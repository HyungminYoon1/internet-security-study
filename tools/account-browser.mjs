// Deterministic UI regression suite with an explicitly substituted Auth/API adapter.
// This does NOT prove Neon connectivity; tools/live-account-check.mjs does that separately.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {initialState} from '../dist/src/domain/backup.js';
const userId='11111111-1111-4111-8111-111111111111',epoch='22222222-2222-4222-8222-222222222222';
const accountKey=`internet-security-account-v1:${userId}`,guestKey='internet-security-study-v1';
const week=JSON.parse(await readFile(new URL('../dist/content/week-01.json',import.meta.url),'utf8'));
const objective=week.objectives[0].id,output=resolve('output/playwright');await mkdir(output,{recursive:true});
const authErrors=(await readFile(new URL('../dist/src/cloud/neon.js',import.meta.url),'utf8')).split('export async function createNeonTransport')[0];
const stub=`
import {emptyCloud,applyChanges} from '../domain/sync.js';
import {buildCatalog,WEEK_NUMBERS} from '../domain/content.js';
const catalog=buildCatalog(await Promise.all(WEEK_NUMBERS.map(n=>fetch(new URL('../../content/week-'+String(n).padStart(2,'0')+'.json',import.meta.url)).then(r=>r.json()))));
const fixture=window.__accountTest={user:null,cloud:emptyCloud('${userId}','${epoch}'),failPull:false,failSync:false,calls:0};
fixture.cloud.serverNow=Date.now();
${authErrors}
export async function createNeonTransport(){return{
 session:async()=>fixture.user,
 signIn:async()=>fixture.emptySession?null:fixture.user={id:'${userId}',email:'fixture@example.invalid',emailVerified:true},
 signOut:async()=>{fixture.user=null;},
 rpc:async(name,request)=>{
   fixture.calls++;
   if(name==='study_pull'){if(fixture.failPull)throw new Error('NETWORK');return structuredClone(fixture.cloud);}
   if(fixture.failSync)throw Object.assign(new Error('INVALID_REQUEST'),{code:'22023'});
   if(name!=='study_sync')throw new Error('UNSUPPORTED_TEST_RPC');
   const r=applyChanges(fixture.cloud,request.changes,catalog);fixture.cloud=r.cloud;fixture.cloud.serverNow=Date.now();
   return{status:r.conflicts.length?'conflict':'ok',...r,acceptedVersions:structuredClone(r.cloud.versions),acceptedRevision:r.cloud.revision};
 }
};}`;
let browser;const results=[],server=spawn(process.execPath,['tools/serve.mjs','0'],{stdio:['ignore','pipe','pipe'],windowsHide:true});
const base=await new Promise((done,reject)=>{const t=setTimeout(()=>reject(new Error('server timeout')),10000);server.stdout.on('data',b=>{const m=b.toString().match(/Local: (http:\/\/127\.0\.0\.1:\d+\/)/);if(m){clearTimeout(t);done(m[1]);}});server.once('error',reject);});
async function check(name,fn){
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});const page=await context.newPage();page.setDefaultTimeout(10000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/src/cloud/neon.js',route=>route.fulfill({contentType:'text/javascript',body:stub}));
 try{await fn(page);assert.deepEqual(errors,[]);results.push({name,status:'PASS'});console.log('PASS',name);}
 catch(e){results.push({name,status:'FAIL',message:e.message});console.error('FAIL',name,e.message);await page.screenshot({path:resolve(output,`account-ui-fail-${results.length}.png`)}).catch(()=>{});}
 finally{await context.close();}
}
async function login(page){await page.goto(base+'#account');await page.getByLabel('이메일',{exact:true}).fill('fixture@example.invalid');await page.getByLabel('비밀번호',{exact:true}).fill('not-a-real-password');await page.locator('.auth-form').getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:'지금 동기화',exact:true}).waitFor();}
async function settle(page){await page.getByText(/마지막 동기화 ·/).waitFor();}
try{
 browser=await chromium.launch({headless:true});
 await check('guest original survives login, explicit additive import and logout',async page=>{
  await page.goto(base);const guest=initialState();guest.read=[objective];guest.bookmarks=['w01-q001'];const raw=JSON.stringify(guest);
  await page.evaluate(({guestKey,raw})=>localStorage.setItem(guestKey,raw),{guestKey,raw});await page.reload();
  await login(page);await settle(page);assert.match(await page.locator('.account-panel .muted').innerText(),/읽기 0개/);
  assert.equal(await page.locator('.account-layout > .stack').evaluate(node=>[...node.childNodes].some(child=>child.nodeType===3&&child.textContent.trim()==='0')),false,'No stray zero should be rendered for an empty conflict list');
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),guestKey),raw);
  await page.getByRole('button',{name:'이 브라우저 기록 가져오기',exact:true}).click();await page.locator('#confirm-yes').click();
  await page.waitForFunction(()=>document.querySelector('.account-panel .muted')?.textContent.includes('읽기 1개'));await settle(page);
  assert.match(await page.locator('.account-panel .muted').innerText(),/읽기 1개/);
  await page.getByRole('button',{name:'로그아웃',exact:true}).click();await page.locator('.auth-form').waitFor();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),guestKey),raw);
  const persisted=await page.evaluate(()=>JSON.stringify(localStorage));assert.ok(!persisted.includes('not-a-real-password'));assert.ok(!persisted.includes('fixture@example.invalid'));
 });
 await check('initial connection failure offers a working manual retry',async page=>{
  await page.goto(base+'#account');await page.waitForFunction(()=>window.__accountTest);await page.evaluate(()=>window.__accountTest.failPull=true);
  await page.getByLabel('이메일',{exact:true}).fill('fixture@example.invalid');await page.getByLabel('비밀번호',{exact:true}).fill('not-a-real-password');await page.locator('.auth-form').getByRole('button',{name:'로그인',exact:true}).click();await page.getByRole('button',{name:'지금 동기화',exact:true}).waitFor();
  await page.getByText('아직 계정 기록을 불러오지 못했습니다.',{exact:true}).waitFor();
  await page.evaluate(()=>window.__accountTest.failPull=false);await page.getByRole('button',{name:'지금 동기화',exact:true}).click();await settle(page);
 });
 await check('a blocked account never labels an unrecorded answer as recorded feedback',async page=>{
  await login(page);await settle(page);await page.evaluate(()=>window.__accountTest.failSync=true);
  await page.goto(base+'#lesson/'+objective);await page.getByRole('button',{name:'STEP 04 문제 적용',exact:true}).click();
  await page.goto(base+'#account');await page.getByRole('button',{name:'지금 동기화',exact:true}).click();await page.getByRole('heading',{name:'자동 동기화를 멈췄습니다',exact:true}).waitFor();
  await page.goto(base+'#practice');await page.getByRole('button',{name:'이 문제 풀기',exact:true}).first().click();
  await page.getByRole('radio').first().check();await page.getByRole('button',{name:'정답 확인',exact:true}).click();
  assert.equal(await page.locator('#feedback').count(),0);assert.equal(await page.getByRole('button',{name:'정답 확인',exact:true}).count(),1);
 });
 await check('a missing session after successful password exchange is not called unverified email',async page=>{
  await page.goto(base+'#account');await page.waitForFunction(()=>window.__accountTest);await page.evaluate(()=>window.__accountTest.emptySession=true);
  await page.getByLabel('이메일',{exact:true}).fill('fixture@example.invalid');await page.getByLabel('비밀번호',{exact:true}).fill('not-a-real-password');
  await page.locator('.auth-form').getByRole('button',{name:'로그인',exact:true}).click();
  await page.getByText(/로그인 세션을 유지하지 못했습니다/).waitFor();
  assert.equal(await page.getByLabel('이메일 인증번호 · 6자리',{exact:true}).count(),0);
 });
 await check('expired automatic sign-in explains that visible guest work is not account progress',async page=>{
  await page.goto(base);await page.evaluate(()=>localStorage.setItem('internet-security-account-mode-v1','account'));await page.reload();
  await page.locator('#account-notice').filter({hasText:'계정에 다시 로그인'}).waitFor();
  assert.match(await page.locator('#storage-mode').innerText(),/비로그인/);
  await page.getByRole('link',{name:'계정·동기화',exact:true}).first().click();
  await page.getByLabel('이메일',{exact:true}).fill('fixture@example.invalid');await page.getByLabel('비밀번호',{exact:true}).fill('not-a-real-password');
  await page.locator('.auth-form').getByRole('button',{name:'로그인',exact:true}).click();await settle(page);
  assert.equal(await page.locator('#account-notice').isVisible(),false);
 });
 await check('corrupt account bytes are preserved and cannot overwrite guest records',async page=>{
  await page.goto(base);await page.evaluate(key=>localStorage.setItem(key,'{broken account'),accountKey);await login(page);
  await page.getByRole('heading',{name:'자동 동기화를 멈췄습니다',exact:true}).waitFor();
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),accountKey),'{broken account');
  assert.equal(await page.getByRole('button',{name:'계정 기록으로 다시 연결',exact:true}).count(),1);
 });
 await check('historical bookmark opens the replacement and removal clears the saved list',async page=>{
  await page.goto(base);const state=initialState();state.bookmarks=['w01-q001'];await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:guestKey,value:state});await page.reload();
  await page.goto(base+'#practice');await page.getByRole('button',{name:'저장한 문제만',exact:true}).click();await page.getByRole('button',{name:'이 문제 풀기',exact:true}).click();
  assert.doesNotMatch(await page.locator('#question-title').innerText(),/교안|오기를/);
  await page.getByRole('button',{name:'저장한 문제 ✓',exact:true}).click();await page.getByRole('button',{name:'연습 목록',exact:true}).click();
  await page.getByRole('heading',{name:'조건에 맞는 문제가 없습니다.',exact:true}).waitFor();
 });
 await check('account controls fit 320px and inputs have accessible labels',async page=>{
  await page.goto(base+'#account');await page.setViewportSize({width:320,height:844});
  await page.getByLabel('이메일',{exact:true}).waitFor();
  assert(await page.getByLabel('이메일',{exact:true}).isVisible());assert(await page.getByLabel('비밀번호',{exact:true}).isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:resolve(output,'account-signin-mobile.png'),fullPage:true});
 });
}finally{await browser?.close();server.kill();await writeFile(resolve(output,'account-ui-results.json'),JSON.stringify({kind:'test-double browser UI',results},null,2),'utf8');}
console.log(`${results.filter(r=>r.status==='PASS').length}/${results.length} account UI scenarios passed.`);
if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
