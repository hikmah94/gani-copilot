import { env } from "cloudflare:workers";
import { isAdmin } from "@/lib/admin-auth";
import { documentVectorMetadata } from "@/lib/document-vector-search";

type InputChunk={id:string;page:number;index:number;content:string};
export async function POST(request:Request){
  if(!(await isAdmin(request)))return Response.json({error:"Unauthorized"},{status:401});
  const body=await request.json() as {documentId?:string;chunks?:InputChunk[];offset?:number};
  if(!body.documentId)return Response.json({error:"A document is required."},{status:400});
  const doc=await env.DB.prepare("SELECT id FROM documents WHERE id=?1").bind(body.documentId).first();
  if(!doc)return Response.json({error:"Document not found."},{status:404});
  const offset=body.offset??0;
  if(!Number.isSafeInteger(offset)||offset<0)return Response.json({error:"Invalid offset."},{status:400});
  let chunks:InputChunk[];
  if(body.chunks){
    if(!Array.isArray(body.chunks)||body.chunks.length<1||body.chunks.length>100)return Response.json({error:"Provide 1–100 document chunks."},{status:400});
    chunks=body.chunks.filter(c=>c.id&&Number.isInteger(c.page)&&c.content.trim().length>10);
    if(chunks.length!==body.chunks.length)return Response.json({error:"One or more chunks are invalid."},{status:400});
  }else{
    const rows=await env.DB.prepare("SELECT id,page,chunk_index,text FROM document_chunks WHERE document_id=?1 ORDER BY page,chunk_index LIMIT 20 OFFSET ?2").bind(body.documentId,offset).all<{id:string;page:number;chunk_index:number;text:string}>();
    chunks=(rows.results??[]).map(row=>({id:row.id,page:row.page,index:row.chunk_index,content:row.text}));
    if(!chunks.length)return Response.json({ok:true,indexed:0,nextOffset:null});
  }
  const embed=await env.AI.run("@cf/baai/bge-base-en-v1.5",{text:chunks.map(c=>c.content)}) as {data:number[][]};
  if(!embed.data||embed.data.length!==chunks.length)return Response.json({error:"Embedding generation failed."},{status:503});
  const statement=env.DB.prepare("INSERT INTO document_chunks (id,document_id,page,chunk_index,text,char_count) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET text=excluded.text,char_count=excluded.char_count");
  if(body.chunks)await env.DB.batch(chunks.map(c=>statement.bind(c.id,body.documentId!,c.page,c.index,c.content,c.content.length)));
  await env.VECTORIZE.upsert(chunks.map((c,i)=>({id:c.id,values:embed.data[i],namespace:"niger-state",metadata:documentVectorMetadata(body.documentId!,c.page)})));
  await env.DB.batch([
    env.DB.prepare("UPDATE documents SET indexed_at=CURRENT_TIMESTAMP,processing_status='indexed' WHERE id=?1").bind(body.documentId),
    env.DB.prepare("INSERT INTO admin_logs (id,event_type,actor,summary,status) VALUES (?1,'document_index','administrator',?2,'success')").bind(crypto.randomUUID(),`Indexed ${chunks.length} chunks for ${body.documentId}`),
  ]);
  return Response.json({ok:true,indexed:chunks.length,nextOffset:body.chunks?null:offset+chunks.length});
}
