import test from 'node:test';
import assert from 'node:assert/strict';
import { scopedDocumentMatches, documentVectorMetadata } from '../lib/document-vector-search.ts';

test('Vectorize query is filtered to the current document', async () => {
  let options;
  const vectorize = { query: async (_vector, input) => { options = input; return { matches: [{ id: 'same' }, { id: 'other' }] }; } };
  const rows = await scopedDocumentMatches(vectorize, [0.1], 'doc-1');
  assert.deepEqual(options.filter, { document_id: 'doc-1' });
  assert.equal(options.returnMetadata, 'indexed');
  assert.deepEqual(rows.map((row) => row.id), ['same', 'other']);
});

test('rejects missing document id rather than searching broadly', async () => {
  const vectorize = { query: async () => { throw new Error('should not query'); } };
  await assert.rejects(scopedDocumentMatches(vectorize, [0.1], ''), /document/i);
});

test('indexed vectors carry the exact filter field', () => {
  assert.deepEqual(documentVectorMetadata('doc-1', 7), { document_id: 'doc-1', page: 7 });
});
