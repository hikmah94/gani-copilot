import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDocumentQuestion, validateDocumentPassages, parseDocumentAnswer, documentEvidenceItems } from '../lib/document-rag.ts';

test('normalizes whitespace without changing the question meaning', () => {
  assert.equal(normalizeDocumentQuestion('  How much\n is   allocated to health?  '), 'How much is allocated to health?');
});

test('rejects vector and database passages from another document', () => {
  const matches = [
    { id: 'a', metadata: { document_id: 'doc-1' }, score: .9 },
    { id: 'b', metadata: { document_id: 'doc-2' }, score: .8 },
    { id: 'c', metadata: { document_id: 'doc-1' }, score: .7 },
  ];
  const rows = [
    { id: 'a', document_id: 'doc-1', page: 3, text: 'Health allocation is shown here.' },
    { id: 'b', document_id: 'doc-2', page: 4, text: 'Unrelated record.' },
    { id: 'c', document_id: 'doc-2', page: 5, text: 'Wrong database owner.' },
  ];
  assert.deepEqual(validateDocumentPassages(matches, rows, 'doc-1').map(x => x.id), ['a']);
});

test('structured answer references only validated passage IDs', () => {
  const raw = JSON.stringify({ answer: 'Health receives ₦10m.', summary: 'Health allocation', facts: ['₦10m'], limitations: [], source_ids: ['a', 'forged'] });
  const result = parseDocumentAnswer(raw, [{ id: 'a', page: 3, text: 'Health receives ₦10m.' }], 'doc-1', 'Budget');
  assert.equal(result.answer, 'Health receives ₦10m.');
  assert.deepEqual(result.sources.map(x => x.chunk_id), ['a']);
  assert.deepEqual(result.calculations, []);
  assert.deepEqual(result.projects, []);
});

test('unparseable model output never becomes an authoritative answer', () => {
  assert.throws(() => parseDocumentAnswer('Health receives ₦10m.', [{ id: 'a', page: 3, text: 'Health receives ₦10m.' }], 'doc-1', 'Budget'), /structured/i);
});

test('evidence items link to the validated document record and page', () => {
  const items = documentEvidenceItems([{ chunk_id: 'a', page: 3, snippet: 'Health receives ₦10m.', documentTitle: 'Budget', href: '/documents/doc-1' }]);
  assert.equal(items[0].href, '/documents/doc-1');
  assert.equal(items[0].page, 3);
  assert.equal(items[0].passage, 'Health receives ₦10m.');
});
