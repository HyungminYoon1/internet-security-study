import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateWeek } from '../dist/src/domain/content.js';

const weeks = [12, 13, 14].map(n => JSON.parse(readFileSync(new URL(`../dist/content/week-${n}.json`, import.meta.url), 'utf8')));
const question = id => weeks.flatMap(w => w.questions).find(q => q.id === id);
const objective = id => weeks.flatMap(w => w.objectives).find(o => o.id === id);
const correct = q => q.options.find(o => o.id === q.answerId);

test('PR4-01: q032 supplies its own complete SMTP AND conditions', () => {
  const q = question('w13-q032');
  const stem = `${q.context ?? ''} ${q.prompt}`;
  for (const condition of [/같은 출발지|동일 출발지/, /고정 1분/, /20건 이상/, /고유 목적지 2곳 이상/, /모두|AND/]) assert.match(stem, condition);
  const matches = (count, destinations) => count >= 20 && destinations >= 2;
  assert.equal(matches(100, 1), false);
  assert.equal(matches(20, 2), true);
  assert.match(correct(q).text, /미충족|발동하지/);
  assert.match(q.explanation, /목적지 2곳 이상/);
});

test('PR4-02: incident teaching includes imminent jeopardy and policy violations without declaring every event an incident', () => {
  const o = objective('w14-incident-team');
  const teaching = o.explanation.join('\n');
  assert.match(teaching, /임박/);
  assert.match(teaching, /정책.*절차.*허용.*사용/);
  assert.match(teaching, /모든.*이벤트.*사고.*아니/);
  assert.match(teaching, /NIST/);
  const correction = weeks[2].corrections.find(c => c.id === 'w14-correction-01');
  assert.match(correction.corrected, /임박/);
  assert.match(correction.corrected, /정책/);
  assert(correction.references.some(r => r.url.includes('nist.gov')));
});

test('PR4-04: fixed and moving half-open windows produce the taught boundary counterexample', () => {
  const events = [...Array(19).fill(59), 60]; // seconds since 12:00:00
  const count = (start, end) => events.filter(t => start <= t && t < end).length;
  assert.deepEqual([count(0, 60), count(60, 120), count(1, 61)], [19, 1, 20]);
  assert.equal([1, 61].filter(t => 1 <= t && t < 61).length, 1, 'start included, end excluded');
  const o = objective('w13-rule-design');
  const teaching = JSON.stringify([o.explanation, o.workedExample]);
  for (const value of ['12:00:59', '12:01:00', '12:00:01', '12:01:01', '시작 포함', '끝 제외']) assert(teaching.includes(value), value);
  const q = question('w13-q034');
  const stem = `${q.context ?? ''} ${q.prompt}`;
  for (const value of ['12:00:59', '12:01:00', '12:00:01', '12:01:01', '시작 포함', '끝 제외']) assert(stem.includes(value), value);
  assert.match(correct(q).text, /고정.*미충족.*이동.*충족/);
  assert.match(q.explanation, /19건.*1건.*20건/);
});

test('PR4-03: no cosmetic or unrelated physical-display distractors remain', () => {
  const cosmetic = /글꼴|폰트|배경색|바탕화면 색|화면 밝기|모니터 제조사|케이블의 색|장비의 색상|모니터의 가로|큰 글씨|대문자 수|제목의 글자 수|이름의 글자색/;
  for (const w of weeks) for (const q of w.questions) for (const option of q.options) assert.doesNotMatch(option.text, cosmetic, `${q.id}/${option.id}`);
  const q = weeks[2].retiredQuestions.find(q=>q.id==='w14-q016');
  for (const option of q.options) assert.deepEqual(option.text.split('→').sort(), ['관심', '경계', '심각', '주의'].sort());
});

test('part4 retains counts, stable IDs/families, four distinct options, source pages and validator integrity', () => {
  // Captured from the accepted pre-revision content, not recomputed by the generator.
  const identity = weeks.flatMap(w => w.questions.map(q => (w.retiredQuestions??[]).find(old=>old.supersededBy===q.id)??q).map(q => [q.id, q.objectiveId, q.family, q.answerId]));
  assert.equal(createHash('sha256').update(JSON.stringify(identity)).digest('hex'), '524fc7948034c96c64ba334db5787614ab0f1a0a2e98844153e382def2561570');
  for (const [i, w] of weeks.entries()) {
    validateWeek(w);
    assert.equal(w.questions.length, [55, 50, 45][i]);
    assert.equal(w.objectives.length, [11, 10, 9][i]);
    assert.equal(w.corrections.length, [12, 10, 11][i]);
    assert.equal(new Set(w.coverage.flatMap(c => c.pages)).size, [19, 19, 18][i]);
    assert.equal(new Set(w.questions.map(q => q.family)).size, w.questions.length);
    w.questions.forEach((q, j) => {
      const originalId=`w${w.number}-q${String(j + 1).padStart(3, '0')}`;
      assert.equal(q.id.replace(/-r2$/,''), originalId);
      if(q.id.endsWith('-r2'))assert(w.retiredQuestions.some(old=>old.id===originalId&&old.supersededBy===q.id));
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map(o => o.text)).size, 4);
      assert.equal(q.options.filter(o => o.id === q.answerId).length, 1);
    });
  }
});

test('new teaching claims retain visited primary references in their relevant corrections', () => {
  const cases = [
    [12, 'w12-correction-07', 'cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html'],
    [13, 'w13-correction-07', 'beam.apache.org/documentation/programming-guide/#windowing'],
    [14, 'w14-correction-01', 'nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r3.pdf'],
    [14, 'w14-correction-05', 'learn.microsoft.com/en-us/windows-server/administration/windows-commands/netstat'],
  ];
  for (const [number, id, url] of cases) {
    const week = weeks.find(w => w.number === number);
    assert(week.corrections.find(c => c.id === id).references.some(r => r.url === `https://${url}`), id);
    assert(week.references.some(r => r.url === `https://${url}`), id);
  }
});
