import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WEEK_NUMBERS, buildCatalog, validateWeek } from '../dist/src/domain/content.js';
import { correctionReview, filterCorrections, objectiveCorrections } from '../dist/src/domain/corrections.js';

const catalog = buildCatalog(await Promise.all(WEEK_NUMBERS.map(n => readFile(new URL(
  `../dist/content/week-${String(n).padStart(2, '0')}.json`, import.meta.url), 'utf8').then(JSON.parse))));
const examples = [
  ['w02-correction-11', /수신자 공개키/, /서명자|서명 생성/],
  ['w02-correction-10', /1:1|일대일/, /충돌/],
  ['w04-correction-06', /9번|9회/, /16/],
  ['w11-post-security', /헤더/, /본문|요청 내용/],
  ['w12-correction-02', /GROUP BY/, /암시적|하나의.*그룹|단일.*그룹/],
  ['w14-correction-08', /생성/, /상태 변경/],
];

test('six source conflicts retain the handout explanation and the specific correction rationale', () => {
  for (const [id, handout, reason] of examples) {
    const c = catalog.corrections.find(c => c.id === id);
    assert.equal(typeof c.handoutExplanation, 'string', `${id}: the original explanation needs an explicit labelled summary`);
    assert.match(c.handoutExplanation, handout, id);
    assert.match(c.verificationReason, reason, id);
    assert(c.references.length > 0, `${id}: primary evidence remains linked`);
  }
});

test('incomplete or nontextual comparison metadata is rejected before content is shown', () => {
  for (const patch of [{ handoutExplanation: '설명은 존재하지만 근거가 누락되었습니다.' },
    { handoutExplanation: {}, verificationReason: '잘못된 입력 형식은 허용하지 않습니다.' },
    { handoutExplanation: '충분한 길이의 교안 설명입니다.', verificationReason: '' }]) {
    const week = structuredClone(catalog.weeks[0]);
    Object.assign(week.corrections[0], patch);
    assert.throws(() => validateWeek(week), /설명 길이/, 'comparison metadata must be validated as a pair');
  }
});

test('all 149 comparisons retain both explanations, evidence and the distinction from the actual exam key', () => {
  assert.equal(catalog.corrections.length, 149);
  for (const c of catalog.corrections) {
    const review = correctionReview(c);
    assert(review.handoutExplanation.length >= 10, c.id);
    assert.equal(review.explanation, c.corrected);
    assert(review.verificationReason.length >= 10, c.id);
    assert.match(review.examExplanation, /실제 시험/);
    assert.match(review.examExplanation, /미확인/);
    assert(!/승인|확정된 정답/.test(review.examExplanation), 'no instructor answer was supplied');
  }
});

test('technical corrections and app exclusions require confirmation; context is conditional rather than an error claim', () => {
  const pending = filterCorrections(catalog.corrections, { status: 'pending' });
  assert.equal(pending.length, 81);
  assert(pending.every(c => c.status !== 'contextualized'));
  for (const c of catalog.corrections.filter(c => c.status === 'excluded')) {
    const review = correctionReview(c);
    assert.match(review.examExplanation, /실제 시험에서도 제외되는지/);
    assert.match(review.verificationReason, /입증하는 근거는 아닙니다/);
  }
  const oldBoot = catalog.corrections.find(c => c.id === 'w03-correction-03');
  assert.equal(correctionReview(oldBoot).examReview, 'conditional');
  assert.match(correctionReview(oldBoot).examExplanation, /문항에 조건이 없거나/);
  assert.throws(() => correctionReview({ status: 'instructor-approved' }), /정정 상태/);
});

test('comparison search combines week, evidence type and normalized terms without mutating curriculum', () => {
  const before = JSON.stringify(catalog.corrections);
  assert(filterCorrections(catalog.corrections, { week: '4', search: 'ｄｅｓ １６', status: 'pending' }).some(c => c.id === 'w04-correction-06'));
  assert.deepEqual(filterCorrections(catalog.corrections, { week: '12', search: 'GROUP BY 암시적' }).map(c => c.id), ['w12-correction-02']);
  assert.deepEqual(filterCorrections(catalog.corrections, { week: '3', search: '수신자 공개키' }), []);
  assert.equal(filterCorrections(catalog.corrections, { search: '  ' }).length, 149);
  assert.deepEqual(filterCorrections(catalog.corrections, { week: '8' }), []);
  assert.deepEqual(filterCorrections(catalog.corrections, { search: 'NOT-A-REAL-SOURCE-9876' }), []);
  assert.equal(JSON.stringify(catalog.corrections), before);
});

test('lesson and feedback comparisons resolve only the explicitly linked correction IDs', () => {
  const objective = catalog.objectives.find(o => o.correctionIds.includes('w02-correction-11'));
  const linked = objectiveCorrections(catalog, objective.id);
  assert(linked.some(c => c.id === 'w02-correction-11'));
  assert(linked.every(c => objective.correctionIds.includes(c.id)));
  assert.deepEqual(objectiveCorrections(catalog, 'unknown-objective'), []);
});
