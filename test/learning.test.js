import test from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestions, optionOrder, grade, recordAttempt, reviewState, newExam, answerExam, finishExam, remainingMs, recommend } from '../dist/src/domain/learning.js';

const questions = Array.from({ length: 84 }, (_, i) => ({ id: `w${String(i % 7 + 1).padStart(2, '0')}-q${i}`, week: i % 7 + 1, exam: 'midterm', objectiveId: `o${i % 14}`, family: `f${i}`, difficulty: i % 3 + 1, answerId: 'b', options: ['a', 'b', 'c', 'd'].map(id => ({ id, text: id })) }));
const all = [...questions, ...questions.map(q => ({ ...q, id: `final-${q.id}`, week: 9 + q.week % 6, exam: 'final', family: `final-${q.family}` }))];

test('seeded selection is reproducible, balanced, immutable and strictly in scope', () => {
  const before = JSON.stringify(all);
  const picked = selectQuestions(all, { exam: 'midterm', count: 30, seed: 'lesson-1' });
  assert.deepEqual(picked, selectQuestions(all, { exam: 'midterm', count: 30, seed: 'lesson-1' }));
  assert.equal(picked.length, 30);
  assert.equal(new Set(picked.map(q => q.family)).size, 30);
  assert.equal(new Set(picked.map(q => q.week)).size, 7);
  assert(picked.every(q => q.exam === 'midterm'));
  assert.notDeepEqual(picked, selectQuestions(all, { exam: 'midterm', count: 30, seed: 'lesson-2' }));
  assert.equal(JSON.stringify(all), before);
  assert.throws(() => selectQuestions(all, { exam: 'unknown', count: 30 }), /범위/);
  for (const count of [0, 1.2, NaN, 201]) assert.throws(() => selectQuestions(all, { exam: 'midterm', count }), /문항/);
  assert.throws(() => selectQuestions(questions.slice(0, 3), { exam: 'midterm', count: 5 }), /부족/);
});

test('families do not double count and option permutations never change the correct ID', () => {
  const duplicated = [...questions, { ...questions[0], id: 'variant', family: questions[0].family }];
  const picked = selectQuestions(duplicated, { exam: 'midterm', count: 84, seed: 'x' });
  assert.equal(new Set(picked.map(q => q.family)).size, 84);
  for (let i = 0; i < 100; i++) {
    assert.deepEqual([...optionOrder(questions[0], String(i))].sort(), ['a', 'b', 'c', 'd']);
    assert(grade(questions[0], 'b'));
    assert(!grade(questions[0], 'a'));
    assert(!grade(questions[0], null));
  }
});

test('attempt IDs are idempotent and confident wrong answers get early review', () => {
  const first = { id: 'a1', questionId: questions[0].id, objectiveId: 'o0', family: 'f0', answerId: 'a', correct: false, confidence: 'sure', at: 1000, mode: 'practice' };
  const one = recordAttempt([], first);
  assert.equal(recordAttempt(one, first).length, 1);
  assert.deepEqual(reviewState(one, 'o0', 1001).status, 'relearn');
  assert.equal(reviewState([], 'o0', 1000).status, 'new');
});

test('guessed answers, same-family repeats and immediate repeats are not mastery', () => {
  const base = { questionId: questions[0].id, objectiveId: 'o0', answerId: 'b', correct: true, mode: 'practice' };
  const guessed = [{ ...base, id: 'a', family: 'f1', confidence: 'guess', at: 1000 }];
  assert.notEqual(reviewState(guessed, 'o0', 1000).status, 'secure');
  const immediate = [...guessed, { ...base, id: 'b', family: 'f2', confidence: 'sure', at: 2000 }, { ...base, id: 'c', family: 'f3', confidence: 'sure', at: 3000 }];
  assert.notEqual(reviewState(immediate, 'o0', 3000).status, 'secure');
  const delayed = [{ ...base, id: 'a', family: 'f1', confidence: 'sure', at: 1000 }, { ...base, id: 'b', family: 'f2', confidence: 'sure', at: 1000 + 86400000 }];
  assert.equal(reviewState(delayed, 'o0', 1000 + 86400000).status, 'secure');
  assert.notEqual(reviewState(delayed.map(a => ({ ...a, family: 'same' })), 'o0', 86401000).status, 'secure');
  assert.equal(reviewState([...delayed, { ...base, id: 'd', family: 'f4', correct: false, confidence: 'sure', at: 86402000 }], 'o0', 86402000).status, 'relearn');
});

test('mock exam deadline survives serialization, background time and late answers', () => {
  const exam = newExam(questions, { exam: 'midterm', count: 20, seed: 'exam', now: 1000, minutes: 60, id: 'run-1' });
  assert.equal(exam.deadline, 3601000);
  const restored = JSON.parse(JSON.stringify(exam));
  assert.equal(remainingMs(restored, 1801000), 1800000);
  assert.equal(remainingMs(restored, 3601001), 0);
  const answered = answerExam(restored, restored.questionIds[0], 'b', questions, 2000);
  assert.equal(restored.answers[restored.questionIds[0]], undefined);
  assert.equal(answered.answers[restored.questionIds[0]], 'b');
  assert.throws(() => answerExam(restored, restored.questionIds[0], 'b', questions, 3601000), /종료/);
  assert.throws(() => answerExam(restored, 'not-in-exam', 'b', questions, 2000), /문항/);
  assert.throws(() => answerExam(restored, restored.questionIds[0], 'x', questions, 2000), /보기/);
  const result = finishExam(answered, questions, 4000000);
  assert.equal(result.correct, 1);
  assert.equal(result.unanswered, 19);
  assert.equal(result.score, 5);
  assert.equal(result.finishedAt, answered.deadline);
  assert.throws(() => answerExam({ ...answered, status: 'finished' }, answered.questionIds[0], 'b', questions, 2000), /종료/);
});

test('recommendation prioritizes due review over unread concepts and honours exam scope', () => {
  const objectives = [{ id: 'o0', exam: 'midterm' }, { id: 'o1', exam: 'midterm' }, { id: 'o2', exam: 'final' }];
  const attempts = [{ id: 'a', objectiveId: 'o1', family: 'f1', correct: false, confidence: 'sure', at: 1 }];
  assert.equal(recommend(objectives, attempts, 'midterm', 90000000)[0].objective.id, 'o1');
  assert(recommend(objectives, attempts, 'midterm', 90000000).every(r => r.objective.exam === 'midterm'));
});
test('date planning uses calendar days, current scope and unread concepts without asserting mastery', async () => {
  const { studyPlan } = await import('../dist/src/domain/learning.js');
  const objectives = [{ id: 'a', exam: 'midterm' }, { id: 'b', exam: 'midterm' }, { id: 'c', exam: 'final' }];
  const now = new Date(2026, 9, 15, 23, 59).getTime();
  assert.deepEqual(studyPlan(objectives, ['a'], 'midterm', '2026-10-16', now), { remaining: 1, days: 1, perDay: 1 });
  assert.deepEqual(studyPlan(objectives, ['a', 'b'], 'midterm', '2026-10-15', now), { remaining: 0, days: 0, perDay: 0 });
  assert.deepEqual(studyPlan(objectives, [], 'final', '', now), { remaining: 1, days: null, perDay: null });
  assert.equal(studyPlan(objectives, [], 'midterm', '2026-10-14', now).perDay, null);
});
