import {el,fragment,btn,link,pageHead,note,field,pill} from './ui.js';

const settingNames={exam:'학습 범위',examDate:'시험 예정일',lesson:'마지막 학습 단계'};
const show=value=>typeof value==='boolean'?(value?'저장함':'저장 안 함'):typeof value==='object'?`${value.lastObjective||'시작 전'} · ${value.lessonStep+1}단계`:value==='midterm'?'중간':value==='final'?'기말':value||'설정 안 함';
export function accountView(api) {
  const auth=api.account,session=auth.session;
  const privacy=el('section',{class:'panel account-privacy'},el('h2',{},'저장과 동기화'),el('ul',{class:'privacy-list'},
    el('li',{},'비로그인 기록은 이 브라우저에만 남습니다. 로그인 뒤 가져오기를 선택해야 계정에 합쳐집니다.'),
    el('li',{},'이메일과 학습 진도를 저장하며 이름·전화번호는 받지 않습니다. 비밀번호와 로그인 세션은 Neon 인증 서비스가 처리하고, 접속 IP·브라우저 정보가 인증 기록에 포함될 수 있습니다.'),
    el('li',{},'읽기와 풀이는 합치고, 서로 다른 북마크·설정 변경은 선택을 요청합니다. 기기 시각으로 덮어쓰지 않습니다.'),
    el('li',{},'풀이 최근 3,000건, 모의고사 최근 20회를 보관합니다. 모의고사는 한 기기에서만 수정할 수 있습니다.'),
    el('li',{},'연결이 끊기면 열린 화면에서 진행한 학습을 기기에 보관합니다. 다른 기기로 옮기기 전에 동기화 완료를 확인하세요.'),
    el('li',{},'계정 대기 기록은 기기에 남습니다. 공용 PC에서는 동기화·백업 후 로그아웃하고 사이트 데이터를 지워 주세요. 같은 GitHub Pages 출처의 다른 앱과 브라우저 저장 공간을 공유합니다.')),
    el('p',{class:'muted'},'무료 서비스의 이용 한도 또는 이메일 전송 제한으로 연결이 지연될 수 있습니다. 동기화가 실패해도 기록을 지우지 않으며, 파일 백업을 계속 사용할 수 있습니다.'),
    link('기록·백업 열기','#records','link'));
  if(session&&auth.mode==='account') {
    const body=el('section',{class:'panel account-panel'},pill(session.error||session.blocked?'확인 필요':session.pendingCount?'전송 대기':session.busy?'연결 중':'계정 연결','green'),
      el('h2',{},auth.user.email),el('p',{id:'account-sync-state',role:'status'},session.busy?'계정 기록을 확인하고 있습니다.':session.pendingCount?`${session.pendingCount}건 전송 대기`:session.lastSynced?`마지막 동기화 · ${new Date(session.lastSynced).toLocaleString('ko-KR')}`:'아직 계정 기록을 불러오지 못했습니다.'),
      session.error&&note(session.error,'error'),
      session.state&&el('p',{class:'muted'},`풀이 ${session.state.attempts.length}건 · 읽기 ${session.state.read.length}개 · 모의고사 ${session.state.examHistory.length}회`),
      el('div',{class:'button-row'},btn('지금 동기화',()=>api.syncAccount(),'',{disabled:session.busy}),btn('이 브라우저 기록 가져오기',()=>api.importGuest(),'secondary',{disabled:session.busy||!!session.blocked}),btn('로그아웃',()=>api.signOut(),'ghost',{disabled:session.busy})),
      session.needsLogin&&btn('다시 로그인',()=>api.authMode('signin'),'secondary'),
      session.pendingCount>0&&el('div',{class:'button-row'},btn('대기 기록 원본 내려받기',()=>api.exportPending(),'secondary small')));
    const conflict=session.conflicts.length>0&&el('section',{class:'panel'},el('h2',{},'두 기기의 변경이 다릅니다'),el('p',{},'풀이와 읽기 기록은 합쳤습니다. 아래 항목에 적용할 값을 선택하세요.'),
      el('ul',{class:'conflict-list'},session.conflicts.map(c=>el('li',{},el('strong',{},c.kind==='bookmark'?`문제 북마크 · ${c.key}`:settingNames[c.key]),el('span',{},`계정: ${show(c.remote)}`),el('span',{},`이 기기: ${show(c.local)}`)))),
      el('div',{class:'button-row'},btn('계정의 값 유지',()=>api.resolveAccount('remote')),btn('이 기기의 값 적용',()=>api.resolveAccount('local'),'secondary')));
    const blocked=session.blocked&&el('section',{class:'panel'},el('h2',{},session.blocked==='epoch'?'다른 기기에서 기록을 초기화했습니다':session.blocked==='writer'?'모의고사 진행 기기가 바뀌었습니다':'자동 동기화를 멈췄습니다'),el('p',{},'이 기기의 기록을 덮어쓰지 않았습니다. 백업을 내려받고 최신 계정 기록으로 다시 연결할 수 있습니다.'),el('div',{class:'button-row'},btn('현재 학습 기록 백업',()=>api.exportBackup(),'secondary'),btn('저장 원본 내려받기',()=>api.exportPending(),'secondary'),btn('계정 기록으로 다시 연결',()=>api.recoverAccount(),'',{disabled:session.busy})));
    return fragment(pageHead('계정과 동기화','PC와 휴대폰에서 같은 진도를 이어가세요.'),el('div',{class:'account-layout'},el('div',{class:'stack'},body,conflict,blocked),privacy));
  }
  const mode=auth.mode==='account'?'signin':auth.mode;
  const titles={signin:'로그인',signup:'계정 만들기',verify:'이메일 인증',reset:'비밀번호 찾기','reset-confirm':'새 비밀번호 설정'};
  const email=el('input',{id:'auth-email',name:'email',type:'email',autocomplete:'username',maxlength:254,required:true,value:auth.email,disabled:auth.busy});
  const password=['signin','signup','reset-confirm'].includes(mode)&&el('input',{id:'auth-password',name:'password',type:'password',autocomplete:mode==='signin'?'current-password':'new-password',minlength:mode==='signin'?1:12,maxlength:128,required:true,disabled:auth.busy});
  const otp=['verify','reset-confirm'].includes(mode)&&el('input',{id:'auth-otp',name:'otp',type:'text',inputmode:'numeric',autocomplete:'one-time-code',pattern:'[0-9]{6}',maxlength:6,minlength:6,required:true,disabled:auth.busy});
  const form=el('form',{class:'auth-form',onsubmit:event=>{event.preventDefault();const input=event.currentTarget.elements;const values={email:input.email.value.trim(),password:input.password?.value||'',otp:input.otp?.value||''};if(input.password)input.password.value='';if(input.otp)input.otp.value='';void api.authSubmit(mode,values);}},
    el('h2',{},titles[mode]),el('p',{class:'muted'},'타사 쿠키가 차단되면 계정 연결이 제한될 수 있습니다. 연결되지 않으면 다른 브라우저나 기록·백업을 이용하세요.'),field('이메일',email),password&&field(mode==='signin'?'비밀번호':'비밀번호 · 12–128자',password),otp&&field('이메일 인증번호 · 6자리',otp),
    mode==='verify'&&el('p',{class:'muted'},'이메일로 받은 인증번호를 입력하세요. 메일이 보이지 않으면 스팸함을 확인해 주세요.'),
    el('button',{class:'button',type:'submit',disabled:auth.busy},auth.busy?'처리 중…':mode==='reset'?'인증번호 요청':titles[mode]),
    mode==='verify'&&btn('인증번호 다시 받기',()=>api.authSubmit('resend',{email:email.value.trim()}),'secondary',{disabled:auth.busy}),
    mode==='reset'&&el('p',{class:'muted'},'등록한 이메일로 인증번호를 받은 뒤 새 비밀번호를 설정합니다.'),
    auth.error&&note(auth.error,'error'),auth.message&&note(auth.message));
  const tabs=el('div',{class:'button-row auth-tabs'},[['signin','로그인'],['signup','가입'],['reset','비밀번호 찾기'],['verify','이메일 인증']].map(([id,label])=>btn(label,()=>api.authMode(id),mode===id?'':'secondary small',{disabled:auth.busy,'aria-pressed':mode===id})));
  return fragment(pageHead('계정과 동기화','이메일을 인증한 계정에 학습 진도를 저장합니다.'),el('div',{class:'account-layout'},el('section',{class:'panel account-panel'},tabs,form,link('로그인 없이 학습하기','#home','link')),privacy));
}
