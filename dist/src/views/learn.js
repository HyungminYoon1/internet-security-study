import { el, fragment, btn, link, pill, eyebrow, pageHead, note, progress, meta, source, sectionHead, stat, empty } from './ui.js';
import { recommend, reviewState, studyPlan } from '../domain/learning.js';
import { PATHWAYS, prerequisiteIds } from '../domain/pathways.js';

const scopeLabel = exam => exam === 'midterm' ? '중간 · 1–7주차' : '기말 · 9–14주차';

export function homeView(api) {
  const { data, state } = api, exam = state.settings.exam;
  const order = recommend(data.objectives, state.attempts, exam), next = order[0]?.objective;
  const objectives = data.objectives.filter(o => o.exam === exam), questions = data.questions.filter(q => q.exam === exam);
  const read = objectives.filter(o => state.read.includes(o.id)).length;
  const due = order.filter(r => r.review.due).length;
  const secure = order.filter(r => r.review.status === 'secure').length;
  const plan = studyPlan(data.objectives, state.read, exam, state.settings.examDate);
  const planNotice = plan.days === null ? null : note(plan.days < 0 ? '설정한 시험일이 지났습니다. 새 날짜를 정하거나 지금까지의 개념을 계속 복습할 수 있습니다.' : `${plan.days === 0 ? '오늘이 설정한 시험일입니다.' : `시험일까지 ${plan.days}일.`} 처음 읽을 개념 ${plan.remaining}개 · 오늘부터 시험일까지 하루 ${plan.perDay}개씩 읽는 계획입니다. 문제 적용과 복습 시간은 별도로 확보하세요.`);
  const first = new Map();
  state.attempts.forEach(a => { if (data.questionMap.get(a.questionId)?.exam === exam && !first.has(a.questionId)) first.set(a.questionId, a); });
  const accuracy = first.size ? `${Math.round([...first.values()].filter(a => a.correct).length / first.size * 100)}%` : '—';
  const hero = el('section', { class: 'hero' }, el('div', { class: 'hero-copy' }, eyebrow('UNDERSTAND · APPLY · REMEMBER'), el('h2', {}, '보안의 원리를 이해하고,', el('br'), '상황에 적용해 보세요.'), el('p', {}, '왜 필요한지부터 시작합니다. 예제를 따라 생각하고, 다른 상황의 문제로 이해를 확인하세요.'), el('div', { class: 'button-row' }, link(read ? '다음 개념 이어가기 →' : '첫 개념 시작하기 →', `#lesson/${next.id}`, 'button'), link('학습 과정 보기', '#learn', 'button ghost'))), el('div', { class: 'hero-visual' }, el('img', { src: 'assets/learning-map.svg', alt: '보호할 정보, 공격과 위협, 방어와 대응을 연결하여 근거로 판단하는 학습 과정', width: 480, height: 300 })));
  const left = el('section', {}, sectionHead('지금 공부하면 좋은 개념', link('전체 과정 ↗', '#learn')), el('div', { class: 'stack' }, order.slice(0, 3).map((r, i) => link(el('div', { class: 'next-card' }, el('span', { class: 'step-number' }, String(i + 1).padStart(2, '0')), el('div', {}, meta(pill(`${r.objective.week}주차`), r.review.due ? pill('복습할 때', 'amber') : null), el('h3', {}, r.objective.title), el('p', {}, r.review.status === 'new' ? '개념 → 예제 → 스스로 설명 → 문제 적용' : r.review.label)), el('span', { class: 'arrow', 'aria-hidden': 'true' }, '↗')), `#lesson/${r.objective.id}`))), el('div', { class: 'button-row' }, btn(due ? `복습할 개념 ${due}개 살펴보기` : '오늘의 10문제 풀기', () => due ? api.navigate('review') : api.startPractice({ count: 10, daily: true }), 'secondary')));
  const right = el('section', { class: 'panel' }, eyebrow('A SMALL STEP, EVERY DAY'), el('h3', {}, '한 번의 학습, 네 단계'), el('ol', { class: 'path-list' }, [ ['이해', '문제가 생기는 이유와 해결 원리를 읽습니다.'], ['따라 생각하기', '풀이의 판단 기준을 한 단계씩 살펴봅니다.'], ['꺼내 설명하기', '답을 보기 전에 자신의 말로 설명합니다.'], ['적용·복습', '새 문제와 시간이 지난 뒤의 복습으로 확인합니다.'] ].map(([title, copy]) => el('li', {}, el('strong', {}, title), el('p', {}, copy)))), el('p', { class: 'notice' }, '읽은 개념과 이해를 확인한 개념은 따로 표시합니다.'));
  return fragment(pageHead('오늘의 학습', `${scopeLabel(exam)} · ${objectives.length}개 개념 · ${questions.length}문항`, link('학습 계획 설정', '#records', 'button secondary small'), 'YOUR LEARNING DESK'), planNotice, hero, el('div', { class: 'stats' }, stat('읽어 본 개념', read, `/ ${objectives.length}`), stat('복습할 개념', due, '개'), stat('처음 풀이 정답률', accuracy, first.size ? `${first.size}문항` : '기록 없음'), stat('시간을 두고 확인', secure, '개')), el('div', { class: 'two-columns' }, left, right));
}

