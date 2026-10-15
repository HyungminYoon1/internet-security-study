import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalog, validateWeek, WEEK_NUMBERS } from '../dist/src/domain/content.js';

const weeks = await Promise.all(WEEK_NUMBERS.map(n => readFile(new URL(`../dist/content/week-${String(n).padStart(2, '0')}.json`, import.meta.url), 'utf8').then(JSON.parse)));
const catalog = buildCatalog(weeks);
test('all 13 source documents and 315 pages are accounted for', () => {
  assert.equal(weeks.length, 13);
  assert.equal(weeks.reduce((n, w) => n + w.source.pages, 0), 315);
  assert(catalog.questions.length >= 600);
  assert(catalog.questions.filter(q => q.exam === 'midterm').length >= 330);
  assert(catalog.questions.filter(q => q.exam === 'final').length >= 270);
  for (const w of weeks) {
    assert.equal(new Set(w.coverage.flatMap(c => c.pages)).size, w.source.pages);
    assert(w.objectives.length >= 4, `${w.id}: substantive learning objectives`);
  }
});
for (const week of weeks) test(`${week.id}: complete explanations, source links and unambiguous keyed questions`, () => validateWeek(week));
test('question stems are distinct, answer keys survive permutations and each objective is exercised', () => {
  const stems = catalog.questions.map(q => `${q.context ?? ''} ${q.prompt}`.replace(/\s/g, ''));
  assert.equal(new Set(stems).size, stems.length, 'duplicate problem stems');
  for (const objective of catalog.objectives) assert(catalog.questions.filter(q => q.objectiveId === objective.id).length >= 3, objective.id);
});
test('unknown sources, broken options, zero-page references and missing coverage fail closed', () => {
  const original = weeks[0];
  const mutations = [
    w => { w.questions[0].answerId = 'missing'; },
    w => { w.questions[0].options[0].text = w.questions[0].options[1].text; },
    w => { w.questions[0].sourcePages = [0]; },
    w => { w.coverage = []; },
    w => { w.objectives[0].workedExample.steps = []; },
    w => { w.objectives[0].explanation = ['암기하세요']; },
    w => { w.references = [{ title: 'unsafe', url: 'javascript:alert(1)' }]; },
  ];
  for (const mutate of mutations) { const w = structuredClone(original); mutate(w); assert.throws(() => validateWeek(w)); }
});
