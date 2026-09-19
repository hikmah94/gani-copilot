import { env } from "cloudflare:workers";
import type { CivicIntent } from "@/lib/intent-router";

export type CivicEntities={
  year?:number; government?:string; state?:string; senatorial_zone?:string; lga?:string; location?:string;
  sector?:string; mda?:string; project?:string; minimum_amount?:number; maximum_amount?:number;
  expenditure_type?:"Capital"|"Recurrent"; status?:string;
};

type AliasRow={alias:string;entity_type:keyof CivicEntities;canonical_value:string};

const NIGER_LGAS=["Agaie","Agwara","Bida","Borgu","Bosso","Chanchaga","Edati","Gbako","Gurara","Katcha","Kontagora","Lapai","Lavun","Magama","Mariga","Mashegu","Mokwa","Munya","Paikoro","Rafi","Rijau","Shiroro","Suleja","Tafa","Wushishi"];
const COMMON_SECTORS=["Agriculture","Education","Health","Infrastructure","Security","Water","Environment","Transport","Housing","Commerce","Youth","Sports"];

function amountValue(raw:string,unit?:string){const number=Number(raw.replaceAll(",",""));const multiplier=unit?.toLowerCase().startsWith("tr")?1e12:unit?.toLowerCase().startsWith("b")?1e9:unit?.toLowerCase().startsWith("m")?1e6:unit?.toLowerCase().startsWith("k")?1e3:1;return Number.isFinite(number)?Math.round(number*multiplier):undefined}
function namedMatch(message:string,names:string[]){return names.filter(Boolean).sort((a,b)=>b.length-a.length).find(name=>new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"i").test(message));}
function normalizeTerminology(value:string){return value.normalize("NFKD").replace(/[’']/g,"").replace(/&/g," and ").replace(/[^\p{L}\p{N}]+/gu," ").trim().toLocaleLowerCase("en-NG").replace(/\s+/g," ");}
function containsAlias(message:string,alias:string){const haystack=` ${normalizeTerminology(message)} `;const needle=normalizeTerminology(alias);return Boolean(needle)&&haystack.includes(` ${needle} `);}
function applyAliases(message:string,rows:AliasRow[],entities:CivicEntities){
  for(const row of [...rows].sort((a,b)=>b.alias.length-a.alias.length)){
    if(!containsAlias(message,row.alias))continue;
    switch(row.entity_type){
      case "government":entities.government=row.canonical_value;break;
      case "state":entities.state=row.canonical_value;break;
      case "senatorial_zone":entities.senatorial_zone=row.canonical_value;break;
      case "lga":entities.lga=row.canonical_value;entities.location=row.canonical_value;break;
      case "sector":entities.sector=row.canonical_value;break;
      case "mda":entities.mda=row.canonical_value;break;
      case "project":entities.project=row.canonical_value;break;
      case "expenditure_type":if(row.canonical_value==="Capital"||row.canonical_value==="Recurrent")entities.expenditure_type=row.canonical_value;break;
      case "status":entities.status=row.canonical_value;break;
    }
  }
}

export async function extractEntities(message:string,intent:CivicIntent):Promise<CivicEntities>{
  const entities:CivicEntities={};
  const year=message.match(/\b(20\d{2}|19\d{2})\b/);if(year)entities.year=Number(year[1]);
  if(/\bniger state(?: government)?\b/i.test(message)){entities.government="Niger State Government";entities.state="Niger";}
  const zone=message.match(/\bniger\s+(north|south|east)\s+senatorial(?:\s+zone)?\b/i);if(zone)entities.senatorial_zone=`Niger ${zone[1][0].toUpperCase()}${zone[1].slice(1).toLowerCase()}`;
  const range=message.match(/(?:between|from)\s*(?:₦|ngn|n)?\s*([\d,.]+)\s*(thousand|million|billion|trillion|k|m|bn|tn)?\s*(?:and|to|-)\s*(?:₦|ngn|n)?\s*([\d,.]+)\s*(thousand|million|billion|trillion|k|m|bn|tn)?/i);
  if(range){entities.minimum_amount=amountValue(range[1],range[2]||range[4]);entities.maximum_amount=amountValue(range[3],range[4]||range[2]);}
  else {const threshold=message.match(/\b(above|over|more than|at least|minimum|below|under|less than|at most|maximum)\s*(?:of\s*)?(?:₦|ngn|n)?\s*([\d,.]+)\s*(thousand|million|billion|trillion|k|m|bn|tn)?/i);if(threshold){const value=amountValue(threshold[2],threshold[3]);if(value!==undefined){if(/above|over|more than|at least|minimum/i.test(threshold[1]))entities.minimum_amount=value;else entities.maximum_amount=value;}}}
  if(/\bcapital(?: expenditure| spending| projects?)?\b/i.test(message))entities.expenditure_type="Capital";
  else if(/\brecurrent(?: expenditure| spending| projects?)?\b/i.test(message))entities.expenditure_type="Recurrent";
  const status=message.match(/\b(completed|ongoing|not started|abandoned|delayed|verified|unverified|approved|pending)\b/i);if(status)entities.status=status[1].toLowerCase();
  const [locations,sectors,mdas,aliases]=await env.DB.batch([env.DB.prepare("SELECT name,type,senatorial_zone FROM locations LIMIT 200"),env.DB.prepare("SELECT name FROM sectors LIMIT 100"),env.DB.prepare("SELECT name FROM mdas LIMIT 200"),env.DB.prepare("SELECT alias,entity_type,canonical_value FROM entity_aliases WHERE active=1 LIMIT 500")]);
  const locationRows=locations.results as {name:string;type:string;senatorial_zone:string|null}[];
  const lga=namedMatch(message,[...locationRows.filter(row=>/lga|local/i.test(row.type)).map(row=>row.name),...NIGER_LGAS]);if(lga){entities.lga=lga.toLowerCase();entities.location=lga.toLowerCase();}
  const sector=namedMatch(message,[...(sectors.results as {name:string}[]).map(row=>row.name),...COMMON_SECTORS]);if(sector)entities.sector=sector.toLowerCase();
  const mda=namedMatch(message,(mdas.results as {name:string}[]).map(row=>row.name));if(mda)entities.mda=mda;
  if(!entities.senatorial_zone&&lga){const row=locationRows.find(item=>item.name.toLowerCase()===lga.toLowerCase());if(row?.senatorial_zone)entities.senatorial_zone=row.senatorial_zone;}
  const quoted=message.match(/[“"]([^”"]{4,120})[”"]/);if(quoted&&/project/i.test(message))entities.project=quoted[1];
  else if(intent==="project_lookup"){const code=message.match(/\bproject\s+(?:code\s+)?([A-Z0-9][A-Z0-9/_-]{2,})\b/i);if(code)entities.project=code[1];}
  applyAliases(message,aliases.results as AliasRow[],entities);
  return entities;
}
