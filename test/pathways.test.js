import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalog, WEEK_NUMBERS } from '../dist/src/domain/content.js';
import { PATHWAYS, prerequisiteIds } from '../dist/src/domain/pathways.js';
import { selectQuestions, optionOrder, grade } from '../dist/src/domain/learning.js';

const data = buildCatalog(await Promise.all(WEEK_NUMBERS.map(n => readFile(new URL(`../dist/content/week-${String(n).padStart(2, '0')}.json`, import.meta.url), 'utf8').then(JSON.parse))));
test('guided pathways resolve to real concepts and prerequisite graph has no cycles', () => {
  assert.equal(new Set(PATHWAYS.map(p => p.id)).size, PATHWAYS.length);
  for (const path of PATHWAYS) {
    assert(path.steps.length >= 4); assert(path.question.length > 10);
    assert.equal(new Set(path.steps).size, path.steps.length);
    for (const id of path.steps) assert(data.objectiveIds.has(id), id);
  }
  function visit(id, trail = new Set()) {
    assert(!trail.has(id), `cycle: ${[...trail, id]}`);
    const next = new Set([...trail, id]);
    for (const before of prerequisiteIds(id, data)) { assert(data.objectiveIds.has(before)); visit(before, next); }
  }
  for (const id of data.objectiveIds) visit(id);
  assert(prerequisiteIds('w12-sql-boundary', data).includes('w11-injection'));
});
test('both exam scopes stay balanced and grading remains stable over 600 seeded selections', () => {
  for (const exam of ['midterm', 'final']) for (const count of [20, 30, 40]) for (let seed = 0; seed < 100; seed++) {
    const selected = selectQuestions(data.questions, { exam, count, seed });
    assert.equal(selected.length, count); assert.equal(new Set(selected.map(q => q.family)).size, count);
    const counts = new Map();
    for (const q of selected) {
      assert.equal(q.exam, exam); counts.set(q.week, (counts.get(q.week) || 0) + 1);
      const order = optionOrder(q, seed);
      assert.deepEqual([...order].sort(), q.options.map(o => o.id).sort());
      assert.equal(order.filter(id => grade(q, id)).length, 1);
    }
    assert.equal(counts.size, exam === 'midterm' ? 7 : 6);
    assert(Math.max(...counts.values()) - Math.min(...counts.values()) <= 1);
  }
});
