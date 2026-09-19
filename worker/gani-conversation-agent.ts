import { Agent } from "agents";
import type { CivicEntities } from "@/lib/entity-extractor";
import type { CivicIntent } from "@/lib/intent-router";

export type ConversationState={conversationId:string;currentGovernment:string;currentYear:number;currentLocation:string|null;currentSector:string|null;currentMda:string|null;currentDocument:string|null;currentProject:string|null;lastIntent:CivicIntent|null;updatedAt:string|null};

export class GaniConversationAgent extends Agent<Env,ConversationState>{
  initialState:ConversationState={conversationId:"",currentGovernment:"niger-state",currentYear:2026,currentLocation:null,currentSector:null,currentMda:null,currentDocument:null,currentProject:null,lastIntent:null,updatedAt:null};

  validateStateChange(next:ConversationState){if(next.conversationId.length>100)throw new Error("Invalid conversation ID");for(const value of [next.currentGovernment,next.currentLocation,next.currentSector,next.currentMda,next.currentDocument,next.currentProject])if(value&&value.length>300)throw new Error("Conversation context value is too long");if(!Number.isInteger(next.currentYear)||next.currentYear<2000||next.currentYear>2100)throw new Error("Invalid conversation year");}

  resolveContext(conversationId:string,explicit:CivicEntities,intent:CivicIntent):{entities:CivicEntities;effectiveIntent:CivicIntent;state:ConversationState}{
    const previous=this.state;const effectiveIntent=intent==="follow_up"&&previous.lastIntent?previous.lastIntent:intent;
    const next:ConversationState={conversationId,currentGovernment:explicit.government??previous.currentGovernment,currentYear:explicit.year??previous.currentYear,currentLocation:explicit.location??explicit.lga??previous.currentLocation,currentSector:explicit.sector??previous.currentSector,currentMda:explicit.mda??previous.currentMda,currentDocument:previous.currentDocument,currentProject:explicit.project??previous.currentProject,lastIntent:intent==="unsupported"?previous.lastIntent:effectiveIntent,updatedAt:new Date().toISOString()};
    this.setState(next);
    const entities:CivicEntities={...explicit,government:explicit.government??next.currentGovernment,year:explicit.year??next.currentYear};if(!entities.location&&next.currentLocation){entities.location=next.currentLocation;entities.lga=next.currentLocation;}if(!entities.sector&&next.currentSector)entities.sector=next.currentSector;if(!entities.mda&&next.currentMda)entities.mda=next.currentMda;if(!entities.project&&next.currentProject)entities.project=next.currentProject;
    return {entities,effectiveIntent,state:next};
  }

  resetContext(conversationId:string):ConversationState{const next={...this.initialState,conversationId,updatedAt:new Date().toISOString()};this.setState(next);return next;}
}
