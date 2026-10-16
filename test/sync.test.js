import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../dist/src/domain/backup.js';
import { makeChanges, applyChanges, mergeImport, emptyCloud, validateCloud } from '../dist/src/domain/sync.js';
import { buildCatalog, WEEK_NUMBERS } from '../dist/src/domain/content.js';
import { readFile } from 'node:fs/promises';
import {newExam,finishExam} from '../dist/src/domain/learning.js';

const catalog = buildCatalog(await Promise.all(WEEK_NUMBERS.map(n => readFile(new URL(`../dist/content/week-${String(n).padStart(2, '0')}.json`, import.meta.url), 'utf8').then(JSON.parse))));
const q = catalog.questions[0], q2 = catalog.questions[1];
const uid = '11111111-1111-4111-8111-111111111111';
const fresh = () => emptyCloud(uid, '22222222-2222-4222-8222-222222222222');
const attempt = (id, question = q) => ({ id, questionId: question.id, objectiveId: question.objectiveId, family: question.family, answerId: question.answerId, correct: true, confidence: 'sure', at: 1000, mode: 'practice' });

test('sync does not upload unchanged guest data or mutate inputs', () => {
  const base = fresh(), before = structuredClone(base);
  assert.deepEqual(makeChanges(base, base.state, catalog), { read: [], attempts: [], bookmarks: [], settings: [], examHistory: [] });
  assert.deepEqual(base, before);
});
test('concurrent attempts and reading merge without whole-state replacement', () => {
  const base = fresh();
  const a = makeChanges(base, { ...base.state, attempts: [attempt('a')], read: [q.objectiveId] }, catalog);
  const b = makeChanges(base, { ...base.state, attempts: [attempt('b', q2)], read: [q2.objectiveId] }, catalog);
  const both = applyChanges(applyChanges(base, a, catalog).cloud, b, catalog).cloud;
  assert.equal(both.state.attempts.length, 2); assert.ok(both.state.read.includes(q.objectiveId));
});
test('same attempt is idempotent; same id with a different answer is rejected', () => {
  const base = fresh(), changes = makeChanges(base, { ...base.state, attempts: [attempt('a')] }, catalog);
  const once = applyChanges(base, changes, catalog).cloud;
  assert.equal(applyChanges(once, changes, catalog).cloud.state.attempts.length, 1);
  const altered = structuredClone(changes); altered.attempts[0].confidence = 'guess';
  assert.throws(() => applyChanges(once, altered, catalog), /풀이|conflict/i);
});
test('Postgres JSON key ordering does not change a record identity', () => {
  const base=fresh(); base.state.attempts=[attempt('order')];
  const reordered=Object.fromEntries(Object.entries(base.state.attempts[0]).reverse());
  assert.deepEqual(makeChanges(base,{...base.state,attempts:[reordered]},catalog).attempts,[]);
});
test('stale bookmark cannot resurrect a removal; conflicting settings are explicit', () => {
  const base = fresh();
  const add = makeChanges(base, { ...base.state, bookmarks: [q.id] }, catalog);
  const added = applyChanges(base, add, catalog).cloud;
  const removed = applyChanges(added, makeChanges(added, { ...added.state, bookmarks: [] }, catalog), catalog).cloud;
  assert.equal(applyChanges(removed, add, catalog).conflicts.length, 1);
  assert.deepEqual(applyChanges(removed, add, catalog).cloud.state.bookmarks, []);
  const first = makeChanges(base, { ...base.state, settings: { ...base.state.settings, examDate: '2026-10-19' } }, catalog);
  const second = makeChanges(base, { ...base.state, settings: { ...base.state.settings, examDate: '2026-10-20' } }, catalog);
  assert.equal(applyChanges(applyChanges(base, first, catalog).cloud, second, catalog).conflicts.length, 1);
});
test('same desired field value converges without conflict; device time is irrelevant', () => {
  const base = fresh(), changes = makeChanges(base, { ...base.state, bookmarks: [q.id] }, catalog);
  const once = applyChanges(base, changes, catalog).cloud;
  assert.equal(applyChanges(once, changes, catalog).conflicts.length, 0);
});
test('import is additive; account settings and active exam stay authoritative', () => {
  const cloud = fresh(); cloud.state.settings.exam = 'final';
  const guest = initialState(); guest.attempts = [attempt('guest')]; guest.read = [q.objectiveId]; guest.bookmarks = [q.id];
  const merged = mergeImport(cloud.state, guest, catalog);
  assert.equal(merged.settings.exam, 'final'); assert.equal(merged.attempts.length, 1);
  assert.equal(guest.attempts.length, 1); assert.deepEqual(cloud.state.attempts, []);
});
test('malformed cloud shape and cross-account state are rejected before use', () => {
  assert.throws(() => validateCloud({ ...fresh(), userId: 'other' }, catalog, uid));
  assert.throws(() => validateCloud({ ...fresh(), epoch: '' }, catalog, uid));
  assert.throws(() => validateCloud({ ...fresh(), surprise: true }, catalog, uid));
  const bad = fresh(); bad.state.attempts = [{ id: 'bad' }]; assert.throws(() => validateCloud(bad, catalog, uid));
});
test('changes cannot remove attempts/read/history or smuggle an exam into normal sync', () => {
  const base = fresh(); base.state.attempts = [attempt('a')]; base.state.read = [q.objectiveId];
  const changes = makeChanges(base, { ...base.state, attempts: [], read: [] }, catalog);
  assert.deepEqual(changes.attempts, []); assert.deepEqual(changes.read, []);
  const unknown = { ...changes, activeExam: null }; assert.throws(() => applyChanges(base, unknown, catalog));
});

test('a backup with a conflicting historical exam ID is rejected, not silently discarded',()=>{
  const base=fresh(),exam=finishExam(newExam([q],{exam:q.exam,count:1,id:'same-id',seed:'one',now:100}),[q],101);
  base.state.examHistory=[exam];const imported=initialState();
  imported.examHistory=[{...exam,finishedAt:102}];
  assert.throws(()=>mergeImport(base.state,imported,catalog),/모의고사/);
  assert.equal(base.state.examHistory[0].finishedAt,101);
});

test('cloud versions require both maps and a revision consistent with the state',()=>{
  for(const edit of [c=>c.versions={},c=>delete c.versions.bookmarks,c=>c.state.revision=1]){
    const cloud=fresh();edit(cloud);assert.throws(()=>validateCloud(cloud,catalog,uid));
  }
});
