import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, validateState, makeBackup } from '../dist/src/domain/backup.js';
import { createRepository, STORAGE_KEY } from '../dist/src/storage.js';

// A small valid catalog keeps these persistence regressions independent of
// content authoring and browser rendering. No real localStorage is touched.
const question = {
  id: 'w01-q001', objectiveId: 'w01-test', family: 'w01-test-family',
  exam: 'midterm', week: 1, answerId: 'a',
  options: ['a', 'b', 'c', 'd'].map(id => ({ id }))
};
const catalog = {
  objectiveIds: new Set([question.objectiveId]),
  questionIds: new Set([question.id]),
  questionMap: new Map([[question.id, question]])
};

function progressState() {
  const state = initialState();
  state.revision = 3;
  state.read = [question.objectiveId];
  state.bookmarks = [question.id];
  state.attempts = [{
    id: 'prior-attempt', questionId: question.id,
    objectiveId: question.objectiveId, family: question.family,
    answerId: 'a', correct: true, confidence: 'sure', hinted: false,
    at: 1000, mode: 'practice'
  }];
  validateState(state, catalog);
  return state;
}

function memory(initialRaw = null) {
  const map = new Map([['unrelated-app', 'must-remain']]);
  if (initialRaw !== null) map.set(STORAGE_KEY, initialRaw);
  return {
    map,
    getItem(key) { return map.get(key) ?? null; },
    setItem(key, value) { map.set(key, value); },
    removeItem(key) { map.delete(key); }
  };
}

test('ADV-01: a restore reported as failed must preserve the previous persisted record', () => {
  const originalRaw = JSON.stringify(progressState());
  const storage = memory(originalRaw);
  const repository = createRepository(storage, catalog);
  assert.equal(repository.load().ok, true);

  // The replacement write succeeds, but exactly its first readback fails.
  // Later reads work, so a guarded rollback of our own value is possible.
  const get = storage.getItem.bind(storage);
  const set = storage.setItem.bind(storage);
  let readbackFailure = false;
  let injectOnce = true;
  storage.setItem = (key, value) => {
    set(key, value);
    if (key === STORAGE_KEY && injectOnce) {
      injectOnce = false;
      readbackFailure = true;
    }
  };
  storage.getItem = key => {
    if (key === STORAGE_KEY && readbackFailure) {
      readbackFailure = false;
      throw new Error('injected one-shot readback failure');
    }
    return get(key);
  };

  const result = repository.restore(makeBackup(initialState(), 2000));
  assert.equal(storage.getItem('unrelated-app'), 'must-remain');
  const persisted = JSON.parse(storage.getItem(STORAGE_KEY));
  if (result.ok) {
    // A future implementation may recover by retrying readback and proving
    // success instead. A truthful, validated successful restore is also safe.
    validateState(persisted, catalog);
    assert.deepEqual(persisted.attempts, []);
    assert.deepEqual(result.state, persisted);
    return;
  }
  assert.equal(repository.raw(), originalRaw, 'original is still exportable from this instance');
  assert.deepEqual(persisted.attempts, progressState().attempts,
    'restore said it failed, but it erased the persisted prior attempt');
  assert.equal(storage.getItem(STORAGE_KEY), originalRaw,
    'a failed restore must leave the original bytes and revision intact');
});

test('ADV-02: explicit valid restore can recover corrupt storage without requiring a destructive reset', () => {
  const originalRaw = '{broken record retained for export';
  const storage = memory(originalRaw);
  const repository = createRepository(storage, catalog);
  assert.equal(repository.load().ok, false);
  assert.equal(repository.save(initialState()).ok, false,
    'automatic saving must still be blocked while the original is corrupt');
  assert.equal(storage.getItem(STORAGE_KEY), originalRaw);

  // app.js calls restore() only after its user confirmation dialog.
  // Invalid input must not relax the automatic-write block.
  assert.equal(repository.restore('{not a backup').reason, 'invalid');
  assert.equal(storage.getItem(STORAGE_KEY), originalRaw);
  const result = repository.restore(makeBackup(progressState(), 2000));
  assert.equal(result.ok, true,
    `confirmed valid restore is unusable after corrupt load: ${result.reason}`);
  assert.deepEqual(createRepository(storage, catalog).load().state.attempts,
    progressState().attempts);
  assert.equal(storage.getItem('unrelated-app'), 'must-remain');
});

test('ADV-03: validateState must reject sparse record arrays before acknowledging them as valid', () => {
  const accepted = [];
  for (const field of ['read', 'bookmarks', 'attempts', 'examHistory']) {
    const candidate = initialState();
    candidate[field] = Array(1); // one missing element; not an empty array
    try { validateState(candidate, catalog); accepted.push(field); }
    catch (error) { assert(error instanceof Error); }
  }
  assert.deepEqual(accepted, [],
    'holes bypass forEach validation, then JSON converts them into forbidden null entries');
});

test('ADV-04: an acknowledged save must be reloadable and must not replace good progress with invalid JSON state', () => {
  const originalRaw = JSON.stringify(progressState());
  const storage = memory(originalRaw);
  const repository = createRepository(storage, catalog);
  const loaded = repository.load();
  assert.equal(loaded.ok, true);
  const malformed = { ...loaded.state, read: Array(1) };
  const saved = repository.save(malformed);

  // Either reject without mutation or persist a valid round trip. In both
  // cases the existing attempt remains usable after a new repository load.
  const reloaded = createRepository(storage, catalog).load();
  assert.equal(reloaded.ok, true,
    `save.ok=${saved.ok}, but reopening now rejects this app's own stored record`);
  assert.deepEqual(reloaded.state.attempts, progressState().attempts,
    'a malformed read list must not make prior valid attempts disappear on load');
  if (!saved.ok) assert.equal(storage.getItem(STORAGE_KEY), originalRaw);
  assert.equal(storage.getItem('unrelated-app'), 'must-remain');
});
