export const WEEK_NUMBERS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14]);
export const PAGE_COUNTS = Object.freeze({ 1: 15, 2: 27, 3: 34, 4: 21, 5: 28, 6: 24, 7: 31, 9: 28, 10: 28, 11: 23, 12: 19, 13: 19, 14: 18 });
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const text = (value, label, min = 1) => assert(typeof value === 'string' && value.trim().length >= min && value.length <= 15000, `${label}: 설명 길이를 확인해 주세요.`);
const id = (value, label) => assert(typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,100}$/.test(value), `${label}: 식별자 오류`);
const many = (value, label, min = 1) => assert(Array.isArray(value) && value.length >= min && value.length <= 1000, `${label}: 목록 오류`);
const unique = (values, label) => assert(new Set(values).size === values.length, `${label}: 중복`);
export function safeReference(url) { try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } }

export function validateWeek(w) {
  assert(w?.schemaVersion === 1 && WEEK_NUMBERS.includes(w.number), '교재 버전 또는 주차 오류');
  assert(w.id === `w${String(w.number).padStart(2, '0')}`, '주차 식별자 오류');
  assert(w.exam === (w.number <= 7 ? 'midterm' : 'final'), '시험 범위 오류');
  assert(w.source?.filename === `[교안]인터넷보안_${String(w.number).padStart(2, '0')}.pdf` && w.source.pages === PAGE_COUNTS[w.number], '원문 정보 오류');
  text(w.title, w.id); text(w.overview, w.id, 20);
  const pages = (values, label) => { many(values, label); unique(values, label); for (const p of values) assert(Number.isInteger(p) && p >= 1 && p <= w.source.pages, `${label}: 출처 페이지 오류`); };
  const references = values => { many(values, '참고자료', 0); for (const ref of values) { text(ref.title, '참고자료'); assert(safeReference(ref.url), '안전하지 않은 출처 URL'); } };
  many(w.objectives, '학습목표'); many(w.questions, '문항'); many(w.corrections, '정정', 0); references(w.references);
  many(w.retiredQuestions ?? [], '이전 문항', 0);
  const allQuestions = [...w.questions, ...(w.retiredQuestions ?? [])];
  unique(w.objectives.map(o => o.id), '학습목표'); unique(allQuestions.map(q => q.id), '문항'); unique(w.corrections.map(c => c.id), '정정');
  for (const q of w.retiredQuestions ?? []) {
    const next = w.questions.find(item => item.id === q.supersededBy);
    assert(next && next.objectiveId === q.objectiveId, `${q.id}: 대체 문항 연결 오류`);
  }
  const objectives = new Set(w.objectives.map(o => o.id));
  const correctionIds = new Set(w.corrections.map(c => c.id));
  for (const o of w.objectives) {
    id(o.id, w.id); text(o.title, o.id); pages(o.pages, o.id); text(o.why, o.id, 20);
    many(o.explanation, o.id, 2); o.explanation.forEach(p => text(p, o.id, 25)); text(o.keyTakeaway, o.id, 15);
    many(o.comparison, o.id, 2); for (const row of o.comparison) for (const key of ['term', 'meaning', 'example']) text(row[key], o.id);
    text(o.workedExample?.situation, o.id, 15); many(o.workedExample?.steps, o.id, 2); o.workedExample.steps.forEach(s => text(s, o.id, 10)); text(o.workedExample.answer, o.id, 10);
    many(o.commonMistakes, o.id); o.commonMistakes.forEach(s => text(s, o.id, 10)); text(o.check?.prompt, o.id, 10); text(o.check?.answer, o.id, 15);
    many(o.prerequisites, o.id, 0); many(o.correctionIds, o.id, 0); o.correctionIds.forEach(c => assert(correctionIds.has(c), `${o.id}: 정정 연결 오류`));
  }
  for (const q of allQuestions) {
    id(q.id, w.id); id(q.family, q.id); assert(objectives.has(q.objectiveId), `${q.id}: 개념 연결 오류`);
    assert(['concept', 'contrast', 'application', 'evidence'].includes(q.kind) && [1, 2, 3].includes(q.difficulty), `${q.id}: 유형/난이도 오류`);
    text(q.prompt, q.id, 10); if (q.context !== undefined) text(q.context, q.id, 0);
    assert(Array.isArray(q.options) && q.options.length === 4, `${q.id}: 보기 4개 필요`);
    unique(q.options.map(o => o.id), q.id); unique(q.options.map(o => o.text.trim()), q.id);
    for (const o of q.options) { id(o.id, q.id); text(o.text, q.id); text(o.explanation, q.id, 8); }
    assert(q.options.some(o => o.id === q.answerId), `${q.id}: 정답 없음`); text(q.explanation, q.id, 15); pages(q.sourcePages, q.id);
  }
  many(w.coverage, '범위');
  const accounted = new Set();
  for (const entry of w.coverage) {
    pages(entry.pages, '범위'); text(entry.topic, '범위'); many(entry.objectiveIds, '범위', 0);
    assert(['covered', 'historical', 'administrative', 'blank'].includes(entry.status), '범위 상태 오류');
    if (['covered', 'historical'].includes(entry.status)) assert(entry.objectiveIds.length > 0, '학습 내용에 연결된 개념이 없습니다.');
    else text(entry.note, '제외 사유', 5);
    entry.objectiveIds.forEach(o => assert(objectives.has(o), '범위와 개념 연결 오류'));
    entry.pages.forEach(p => accounted.add(p));
  }
  assert(accounted.size === w.source.pages, `${w.id}: 점검하지 않은 원문 페이지가 있습니다.`);
  for (const c of w.corrections) {
    id(c.id, w.id); pages(c.pages, c.id);
    for (const field of ['issue', 'corrected', 'examGuidance']) text(c[field], c.id, 10);
    if (c.handoutExplanation !== undefined || c.verificationReason !== undefined) {
      text(c.handoutExplanation, c.id, 10); text(c.verificationReason, c.id, 10);
    }
    assert(['verified', 'contextualized', 'excluded'].includes(c.status), '정정 상태 오류');
    references(c.references); assert(c.references.length > 0, `${c.id}: 검증 출처가 없습니다.`);
  }
  return true;
}

