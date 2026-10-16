import { WEEK_NUMBERS, buildCatalog, activeQuestionId, toggleBookmark } from './domain/content.js';
import { selectQuestions, optionOrder, grade, recordAttempt, newExam, answerExam, finishExam, remainingMs, reviewState } from './domain/learning.js';
import { makeBackup, parseBackup, validateState, MAX_BYTES } from './domain/backup.js';
import { createRepository, STORAGE_KEY } from './storage.js';
import { el, btn, prettyTime } from './views/ui.js';
import { homeView, curriculumView, lessonView, reviewView } from './views/learn.js';
import { practiceView, examView, resultView } from './views/practice.js';
import { scopeView, recordsView } from './views/records.js';
import { casesView, caseView } from './views/cases.js';
import { accountView } from './views/account.js';
import { createNeonTransport, publicError } from './cloud/neon.js';
import { createCloudSession } from './cloud/session.js';
import { loadDeviceId } from './cloud/storage.js';

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
  let cloud = null, transportPromise = null, accountUser = null, examFinishBusy = false, nextExamCheck = 0;
  const accountModeKey = 'internet-security-account-mode-v1';
  const auth = { mode:'signin', email:'', busy:false, error:'', message:'', restoreNotice:'' };
  let deviceId;
  const transport = () => transportPromise ||= createNeonTransport();
  let backupReadId = 0;
  let filters = { search: '', week: 'all', kind: 'all', level: 'all', bookmarks: false, page: 0 };
  const caseState = {};
  function commit(next) {
    try { validateState(next, data); }
    catch (error) { toast(error.message); return { ok: false, reason: 'invalid', message: error.message }; }
    let result;
    if(cloud) {
      if(!cloud.state){toast('계정 기록을 먼저 불러와 주세요.');return{ok:false};}
      try { result=cloud.change(next);state=cloud.state;updateShell();return result; }
      catch(error){toast(error.message);return{ok:false};}
    }
    result = repository.save(next);
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
    document.querySelector('#storage-mode').textContent=cloud?'계정 기록 · 기기에 전송 대기본 보관':'비로그인 · 이 브라우저에 저장';
    document.querySelector('#sync-summary').textContent=!cloud?'로그인·동기화':cloud.error||cloud.blocked||cloud.conflicts.length?'동기화 확인 필요':cloud.busy?'동기화 중…':cloud.pendingCount?`${cloud.pendingCount}건 전송 대기`:'계정·동기화';
    const accountNotice=document.querySelector('#account-notice');
    const accountMessage=cloud?.error||(cloud?.blocked?'자동 동기화를 멈췄습니다. 계정 화면에서 기록을 확인해 주세요.':cloud?.conflicts.length?'다른 기기의 변경과 충돌한 항목이 있습니다. 계정 화면에서 선택해 주세요.':!cloud?auth.restoreNotice:'');
    accountNotice.hidden=!accountMessage;accountNotice.replaceChildren();
    if(accountMessage)accountNotice.append(el('span',{},accountMessage),' ',el('a',{href:'#account',class:'link'},'계정·동기화'));
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
    else if (route === 'account') view = accountView(api);
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
    const remaining = remainingMs(exam,cloud?cloud.now():Date.now()), text = prettyTime(remaining);
    document.querySelector('#running-time').textContent = text;
    const counter = document.querySelector('#exam-time'); if (counter) counter.textContent = text;
    if (remaining === 0 && submit) {
      if(cloud){if(!examFinishBusy&&!cloud.busy&&Date.now()>=nextExamCheck){examFinishBusy=true;nextExamCheck=Date.now()+15000;void cloud.flush({pull:true}).finally(()=>{examFinishBusy=false;if(!state.activeExam){render();toast('시간이 종료되어 모의고사를 마쳤습니다.');}});}}
      else {completeExam();toast('60분이 지나 답안을 제출했습니다.');}
    }
  }
  async function completeExam() {
    const exam = state.activeExam; if (!exam) return;
    if(cloud){try{await cloud.exam('finish');if(!cloud.state?.activeExam&&cloud.state?.examHistory.some(e=>e.id===exam.id))navigate(`results/${exam.id}`);}catch(error){toast(error.message);}return;}
    const result = finishExam(exam, [...data.questionMap.values()]);
    let attempts = state.attempts;
    for (const qid of result.questionIds) {
      if (!result.answers[qid]) continue;
      const q = data.questionMap.get(qid);
      attempts = recordAttempt(attempts, { id: `${exam.id}-${qid}`, questionId: qid, objectiveId: q.objectiveId, family: q.family, answerId: result.answers[qid], correct: grade(q, result.answers[qid]), confidence: 'unsure', at: result.finishedAt, mode: 'exam' });
    }
    commit({ ...state, activeExam: null, attempts, examHistory: [...state.examHistory, result].slice(-20) });
    navigate(`results/${result.id}`);
  }
  function cloudChanged(){
    if(cloud?.state)state=cloud.state;
    if(['#account','#exam'].includes(location.hash))render();else updateShell();
  }
  async function activateAccount(user){
    if(!user)throw Object.assign(new Error('SESSION_UNAVAILABLE'),{code:'SESSION_UNAVAILABLE'});
    if(!user?.emailVerified){auth.email=user?.email||auth.email;auth.mode='verify';auth.message='이메일 인증을 완료해 주세요.';return;}
    cloud?.stop();practice=null;pendingBackup=null;accountUser=user;auth.mode='account';auth.restoreNotice='';
    deviceId=loadDeviceId(storage);
    cloud=createCloudSession({storage,catalog:data,user,transport:await transport(),deviceId,onChange:cloudChanged});
    try{storage.setItem(accountModeKey,'account');}catch{/* Session can still explain unavailable local storage. */}
    await cloud.start();if(!cloud.state)navigate('account');render();
  }
  async function saveCloudExam(patch){
    if(!cloud?.canEditExam){toast('진행 기기와 저장 상태를 확인해 주세요.');return;}
    const exam=state.activeExam;if(!exam)return;
    try{await cloud.exam('save',{answers:exam.answers,flagged:exam.flagged,position:exam.position,...patch});render();}catch(error){toast(error.message);}
  }
  const api = {
    data, repository, caseState, get state() { return state; }, get practice() { return practice; }, get filters() { return filters; }, get pendingBackup() { return pendingBackup; }, get storageMessage() { return storageMessage; },
    navigate, render, toast,
    get account(){return{...auth,user:accountUser,session:cloud};},get cloud(){return cloud;},
    authMode(mode){if(auth.busy)return;const email=document.querySelector('#auth-email')?.value;if(email)auth.email=email;auth.mode=mode;auth.error='';auth.message='';render();},
    async authSubmit(mode,values){
      if(auth.busy)return;
      auth.email=values.email;auth.busy=true;auth.error='';auth.message='';render();
      try{
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)||values.email.length>254)throw new TypeError('이메일 형식을 확인해 주세요.');
        if(['signup','reset-confirm'].includes(mode)&&(values.password.length<12||values.password.length>128))throw new TypeError('비밀번호는 12–128자로 입력해 주세요.');
        if(['verify','reset-confirm'].includes(mode)&&!/^\d{6}$/.test(values.otp))throw new TypeError('인증번호 6자리를 입력해 주세요.');
        const client=await transport();
        if(mode==='signin')await activateAccount(await client.signIn(values.email,values.password));
        else if(mode==='signup'){await client.signUp(values.email,values.password);auth.mode='verify';auth.message='이메일로 받은 인증번호를 입력해 주세요.';}
        else if(mode==='verify'){await client.verify(values.email,values.otp);const user=await client.session();if(user?.emailVerified)await activateAccount(user);else{auth.mode='signin';auth.message='이메일을 인증했습니다. 로그인해 주세요.';}}
        else if(mode==='resend'){await client.resend(values.email);auth.message='이메일로 받은 새 인증번호를 입력해 주세요.';}
        else if(mode==='reset'){await client.requestReset(values.email);auth.mode='reset-confirm';auth.message='가입한 이메일이라면 인증번호를 받을 수 있습니다.';}
        else if(mode==='reset-confirm'){await client.resetPassword(values.email,values.otp,values.password);auth.mode='signin';auth.message='비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.';}
      }catch(error){auth.error=error instanceof TypeError&&/이메일 형식|비밀번호는|인증번호 6자리/.test(error.message)?error.message:publicError(error);}
      finally{values.password='';values.otp='';auth.busy=false;render();}
    },
    async syncAccount(){await cloud?.flush({pull:true});render();},
    async resolveAccount(choice){try{await cloud?.resolve(choice);}catch(error){toast(error.message);}render();},
    exportPending(){const raw=cloud?.pendingBackup();if(raw)download(raw,'internet-security-account-pending.json');},
    async recoverAccount(){
      if(!cloud||!await confirmAction('최신 계정 기록으로 다시 연결할까요?','이 기기의 미전송 기록을 원본 파일로 내려받은 뒤, 최신 계정 기록을 불러옵니다. 내려받은 파일은 보관해 주세요.'))return;
      api.exportPending();await cloud.recover();render();
    },
    async importGuest(){
      if(!cloud?.state)return;const guest=repository.load();if(!guest.ok){toast(guest.message);return;}
      if(!await confirmAction('이 브라우저 기록을 계정에 합칠까요?',`읽기 ${guest.state.read.length}개, 풀이 ${guest.state.attempts.length}건, 모의고사 ${guest.state.examHistory.length}회를 합칩니다. 계정 설정과 진행 중인 모의고사는 유지하며, 이 브라우저의 진행 중인 모의고사는 가져오지 않습니다. 원본은 그대로 남습니다.`))return;
      try{await cloud.importState(guest.state);render();}catch(error){toast(error.message);}
    },
    async signOut(){
      if(cloud?.pendingCount&&!await confirmAction('대기 기록을 남기고 로그아웃할까요?','미전송 기록은 이 기기에 계정별로 보관합니다. 다음에 같은 계정으로 로그인해야 전송됩니다. 다른 기기에서는 아직 볼 수 없습니다.'))return;
      try{await(await transport()).signOut();cloud?.stop();cloud=null;accountUser=null;try{storage.setItem(accountModeKey,'guest');}catch{}
        const guest=repository.load();state=guest.state;storageMessage=guest.ok?'':guest.message;practice=null;pendingBackup=null;auth.mode='signin';auth.error='';auth.restoreNotice='';auth.message='로그아웃했습니다. 비로그인 기록으로 돌아왔습니다.';render();
      }catch(error){toast(publicError(error));}
    },
    async takeoverExam(){if(cloud&&await confirmAction('이 기기에서 이어 풀까요?','다른 기기에서는 답안을 수정할 수 없게 됩니다. 이미 저장한 답안과 남은 시간은 그대로 이어집니다.')){try{await cloud.exam('takeover');render();}catch(error){toast(error.message);}}},
    saveSettings(patch) { commit({ ...state, settings: { ...state.settings, ...patch } }); render(); },
    lessonStep(id, step) {
      commit({ ...state, settings: { ...state.settings, lastObjective: id, lessonStep: step }, read: step === 3 ? [...new Set([...state.read, id])] : state.read }); render(false, 'main');
    },
    filter(patch) { filters = { ...filters, page: 0, ...patch }; render(); },
    startPractice({ questionId, objectiveId, week, exam = state.settings.exam, count = 10, daily = false, diagnostic = false } = {}) {
      try {
        const seed = uid('practice');
        let selected;
        if (questionId) selected = [data.questionMap.get(activeQuestionId(data, questionId))];
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
      commit({ ...state, attempts: recordAttempt(state.attempts, attempt) });
      // A blocked account rejects the write. Do not present an unrecorded result
      // as completed; leave the answer selectable so the learner can retry.
      if (!state.attempts.some(saved => saved.id === attempt.id)) return;
      practice.feedback = attempt; practice.results.push(attempt); render(false, 'feedback');
    },
    nextPractice() { if (!practice?.feedback) return; practice.position++; practice.feedback = null; practice.selected = null; practice.confidence = 'unsure'; practice.hinted = false; render(true); },
    endPractice() { practice = null; navigate('practice'); },
    bookmark(id) { commit({ ...state, bookmarks: toggleBookmark(data,state.bookmarks,id) }); render(); },
    async startExam(count) {
      if (state.activeExam) { navigate('exam'); return; }
      if(cloud){try{await cloud.exam('start',{exam:newExam(data.questions,{exam:state.settings.exam,count,seed:uid('seed'),id:uid('exam')})});render(true);}catch(error){toast(error.message);}return;}
      try { commit({ ...state, activeExam: newExam(data.questions, { exam: state.settings.exam, count, seed: uid('seed'), id: uid('exam') }) }); render(true); } catch (error) { toast(error.message); }
    },
    chooseExam(id, answer) { if(cloud)return saveCloudExam({answers:{...state.activeExam.answers,[id]:answer}}); try { commit({ ...state, activeExam: answerExam(state.activeExam, id, answer, [...data.questionMap.values()]) }); render(); } catch (error) { tick(); toast(error.message); } },
    examPosition(position) { tick(); if (!state.activeExam || position < 0 || position >= state.activeExam.questionIds.length) return; if(cloud)return saveCloudExam({position});commit({ ...state, activeExam: { ...state.activeExam, position } }); render(true); },
    flagExam(id) { tick(); if (!state.activeExam) return; const exam = state.activeExam;const flagged=exam.flagged.includes(id)?exam.flagged.filter(q=>q!==id):[...exam.flagged,id];if(cloud)return saveCloudExam({flagged});commit({ ...state, activeExam: { ...exam, flagged } }); render(); },
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
      if(cloud){if(!pendingBackup||!await confirmAction('백업을 계정 기록에 합칠까요?','계정의 기존 읽기·풀이·모의고사 결과는 유지합니다. 계정 설정과 진행 중인 모의고사는 바꾸지 않습니다.'))return;try{await cloud.importState(pendingBackup.state);pendingBackup=null;render();}catch(error){toast(error.message);}return;}
      if (!pendingBackup || !await confirmAction('백업으로 교체할까요?', '현재 이 앱의 학습 기록을 검사한 백업으로 교체합니다. 필요한 현재 기록은 먼저 내려받아 보관해 주세요.')) return;
      const result = repository.restore(pendingBackup.json);
      if (!result.ok) { toast(result.message); return; }
      backupReadId++; state = result.state; pendingBackup = null; practice = null; storageMessage = ''; render(true); tick(); toast('백업을 복원했습니다.');
    },
    async resetRecords() {
      if(cloud){if(!await confirmAction('계정의 학습 기록을 초기화할까요?','이 계정의 모든 기기에 적용됩니다. 현재 기록을 백업 파일로 내려받은 뒤 초기화합니다. 다른 기기의 미전송 기록은 자동으로 합쳐지지 않습니다. 비로그인 기록은 그대로 남습니다.'))return;api.exportBackup();try{if(await cloud.reset()){practice=null;pendingBackup=null;render();toast('계정 학습 기록을 초기화했습니다.');}}catch(error){toast(error.message);}return;}
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
  window.addEventListener('storage', event => { if(cloud&&(event.key===cloud.key||event.key===null))cloud.storageChanged();if (!cloud&&(event.key === STORAGE_KEY || event.key === null)) { storageMessage = '다른 탭에서 저장소가 바뀌었습니다. 현재 기록을 백업한 뒤 새로고침해 주세요.'; updateShell(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) {tick();void cloud?.flush({pull:true});} });
  window.addEventListener('online',()=>void cloud?.flush({pull:true}));
  setInterval(tick, 1000);
  render(); tick();
  try{if(storage.getItem(accountModeKey)==='account'){
    auth.busy=true;auth.restoreNotice='계정 연결을 확인하고 있습니다. 현재 화면은 이 브라우저의 비로그인 기록입니다.';updateShell();
    void transport().then(client=>client.session()).then(user=>{
      if(user)return activateAccount(user);
      auth.restoreNotice='계정에 다시 로그인해 주세요. 현재 화면은 이 브라우저의 비로그인 기록이며 계정 진도가 아닙니다.';
    }).catch(error=>{auth.error=publicError(error);auth.restoreNotice='계정 기록을 불러오지 못했습니다. 현재 화면은 비로그인 기록입니다. 계정 화면에서 다시 연결해 주세요.';}).finally(()=>{auth.busy=false;if(location.hash==='#account')render();else updateShell();});
  }}catch{/* Guest learning remains available when browser storage is disabled. */}
} catch (error) {
  root.replaceChildren(el('section', { class: 'empty' }, el('h1', { tabindex: '-1' }, '학습 자료를 불러오지 못했습니다.'), el('p', {}, '연결 상태를 확인한 뒤 다시 시도해 주세요. 저장된 기록은 변경하지 않았습니다.'), el('p', { class: 'notice error' }, error.message), btn('다시 불러오기', () => location.reload())));
}
