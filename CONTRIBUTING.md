# Contributing to GANI Copilot

GANI welcomes contributions that make public information easier to find, understand, verify, and act on while respecting local context and citizen safety.

## Before contributing

1. Open an issue describing the civic need, intended users, jurisdiction, and source records.
2. Explain how the change preserves the distinction between official records, AI interpretation, and community observations.
3. Do not add scraped personal data, allegations, confidential records, credentials, or copyrighted material without a clear right to use it.

## Development workflow

```bash
npm install
cp .env.example .dev.vars
node --test tests/*.test.mjs
npm run build:vinext
```

Use a feature branch and include tests for changes to calculations, retrieval boundaries, moderation, entity resolution, or evidence presentation. Keep authoritative arithmetic in code and database queries rather than prompts.

## Adding a new jurisdiction

- Preserve the original issuing authority and document URL.
- Record publication and indexing dates when known.
- Define local aliases for ministries, sectors, locations, and expenditure terminology.
- Validate parsed totals against the source document before publishing them.
- Involve local civic organisations and language speakers in terminology, risk, and usability review.

## Pull-request checklist

- [ ] The change is supported by a test or a documented manual verification.
- [ ] No secret, personal information, generated build output, or private dataset is included.
- [ ] New factual claims include provenance.
- [ ] Accessibility and low-bandwidth behaviour were considered.
- [ ] Documentation states limitations without marketing unsupported capabilities.
