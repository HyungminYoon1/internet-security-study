import { initialState, validateState, MAX_BYTES } from './backup.js';
import { MAX_ATTEMPTS } from './learning.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const fail = text => { throw new TypeError(text); };
function keys(v, allowed) { if (!plain(v) || Object.keys(v).some(k => !allowed.includes(k))) fail('동기화 데이터 구조를 확인해 주세요.'); }
const canonical = v => Array.isArray(v) ? v.map(canonical) : plain(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
export const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const version = v => Number.isSafeInteger(v) && v >= 0;
const settingKeys = ['exam', 'examDate', 'lesson'];
function settings(state) { return { exam: state.settings.exam, examDate: state.settings.examDate, lesson: { lastObjective: state.settings.lastObjective, lessonStep: state.settings.lessonStep } }; }
function writeSetting(state, key, value) { if (key === 'lesson') Object.assign(state.settings, value); else state.settings[key] = value; }

export function emptyCloud(userId, epoch) {
  return { userId, epoch, revision: 0, state: initialState(), versions: { bookmarks: {}, settings: {} }, examWriter: null, serverNow: 0 };
}
export function validateCloud(value, catalog, userId) {
  keys(value, ['userId', 'epoch', 'revision', 'state', 'versions', 'examWriter', 'serverNow']);
  if (typeof value.userId !== 'string' || !value.userId || value.userId !== userId || !uuid.test(value.epoch) || !version(value.revision) || !version(value.serverNow)) fail('계정 또는 동기화 버전이 일치하지 않습니다.');
  const state = validateState(value.state, catalog);
  if (state.revision !== value.revision) fail('계정 기록의 버전이 일치하지 않습니다.');
  keys(value.versions, ['bookmarks', 'settings']);
  if (!plain(value.versions.bookmarks) || !plain(value.versions.settings)) fail('항목 버전 목록이 없습니다.');
  for (const [group, values] of Object.entries(value.versions)) {
    if (!plain(values) || Object.keys(values).length > 3000) fail('항목 버전이 잘못되었습니다.');
    for (const [key, v] of Object.entries(values)) if (!version(v) || v > value.revision || (group === 'settings' ? !settingKeys.includes(key) : !catalog.questionIds.has(key))) fail('항목 버전이 잘못되었습니다.');
  }
  if (value.examWriter !== null) {
    keys(value.examWriter, ['deviceId', 'generation']);
    if (!uuid.test(value.examWriter.deviceId) || !uuid.test(value.examWriter.generation) || !state.activeExam) fail('모의고사 진행 기기 정보가 잘못되었습니다.');
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_BYTES + 256000) fail('동기화 데이터가 너무 큽니다.');
  return structuredClone({ ...value, state });
}

export function makeChanges(base, desired, catalog) {
  validateState(desired, catalog);
  const before = base.state, previousAttempts = new Map(before.attempts.map(a => [a.id, a]));
  const attempts = desired.attempts.filter(a => {
    const old = previousAttempts.get(a.id);
    if (old && !equal(old, a)) fail('기존 풀이를 다른 내용으로 바꿀 수 없습니다.');
    return !old;
  });
  const bookmarks = [...new Set([...before.bookmarks, ...desired.bookmarks])].filter(id => before.bookmarks.includes(id) !== desired.bookmarks.includes(id)).map(id => ({ id, value: desired.bookmarks.includes(id), baseVersion: base.versions.bookmarks[id] || 0 }));
  const a = settings(before), b = settings(desired);
  return {
    read: desired.read.filter(id => !before.read.includes(id)), attempts,
    bookmarks, settings: settingKeys.filter(key => !equal(a[key], b[key])).map(key => ({ key, value: b[key], baseVersion: base.versions.settings[key] || 0 })),
    examHistory: desired.examHistory.filter(e => {
      const old=before.examHistory.find(old=>old.id===e.id);
      if(old&&!equal(old,e))fail('같은 모의고사의 결과가 다릅니다.');
      return !old;
    })
  };
}

export function applyChanges(base, changes, catalog) {
  keys(changes, ['read', 'attempts', 'bookmarks', 'settings', 'examHistory']);
  for (const [key, max] of [['read', 1000], ['attempts', MAX_ATTEMPTS], ['bookmarks', 3000], ['settings', 3], ['examHistory', 20]]) {
    if (!Array.isArray(changes[key]) || changes[key].length > max || Object.keys(changes[key]).length !== changes[key].length) fail('동기화 목록 형식이 잘못되었습니다.');
  }
  const cloud = structuredClone(base), state = cloud.state, conflicts = [], nextRevision = base.revision + 1;
  const attemptMap = new Map(state.attempts.map(a => [a.id, a]));
  for (const attempt of changes.attempts) {
    const old = attemptMap.get(attempt.id);
    if (old && !equal(old, attempt)) fail('같은 식별자의 풀이 내용이 다릅니다.');
    attemptMap.set(attempt.id, attempt);
  }
  state.attempts = [...attemptMap.values()].slice(-MAX_ATTEMPTS);
  state.read = [...new Set([...state.read, ...changes.read])];
  for (const change of changes.bookmarks) {
    keys(change, ['id', 'value', 'baseVersion']);
    if (!catalog.questionIds.has(change.id) || typeof change.value !== 'boolean' || !version(change.baseVersion)) fail('북마크 변경 형식이 잘못되었습니다.');
    const current = state.bookmarks.includes(change.id);
    if (current === change.value) continue;
    if ((cloud.versions.bookmarks[change.id] || 0) !== change.baseVersion) { conflicts.push({ kind: 'bookmark', key: change.id, local: change.value, remote: current }); continue; }
    state.bookmarks = change.value ? [...state.bookmarks, change.id] : state.bookmarks.filter(id => id !== change.id);
    cloud.versions.bookmarks[change.id] = nextRevision;
  }
  for (const change of changes.settings) {
    keys(change, ['key', 'value', 'baseVersion']);
    if (!settingKeys.includes(change.key) || !version(change.baseVersion)) fail('설정 변경 형식이 잘못되었습니다.');
    const current = settings(state)[change.key];
    if (equal(current, change.value)) continue;
    if ((cloud.versions.settings[change.key] || 0) !== change.baseVersion) { conflicts.push({ kind: 'setting', key: change.key, local: change.value, remote: current }); continue; }
    writeSetting(state, change.key, change.value);
    cloud.versions.settings[change.key] = nextRevision;
  }
  const history = new Map(state.examHistory.map(e => [e.id, e]));
  for (const exam of changes.examHistory) {
    if (state.activeExam?.id === exam.id) fail('진행 중인 모의고사를 가져오기 기록으로 덮어쓸 수 없습니다.');
    if (history.has(exam.id) && !equal(history.get(exam.id), exam)) fail('같은 모의고사의 결과가 다릅니다.');
    history.set(exam.id, exam);
  }
  state.examHistory = [...history.values()].slice(-20);
  state.revision = nextRevision; cloud.revision = nextRevision;
  validateState(state, catalog);
  return { cloud, conflicts };
}

export function mergeImport(accountState, guestState, catalog) {
  validateState(accountState, catalog); validateState(guestState, catalog);
  const base = emptyCloud('import', '22222222-2222-4222-8222-222222222222'); base.state = structuredClone(accountState);
  const desired = { ...accountState, read: [...new Set([...accountState.read, ...guestState.read])], bookmarks: [...new Set([...accountState.bookmarks, ...guestState.bookmarks])], attempts: [...new Map([...accountState.attempts, ...guestState.attempts].map(a => [a.id, a])).values()].slice(-MAX_ATTEMPTS), examHistory: [...new Map([...accountState.examHistory, ...guestState.examHistory].map(e => [e.id, e])).values()].filter(e => e.id !== accountState.activeExam?.id).slice(-20) };
  return applyChanges(base, makeChanges(base, desired, catalog), catalog).cloud.state;
}

export const hasChanges = changes => Object.values(changes).some(list => list.length > 0);
export const validUuid = value => typeof value === 'string' && uuid.test(value);