export function curriculumView(api, selectedWeek = null) {
  const { data, state } = api;
  if (selectedWeek) {
    const week = data.weeks.find(w => w.id === selectedWeek);
    if (!week) return empty('주차를 찾을 수 없습니다.', '학습 과정에서 주차를 선택해 주세요.', link('학습 과정', '#learn', 'button'));
    return fragment(pageHead(`${week.number}주차 · ${week.title}`, week.overview, link('전체 과정', '#learn', 'button secondary small'), scopeLabel(week.exam)), el('div', { class: 'stack' }, week.objectives.map((o, i) => {
      const review = reviewState(state.attempts, o.id);
      return el('article', { class: 'next-card' }, el('span', { class: 'step-number' }, String(i + 1).padStart(2, '0')), el('div', {}, meta(state.read.includes(o.id) ? pill('읽음') : pill('읽기 전'), pill(review.label, review.due ? 'amber' : '')), el('h3', {}, o.title), el('p', {}, o.why)), link('학습 →', `#lesson/${o.id}`, 'button secondary small'));
    })), el('div', { class: 'button-row' }, btn('이 주차 문제 연습', () => api.startPractice({ week: week.number, exam: week.exam, count: 10 }))), note('개념은 원하는 순서로 열 수 있습니다. 처음 공부한다면 위에서부터 읽어 보세요.'));
  }
  const weeks = data.weeks.filter(w => w.exam === state.settings.exam);
  const pathways = el('section', { class: 'pathways' }, sectionHead('질문으로 연결하는 학습 경로'), el('p', { class: 'muted' }, '처음이라면 아래 핵심 경로로 시작하세요. 전체 시험 범위는 이어지는 주차별 학습에서 확인합니다.'), el('div', { class: 'week-grid' }, PATHWAYS.filter(p => p.exam === state.settings.exam).map(p => el('article', { class: 'panel' }, el('h2', {}, p.title), el('p', {}, p.question), el('ol', { class: 'concept-chain' }, p.steps.map(id => el('li', {}, link(data.objectiveMap.get(id).title, `#lesson/${id}`, 'link'), state.read.includes(id) && pill('읽음'))))))));
  return fragment(pageHead('개념 학습', '보호할 대상에서 출발해 공격·방어·판단을 연결합니다.', btn('시작점 찾기', () => api.startPractice({ count: state.settings.exam === 'midterm' ? 14 : 12, diagnostic: true }), 'secondary small'), scopeLabel(state.settings.exam)), pathways, sectionHead('주차별 전체 학습'), el('div', { class: 'week-grid' }, weeks.map(w => {
    const read = w.objectives.filter(o => state.read.includes(o.id)).length;
    return el('article', { class: 'week-card' }, meta(pill(`WEEK ${String(w.number).padStart(2, '0')}`), el('span', { class: 'muted' }, `${w.objectives.length}개 개념 · ${w.questions.length}문항`)), el('h2', {}, w.title), el('p', {}, w.overview), el('ul', {}, w.objectives.slice(0, 3).map(o => el('li', {}, o.title)), w.objectives.length > 3 && el('li', {}, `외 ${w.objectives.length - 3}개 개념`)), progress(read, w.objectives.length, `${w.number}주차 읽은 개념`), el('div', { class: 'button-row' }, link('주차 학습 →', `#learn/${w.id}`, 'button secondary small'), el('small', {}, `읽기 ${read}/${w.objectives.length}`)));
  })));
}

