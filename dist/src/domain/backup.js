import { MAX_ATTEMPTS, finishExam } from './learning.js';

export const MAX_BYTES = 2 * 1024 * 1024;
export const CONTENT_VERSION = '2026.10.15';
const encoder = new TextEncoder();
const fail = message => { throw new TypeError(message); };
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function keys(v, allowed) { if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) fail('지원하지 않는 데이터 구조 또는 필드입니다.'); }
function number(v, max = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(v) || v < 0 || v > max) fail('숫자 범위를 확인해 주세요.'); }
function text(v, max = 160) { if (typeof v !== 'string' || v.length > max) fail('문자열 형식 또는 길이가 잘못되었습니다.'); }
function list(v, max, check) { if (!Array.isArray(v) || v.length > max) fail('목록 크기 또는 형식이 잘못되었습니다.'); for (let i = 0; i < v.length; i++) { if (!Object.hasOwn(v, i)) fail('비어 있는 목록 항목이 있습니다.'); check(v[i]); } }
function unique(v) { if (new Set(v).size !== v.length) fail('중복된 기록이 있습니다.'); }

export function initialState() {
  return { schemaVersion: 1, contentVersion: CONTENT_VERSION, revision: 0, settings: { exam: 'midterm', examDate: '', lastObjective: '', lessonStep: 0 }, read: [], attempts: [], bookmarks: [], activeExam: null, examHistory: [] };
}

function validateExam(exam, catalog, finished = false) {
  keys(exam, ['id', 'exam', 'seed', 'startAt', 'deadline', 'status', 'questionIds', 'optionOrders', 'answers', 'flagged', 'position', ...(finished ? ['finishedAt', 'correct', 'unanswered', 'score'] : [])]);
  text(exam.id); text(exam.seed); if (!exam.id) fail('시험 식별자가 없습니다.');
  if (!['midterm', 'final'].includes(exam.exam) || exam.status !== (finished ? 'finished' : 'active')) fail('시험 상태가 잘못되었습니다.');
  number(exam.startAt, 8640000000000000); number(exam.deadline, 8640000000000000);
  if (exam.deadline - exam.startAt !== 3600000) fail('시험 제한시간이 잘못되었습니다.');
  list(exam.questionIds, 200, id => { if (!catalog.questionIds.has(id)) fail('현재 교재에 없는 시험 문항입니다.'); }); unique(exam.questionIds);
  if (!exam.questionIds.length) fail('시험 문항이 없습니다.');
  number(exam.position, exam.questionIds.length - 1);
  list(exam.flagged, 200, id => { if (!exam.questionIds.includes(id)) fail('시험 표시 문항이 잘못되었습니다.'); }); unique(exam.flagged);
  keys(exam.answers, exam.questionIds); keys(exam.optionOrders, exam.questionIds);
  for (const id of exam.questionIds) {
    const q = catalog.questionMap.get(id);
    if (q.exam !== exam.exam) fail('시험 범위가 섞여 있습니다.');
    const options = q.options.map(o => o.id);
    if (Object.hasOwn(exam.answers, id) && !options.includes(exam.answers[id])) fail('시험 답안이 잘못되었습니다.');
    if (!Array.isArray(exam.optionOrders[id]) || exam.optionOrders[id].length !== options.length || [...exam.optionOrders[id]].sort().join('|') !== [...options].sort().join('|')) fail('시험 보기 순서가 잘못되었습니다.');
  }
  const families = exam.questionIds.map(id => catalog.questionMap.get(id).family); unique(families);
  if (finished) {
    number(exam.finishedAt, exam.deadline); if (exam.finishedAt < exam.startAt) fail('시험 종료 시각이 잘못되었습니다.');
    const expected = finishExam({ ...exam, status: 'active' }, [...catalog.questionMap.values()], exam.finishedAt);
    for (const key of ['correct', 'unanswered', 'score']) if (exam[key] !== expected[key]) fail('시험 점수가 답안과 일치하지 않습니다.');
  }
}

