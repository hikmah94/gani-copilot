# Architecture and request flows

## Principles

1. Structured records answer structured questions.
2. Retrieved document passages answer document questions.
3. Software performs authoritative financial arithmetic.
4. The model receives controlled tools, never unrestricted database access.
5. Every material answer either carries evidence or states that adequate evidence is unavailable.

## Structured query flow

```text
Question → intent and entity extraction → alias resolution → approved tool
         → prepared D1 query → programmatic calculation → AI explanation
         → structured response → evidence UI
```

Controlled tools cover project search, aggregation, comparisons, rankings, sector/location summaries, document retrieval, evidence, pages, and civic terminology. Parameters are validated and query scope is bounded.

## Document RAG flow

```text
Question → normalization → Workers AI embedding → Vectorize query
         → document_id filter → D1 metadata validation → optional reranking
         → Workers AI → structured answer → cited evidence passages
```

The D1 validation step rejects a vector match whose stored chunk does not belong to the selected document. If no valid passage survives, the API returns an unavailable-evidence response.

## Conversation flow

Cloudflare Agents SDK and Durable Objects maintain explicit conversational filters such as government, year, LGA, sector, document, and project. Follow-up messages inherit these filters while the tool layer remains authoritative.

## Public feedback flow

```text
Citizen observation → validation and rate limit → optional R2 photo
                    → pending D1 report → administrator moderation
                    → approved-only public display
```

Community reports never update `projects.official_status`. Public counts use approved rows only.

## Deployment

The application is compiled with vinext and deployed as a Cloudflare Worker. Binding configuration is defined in `wrangler.jsonc`; secrets are injected through the platform and not committed.
