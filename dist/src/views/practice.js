import { el, fragment, btn, link, pill, pageHead, note, progress, meta, source, field, select, prettyTime, empty, stat } from './ui.js';
import { remainingMs } from '../domain/learning.js';
import { objectiveCorrections } from '../domain/corrections.js';
import { correctionCard } from './corrections.js';
import { activeQuestionId, isBookmarked } from '../domain/content.js';

const typeLabels = { concept: '개념 확인', contrast: '차이 구분', application: '상황 적용', evidence: '자료 해석' };
const levels = { 1: '기본', 2: '응용', 3: '복합 판단' };

export function questionCard(q, { order = q.options.map(o => o.id), selected = null, graded = false, disabled = false, onChoose = () => {}, extras = [], titleId = 'question-title' } = {}) {
  return el('article', { class: 'question' }, meta(pill(`${q.week}주차`), pill(typeLabels[q.kind]), pill(levels[q.difficulty], q.difficulty === 3 ? 'amber' : ''), source(q.week, q.sourcePages)), el('h2', { id: titleId }, q.prompt), q.context && el('pre', { class: 'question-context', tabindex: '0' }, q.context), el('fieldset', { class: 'options', 'aria-labelledby': titleId }, el('legend', {}, graded ? '정답과 각 보기의 이유' : '가장 적절한 답 하나를 고르세요.'), order.map((id, i) => {
    const o = q.options.find(option => option.id === id);
    return el('label', { class: `option ${graded && id === q.answerId ? 'correct' : graded && id === selected ? 'wrong' : ''}` }, el('input', { type: 'radio', name: `answer-${q.id}`, value: id, checked: id === selected, disabled: graded||disabled, onchange: () => onChoose(id), id: `option-${q.id}-${id}` }), el('span', { class: 'option-code', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')), el('span', { class: 'option-content' }, o.text, graded && el('span', { class: 'rationale' }, `${id === q.answerId ? '정답 · ' : id === selected ? '선택한 답 · ' : ''}${o.explanation}`)));
  })), extras);
}

export function practiceView(api) {
  const session = api.practice;
  if (!session) return bankView(api);
  if (session.position >= session.questionIds.length) {
    const correct = session.results.filter(r => r.correct).length, uncertain = session.results.filter(r => r.confidence !== 'sure').length;
    return fragment(pageHead('이번 연습을 돌아보세요.', '점수보다 어떤 판단 기준을 놓쳤는지 확인하는 시간이 중요합니다.', null, 'SESSION COMPLETE'), el('section', { class: 'score-panel' }, el('div', { class: 'score-large' }, correct, el('small', {}, `/ ${session.results.length}`)), el('div', {}, el('h2', {}, '연습을 마쳤습니다.'), el('p', {}, `확신하지 못한 문제 ${uncertain}개를 포함해 복습 일정에 반영했습니다.`))), el('div', { class: 'stack' }, session.results.filter(r => !r.correct || r.confidence !== 'sure').map(r => {
      const q = api.data.questionMap.get(r.questionId), o = api.data.objectiveMap.get(q.objectiveId);
      return el('article', { class: 'next-card' }, el('span', { class: 'step-number' }, r.correct ? '?' : '↻'), el('div', {}, el('h3', {}, o.title), el('p', {}, q.prompt)), link('개념 확인', `#lesson/${o.id}`, 'button secondary small'));
    })), el('div', { class: 'button-row' }, btn('다른 문제 연습', () => api.endPractice(), 'secondary'), link('복습 노트 보기 →', '#review', 'button')));
  }
  const q = api.data.questionMap.get(session.questionIds[session.position]), objective = api.data.objectiveMap.get(q.objectiveId);
  const feedback = session.feedback;
  const controls = el('div', { class: 'button-row' }, !feedback ? btn('정답 확인', () => api.gradePractice()) : btn(session.position + 1 === session.questionIds.length ? '연습 마치기 →' : '다음 문제 →', () => api.nextPractice()), btn(isBookmarked(api.data,api.state.bookmarks,q.id) ? '저장한 문제 ✓' : '문제 저장', () => api.bookmark(q.id), 'secondary small'), btn('연습 목록', () => api.endPractice(), 'ghost small'));
  const confidences = el('div', { class: 'confidence', role: 'group', 'aria-label': '답에 대한 확신' }, el('span', {}, '얼마나 확신하나요?'), [['sure', '확실해요'], ['unsure', '헷갈려요'], ['guess', '추측했어요']].map(([id, label]) => el('button', { type: 'button', 'aria-pressed': String(session.confidence === id), disabled: Boolean(feedback), onclick: () => api.setConfidence(id) }, label)));
  const hint = !feedback && el('details', { ontoggle: event => { if (event.target.open) api.hintUsed(); } }, el('summary', { class: 'link' }, '개념 힌트'), el('p', { class: 'notice' }, objective.keyTakeaway));
  const result = feedback && el('section', { id: 'feedback', tabindex: '-1', class: `feedback ${feedback.correct ? '' : 'wrong'}` }, el('h3', {}, feedback.correct ? '판단이 맞았습니다.' : '판단 기준을 다시 살펴보세요.'), el('p', {}, q.explanation), el('div', { class: 'button-row' }, link(`개념: ${objective.title} ↗`, `#lesson/${objective.id}`, 'link')),
    objectiveCorrections(api.data, q.objectiveId).map(c => correctionCard(c)));
  return fragment(pageHead('문제 연습', objective.title, null, session.label), el('div', { class: 'practice-top' }, el('span', {}, `${session.position + 1} / ${session.questionIds.length}`), progress(session.position, session.questionIds.length, '이번 연습 진행')), questionCard(q, { order: session.optionOrders[q.id], selected: session.selected, graded: Boolean(feedback), onChoose: id => api.choosePractice(id), extras: [confidences, hint, result, controls] }));
}

function bankView(api) {
  const { data, state, filters } = api;
  const scoped = data.questions.filter(q => q.exam === state.settings.exam);
  const bookmarked = new Set(state.bookmarks.map(id => activeQuestionId(data, id)));
  const terms = filters.search.trim().toLocaleLowerCase('ko').split(/\s+/).filter(Boolean);
  const matches = scoped.filter(q => (filters.week === 'all' || q.week === Number(filters.week)) && (filters.kind === 'all' || q.kind === filters.kind) && (filters.level === 'all' || q.difficulty === Number(filters.level)) && (!filters.bookmarks || bookmarked.has(q.id)) && terms.every(t => `${q.prompt} ${data.objectiveMap.get(q.objectiveId).title} ${q.context ?? ''}`.toLocaleLowerCase('ko').includes(t)));
  const page = Math.min(filters.page, Math.max(0, Math.ceil(matches.length / 12) - 1));
  const controls = el('form', { class: 'filters', onsubmit: event => { event.preventDefault(); api.filter({ search: event.target.elements.search.value }); } }, field('개념·문제 검색', el('input', { id: 'question-search', name: 'search', type: 'search', value: filters.search, maxlength: '100', placeholder: '예: 전자서명, 방화벽' })), field('주차', select([['all', '전체 주차'], ...data.weeks.filter(w => w.exam === state.settings.exam).map(w => [String(w.number), `${w.number}주차`])], filters.week, e => api.filter({ week: e.target.value }), { id: 'question-week' })), field('문제 유형', select([['all', '모든 유형'], ...Object.entries(typeLabels)], filters.kind, e => api.filter({ kind: e.target.value }), { id: 'question-kind' })), field('난이도', select([['all', '모든 난이도'], ...Object.entries(levels)], filters.level, e => api.filter({ level: e.target.value }), { id: 'question-level' })), el('button', { type: 'submit', class: 'button secondary' }, '검색'));
  const list = el('div', { class: 'question-list' }, matches.slice(page * 12, (page + 1) * 12).map(q => el('article', {}, el('div', {}, meta(pill(`${q.week}주차`), pill(typeLabels[q.kind]), pill(levels[q.difficulty])), el('h3', {}, q.prompt), el('p', {}, data.objectiveMap.get(q.objectiveId).title)), btn('이 문제 풀기', () => api.startPractice({ questionId: q.id }), 'secondary small'))));
  return fragment(pageHead('문제 연습', '조건에 맞는 문제를 고르거나, 처음 보는 문제부터 연습하세요.', btn('오늘의 10문제 →', () => api.startPractice({ count: 10, daily: true })), 'PRACTICE WITH REASONS'), controls, el('div', { class: 'section-head' }, el('p', { class: 'muted', role: 'status' }, `${matches.length}문항`), btn(filters.bookmarks ? '전체 문제 보기' : '저장한 문제만', () => api.filter({ bookmarks: !filters.bookmarks }), 'ghost small')), matches.length ? list : empty('조건에 맞는 문제가 없습니다.', '검색어 또는 필터를 바꿔 보세요.'), matches.length > 12 && el('div', { class: 'button-row' }, btn('← 이전', () => api.filter({ page: page - 1 }), 'secondary small', { disabled: page === 0 }), el('small', {}, `${page + 1} / ${Math.ceil(matches.length / 12)}`), btn('다음 →', () => api.filter({ page: page + 1 }), 'secondary small', { disabled: (page + 1) * 12 >= matches.length })));
}

export function examView(api) {
  const exam = api.state.activeExam;
  if (!exam) return fragment(pageHead('60분 모의고사', '해설 없이 끝까지 풀고, 제출 후 약점을 확인합니다.', null, 'MOCK EXAM'), el('div', { class: 'two-columns' }, el('section', { class: 'panel' }, meta(pill(api.state.settings.exam === 'midterm' ? '중간 · 1–7주차' : '기말 · 9–14주차'), pill('객관식 연습')), el('h2', {}, '이번 연습의 문항 수'), el('p', {}, '실제 시험의 문항 수와 유형은 아직 확인되지 않았습니다. 아래 설정은 연습용이며, 제한시간은 60분입니다.'), el('div', { class: 'filters' }, field('문항 수', select([['20', '20문항'], ['30', '30문항 · 기본 연습'], ['40', '40문항']], '30', null, { id: 'mock-count' }))), el('ul', { class: 'privacy-list' }, el('li', {}, '주차를 골고루 포함하고 같은 유형의 중복 출제를 피합니다.'), el('li', {}, '새로고침하거나 다른 화면을 보더라도 시간은 계속 흐릅니다.'), el('li', {}, '제출 전까지 답을 바꾸거나 다시 볼 문제를 표시할 수 있습니다.'), el('li', {}, '시간이 끝나면 미응답 문항은 오답으로 처리됩니다.')), el('div', { class: 'button-row' }, btn('60분 모의고사 시작 →', () => api.startExam(Number(document.querySelector('#mock-count').value))))), el('aside', { class: 'panel' }, el('h3', {}, '최근 모의고사'), api.state.examHistory.length ? el('div', { class: 'stack' }, api.state.examHistory.slice().reverse().slice(0, 5).map(e => link(el('p', {}, `${e.exam === 'midterm' ? '중간' : '기말'} ${e.questionIds.length}문항 · ${e.score}점`, el('br'), el('small', {}, new Date(e.finishedAt).toLocaleDateString('ko-KR'))), `#results/${e.id}`, 'notice'))) : el('p', { class: 'muted' }, '아직 모의고사 기록이 없습니다.'))));
  const q = api.data.questionMap.get(exam.questionIds[exam.position]);
  const answered = Object.keys(exam.answers).length;
  const aside = el('aside', { class: 'exam-aside panel' }, el('span', { class: 'eyebrow' }, '남은 시간'), el('div', { class: 'timer', id: 'exam-time', 'aria-label': '남은 시험 시간' }, prettyTime(remainingMs(exam))), el('small', {}, `${answered}/${exam.questionIds.length}문항 응답`), el('div', { class: 'number-grid', 'aria-label': '시험 문항 이동' }, exam.questionIds.map((id, i) => el('button', { type: 'button', class: `${exam.answers[id] ? 'answered' : ''} ${exam.flagged.includes(id) ? 'flagged' : ''} ${i === exam.position ? 'current' : ''}`, 'aria-label': `${i + 1}번${exam.answers[id] ? ' 응답함' : ' 미응답'}${exam.flagged.includes(id) ? ' 다시 볼 문제' : ''}`, 'aria-current': i === exam.position ? 'true' : null, onclick: () => api.examPosition(i) }, i + 1))), el('small', {}, '초록: 응답 · 밑줄: 다시 보기'), el('div', { class: 'button-row' }, btn('답안 제출', () => api.submitExam(), 'secondary')));
  const locked=!!api.cloud&&!api.cloud.canEditExam;
  if(locked)aside.querySelectorAll('button').forEach(button=>{button.disabled=true;});
  const notice=api.cloud&&el('div',{class:'notice cloud-exam-notice',role:'status'},api.cloud.busy?'답안을 계정에 저장하고 있습니다.':api.cloud.pendingCount?'답안 전송 대기 중입니다. 연결 후 저장 결과를 확인해 주세요.':api.cloud.canEditExam?'답안은 계정에 저장되며 남은 시간은 서버 기준입니다.':'다른 기기에서 진행 중이거나 연결 확인이 필요합니다.',!api.cloud.busy&&!api.cloud.canEditExam&&el('div',{class:'button-row'},btn('이 기기에서 이어 풀기',()=>api.takeoverExam(),'secondary'),btn('저장 상태 확인',()=>api.syncAccount(),'secondary')));
  return fragment(pageHead(`${exam.position + 1}번 문제`, `${exam.exam === 'midterm' ? '중간' : '기말'} · ${exam.questionIds.length}문항 · 60분`),notice, el('div', { class: 'exam-layout' }, questionCard(q, { order: exam.optionOrders[q.id], selected: exam.answers[q.id],disabled:locked, onChoose: id => api.chooseExam(q.id, id), extras: el('div', { class: 'button-row' }, btn('← 이전', () => api.examPosition(exam.position - 1), 'secondary', { disabled: locked||exam.position === 0 }), btn(exam.flagged.includes(q.id) ? '다시 보기 표시됨 ✓' : '다시 볼 문제', () => api.flagExam(q.id), 'ghost small',{disabled:locked}), exam.position + 1 < exam.questionIds.length ? btn('다음 →', () => api.examPosition(exam.position + 1),'',{disabled:locked}) : btn('답안 제출 →', () => api.submitExam(),'',{disabled:locked})) }), aside));
}

export function resultView(api, id) {
  const result = api.state.examHistory.find(e => e.id === id);
  if (!result) return empty('결과를 찾을 수 없습니다.', '이 브라우저에 저장된 최근 20회 결과만 표시합니다.', link('모의고사', '#exam', 'button'));
  const weak = [...new Set(result.questionIds.filter(qid => result.answers[qid] !== api.data.questionMap.get(qid).answerId).map(qid => api.data.questionMap.get(qid).objectiveId))];
  return fragment(pageHead('모의고사 결과', `${result.exam === 'midterm' ? '중간' : '기말'} · ${result.questionIds.length}문항 · ${new Date(result.finishedAt).toLocaleString('ko-KR')}`, link('다른 모의고사', '#exam', 'button secondary small')), el('section', { class: 'score-panel' }, el('div', { class: 'score-large' }, result.score, el('small', {}, '점')), el('div', {}, el('h2', {}, `정답 ${result.correct} / ${result.questionIds.length}`), el('p', {}, `미응답 ${result.unanswered}문항 · 풀이 시간 ${prettyTime(result.finishedAt - result.startAt)}`), el('p', {}, '연습 결과이며 실제 시험 점수나 합격 가능성의 예측은 아닙니다.'))), weak.length && el('section', { class: 'panel' }, el('h2', {}, '다음에 확인할 개념'), el('div', { class: 'button-row' }, weak.map(oid => link(api.data.objectiveMap.get(oid).title, `#lesson/${oid}`, 'button secondary small')))), el('h2', { class: 'section-head' }, '문제별 해설'), result.questionIds.map((qid, i) => {
    const q = api.data.questionMap.get(qid), right = result.answers[qid] === q.answerId;
    return el('details', { class: 'audit-week' }, el('summary', {}, `${i + 1}. ${q.prompt}`, pill(right ? '정답' : result.answers[qid] ? '오답' : '미응답', right ? 'green' : 'amber')), el('div', { class: 'audit-detail' }, questionCard(q, { order: result.optionOrders[qid], selected: result.answers[qid], graded: true, titleId: `result-${qid}`, extras: [el('p', { class: 'notice' }, q.explanation), link('관련 개념 학습 →', `#lesson/${q.objectiveId}`, 'link'), ...objectiveCorrections(api.data, q.objectiveId).map(c => correctionCard(c))] })));
  }));
}
