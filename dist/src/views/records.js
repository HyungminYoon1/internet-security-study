import { el, fragment, btn, link, pageHead, note, field, select, empty } from './ui.js';
import { filterCorrections } from '../domain/corrections.js';
import { correctionCard } from './corrections.js';

export function scopeView(api) {
  const { data } = api;
  const filters = { search: '', week: 'all', status: 'all' };
  const count = el('p', { id: 'correction-count', class: 'muted', role: 'status', 'aria-live': 'polite' });
  const list = el('div', { id: 'correction-list' });
  function update(patch) {
    Object.assign(filters, patch);
    const matches = filterCorrections(data.corrections, filters);
    count.textContent = `${matches.length}개 항목 · 주차를 열고 비교할 항목을 선택하세요.`;
    const expanded = Boolean(filters.search.trim()) || filters.week !== 'all' || filters.status !== 'all';
    list.replaceChildren(...data.weeks.flatMap(w => {
      const own = matches.filter(c => c.week === w.number);
      return own.length ? [el('details', { class: 'audit-week', open: expanded },
        el('summary', {}, `${w.number}주차 · ${w.title}`, el('small', {}, `${own.length}개 항목`)),
        el('div', { class: 'audit-detail' }, own.map(c => correctionCard(c, { id: c.id }))))] : [];
    }));
    if (!matches.length) list.append(empty('조건에 맞는 정정 항목이 없습니다.', '검색어 또는 주차·확인 상태를 바꿔 보세요.'));
  }
  const controls = el('div', { class: 'filters correction-filters' },
    field('교안·검증 내용 검색', el('input', { type: 'search', id: 'correction-search', maxlength: 200, placeholder: '예: 전자서명, DES, ctime', oninput: e => update({ search: e.target.value }) })),
    field('주차', select([['all', '전체 주차'], ...data.weeks.map(w => [String(w.number), `${w.number}주차`])], 'all', e => update({ week: e.target.value }), { id: 'correction-week' })),
    field('확인할 항목', select([['all', '모든 정정·보완'], ['pending', '교수님 확인 필요'], ['contextualized', '조건·맥락 보완'], ['excluded', '근거 미확인 · 앱 채점 제외']], 'all', e => update({ status: e.target.value }), { id: 'correction-filter' })));
  update({});
  const coverage = data.weeks.map(w => {
    const rows = w.coverage.map(c => el('tr', {}, el('td', {}, c.pages.join(', ')), el('td', {}, c.topic, c.note && el('p', { class: 'muted' }, c.note)), el('td', {}, c.objectiveIds.length ? c.objectiveIds.map((id, i) => fragment(i ? el('br') : null, link(data.objectiveMap.get(id).title, `#lesson/${id}`, 'link'))) : (c.status === 'blank' ? '빈 페이지' : '안내 페이지'))));
    return el('details', { class: 'audit-week', id: `scope-${w.id}` }, el('summary', {}, `${w.number}주차 · ${w.title}`, el('small', {}, `${w.source.pages}쪽 · ${w.objectives.length}개 개념 · ${w.questions.length}문항`)),
      el('div', { class: 'audit-detail' }, el('p', { class: 'muted' }, w.source.filename),
        el('div', { class: 'table-wrap' }, el('table', { class: 'comparison coverage-table' }, el('thead', {}, el('tr', {}, ['쪽', '교안 내용', '연결된 학습'].map(t => el('th', { scope: 'col' }, t)))), el('tbody', {}, rows))),
        w.references.length > 0 && el('details', {}, el('summary', { class: 'link' }, '추가 참고자료'), el('ul', { class: 'privacy-list' }, w.references.map(ref => el('li', {}, el('a', { href: ref.url, target: '_blank', rel: 'noopener noreferrer', class: 'link' }, ref.title)))))));
  });
  return fragment(pageHead('학습 범위와 정정 안내', '교안의 설명과 검증한 내용을 비교하고, 시험 전에 확인할 항목을 찾아보세요.', null, 'SCOPE & EVIDENCE'),
    el('div', { class: 'scope-stats' }, el('span', {}, el('strong', {}, '13'), '개 교안'), el('span', {}, el('strong', {}, '315'), '쪽 확인'), el('span', {}, el('strong', {}, data.objectives.length), '개 학습 개념'), el('span', {}, el('strong', {}, data.questions.length), '개 문항'), el('span', {}, el('strong', {}, data.corrections.length), '개 정정·맥락 보완')),
    note('기술적으로 확인한 내용과 실제 시험의 채점 기준은 별개입니다. 교수님 확인 필요 표시가 있는 항목은 시험 전에 문의하세요. 앱의 학습·채점 기준은 교수님이 확정한 답안이 아닙니다.'),
    el('section', { 'aria-labelledby': 'correction-heading' }, el('h2', { id: 'correction-heading' }, '교안 설명과 검증 내용 비교'),
      el('p', { class: 'muted correction-intro' }, '교안의 주장과 검토할 표현을 요약했습니다. 149건에는 기술 내용 정정, 조건 보완, 근거 미확인 항목이 함께 포함됩니다.'), controls, count, list),
    el('section', { class: 'coverage-section' }, el('h2', {}, '페이지별 학습 범위'), el('p', { class: 'muted' }, '중간 1–7주차 · 기말 9–14주차. 원문 PDF 쪽 번호와 관련 학습을 연결합니다.'), coverage),
    note('교안 원문과 캡처는 재배포하지 않습니다. 강의 중 구두 설명, 실제 시험 문항·출제 비중·정답표는 확인하지 않았습니다. 검토 기준일: 2026-10-15.'));
}

