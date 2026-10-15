import { initialState, validateState, parseBackup, MAX_BYTES } from './domain/backup.js';
export const STORAGE_KEY = 'internet-security-study-v1';

export function createRepository(storage, catalog) {
  let baseline, blocked = true, revision = 0;
  function load() {
    try {
      baseline = storage.getItem(STORAGE_KEY);
      if (baseline !== null && new TextEncoder().encode(baseline).length > MAX_BYTES) throw new Error('저장된 기록이 크기 제한을 초과했습니다.');
      const state = baseline === null ? initialState() : validateState(JSON.parse(baseline), catalog);
      blocked = false; revision = state.revision;
      return { ok: true, state };
    } catch {
      blocked = true;
      return { ok: false, reason: 'unavailable', state: initialState(), message: '저장된 기록을 읽을 수 없어 원본을 보존했습니다. 지금 학습은 임시로 진행됩니다. 기록 관리에서 확인해 주세요.' };
    }
  }
  function save(state, confirmedRestore = false) {
    if (blocked && !confirmedRestore) return { ok: false, reason: 'blocked', message: '자동 저장이 중단되어 있습니다. 현재 학습을 백업해 주세요.' };
    let written = false;
    try {
      if (baseline === undefined || storage.getItem(STORAGE_KEY) !== baseline) { blocked = true; return { ok: false, reason: 'conflict', message: '저장 원본을 확인할 수 없거나 다른 탭에서 기록이 바뀌었습니다. 현재 기록을 백업한 뒤 새로고침해 주세요.' }; }
      const next = validateState({ ...state, revision: revision + 1 }, catalog), encoded = JSON.stringify(next);
      validateState(JSON.parse(encoded), catalog);
      if (new TextEncoder().encode(encoded).length > MAX_BYTES) throw new Error('기록 크기 제한');
      storage.setItem(STORAGE_KEY, encoded);
      written = true;
      let persisted;
      try { persisted = storage.getItem(STORAGE_KEY); }
      catch { persisted = storage.getItem(STORAGE_KEY); }
      if (persisted !== encoded) throw new Error('저장 확인 실패');
      baseline = encoded; revision = next.revision; blocked = false;
      return { ok: true, state: next };
    } catch { blocked = true; return written
      ? { ok: false, reason: 'write-uncertain', message: '기록 쓰기 후 결과를 확인하지 못했습니다. 새로고침 전에 현재 기록과 저장 원본을 모두 내려받아 보관해 주세요.' }
      : { ok: false, reason: 'write-failed', message: '기록을 저장하지 못했습니다. 현재 학습을 백업해 주세요. 다른 앱의 기록은 변경하지 않습니다.' }; }
  }
  function restore(json) {
    let state; try { state = parseBackup(json, catalog); } catch (error) { return { ok: false, reason: 'invalid', message: error.message }; }
    return save(state, true);
  }
  function reset() {
    try {
      if (baseline === undefined || storage.getItem(STORAGE_KEY) !== baseline) return { ok: false, message: '기록 상태가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.' };
      storage.removeItem(STORAGE_KEY);
      if (storage.getItem(STORAGE_KEY) !== null) throw new Error('삭제 확인 실패');
      baseline = null; revision = 0; blocked = false;
      return { ok: true, state: initialState() };
    } catch { return { ok: false, message: '기록을 지우지 못했습니다.' }; }
  }
  return { load, save: state => save(state), restore, reset, raw: () => baseline ?? null };
}
