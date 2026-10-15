export const DAY = 86400000;
export const MAX_ATTEMPTS = 3000;

export function studyPlan(objectives, read, exam, examDate, now = Date.now()) {
  const remaining = objectives.filter(o => o.exam === exam && !read.includes(o.id)).length;
  if (!examDate) return { remaining, days: null, perDay: null };
  const target = Date.parse(`${examDate}T00:00:00Z`), local = new Date(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || !Number.isFinite(target) || !Number.isFinite(now)) throw new TypeError('시험 날짜를 확인해 주세요.');
  const today = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate());
  const days = Math.floor((target - today) / DAY);
  return { remaining, days, perDay: days < 0 ? null : Math.ceil(remaining / (days + 1)) };
}

export function randomFrom(seed = '') {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function shuffle(items, seed) {
  const copy = [...items], random = randomFrom(seed);
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

export function selectQuestions(questions, { exam, count, seed = 'practice', objectiveId = null, week = null, unseen = [] } = {}) {
  if (!['midterm', 'final'].includes(exam)) throw new RangeError('시험 범위를 확인해 주세요.');
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new RangeError('문항 수는 1~200 사이의 정수여야 합니다.');
  let candidates = shuffle(questions.filter(q => q.exam === exam && (!objectiveId || q.objectiveId === objectiveId) && (!week || q.week === week)), seed);
  const seen = new Set(unseen);
  candidates.sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
  const groups = new Map();
  for (const q of candidates) { if (!groups.has(q.week)) groups.set(q.week, []); groups.get(q.week).push(q); }
  const chosen = [], families = new Set();
  const weekOrder = shuffle([...groups.keys()], `${seed}:weeks`);
  while (chosen.length < count) {
    let progress = false;
    for (const key of weekOrder) {
      const group = groups.get(key);
      while (group.length && families.has(group[0].family)) group.shift();
      if (group.length) { const q = group.shift(); chosen.push(q); families.add(q.family); progress = true; }
      if (chosen.length === count) break;
    }
    if (!progress) throw new RangeError(`서로 다른 유형의 문항이 부족합니다. 현재 조건에서는 ${chosen.length}문항까지 선택할 수 있습니다.`);
  }
  return shuffle(chosen, `${seed}:order`);
}

export function optionOrder(question, seed) { return shuffle(question.options.map(o => o.id), `${seed}:${question.id}`); }
export function grade(question, answerId) { return answerId != null && answerId === question.answerId; }

export function recordAttempt(attempts, attempt) {
  if (attempts.some(item => item.id === attempt.id)) return [...attempts];
  return [...attempts, { ...attempt }].slice(-MAX_ATTEMPTS);
}

export function reviewState(attempts, objectiveId, now = Date.now()) {
  const relevant = attempts.filter(a => a.objectiveId === objectiveId).sort((a, b) => a.at - b.at);
  if (!relevant.length) return { status: 'new', label: '아직 연습 전', dueAt: 0, due: false, count: 0 };
  const last = relevant.at(-1);
  if (!last.correct) return { status: 'relearn', label: '개념 다시 보기', dueAt: last.at + (last.confidence === 'sure' ? 600000 : 3600000), due: now >= last.at + (last.confidence === 'sure' ? 600000 : 3600000), count: relevant.length };
  if (last.confidence !== 'sure' || last.hinted) return { status: 'learning', label: '다시 확인하기', dueAt: last.at + DAY, due: now >= last.at + DAY, count: relevant.length };
  const lastWrong = relevant.findLastIndex(a => !a.correct || a.hinted || a.confidence !== 'sure');
  const independent = relevant.slice(lastWrong + 1).filter(a => a.correct && a.confidence === 'sure' && !a.hinted);
  const secure = independent.some(a => independent.some(b => b.at - a.at >= DAY && a.family !== b.family));
  const interval = secure ? (independent.length >= 5 ? 7 : 3) * DAY : DAY;
  return { status: secure ? 'secure' : 'learning', label: secure ? '시간을 두고 확인됨' : '연습 중', dueAt: last.at + interval, due: now >= last.at + interval, count: relevant.length };
}

export function recommend(objectives, attempts, exam, now = Date.now()) {
  return objectives.filter(o => o.exam === exam).map((objective, i) => {
    const review = reviewState(attempts, objective.id, now);
    const priority = review.due ? (review.status === 'relearn' ? 0 : 1) : review.status === 'new' ? 2 : review.status === 'learning' ? 3 : 4;
    return { objective, review, priority, i };
  }).sort((a, b) => a.priority - b.priority || a.i - b.i);
}

export function newExam(questions, { exam, count, seed, now = Date.now(), minutes = 60, id }) {
  if (!Number.isFinite(now) || now < 0 || minutes !== 60 || typeof id !== 'string' || !id) throw new TypeError('시험 설정을 확인해 주세요.');
  const chosen = selectQuestions(questions, { exam, count, seed });
  return { id, exam, seed, startAt: now, deadline: now + minutes * 60000, status: 'active', questionIds: chosen.map(q => q.id), optionOrders: Object.fromEntries(chosen.map(q => [q.id, optionOrder(q, seed)])), answers: {}, flagged: [], position: 0 };
}

export function remainingMs(exam, now = Date.now()) { return Math.max(0, Math.min(exam.deadline - exam.startAt, exam.deadline - now)); }

export function answerExam(exam, questionId, answerId, questions, now = Date.now()) {
  if (exam.status !== 'active' || now >= exam.deadline) throw new Error('시험이 종료되었습니다.');
  if (!exam.questionIds.includes(questionId)) throw new Error('시험에 없는 문항입니다.');
  const q = questions.find(item => item.id === questionId);
  if (!q?.options.some(o => o.id === answerId)) throw new Error('보기를 확인해 주세요.');
  return { ...exam, answers: { ...exam.answers, [questionId]: answerId } };
}

export function finishExam(exam, questions, now = Date.now()) {
  if (exam.status !== 'active') throw new Error('이미 종료된 시험입니다.');
  const byId = new Map(questions.map(q => [q.id, q]));
  let correct = 0, unanswered = 0;
  for (const id of exam.questionIds) {
    if (!byId.has(id)) throw new Error('시험 문항이 바뀌었습니다. 백업을 보관하고 다시 시작해 주세요.');
    if (!exam.answers[id]) unanswered++;
    if (grade(byId.get(id), exam.answers[id])) correct++;
  }
  return { ...exam, status: 'finished', finishedAt: Math.min(Math.max(now, exam.startAt), exam.deadline), correct, unanswered, score: Math.round(correct / exam.questionIds.length * 1000) / 10 };
}
