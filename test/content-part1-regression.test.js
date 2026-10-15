import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateWeek } from '../dist/src/domain/content.js';

const weeks = [1, 2, 3, 4].map(n => JSON.parse(readFileSync(new URL(
  `../dist/content/week-${String(n).padStart(2, '0')}.json`, import.meta.url), 'utf8')));
const questions = new Map(weeks.flatMap(w => w.questions.map(q => [q.id, q])));
const wrong = q => q.options.filter(o => o.id !== q.answerId);
const keyed = id => {
  const q = questions.get(id);
  return q.options.find(o => o.id === q.answerId).text;
};

test('part1 retains 190 distinct questions, valid objective/correction links and 97 source pages', () => {
  assert.deepEqual(weeks.map(w => w.questions.length), [35, 65, 50, 40]);
  assert.equal(questions.size, 190);
  assert.equal(weeks.reduce((sum, w) => sum + w.source.pages, 0), 97);
  for (const w of weeks) {
    validateWeek(w);
    for (const o of w.objectives) {
      assert(w.questions.filter(q => q.objectiveId === o.id).length >= 3, o.id);
      assert(o.correctionIds.every(id => w.corrections.some(c => c.id === id)), o.id);
    }
  }
});

test('part1 distractors do not substitute unrelated display, typography or unit jokes for misconceptions', () => {
  const unrelated = /글꼴|배경색|화면 픽셀|화면 압축|종이 색상|아이콘의 색상|키 이름의 발음|문서의 페이지 수|문서 파일명 길이|CPU 속도가 두 배|권한 숫자는 디스크 용량/;
  const defects = [...questions.values()].flatMap(q => wrong(q)
    .filter(o => unrelated.test(o.text)).map(o => `${q.id}/${o.id}: ${o.text}`));
  assert.deepEqual(defects, [], 'each wrong option must be a plausible confusion in the tested concept');
});

test('w02-q057 alternatives all concern encryption-key rotation and retained-document recovery', () => {
  const q = questions.get('w02-q057');
  const outOfScope = wrong(q).filter(o => !/키|복호|재암호|암호문|보관/.test(o.text));
  assert.deepEqual(outOfScope.map(o => o.id), [], 'font, ARPANET and domain length cannot diagnose key-rotation understanding');
  assert.match(keyed(q.id), /복구|이전 키/);
});

test('w02-q065 CPS alternatives compare certification policies and practices, not invented hardware acronyms', () => {
  const q = questions.get('w02-q065');
  assert.match(keyed(q.id), /Certification Practice Statement/);
  assert(wrong(q).every(o => /인증|정책|발급|관행|운영|Certification|Certificate/.test(o.text)),
    'CPS alternatives must stay within PKI policy/practice concepts');
});

test('corrected cryptographic facts remain keyed after distractor replacement', () => {
  assert.match(keyed('w02-q003'), /^C$/);
  assert.match(keyed('w02-q004'), /서로소/);
  assert.match(keyed('w02-q012'), /10개/);
  assert.match(keyed('w02-q026'), /56비트/);
  assert.match(keyed('w02-q027'), /16라운드.*64비트/);
  assert.match(keyed('w02-q031'), /128.*192.*256/);
  assert.match(keyed('w02-q032'), /128비트.*12라운드/);
  assert.match(keyed('w02-q044'), /64/);
  assert.match(keyed('w02-q046'), /서명자의 개인키/);
  assert.match(keyed('w02-q047'), /민수의 공개키/);
  assert.match(keyed('w04-q021'), /기밀성/);
  assert.match(keyed('w04-q031'), /16라운드/);
});

test('w04 IKE teaching separates the first Child SA and IKEv2 local lifetime policies', () => {
  const objective = weeks[3].objectives.find(o => o.id === 'w04-ike');
  assert.doesNotMatch(objective.why, /키 수명에 합의/,
    'the introductory rationale must not reintroduce mandatory matching IKEv2 lifetimes');
  const prose = objective.explanation.join(' ');
  assert.match(prose, /IKE_AUTH[^.]*첫[^.]*CHILD_SA/,
    'the first Child SA is normally established in IKE_AUTH, not only in a later CREATE_CHILD_SA');
  assert.match(prose, /IKEv2[^.]*수명[^.]*각자/,
    'IKEv2 does not negotiate matching SA lifetimes; each endpoint applies its own policy');
});
