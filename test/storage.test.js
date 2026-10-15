import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, validateState, parseBackup, makeBackup, MAX_BYTES } from '../dist/src/domain/backup.js';
import { createRepository, STORAGE_KEY } from '../dist/src/storage.js';

function memory() { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k), map }; }
const catalog = { objectiveIds: new Set(['o1']), questionIds: new Set(['q1']), questionMap: new Map([['q1', { id: 'q1', objectiveId: 'o1', family: 'f1', exam: 'midterm', options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], answerId: 'a' }]]) };

test('roundtrip backup is bounded, typed and content-referenced', () => {
  const state = initialState();
  assert.deepEqual(validateState(state, catalog), state);
  const encoded = makeBackup(state, 1000);
  assert.deepEqual(parseBackup(encoded, catalog), state);
  for (const text of ['{', 'null', '[]', '{"__proto__":{}}', 'x'.repeat(MAX_BYTES + 1)]) assert.throws(() => parseBackup(text, catalog));
  const envelope = JSON.parse(encoded);
  for (const bad of [{ ...envelope, schemaVersion: 999 }, { ...envelope, extra: true }, { ...envelope, state: { ...state, extra: true } }, { ...envelope, state: { ...state, read: ['missing'] } }, { ...envelope, state: { ...state, revision: -1 } }]) assert.throws(() => parseBackup(JSON.stringify(bad), catalog));
});

test('malformed/newer storage is preserved and disables automatic writes', () => {
  for (const raw of ['{broken', JSON.stringify({ schemaVersion: 999 }), 'null']) {
    const storage = memory(); storage.setItem(STORAGE_KEY, raw); storage.setItem('another-app', 'keep');
    const repo = createRepository(storage, catalog);
    assert.equal(repo.load().ok, false);
    assert.equal(repo.save(initialState()).ok, false);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
    assert.equal(storage.getItem('another-app'), 'keep');
  }
});

test('storage denial and quota are visible, never reported as saved', () => {
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const repo = createRepository(denied, catalog); assert.equal(repo.load().ok, false); assert.equal(repo.save(initialState()).ok, false);
  const storage = memory(); const current = initialState(); storage.setItem(STORAGE_KEY, JSON.stringify(current));
  const quota = createRepository(storage, catalog); quota.load(); storage.setItem = () => { throw new Error('quota'); };
  assert.equal(quota.save({ ...current, read: ['o1'] }).ok, false);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), current);
});

test('cross-tab change cannot silently overwrite a newer record', () => {
  const storage = memory(); const a = createRepository(storage, catalog), b = createRepository(storage, catalog);
  a.load(); b.load();
  assert.equal(a.save({ ...initialState(), read: ['o1'] }).ok, true);
  assert.equal(b.save(initialState()).reason, 'conflict');
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)).read, ['o1']);
});

test('restore validates first and readback failure is not success', () => {
  const storage = memory(); const repo = createRepository(storage, catalog); repo.load(); repo.save(initialState());
  const raw = storage.getItem(STORAGE_KEY);
  assert.equal(repo.restore('{broken').ok, false); assert.equal(storage.getItem(STORAGE_KEY), raw);
  const ignored = { getItem: () => null, setItem: () => {} }; const noWrite = createRepository(ignored, catalog); noWrite.load();
  assert.equal(noWrite.save(initialState()).ok, false);
});

test('permanent post-write read failure is uncertain and retains exportable original bytes', () => {
  const storage = memory(), original = JSON.stringify(initialState()); storage.setItem(STORAGE_KEY, original);
  const repo = createRepository(storage, catalog); repo.load();
  const write = storage.setItem;
  storage.setItem = (key, value) => { write(key, value); storage.getItem = () => { throw new Error('read permission failed'); }; };
  const result = repo.restore(makeBackup({ ...initialState(), read: ['o1'] }));
  assert.equal(result.ok, false); assert.equal(result.reason, 'write-uncertain');
  assert.equal(repo.raw(), original); assert.match(result.message, /결과를 확인하지 못/);
});

test('explicit restore never bypasses unreadable or intervening other-tab baselines', () => {
  const denied = createRepository({ getItem() { throw new Error('denied'); } }, catalog); denied.load();
  assert.equal(denied.restore(makeBackup(initialState())).ok, false);
  const storage = memory(); storage.setItem(STORAGE_KEY, '{corrupt');
  const repo = createRepository(storage, catalog); repo.load();
  const newer = JSON.stringify({ ...initialState(), revision: 7, read: ['o1'] }); storage.setItem(STORAGE_KEY, newer);
  assert.equal(repo.restore(makeBackup(initialState())).reason, 'conflict');
  assert.equal(storage.getItem(STORAGE_KEY), newer);
});

test('invalid dates, array holes and prototype fields are rejected without changing records', () => {
  for (const examDate of ['2026-02-30', '2026-13-01', 'not-a-date']) assert.throws(() => validateState({ ...initialState(), settings: { ...initialState().settings, examDate } }, catalog));
  for (const key of ['read', 'bookmarks', 'attempts', 'examHistory']) assert.throws(() => validateState({ ...initialState(), [key]: Array(1) }, catalog));
  const envelope = JSON.parse(makeBackup(initialState()));
  Object.defineProperty(envelope.state, '__proto__', { value: { polluted: true }, enumerable: true });
  assert.throws(() => parseBackup(JSON.stringify(envelope), catalog)); assert.equal({}.polluted, undefined);
});