export function buildCatalog(weeks) {
  assert(weeks.length === WEEK_NUMBERS.length, '13개 주차가 모두 필요합니다.');
  unique(weeks.map(w => w.number), '주차'); weeks.forEach(validateWeek);
  const sorted = [...weeks].sort((a, b) => a.number - b.number);
  const objectives = sorted.flatMap(w => w.objectives.map(o => ({ ...o, week: w.number, exam: w.exam, weekTitle: w.title })));
  const questions = sorted.flatMap(w => w.questions.map(q => ({ ...q, week: w.number, exam: w.exam })));
  const retiredQuestions = sorted.flatMap(w => (w.retiredQuestions ?? []).map(q => ({ ...q, week: w.number, exam: w.exam })));
  const allQuestions = [...questions, ...retiredQuestions];
  unique(objectives.map(o => o.id), '전체 개념'); unique(allQuestions.map(q => q.id), '전체 문항');
  const objectiveIds = new Set(objectives.map(o => o.id));
  for (const o of objectives) o.prerequisites.forEach(p => assert(objectiveIds.has(p) && p !== o.id, '선수 개념 연결 오류'));
  return { weeks: sorted, objectives, questions, retiredQuestions, objectiveIds, questionIds: new Set(allQuestions.map(q => q.id)), objectiveMap: new Map(objectives.map(o => [o.id, o])), questionMap: new Map(allQuestions.map(q => [q.id, q])), corrections: sorted.flatMap(w => w.corrections.map(c => ({ ...c, week: w.number }))) };
}

export function activeQuestionId(catalog, questionId) {
  const q = catalog.questionMap.get(questionId);
  return q?.supersededBy ?? questionId;
}

export function isBookmarked(catalog,bookmarks,questionId) {
  const active=activeQuestionId(catalog,questionId);
  return bookmarks.some(id=>activeQuestionId(catalog,id)===active);
}
export function toggleBookmark(catalog,bookmarks,questionId) {
  const active=activeQuestionId(catalog,questionId);
  return isBookmarked(catalog,bookmarks,active)?bookmarks.filter(id=>activeQuestionId(catalog,id)!==active):[...bookmarks,active];
}
