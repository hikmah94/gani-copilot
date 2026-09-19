import handler from "vinext/server/fetch-handler";
export { GaniConversationAgent } from "./gani-conversation-agent";

export default {fetch(request:Request,env:Env,ctx:ExecutionContext){return handler.fetch(request,env,ctx);}};
