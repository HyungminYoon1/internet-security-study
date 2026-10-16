// Explicit operational check. Never run in CI: creates only disposable example.com accounts.
import assert from 'node:assert/strict';
import {randomBytes,randomInt,randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium,firefox,webkit,devices} from 'playwright';
import {database,diagnostic} from './db-client.mjs';
import {AUTH_URL,DATA_URL} from '../dist/src/cloud/neon.js';

const base=process.env.STUDY_LIVE_BASE||'http://localhost:52731/';
assert(['http://localhost:52731/','https://hyungminyoon1.github.io/internet-security-study/'].includes(base));
const origin=new URL(base).origin,run=randomBytes(8).toString('hex'),created=[],secrets=[],results=[];
const secondEngine=process.env.STUDY_LIVE_SECOND_ENGINE||'firefox';assert(['firefox','webkit','chromium'].includes(secondEngine));
let db,browser,browser2,phase='API';
const output=resolve('output/account-live');await mkdir(output,{recursive:true});
const weekOne=JSON.parse(await readFile(new URL('../dist/content/week-01.json',import.meta.url),'utf8'));
const readId=weekOne.objectives[0].id,lessonId=weekOne.objectives[1].id;
const scrub=value=>secrets.reduce((s,v)=>v?s.replaceAll(v,'[redacted]'):s,String(value)).replace(/eyJ[A-Za-z0-9_.-]+/g,'[redacted jwt]').slice(0,1800);
function pass(name){results.push({name,status:'PASS'});console.log('PASS',name);}
async function auth(path,body,jar=new Map(),retry=true){
  const r=await fetch(AUTH_URL+path,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
  const retryAfter=Number(r.headers.get('retry-after'))||60;
  if(r.status===429&&retry&&retryAfter>0&&retryAfter<=60){
    console.log(`Managed Auth rate limit: waiting ${retryAfter}s before one bounded retry.`);
    await r.arrayBuffer();await new Promise(resolve=>setTimeout(resolve,retryAfter*1000));return auth(path,body,jar,false);
  }
  for(const line of r.headers.getSetCookie()){const first=line.split(';')[0],i=first.indexOf('=');jar.set(first.slice(0,i),first.slice(i+1));secrets.push(first.slice(i+1));}
  const data=await r.json().catch(()=>({}));const jwt=r.headers.get('set-auth-jwt');if(jwt)secrets.push(jwt);
  return{status:r.status,data,jwt,jar};
}
async function rpc(name,body,jwt){
  const r=await fetch(`${DATA_URL}/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(jwt?{Authorization:`Bearer ${jwt}`}:{})},body:JSON.stringify(body?{p_request:body}:{}),signal:AbortSignal.timeout(25000)});
  return{status:r.status,data:await r.json().catch(()=>({}))};
}
async function seedOtp(fixture,type){
  assert(created.includes(fixture),'Only this test run may receive a controlled OTP fixture');
  const otp=String(randomInt(100000,1000000));secrets.push(otp);
  const hash=createHash('sha256').update(otp).digest('base64url')+':0';secrets.push(hash);
  const r=await db.query(`UPDATE neon_auth.verification SET value=$1,"expiresAt"=now()+interval '5 minutes'
    WHERE identifier=$2 AND EXISTS(SELECT 1 FROM neon_auth."user" WHERE id=$3 AND email=$4)`,[hash,`${type}-otp-${fixture.email}`,fixture.id,fixture.email]);
  assert.equal(r.rowCount,1,'Provider must have generated exactly one test verification record');return otp;
}
async function fixture(label){
  const f={email:`codex-study-e2e-${run}-${label}@example.com`,password:randomBytes(24).toString('base64url')+'!A7',id:null,jar:new Map()};secrets.push(f.password);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM neon_auth."user" WHERE email=$1',[f.email])).rows[0].n,0);
  created.push(f);
  const signup=await auth('/sign-up/email',{email:f.email,password:f.password,name:'학습자'},f.jar);
  assert.equal(signup.status,200,'Managed signup should succeed');
  const rows=await db.query('SELECT id,"emailVerified" FROM neon_auth."user" WHERE email=$1',[f.email]);assert.equal(rows.rowCount,1);f.id=rows.rows[0].id;
  assert.equal(rows.rows[0].emailVerified,false,'Email verification must be required');return f;
}
async function login(f){
  const signed=await auth('/sign-in/email',{email:f.email,password:f.password},f.jar);assert.equal(signed.status,200,'Managed sign-in should succeed');
  const session=await auth('/get-session',null,f.jar);assert.equal(session.status,200);
  const jwt=session.jwt||session.data?.session?.token;assert.ok(typeof jwt==='string'&&jwt.split('.').length===3,'JWT must be obtained from managed Auth');secrets.push(jwt);f.jwt=jwt;return jwt;
}
async function signInPage(page,f){
  const authResponses=[];
  const observe=async response=>{
    if(!response.url().startsWith(AUTH_URL)||!['/sign-in/email','/get-session'].some(path=>response.url().split('?')[0].endsWith(path)))return;
    const data=await response.json().catch(()=>null);
    authResponses.push({endpoint:response.url().split('?')[0].endsWith('/get-session')?'session':'sign-in',status:response.status(),hasUser:!!data?.user});
  };
  page.on('response',observe);
  await page.goto(base+'#account');await page.getByLabel('이메일',{exact:true}).fill(f.email);await page.getByLabel('비밀번호',{exact:true}).fill(f.password);
  await page.locator('.auth-form').getByRole('button',{name:'로그인',exact:true}).click();
  try{await page.getByRole('button',{name:'지금 동기화',exact:true}).waitFor({timeout:30000});}
  catch(error){
    const cookies=await page.context().cookies(AUTH_URL);
    console.log('Sign-in diagnostic',{responses:authResponses,managedSessionCookiePresent:cookies.some(c=>c.name.includes('session_token'))});
    console.log('Sign-in UI',scrub(await page.locator('#view').innerText()));throw error;
  }finally{page.off('response',observe);}
  await page.getByText(/마지막 동기화 ·/).waitFor({timeout:30000});
}
try{
  db=await database();
  const anonymous=await rpc('study_pull');assert.ok([400,401,403].includes(anonymous.status)&&!anonymous.data.userId);pass('production Data API denies unauthenticated progress access');
  const a=await fixture('a');
  const denied=await auth('/sign-in/email',{email:a.email,password:a.password},a.jar);assert.equal(denied.status,403);pass('unverified email cannot sign in');
  const otp=await seedOtp(a,'email-verification');
  const bad=await auth('/email-otp/verify-email',{email:a.email,otp:otp==='000000'?'000001':'000000'},a.jar);assert.ok(bad.status>=400);
  const verified=await auth('/email-otp/verify-email',{email:a.email,otp},a.jar);assert.equal(verified.status,200,'Known test OTP should pass managed verification');pass('managed verification rejects wrong code and accepts controlled test-only OTP');
  const jwt=await login(a);const claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));
  assert.equal(claims.sub,a.id,'JWT must identify this test account');
  const verifiedRow=await db.query('SELECT "emailVerified" FROM neon_auth."user" WHERE id=$1',[a.id]);
  assert.equal(verifiedRow.rows[0]?.emailVerified,true,'Provider must have persisted email verification');
  const pulled=await rpc('study_pull',null,jwt);if(pulled.status!==200)console.log('Data API diagnostic',{status:pulled.status,code:pulled.data.code,message:scrub(pulled.data.message)});assert.equal(pulled.status,200,'Authenticated Data API RPC should succeed');assert.equal(pulled.data.userId,a.id);pass('managed Auth JWT reaches own RLS-protected progress');
  const aCloud=pulled.data;
  const saved=await rpc('study_sync',{epoch:aCloud.epoch,baseRevision:aCloud.revision,operationId:randomUUID(),changes:{read:[readId],attempts:[],bookmarks:[],settings:[],examHistory:[]}},jwt);
  if(saved.status!==200)console.log('Data sync diagnostic',{status:saved.status,code:saved.data.code,message:scrub(saved.data.message)});
  assert.equal(saved.status,200,'Actual sync RPC accepts validated progress');assert.ok(saved.data.cloud.state.read.includes(readId));
  const b=await fixture('b');const bOtp=await seedOtp(b,'email-verification');assert.equal((await auth('/email-otp/verify-email',{email:b.email,otp:bOtp},b.jar)).status,200);await login(b);
  const bCloud=await rpc('study_pull',null,b.jwt);assert.equal(bCloud.status,200);assert.deepEqual(bCloud.data.state.read,[]);
  const forged=await rpc('study_sync',{epoch:aCloud.epoch,baseRevision:0,operationId:randomUUID(),changes:{read:[readId],attempts:[],bookmarks:[],settings:[],examHistory:[]}},b.jwt);
  assert.equal(forged.data.status,'epoch-conflict');assert.equal(forged.data.cloud.userId,b.id);assert.deepEqual(forged.data.cloud.state.read,[]);pass('two real accounts stay isolated; another accounts epoch cannot write');
  const direct=await fetch(DATA_URL+'/progress',{headers:{Authorization:`Bearer ${jwt}`,Origin:origin}});assert.ok(direct.status>=400);pass('browser JWT cannot access private progress table directly');
  for(let i=0;i<8;i++){const f=i%2?a:b;const response=await rpc('study_pull',null,f.jwt);assert.equal(response.status,200);assert.equal(response.data.userId,f.id,'Pooled RPCs must retain request identity');}
  pass('alternating real-account JWT requests retain ownership across pooled connections');
  if(process.env.STUDY_LIVE_MODE!=='probe'){
    browser=await chromium.launch({headless:true});browser2=await ({chromium,firefox,webkit}[secondEngine]).launch({headless:true});
    const desktop=await browser.newContext({viewport:{width:1440,height:1000},locale:'ko-KR'}),mobile=await browser2.newContext({...(secondEngine==='chromium'?devices['Pixel 7']:{viewport:{width:390,height:844}}),locale:'ko-KR'});
    const p=await desktop.newPage(),p2=await mobile.newPage();p.setDefaultTimeout(20000);p2.setDefaultTimeout(20000);
    for(const page of [p,p2])page.on('response',async r=>{if(r.url().startsWith(DATA_URL)&&r.status()>=400){const d=await r.json().catch(()=>({}));console.log('RPC diagnostic',{status:r.status(),code:d.code,message:scrub(d.message)});}});
    phase='Chromium sign-in';await signInPage(p,a);phase=secondEngine+' sign-in';await signInPage(p2,a);pass(`Chromium and ${secondEngine}/mobile-width sign into the same real account`);
    await p.reload();await p.getByText(/마지막 동기화 ·/).waitFor();pass('managed session survives browser-page reload');
    await p.goto(base+'#lesson/'+lessonId);await p.getByRole('button',{name:'STEP 04 문제 적용',exact:true}).click();
    await p.getByRole('button',{name:'개념 적용 문제 풀기 →',exact:true}).click();
    await p.locator('.options input[type=radio]').first().check();await p.getByRole('button',{name:'정답 확인',exact:true}).click();
    await p.locator('#feedback').waitFor();
    await p.goto(base+'#account');await p.getByRole('button',{name:'지금 동기화',exact:true}).click();await p.getByText(/마지막 동기화 ·/).waitFor();
    await p2.getByRole('button',{name:'지금 동기화',exact:true}).click();await p2.getByText(/마지막 동기화 ·/).waitFor();
    const countA=await p.locator('.account-panel .muted').innerText(),countB=await p2.locator('.account-panel .muted').innerText();assert.equal(countA,countB);pass('independent browsers retrieve consistent account progress');
    assert.match(countB,/풀이 1건 · 읽기 2개/);
    await mobile.setOffline(true);
    await p2.goto(base+'#lesson/'+lessonId);await p2.getByRole('button',{name:'STEP 02 풀이 예제',exact:true}).click();
    await p.goto(base+'#lesson/'+readId);await p.getByRole('button',{name:'STEP 03 스스로 설명',exact:true}).click();
    await p.goto(base+'#account');await p.getByRole('button',{name:'지금 동기화',exact:true}).click();await p.getByText(/마지막 동기화 ·/).waitFor();
    await p2.goto(base+'#account');await mobile.setOffline(false);await p2.getByRole('button',{name:'지금 동기화',exact:true}).click();
    await p2.getByRole('heading',{name:'두 기기의 변경이 다릅니다',exact:true}).waitFor({timeout:30000});
    await p2.getByRole('button',{name:'이 기기의 값 적용',exact:true}).click();
    await p2.getByRole('heading',{name:'두 기기의 변경이 다릅니다',exact:true}).waitFor({state:'hidden'});
    await p2.getByText(/마지막 동기화 ·/).waitFor();pass('offline concurrent lesson edits require an explicit conflict choice');
    await p.goto(base+'#account');await p.getByRole('button',{name:'지금 동기화',exact:true}).click();await p.getByText(/마지막 동기화 ·/).waitFor();
    phase='exam start';await p.goto(base+'#exam');await p.locator('#mock-count').selectOption('20');await p.getByRole('button',{name:'60분 모의고사 시작 →',exact:true}).click();
    await p.locator('.cloud-exam-notice').filter({hasText:'남은 시간은 서버 기준'}).waitFor({timeout:30000});
    phase='exam save';await p.locator('.options input[type=radio]').first().check();await p.locator('.cloud-exam-notice').filter({hasText:'남은 시간은 서버 기준'}).waitFor();
    const beforeTakeover=(await db.query('SELECT body FROM study_private.progress WHERE user_id=$1',[a.id])).rows[0].body.activeExam;
    assert.equal(Object.keys(beforeTakeover.answers).length,1);
    await p2.goto(base+'#account');await p2.getByRole('button',{name:'지금 동기화',exact:true}).click();await p2.getByText(/마지막 동기화 ·/).waitFor();
    await p2.goto(base+'#exam');await p2.getByRole('button',{name:'이 기기에서 이어 풀기',exact:true}).waitFor();
    assert.equal(await p2.locator('.options input[type=radio]').first().isEnabled(),false);
    phase='exam takeover';await p2.getByRole('button',{name:'이 기기에서 이어 풀기',exact:true}).click();await p2.locator('#confirm-yes').click();
    await p2.locator('.cloud-exam-notice').filter({hasText:'남은 시간은 서버 기준'}).waitFor();
    const afterTakeover=(await db.query('SELECT body FROM study_private.progress WHERE user_id=$1',[a.id])).rows[0].body.activeExam;
    assert.equal(afterTakeover.deadline,beforeTakeover.deadline);assert.deepEqual(afterTakeover.answers,beforeTakeover.answers);
    await p2.getByRole('button',{name:'답안 제출',exact:true}).click();await p2.locator('#confirm-yes').click();
    await p2.waitForURL(/#results\//);pass('real-browser exam takeover keeps answers/deadline and finalizes once');
    await p.goto(base+'#account');await p.getByRole('button',{name:'지금 동기화',exact:true}).click();await p.getByText(/마지막 동기화 ·/).waitFor();
    await p2.goto(base+'#account');
    await p.screenshot({path:resolve(output,'account-desktop.png'),fullPage:true});await p2.screenshot({path:resolve(output,'account-mobile.png'),fullPage:true});
    await desktop.close();await mobile.close();
  }
  phase='password recovery';const resetRequest=await auth('/email-otp/request-password-reset',{email:a.email},a.jar);assert.equal(resetRequest.status,200,'Managed reset request endpoint should be available');
  const resetOtp=await seedOtp(a,'forget-password'),newPassword=randomBytes(24).toString('base64url')+'!B8';secrets.push(newPassword);
  const reset=await auth('/email-otp/reset-password',{email:a.email,otp:resetOtp,password:newPassword},a.jar);assert.equal(reset.status,200,'Managed password reset should succeed');
  assert.equal((await auth('/sign-in/email',{email:a.email,password:a.password},new Map())).status,401,'Old password must be rejected');a.password=newPassword;a.jar=new Map();await login(a);pass('controlled recovery OTP changes password; old password no longer works');
}catch(error){results.push({name:'live account workflow',status:'FAIL',phase,message:scrub(error.message),code:error.code});console.error('FAIL',phase,scrub(error.message));
  for(const engine of [browser,browser2]){const p=engine?.contexts()[0]?.pages()[0];if(p)console.log('UI diagnostic',scrub(await p.locator('#account-notice,#toast,.cloud-exam-notice').allTextContents().catch(()=>[])));}
  process.exitCode=1;}
finally{
  await browser?.close();await browser2?.close();
  if(db){
    for(const f of created){
      try{
        await db.query('BEGIN');
        const rows=await db.query('SELECT id FROM neon_auth."user" WHERE email=$1 FOR UPDATE',[f.email]);
        if(rows.rowCount>1||f.id&&rows.rows.some(row=>row.id!==f.id))throw new Error('CLEANUP_IDENTITY_MISMATCH');
        for(const type of ['email-verification','forget-password','sign-in'])await db.query('DELETE FROM neon_auth.verification WHERE identifier=$1',[`${type}-otp-${f.email}`]);
        if(rows.rowCount===1)await db.query('DELETE FROM neon_auth."user" WHERE id=$1 AND email=$2',[rows.rows[0].id,f.email]);
        await db.query('COMMIT');
      }catch(error){await db.query('ROLLBACK');console.error('Test cleanup failed',error.code||'SANITIZED');process.exitCode=1;}
    }
    const remaining=await db.query('SELECT count(*)::int AS n FROM neon_auth."user" WHERE email=ANY($1::text[])',[created.map(f=>f.email)]);
    results.push({name:'test accounts removed',status:remaining.rows[0].n===0?'PASS':'FAIL',remaining:remaining.rows[0].n});console.log('Test accounts remaining:',remaining.rows[0].n);await db.end();
  }
  const report={at:new Date().toISOString(),base,secondEngine,mobileEmulation:secondEngine==='chromium'?'Pixel 7, not physical hardware':'mobile-width desktop engine',mailboxDelivery:'NOT_RUN - controlled test OTP fixtures, not actual inbox delivery',results};
  await writeFile(resolve(output,'result.json'),JSON.stringify(report,null,2)+'\r\n','utf8');
  await writeFile(resolve(output,`result-${secondEngine}-${process.env.STUDY_LIVE_MODE||'ui'}.json`),JSON.stringify(report,null,2)+'\r\n','utf8');
  await writeFile(resolve(output,`result-${secondEngine}-${base.startsWith('https:')?'production':'local'}-${process.env.STUDY_LIVE_MODE||'ui'}.json`),JSON.stringify(report,null,2)+'\r\n','utf8');
  await writeFile(resolve(output,`run-${run}.json`),JSON.stringify(report,null,2)+'\r\n','utf8');
}
