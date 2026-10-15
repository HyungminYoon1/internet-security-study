import { WEEK_NUMBERS, buildCatalog } from './domain/content.js';
import { selectQuestions, optionOrder, grade, recordAttempt, newExam, answerExam, finishExam, remainingMs, reviewState } from './domain/learning.js';
import { makeBackup, parseBackup, validateState, MAX_BYTES } from './domain/backup.js';
import { createRepository, STORAGE_KEY } from './storage.js';
import { el, btn, prettyTime } from './views/ui.js';
import { homeView, curriculumView, lessonView, reviewView } from './views/learn.js';
import { practiceView, examView, resultView } from './views/practice.js';
import { scopeView, recordsView } from './views/records.js';
import { casesView, caseView } from './views/cases.js';

const root = document.querySelector('#view');
let toastTimer;
function toast(message) { const node = document.querySelector('#toast'); node.textContent = message; node.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 6500); }
function confirmAction(title, copy) {
  const dialog = document.querySelector('#confirm-dialog');
  if (dialog.open) return Promise.resolve(false);
  document.querySelector('#confirm-title').textContent = title;
  document.querySelector('#confirm-copy').textContent = copy;
  dialog.returnValue = '';
  document.querySelector('#confirm-no').onclick = () => dialog.close('cancel');
  document.querySelector('#confirm-yes').onclick = () => dialog.close('confirm');
  return new Promise(resolve => { dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }); dialog.showModal(); document.querySelector('#confirm-no').focus(); });
}
function download(text, filename, type = 'application/json') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` }), url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const uid = prefix => `${prefix}-${crypto.randomUUID()}`;

try {
  const weeks = await Promise.all(WEEK_NUMBERS.map(async number => {
    const url = new URL(`../content/week-${String(number).padStart(2, '0')}.json`, import.meta.url);
    const response = await fetch(url); if (!response.ok) throw new Error(`${number}주차 교재를 읽을 수 없습니다.`);
    return response.json();
  }));
  const data = buildCatalog(weeks);
  let storage; try { storage = window.localStorage; } catch { storage = { getItem() { throw new Error('blocked'); } }; }
  const repository = createRepository(storage, data), loaded = repository.load();
  let state = loaded.state, storageMessage = loaded.ok ? '' : loaded.message, practice = null, pendingBackup = null;
  let backupReadId = 0;
  let filters = { search: '', week: 'all', kind: 'all', level: 'all', bookmarks: false, page: 0 };
  const caseState = {};
  function commit(next) {
    try { validateState(next, data); }
    catch (error) { toast(error.message); return { ok: false, reason: 'invalid', message: error.message }; }
    const result = repository.save(next);
    state = result.ok ? result.state : next;
    if (!result.ok) storageMessage = result.message;
    updateShell();
    return result;
  }
  function navigate(route) { if (location.hash === `#${route}`) render(true); else location.hash = route; }
  function updateShell() {
    document.querySelectorAll('[data-exam]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.exam === state.settings.exam)));
    const notice = document.querySelector('#storage-notice'); notice.hidden = !storageMessage; notice.replaceChildren();
    if (storageMessage) notice.append(el('span', {}, storageMessage), ' ', el('a', { href: '#records', class: 'link' }, '기록·백업'));
    document.querySelector('#due-count').textContent = String(data.objectives.filter(o => o.exam === state.settings.exam && reviewState(state.attempts, o.id).due).length);
    tick(false);
  }
  function render(focus = false, focusId = null) {
    const previous = document.activeElement?.id, selection = document.activeElement?.selectionStart;
    const raw = location.hash.slice(1).slice(0, 250), [route = 'home', param] = (raw || 'home').split('/');
    const active = ['lesson'].includes(route) ? 'learn' : route === 'case' ? 'cases' : route === 'results' ? 'exam' : route;
    document.querySelectorAll('[data-route]').forEach(a => a.setAttribute('aria-current', a.dataset.route === active ? 'page' : 'false'));
    let view;
    if (route === 'home') view = homeView(api);
    else if (route === 'learn') view = curriculumView(api, param);
    else if (route === 'lesson') view = lessonView(api, param);
    else if (route === 'practice') view = practiceView(api);
    else if (route === 'review') view = reviewView(api);
    else if (route === 'exam') view = examView(api);
    else if (route === 'results') view = resultView(api, param);
    else if (route === 'scope') view = scopeView(api);
    else if (route === 'records') view = recordsView(api);
    else if (route === 'cases') view = casesView(api);
    else if (route === 'case') view = caseView(api, param);
    else view = homeView(api);
    root.replaceChildren(view); updateShell();
    if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
    else if (focus) { root.querySelector('h1')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
    else if (previous) { const target = document.getElementById(previous); target?.focus({ preventScroll: true }); if (target?.setSelectionRange && selection != null && target.type === 'search') target.setSelectionRange(selection, selection); }
  }
  function tick(submit = true) {
    const exam = state.activeExam, banner = document.querySelector('#exam-running');
    banner.hidden = !exam;
    if (!exam) return;
    const remaining = remainingMs(exam), text = prettyTime(remaining);
    document.querySelector('#running-time').textContent = text;
    const counter = document.querySelector('#exam-time'); if (counter) counter.textContent = text;
    if (remaining === 0 && submit) { completeExam(); toast('60분이 지나 답안을 제출했습니다.'); }
  }
  function completeExam() {
    const exam = state.activeExam; if (!exam) return;
    const result = finishExam(exam, data.questions);
    let attempts = state.attempts;
    for (const qid of result.questionIds) {
      if (!result.answers[qid]) continue;
      const q = data.questionMap.get(qid);
      attempts = recordAttempt(attempts, { id: `${exam.id}-${qid}`, questionId: qid, objectiveId: q.objectiveId, family: q.family, answerId: result.answers[qid], correct: grade(q, result.answers[qid]), confidence: 'unsure', at: result.finishedAt, mode: 'exam' });
    }
    commit({ ...state, activeExam: null, attempts, examHistory: [...state.examHistory, result].slice(-20) });
    navigate(`results/${result.id}`);
  }
  const api = {
    data, repository, caseState, get state() { return state; }, get practice() { return practice; }, get filters() { return filters; }, get pendingBackup() { return pendingBackup; }, get storageMessage() { return storageMessage; },
    navigate, render, toast,
    saveSettings(patch) { commit({ ...state, settings: { ...state.settings, ...patch } }); render(); },
    lessonStep(id, step) {
      commit({ ...state, settings: { ...state.settings, lastObjective: id, lessonStep: step }, read: step === 3 ? [...new Set([...state.read, id])] : state.read }); render(false, 'main');
    },
    filter(patch) { filters = { ...filters, page: 0, ...patch }; render(); },
    startPractice({ questionId, objectiveId, week, exam = state.settings.exam, count = 10, daily = false, diagnostic = false } = {}) {
      try {
        const seed = uid('practice');
        let selected;
        if (questionId) selected = [data.questionMap.get(questionId)];
        else {
          if (objectiveId) exam = data.objectiveMap.get(objectiveId).exam;
          const pool = data.questions.filter(q => q.exam === exam && (!objectiveId || q.objectiveId === objectiveId) && (!week || q.week === week));
          const available = new Set(pool.map(q => q.family)).size;
          selected = selectQuestions(pool, { exam, count: Math.min(count, available), seed, unseen: state.attempts.map(a => a.questionId) });
        }
        practice = { id: seed, seed, questionIds: selected.map(q => q.id), optionOrders: Object.fromEntries(selected.map(q => [q.id, optionOrder(q, seed)])), position: 0, selected: null, confidence: 'unsure', hinted: false, feedback: null, results: [], label: diagnostic ? 'STARTING POINT · 주차별 2문제로 시작점 찾기' : daily ? 'DAILY PRACTICE' : 'LEARN BY APPLYING' };
        navigate('practice');
      } catch (error) { toast(error.message); }
    },
    choosePractice(id) { if (!practice.feedback) practice.selected = id; },
    setConfidence(value) { if (!practice.feedback) { practice.confidence = value; render(); } },
    hintUsed() { if (practice && !practice.feedback) practice.hinted = true; },
    gradePractice() {
      if (!practice || practice.feedback) return;
      const q = data.questionMap.get(practice.questionIds[practice.position]);
      if (!q.options.some(o => o.id === practice.selected)) { toast('답 하나를 선택해 주세요.'); return; }
      const attempt = { id: `${practice.id}-${q.id}`, questionId: q.id, objectiveId: q.objectiveId, family: q.family, answerId: practice.selected, correct: grade(q, practice.selected), confidence: practice.confidence, hinted: practice.hinted, at: Date.now(), mode: 'practice' };
      practice.feedback = attempt; practice.results.push(attempt);
      commit({ ...state, attempts: recordAttempt(state.attempts, attempt) }); render(false, 'feedback');
    },
    nextPractice() { if (!practice?.feedback) return; practice.position++; practice.feedback = null; practice.selected = null; practice.confidence = 'unsure'; practice.hinted = false; render(true); },
    endPractice() { practice = null; navigate('practice'); },
    bookmark(id) { commit({ ...state, bookmarks: state.bookmarks.includes(id) ? state.bookmarks.filter(q => q !== id) : [...state.bookmarks, id] }); render(); },
    startExam(count) {
      if (state.activeExam) { navigate('exam'); return; }
      try { commit({ ...state, activeExam: newExam(data.questions, { exam: state.settings.exam, count, seed: uid('seed'), id: uid('exam') }) }); render(true); } catch (error) { toast(error.message); }
    },
    chooseExam(id, answer) { try { commit({ ...state, activeExam: answerExam(state.activeExam, id, answer, data.questions) }); render(); } catch (error) { tick(); toast(error.message); } },
    examPosition(position) { tick(); if (!state.activeExam || position < 0 || position >= state.activeExam.questionIds.length) return; commit({ ...state, activeExam: { ...state.activeExam, position } }); render(true); },
    flagExam(id) { tick(); if (!state.activeExam) return; const exam = state.activeExam; commit({ ...state, activeExam: { ...exam, flagged: exam.flagged.includes(id) ? exam.flagged.filter(q => q !== id) : [...exam.flagged, id] } }); render(); },
    async submitExam() { tick(); if (!state.activeExam) return; const unanswered = state.activeExam.questionIds.length - Object.keys(state.activeExam.answers).length; if (await confirmAction('모의고사를 제출할까요?', `미응답 ${unanswered}문항이 있습니다. 제출하면 정답과 해설을 확인할 수 있으며 답안을 바꿀 수 없습니다.`)) completeExam(); },
    exportBackup() { try { download(makeBackup(state), `internet-security-backup-${new Date().toISOString().slice(0, 10)}.json`); } catch (error) { toast(error.message); } },
    exportRaw() { const raw = repository.raw(); if (raw) download(raw, 'internet-security-stored-original.txt', 'text/plain'); },
    async previewBackup(file) {
      const readId = ++backupReadId;
      pendingBackup = null;
      if (!file) { render(); return; }
      try { if (file.size > MAX_BYTES) throw new Error('2MB 이하의 백업 파일을 선택해 주세요.'); const json = await file.text(); if (readId !== backupReadId) return; pendingBackup = { json, state: parseBackup(json, data) }; render(); } catch (error) { if (readId !== backupReadId) return; toast(error.message); render(); }
    },
    cancelBackup() { backupReadId++; pendingBackup = null; render(); },
    async restoreBackup() {
      if (!pendingBackup || !await confirmAction('백업으로 교체할까요?', '현재 이 앱의 학습 기록을 검사한 백업으로 교체합니다. 필요한 현재 기록은 먼저 내려받아 보관해 주세요.')) return;
      const result = repository.restore(pendingBackup.json);
      if (!result.ok) { toast(result.message); return; }
      backupReadId++; state = result.state; pendingBackup = null; practice = null; storageMessage = ''; render(true); tick(); toast('백업을 복원했습니다.');
    },
    async resetRecords() {
      if (!await confirmAction('이 앱의 기록을 초기화할까요?', '학습·풀이·모의고사 기록을 이 브라우저에서 삭제합니다. 필요한 기록은 먼저 백업하세요. 다른 앱의 기록은 건드리지 않습니다.')) return;
      const result = repository.reset();
      if (!result.ok) { toast(result.message); return; }
      backupReadId++; state = result.state; storageMessage = ''; practice = null; pendingBackup = null; render(true); toast('이 앱의 기록을 초기화했습니다.');
    }
  };
  document.querySelectorAll('[data-exam]').forEach(button => button.addEventListener('click', () => {
    commit({ ...state, settings: { ...state.settings, exam: button.dataset.exam } }); filters = { ...filters, week: 'all', page: 0 }; practice = null; navigate('home');
  }));
  document.querySelector('.skip').addEventListener('click', event => { event.preventDefault(); document.querySelector('#main').focus(); });
  window.addEventListener('hashchange', () => { render(true); tick(); });
  window.addEventListener('storage', event => { if (event.key === STORAGE_KEY || event.key === null) { storageMessage = '다른 탭에서 저장소가 바뀌었습니다. 현재 기록을 백업한 뒤 새로고침해 주세요.'; updateShell(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  setInterval(tick, 1000);
  render(); tick();
} catch (error) {
  root.replaceChildren(el('section', { class: 'empty' }, el('h1', { tabindex: '-1' }, '학습 자료를 불러오지 못했습니다.'), el('p', {}, '연결 상태를 확인한 뒤 다시 시도해 주세요. 저장된 기록은 변경하지 않았습니다.'), el('p', { class: 'notice error' }, error.message), btn('다시 불러오기', () => location.reload())));
}
