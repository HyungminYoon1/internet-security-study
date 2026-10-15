import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateWeek } from '../dist/src/domain/content.js';

const weeks = await Promise.all([9, 10, 11].map(n => readFile(new URL(`../dist/content/week-${String(n).padStart(2, '0')}.json`, import.meta.url), 'utf8').then(JSON.parse)));
const objective = id => weeks.flatMap(w => w.objectives).find(o => o.id === id);
const question = id => weeks.flatMap(w => w.questions).find(q => q.id === id);
const keyed = q => q.options.find(o => o.id === q.answerId);

test('WEP teaches same-secret-key AND same-IV reuse, a worked relation, and the key-recovery limit', () => {
  const o = objective('w10-wep');
  const teaching = o.explanation.join('\n');
  assert.match(teaching, /같은 비밀키.{0,25}같은 IV|같은 IV.{0,25}같은 비밀키/);
  assert.match(teaching, /C1.*C2.*P1.*P2/);
  assert.match(teaching, /비밀키.{0,30}(즉시|자동).{0,30}(아니|않|못)/);
  assert.match(JSON.stringify(o.workedExample), /같은.*IV/);
  assert.match(JSON.stringify(o.workedExample), /다른.*(키|IV)/);
});

test('the WEP reuse question distinguishes same IV under a different key and different IV under the same key', () => {
  const q = question('w10-q029');
  assert.match(q.context ?? '', /A \| K1 \| 01/);
  assert.match(q.context ?? '', /B \| K1 \| 01/);
  assert.match(q.context ?? '', /C \| K2 \| 01/);
  assert.match(q.context ?? '', /D \| K1 \| 02/);
  assert.match(keyed(q).text, /A와 B/);
  assert(q.options.some(o => /A와 C/.test(o.text)));
  assert(q.options.some(o => /A와 D/.test(o.text)));
  assert.match(q.explanation, /비밀키.*(복구|획득).*(아니|않|못)/);
});

test('LM explains byte units, separate halves, uppercase and non-secret DES parity rather than an extra password byte', () => {
  const o = objective('w09-password-storage');
  const teaching = o.explanation.join('\n');
  assert.match(teaching, /대문자/);
  assert.match(teaching, /7바이트/);
  assert.match(teaching, /각각|독립/);
  assert.match(teaching, /패리티/);
  assert.match(teaching, /56비트/);
  assert.match(teaching, /추가 비밀번호.{0,15}(아니|않)/);
  assert.match(JSON.stringify(o.workedExample), /패리티/);
  const correction = weeks[0].corrections.find(c => c.id === 'w09-lm-history');
  assert.match(correction.corrected, /패리티/);
  assert(correction.references.some(r => /openspecs/.test(r.url)));
});

test('LM parity question does not count parity as a secret byte or entropy', () => {
  const q = question('w09-q041');
  assert.match(q.prompt, /패리티|7바이트/);
  assert.match(keyed(q).text, /패리티/);
  assert.match(keyed(q).explanation, /56/);
  assert(q.options.some(o => o.id !== q.answerId && /추가 비밀번호/.test(o.text)));
});

test('HTTP replacement exercise distinguishes PUT from POST, OPTIONS and DELETE without implying authorization', () => {
  const q = question('w11-q003');
  assert.match(q.prompt, /지정|알고 있/);
  assert.match(keyed(q).text, /PUT/);
  assert(q.options.some(o => /POST/.test(o.text)));
  assert(q.options.some(o => /OPTIONS/.test(o.text)));
  assert(q.options.some(o => /DELETE/.test(o.text)));
  assert.match(q.explanation, /인가|권한/);
});

test('Part 3 keeps its allocation and excludes unrelated appearance distractors across all options', () => {
  assert.deepEqual(weeks.map(w => w.questions.length), [60, 35, 45]);
  const irrelevant = /배경색|글꼴|글자색|화면.{0,4}색상|버튼.{0,4}색상|아이콘|키보드 배열|가장 긴 파일|제목.{0,5}길이|이름.{0,5}길[어이]|철자 수|줄 높이|메뉴 표시 순서/;
  for (const w of weeks) {
    validateWeek(w);
    for (const q of w.questions) {
      for (const o of q.options) assert.doesNotMatch(o.text, irrelevant, `${q.id}: unrelated option`);
      assert.equal(q.options.filter(o => o.id === q.answerId).length, 1);
    }
  }
});
