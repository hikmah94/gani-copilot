import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { buildSearchWhere, normalizeSearchQuery, shouldUseSemanticFallback, searchGroupCounts, buildDirectoryOrder } from '../lib/search-utils.ts';

test('multi-term search matches terms across project and location fields', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE records (title TEXT, location TEXT)');
  db.prepare('INSERT INTO records VALUES (?, ?)').run('General Hospital renovation', 'Bida LGA');
  db.prepare('INSERT INTO records VALUES (?, ?)').run('General Hospital renovation', 'Minna');
  const filter = buildSearchWhere(['title', 'location'], normalizeSearchQuery('Bida hospital'));
  const rows = db.prepare(`SELECT title, location FROM records WHERE ${filter.clause}`).all(...filter.params);
  assert.deepEqual(rows.map(row => ({ title: row.title, location: row.location })), [{ title: 'General Hospital renovation', location: 'Bida LGA' }]);
  db.close();
});

test('literal wildcard characters do not expand partial matches', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE records (title TEXT)');
  db.prepare('INSERT INTO records VALUES (?)').run('Health programme');
  const filter = buildSearchWhere(['title'], normalizeSearchQuery('%'));
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM records WHERE ${filter.clause}`).get(...filter.params).n, 0);
  db.close();
});

test('directory search can surface Bida from a broader Bida hospital query', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE locations (name TEXT)');
  db.prepare('INSERT INTO locations VALUES (?)').run('Bida LGA');
  const filter = buildSearchWhere(['name'], normalizeSearchQuery('Bida hospital'), 'any');
  assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM locations WHERE ${filter.clause}`).get(...filter.params).n, 1);
  db.close();
});

test('exact MDA name sorts ahead of generic names sharing common words', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE mdas (name TEXT)');
  db.prepare('INSERT INTO mdas VALUES (?)').run('Bureau of Statistics');
  db.prepare('INSERT INTO mdas VALUES (?)').run('Ministry of Health');
  const tokens = normalizeSearchQuery('Ministry of Health');
  const filter = buildSearchWhere(['name'], tokens, 'any');
  const order = buildDirectoryOrder('name', 'Ministry of Health');
  const rows = db.prepare(`SELECT name FROM mdas WHERE ${filter.clause} ORDER BY ${order.clause}`).all(...filter.params, ...order.params);
  assert.equal(rows[0].name, 'Ministry of Health');
  db.close();
});

test('semantic fallback runs only when all ordinary categories are empty', () => {
  assert.equal(shouldUseSemanticFallback({ projects: [], documents: [], passages: [], mdas: [], locations: [], sectors: [] }), true);
  assert.equal(shouldUseSemanticFallback({ projects: [], documents: [], passages: [], mdas: [{ id: '1' }], locations: [], sectors: [] }), false);
});

test('group counts preserve each result category', () => {
  const counts = searchGroupCounts({ projects: [1, 2, 3], documents: [1, 2], passages: [], mdas: [], locations: [1], sectors: [] });
  assert.deepEqual(counts, { projects: 3, documents: 2, passages: 0, mdas: 0, locations: 1, sectors: 0 });
});