export function lessonView(api, objectiveId) {
  const { data, state } = api, o = data.objectiveMap.get(objectiveId);
  if (!o) return empty('개념을 찾을 수 없습니다.', '학습 과정에서 개념을 선택해 주세요.', link('학습 과정', '#learn', 'button'));
  const step = state.settings.lastObjective === o.id ? state.settings.lessonStep : 0;
  const steps = ['개념 이해', '풀이 예제', '스스로 설명', '문제 적용'];
  const tabs = el('div', { class: 'lesson-tabs', 'aria-label': '학습 단계' }, steps.map((label, i) => el('button', { type: 'button', 'aria-current': step === i ? 'step' : null, onclick: () => api.lessonStep(o.id, i) }, el('span', { class: 'tab-num' }, `STEP 0${i + 1}`), label)));
  let body;
  if (step === 0) body = fragment(eyebrow('먼저 생각해 볼 질문'), el('h2', {}, o.why), o.explanation.map(p => el('p', {}, p)), el('div', { class: 'takeaway' }, el('strong', {}, '기억할 원리'), el('p', {}, o.keyTakeaway)), el('h3', {}, '비슷한 개념, 이렇게 구분해요'), el('div', { class: 'table-wrap' }, el('table', { class: 'comparison' }, el('thead', {}, el('tr', {}, ['개념', '의미', '예시'].map(t => el('th', { scope: 'col' }, t)))), el('tbody', {}, o.comparison.map(row => el('tr', {}, el('td', {}, row.term), el('td', {}, row.meaning), el('td', {}, row.example)))))));
  else if (step === 1) body = fragment(eyebrow('WORKED EXAMPLE'), el('h2', {}, '어떻게 판단할까요?'), el('p', {}, o.workedExample.situation), el('ol', { class: 'worked-steps' }, o.workedExample.steps.map(s => el('li', {}, s))), el('div', { class: 'takeaway' }, el('strong', {}, '판단의 결과'), el('p', {}, o.workedExample.answer)), el('h3', {}, '이렇게 생각하면 헷갈려요'), el('ul', { class: 'mistakes' }, o.commonMistakes.map(m => el('li', {}, m))));
  else if (step === 2) body = fragment(eyebrow('RETRIEVE BEFORE REVEAL'), el('h2', {}, '자신의 말로 설명해 보세요.'), el('p', {}, '잠시 화면에서 눈을 떼고, 이유까지 설명한 뒤 아래 답과 비교해 보세요.'), el('div', { class: 'retrieval' }, el('p', {}, o.check.prompt), el('details', {}, el('summary', {}, '생각한 뒤 해설 보기'), el('p', {}, o.check.answer))), el('h3', {}, '설명에 막혔다면'), el('p', {}, '정답 문장을 외우기보다 어떤 조건을 놓쳤는지 확인하세요. 예제로 돌아가 판단 순서를 다시 따라가도 좋습니다.'));
  else body = fragment(eyebrow('APPLY THE IDEA'), el('h2', {}, '이제 다른 상황에 적용해요.'), el('p', {}, '배운 내용을 문제에 적용하고, 각 보기가 맞거나 틀린 이유를 확인합니다. 추측해서 맞힌 문제도 복습 대상으로 남깁니다.'), el('div', { class: 'takeaway' }, el('strong', {}, '이번 개념의 판단 기준'), el('p', {}, o.keyTakeaway)), el('div', { class: 'button-row' }, btn('개념 적용 문제 풀기 →', () => api.startPractice({ objectiveId: o.id, exam: o.exam, count: 5 }))), note('문제 연습은 점수가 아니라 이해를 확인하는 과정입니다. 틀려도 바로 설명을 읽고 다시 시도할 수 있습니다.'));
  const controls = el('div', { class: 'button-row' }, step > 0 && btn('← 이전 단계', () => api.lessonStep(o.id, step - 1), 'secondary'), step < 3 && btn(`${steps[step + 1]} →`, () => api.lessonStep(o.id, step + 1)));
  const corrections = o.correctionIds.map(id => data.corrections.find(c => c.id === id)).filter(Boolean);
  const aside = el('aside', { class: 'lesson-side' }, el('div', { class: 'panel' }, meta(pill(`${o.week}주차`)), el('h3', {}, '이번 학습의 기준'), el('p', {}, o.keyTakeaway), el('p', {}, source(o.week, o.pages)), ...prerequisiteIds(o.id, data).map(id => link(`먼저 보면 좋아요: ${data.objectiveMap.get(id).title}`, `#lesson/${id}`, 'link')), link('주차의 다른 개념', `#learn/w${String(o.week).padStart(2, '0')}`, 'link'), link('범위·정정 확인', '#scope', 'link')));
  return fragment(pageHead(o.title, `${o.weekTitle} · ${scopeLabel(o.exam)}`, link('주차 목록', `#learn/w${String(o.week).padStart(2, '0')}`, 'button secondary small'), `LESSON ${String(o.week).padStart(2, '0')}`), el('div', { class: 'lesson-layout' }, el('article', { class: 'lesson-body' }, tabs, body, controls, corrections.map(c => note(`교안 보완 · ${c.corrected}`, 'tip'))), aside));
}