export function recordsView(api) {
  const { state } = api;
  const planning = el('section', { class: 'panel' }, el('h2', {}, '학습 계획'), el('p', {}, '시험일을 정하면 오늘의 학습에서 남은 개념을 하루에 얼마나 읽을지 제안합니다. 문제 적용과 복습은 별도로 진행하세요.'), el('div', { class: 'filters' }, field('시험 예정일 · 선택 사항', el('input', { type: 'date', id: 'exam-date', value: state.settings.examDate, onchange: e => api.saveSettings({ examDate: e.target.value }) }))), el('p', { class: 'muted' }, state.settings.examDate ? `예정일: ${state.settings.examDate}` : '시험 날짜를 아직 정하지 않아도 모든 기능을 사용할 수 있습니다.'));
  const backup = el('section', { class: 'panel' }, el('h2', {}, '학습 기록 백업'), el('p', {}, `풀이 ${state.attempts.length}건 · 읽기 ${state.read.length}개 · 모의고사 ${state.examHistory.length}회`), el('div', { class: 'button-row' }, btn('현재 기록 내려받기', () => api.exportBackup()), api.cloud ? btn('계정 대기 원본 보관',()=>api.exportPending(),'secondary') : api.repository.raw() && btn('저장 원본 보관', () => api.exportRaw(), 'secondary')), note(api.cloud?'계정 동기화와 별도로 파일 백업도 사용할 수 있습니다. 기기를 바꾸기 전에 계정 화면의 전송 대기 상태를 확인하세요.':'브라우저 데이터 삭제·기기 변경 시 기록이 사라질 수 있습니다. 중요한 학습 후에는 백업 파일을 보관해 주세요.'));
  const restore = el('section', { class: 'panel' }, el('h2', {}, '백업 가져오기'), el('p', {}, '내용과 버전을 먼저 검사합니다. 확인 버튼을 누르기 전에는 현재 기록을 바꾸지 않습니다.'), field('이 앱에서 내려받은 JSON · 최대 2MB', el('input', { type: 'file', id: 'backup-file', class: 'file-input', accept: '.json,application/json', onchange: e => api.previewBackup(e.target.files[0]) })), api.pendingBackup && el('div', { class: 'notice tip', role: 'status' }, `검사 완료 · 풀이 ${api.pendingBackup.state.attempts.length}건 · 읽기 ${api.pendingBackup.state.read.length}개 · 모의고사 ${api.pendingBackup.state.examHistory.length}회`, el('p', {}, api.cloud?'계정의 기존 기록에 합칩니다. 계정 설정과 진행 중인 모의고사는 바꾸지 않습니다.':'현재 기록을 이 백업 내용으로 교체합니다. 필요한 경우 먼저 현재 기록을 내려받으세요.'), el('div', { class: 'button-row' }, btn(api.cloud?'검사한 백업을 계정에 합치기':'검사한 백업으로 복원', () => api.restoreBackup()), btn('취소', () => api.cancelBackup(), 'secondary'))));
  const privacy = el('section', { class: 'panel' }, el('h2', {}, '저장되는 정보'), el('ul', { class: 'privacy-list' }, el('li', {}, '읽은 개념, 최근 3,000개 풀이, 복습 판단에 쓰는 확신 정도'), el('li', {}, '진행 중인 시험, 최근 20회 모의고사 결과, 문제 북마크'), el('li', {}, '선택한 시험 범위와 예정일, 마지막 학습 단계')), el('p', {}, api.cloud?'로그인한 계정으로 동기화 중입니다. 초기화는 이 계정의 모든 기기에 적용됩니다. 비로그인 기록은 지우지 않습니다.':'현재는 이 브라우저에만 저장합니다. 계정에 로그인하면 여러 기기에서 같은 기록을 이어갈 수 있습니다.'),el('p',{class:'muted'},'분석 추적·공개 랭킹은 없습니다. 같은 GitHub Pages 출처의 다른 코드가 브라우저 저장소에 접근할 수 있으므로 개인정보나 비밀 메모는 입력하지 마세요.'),link('계정·동기화 안내','#account','link'), el('div', { class: 'button-row' }, btn(api.cloud?'계정 학습 기록 초기화':'이 앱의 기록 초기화', () => api.resetRecords(), 'secondary small')));
  const history = el('section', { class: 'panel' }, el('h2', {}, '최근 모의고사'), state.examHistory.length ? el('ul', { class: 'privacy-list' }, [...state.examHistory].reverse().map(e => el('li', {}, link(`${e.exam === 'midterm' ? '중간' : '기말'} · ${e.questionIds.length}문항 · ${e.score}점 · ${new Date(e.finishedAt).toLocaleString('ko-KR')} · 결과 보기`, `#results/${e.id}`, 'link')))) : el('p', { class: 'muted' }, '모의고사를 제출하면 결과와 문제별 해설이 여기에 남습니다.'));
  return fragment(pageHead('기록과 백업', '저장 상태를 확인하고, 자신의 학습 기록을 직접 보관하세요.', null, 'YOUR DATA'), api.storageMessage && note(api.storageMessage, 'error'), el('div', { class: 'two-columns' }, el('div', { class: 'stack' }, planning, history, backup), el('div', { class: 'stack' }, restore, privacy)));
}
