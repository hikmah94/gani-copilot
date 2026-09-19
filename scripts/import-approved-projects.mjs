import { writeFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";

const SOURCE_URL="https://nogp.nigerstate.gov.ng/wp-content/uploads/NIGER-STATE-APPROVED-2026-BUDGET.pdf";
const DOCUMENT_ID="niger-state-2026-approved-budget-detailed";
const output=process.argv[2]||"/tmp/gani-2026-projects.sql";

const response=await fetch(SOURCE_URL,{headers:{"user-agent":"GANI-Copilot/1.0 civic-record-indexer"}});
if(!response.ok)throw new Error(`Download failed: ${response.status}`);
const length=Number(response.headers.get("content-length")||0);if(length>50_000_000)throw new Error("Source PDF exceeds 50 MB safety limit");
const bytes=new Uint8Array(await response.arrayBuffer());
if(bytes.length<5||new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("Source is not a PDF");
const pdf=await getDocumentProxy(bytes);if(pdf.numPages>600)throw new Error("PDF exceeds 600-page safety limit");
const extracted=await extractText(pdf,{mergePages:false});

const money=/\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g;
const token=/^(\d{14})\s+-\s+|^(\d{12})\s+([^\n]+)/gm;
const candidates=[];let currentMda={id:"unknown-mda",name:"Unspecified MDA"};
for(let page=343;page<extracted.text.length;page++){
  const text=extracted.text[page];const matches=[...text.matchAll(token)];
  for(let index=0;index<matches.length;index++){
    const match=matches[index];
    if(match[2]){currentMda={id:match[2],name:match[3].trim().replace(/\s+/g," ")};continue;}
    const projectCode=match[1];const end=matches[index+1]?.index??text.length;const block=text.slice((match.index??0)+match[0].length,end);
    const economic=block.match(/\b(23\d{6})\s+-\s+([\s\S]*?)(?=\b70\d{3}\s+-)/);
    const functional=block.match(/\b(70\d{3})\s+-\s+([\s\S]*?)(?=\b126\d{5}\s+-)/);
    const location=block.match(/\b(126\d{5})\s+-\s+([A-Z][A-Z .'-]*?)(?=\s+\d{1,3}(?:,\d{3})*\.\d{2})/);
    const amounts=[...block.matchAll(money)].map(item=>Number(item[0].replaceAll(",","")));
    if(!economic||!functional||!location||amounts.length<4)continue;
    const approved=Math.round(amounts.at(-1));if(!Number.isFinite(approved)||approved<=0)continue;
    const rawTitle=block.slice(0,economic.index).replace(/\s+/g," ").trim().replace(/^[-–—:;,.\s]+/,"");
    if(rawTitle.length<3)continue;
    candidates.push({projectCode,page:page+1,mda:{...currentMda},rawTitle,approved,economicCode:economic[1],economicDescription:economic[2].replace(/\s+/g," ").trim(),functionCode:functional[1],functionDescription:functional[2].replace(/\s+/g," ").trim(),locationCode:location[1],locationName:location[2].replace(/\s+/g," ").trim()});
  }
}

function commonPrefix(rows){if(rows.length<2)return "";const words=rows.map(row=>row.rawTitle.split(" "));let size=0;while(words.every(parts=>parts[size]?.toLowerCase()===words[0][size]?.toLowerCase()))size++;return size>=2?words[0].slice(0,size).join(" "):"";}
const groups=new Map();for(const row of candidates){const key=row.projectCode.slice(0,6);groups.set(key,[...(groups.get(key)||[]),row]);}
for(const rows of groups.values()){const prefix=commonPrefix(rows);for(const row of rows)row.title=(prefix?row.rawTitle.slice(prefix.length):row.rawTitle).replace(/^\s*[-–—:;,.]\s*/,"").trim()||row.rawTitle;}

function sectorFor(row){const value=`${row.title} ${row.economicDescription} ${row.functionDescription} ${row.mda.name}`.toLowerCase();if(/health|hospital|medical|phc|pharmaceutical|nursing/.test(value))return ["health","Health"];if(/education|school|classroom|college|university|polytechnic|library|teaching/.test(value))return ["education","Education"];if(/agric|livestock|fish|irrigation|farm|crop|ranch/.test(value))return ["agriculture","Agriculture"];if(/road|bridge|transport|culvert/.test(value))return ["works-infrastructure","Works and Infrastructure"];if(/water|borehole|wash|dam|sanitation/.test(value))return ["water-resources","Water Resources"];if(/software|computer| ict |digital|information communication|telecom/.test(` ${value} `))return ["ict","Information and Communication Technology"];if(/environment|waste|erosion|flood|climate|green/.test(value))return ["environment","Environment"];if(/housing|residential|urban development/.test(value))return ["housing","Housing"];if(/security|police|emergency|fire|court|judicial|justice/.test(value))return ["security-justice","Security and Justice"];if(/youth|sport|stadium|recreation/.test(value))return ["youth-sports","Youth and Sports"];return ["general-public-services","General Public Services"];}
for(const row of candidates)[row.sectorId,row.sectorName]=sectorFor(row);
const unique=new Map(candidates.map(row=>[row.projectCode,row]));const projects=[...unique.values()];

const q=value=>`'${String(value).replaceAll("'","''")}'`;
const statements=["PRAGMA foreign_keys=ON;",`INSERT INTO documents (id,title,document_type,government_id,year,issuing_authority,r2_key,original_url,processing_status,page_count,indexed_at) VALUES (${q(DOCUMENT_ID)},'Niger State Approved 2026 Budget — Detailed Estimates','approved_budget','niger-state',2026,'Niger State Government','public-records/2026/NIGER-STATE-APPROVED-2026-BUDGET.pdf',${q(SOURCE_URL)},'indexed',${pdf.numPages},CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET r2_key=excluded.r2_key,original_url=excluded.original_url,processing_status='indexed',page_count=excluded.page_count,indexed_at=CURRENT_TIMESTAMP;`];
const sectors=new Map(projects.map(row=>[row.sectorId,row.sectorName]));for(const [id,name] of sectors)statements.push(`INSERT OR IGNORE INTO sectors (id,name,slug,description) VALUES (${q(id)},${q(name)},${q(id)},'Classified from official 2026 approved-budget function and project descriptions');`);
const mdas=new Map(projects.map(row=>[row.mda.id,row.mda.name]));for(const [id,name] of mdas)statements.push(`INSERT INTO mdas (id,name,type,government_id) VALUES (${q(id)},${q(name)},'MDA','niger-state') ON CONFLICT(id) DO UPDATE SET name=excluded.name;`);
const locations=new Map(projects.map(row=>[row.locationCode,row.locationName]));for(const [id,name] of locations)statements.push(`INSERT OR IGNORE INTO locations (id,name,type,state) VALUES (${q(id)},${q(name==='STATE WIDE'?'Statewide':`${name[0]}${name.slice(1).toLowerCase()} LGA`)},${q(name==='STATE WIDE'?'statewide':'LGA')},'Niger State');`);
for(let i=0;i<projects.length;i+=40){const values=projects.slice(i,i+40).map(row=>`(${q(`budget-2026-${row.projectCode}`)},${q(row.projectCode)},${q(row.title.slice(0,500))},${q(row.rawTitle.slice(0,1000))},2026,${q(row.sectorId)},${q(row.mda.id)},${q(row.locationCode)},${row.approved},'Capital','verified',${q(DOCUMENT_ID)},${row.page},${q(`${SOURCE_URL}#page=${row.page}; economic ${row.economicCode}; function ${row.functionCode}; location ${row.locationCode}`)})`).join(",\n");statements.push(`INSERT INTO projects (id,project_code,title,description,budget_year,sector_id,mda_id,location_id,approved_amount,capital_or_recurrent,verification_status,source_document_id,source_page,source_reference) VALUES\n${values}\nON CONFLICT(project_code) DO UPDATE SET title=excluded.title,description=excluded.description,sector_id=excluded.sector_id,mda_id=excluded.mda_id,location_id=excluded.location_id,approved_amount=excluded.approved_amount,verification_status='verified',source_document_id=excluded.source_document_id,source_page=excluded.source_page,source_reference=excluded.source_reference,updated_at=CURRENT_TIMESTAMP;`);}
await writeFile(output,statements.join("\n"));
console.log(JSON.stringify({source:SOURCE_URL,pages:pdf.numPages,projects:projects.length,mdas:mdas.size,locations:locations.size,sectors:sectors.size,approvedTotal:projects.reduce((sum,row)=>sum+row.approved,0),output},null,2));