export function validateState(state, catalog) {
  keys(state, ['schemaVersion', 'contentVersion', 'revision', 'settings', 'read', 'attempts', 'bookmarks', 'activeExam', 'examHistory']);
  if (state.schemaVersion !== 1 || state.contentVersion !== CONTENT_VERSION) fail('다른 버전의 학습 기록입니다. 원본을 보관해 주세요.');
  number(state.revision);
  keys(state.settings, ['exam', 'examDate', 'lastObjective', 'lessonStep']);
  if (!['midterm', 'final'].includes(state.settings.exam)) fail('학습 범위가 잘못되었습니다.');
  text(state.settings.examDate, 10);
  if (state.settings.examDate && (!/^\d{4}-\d{2}-\d{2}$/.test(state.settings.examDate) || Number.isNaN(Date.parse(state.settings.examDate)) || new Date(state.settings.examDate).toISOString().slice(0, 10) !== state.settings.examDate)) fail('시험 날짜가 잘못되었습니다.');
  text(state.settings.lastObjective);
  if (state.settings.lastObjective && !catalog.objectiveIds.has(state.settings.lastObjective)) fail('현재 교재에 없는 개념입니다.');
  number(state.settings.lessonStep, 3);
  list(state.read, 1000, id => { if (!catalog.objectiveIds.has(id)) fail('현재 교재에 없는 읽기 기록입니다.'); }); unique(state.read);
  list(state.bookmarks, 3000, id => { if (!catalog.questionIds.has(id)) fail('현재 교재에 없는 북마크입니다.'); }); unique(state.bookmarks);
  list(state.attempts, MAX_ATTEMPTS, a => {
    keys(a, ['id', 'questionId', 'objectiveId', 'family', 'answerId', 'correct', 'confidence', 'at', 'mode', 'hinted']);
    text(a.id); if (!a.id) fail('풀이 식별자가 없습니다.');
    const q = catalog.questionMap.get(a.questionId);
    if (!q || a.objectiveId !== q.objectiveId || a.family !== q.family) fail('풀이와 개념 연결이 잘못되었습니다.');
    if (!q.options.some(o => o.id === a.answerId) || a.correct !== (a.answerId === q.answerId)) fail('풀이의 답안 또는 정오가 잘못되었습니다.');
    if (!['sure', 'unsure', 'guess'].includes(a.confidence) || !['practice', 'exam'].includes(a.mode) || (a.hinted !== undefined && typeof a.hinted !== 'boolean')) fail('풀이 상태가 잘못되었습니다.');
    number(a.at, 8640000000000000);
  }); unique(state.attempts.map(a => a.id));
  if (state.activeExam !== null) validateExam(state.activeExam, catalog);
  list(state.examHistory, 20, exam => validateExam(exam, catalog, true)); unique(state.examHistory.map(e => e.id));
  if (state.activeExam && state.examHistory.some(e => e.id === state.activeExam.id)) fail('진행 중인 시험과 종료 기록이 중복됩니다.');
  return structuredClone(state);
}

export function makeBackup(state, now = Date.now()) {
  const json = JSON.stringify({ app: 'internet-security-study', schemaVersion: 1, exportedAt: now, state }, null, 2);
  if (encoder.encode(json).length > MAX_BYTES) fail('백업 크기가 2MB를 초과합니다.');
  return json;
}

export function parseBackup(json, catalog) {
  if (typeof json !== 'string' || encoder.encode(json).length > MAX_BYTES) fail('2MB 이하의 백업 파일을 선택해 주세요.');
  let envelope; try { envelope = JSON.parse(json); } catch { fail('백업 JSON을 읽을 수 없습니다.'); }
  keys(envelope, ['app', 'schemaVersion', 'exportedAt', 'state']);
  if (envelope.app !== 'internet-security-study' || envelope.schemaVersion !== 1) fail('이 앱의 지원되는 백업 파일이 아닙니다.');
  number(envelope.exportedAt, 8640000000000000);
  return validateState(envelope.state, catalog);
}