export function reviewView(api) {
  const { data, state } = api;
  const reviewed = recommend(data.objectives, state.attempts, state.settings.exam).filter(r => r.review.status !== 'new');
  const due = reviewed.filter(r => r.review.due);
  const list = reviewed.map(r => el('article', { class: 'next-card' }, el('span', { class: 'step-number' }, '↻'), el('div', {}, meta(pill(`${r.objective.week}주차`), pill(r.review.label, r.review.status === 'relearn' ? 'amber' : '')), el('h3', {}, r.objective.title), el('p', {}, r.review.due ? '지금 다른 문제로 다시 확인해 보세요.' : `다음 복습: ${new Date(r.review.dueAt).toLocaleDateString('ko-KR')}`)), btn('다시 연습', () => api.startPractice({ objectiveId: r.objective.id, count: 4 }), 'secondary small')));
  return fragment(pageHead('복습 노트', '틀린 문제뿐 아니라 확신하지 못한 정답도 다시 확인합니다.', null, scopeLabel(state.settings.exam)), el('div', { class: 'stats' }, stat('복습할 개념', due.length, '개'), stat('다시 배울 개념', reviewed.filter(r => r.review.status === 'relearn').length, '개'), stat('연습한 개념', reviewed.length, '개'), stat('저장한 문제', state.bookmarks.filter(id => data.questionMap.get(id).exam === state.settings.exam).length, '개')), list.length ? el('div', { class: 'stack' }, list) : empty('첫 연습을 시작해 보세요.', '풀이 결과와 확신 정도를 바탕으로 복습할 개념이 여기에 모입니다.', link('개념 학습 시작', '#learn', 'button')), note('다른 유형의 문제를 하루 이상 간격을 두고 확신 있게 맞히면 ‘시간을 두고 확인됨’으로 표시합니다. 시험 합격 가능성을 뜻하지는 않습니다.'));
}
