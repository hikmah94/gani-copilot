export type CivicIntent = "structured_query"|"document_query"|"hybrid_query"|"project_search"|"project_lookup"|"comparison"|"ranking"|"calculation"|"explanation"|"follow_up"|"unsupported";
export type RoutedIntent = { intent:CivicIntent; route:"d1"|"vectorize"|"d1+vectorize"|"ai_context"|"none"; confidence:number };

const has=(value:string,pattern:RegExp)=>pattern.test(value);
export function routeIntent(message:string):RoutedIntent {
  const q=message.toLowerCase().trim();
  if (!q || has(q,/\b(poem|joke|dating|medical diagnosis|password|hack|weapon)\b/)) return {intent:"unsupported",route:"none",confidence:.96};
  if (has(q,/^(and |what about|how about|why |that |those |it |them )/) || q.split(/\s+/).length < 3) return {intent:"follow_up",route:"d1+vectorize",confidence:.72};
  if (has(q,/\b(projects?|contracts?|contractors?|programmes?|programs?)\b/) && has(q,/\b(find|show|list|search|above|below|over|under|in|where|status|lookup|code|located)\b/)) return {intent:"project_search",route:"d1",confidence:.93};
  if (has(q,/\b(compare|comparison|versus|vs\.?|difference|changed|increase|decrease|higher|lower)\b/)) return {intent:"comparison",route:"d1",confidence:.94};
  if (has(q,/\b(top|largest|smallest|highest|lowest|biggest|rank|ranking|most|least)\b/)) return {intent:"ranking",route:"d1",confidence:.91};
  if (has(q,/\b(calculate|percentage|percent|share|ratio|average|minimum|maximum|sum|total of|how much more|how much less)\b/)) return {intent:"calculation",route:"d1",confidence:.9};
  const documentSignal=has(q,/\b(document|citizens budget|pdf|page|source says|according to|objective|policy|initiative|priority|revenue source|mda allocation|sector allocation)\b/);
  const structuredSignal=has(q,/\b(budgets?|amounts?|allocations?|years?|sectors?|mdas?|locations?|capital|recurrent|revenues?|projects?)\b/) || /\b20\d{2}\b/.test(q);
  const hybridSignal=documentSignal&&has(q,/\b(amount|allocation|total|how much|compare|versus|difference|rank|highest|lowest|capital|recurrent)\b/);
  if(hybridSignal&&structuredSignal)return {intent:"hybrid_query",route:"d1+vectorize",confidence:.88};
  if(documentSignal)return {intent:"document_query",route:"vectorize",confidence:.89};
  if(structuredSignal)return {intent:"structured_query",route:"d1",confidence:.86};
  if(has(q,/\b(what is|what does|explain|meaning|understand|how does|why does)\b/))return {intent:"explanation",route:"ai_context",confidence:.84};
  return {intent:"unsupported",route:"none",confidence:.65};
}
