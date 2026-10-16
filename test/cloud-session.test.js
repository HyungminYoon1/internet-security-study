import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {buildCatalog,WEEK_NUMBERS} from '../dist/src/domain/content.js';
import {emptyCloud,applyChanges} from '../dist/src/domain/sync.js';
import {createCloudSession} from '../dist/src/cloud/session.js';
const catalog=buildCatalog(await Promise.all(WEEK_NUMBERS.map(n=>readFile(new URL(`../dist/content/week-${String(n).padStart(2,'0')}.json`,import.meta.url),'utf8').then(JSON.parse))));
const q=catalog.questions[0];
function harness(){
  const user={id:randomUUID(),email:'test@example.invalid',emailVerified:true};let current=user,cloud=emptyCloud(user.id,randomUUID()),fail=false,calls=0,pullFailure=false,permanent=false;const receipts=new Map(),data=new Map();
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  const transport={session:async()=>current,rpc:async(name,request)=>{
    if(name==='study_pull'){if(pullFailure)throw new Error('network-before-pull');return structuredClone(cloud);}calls++;
    if(permanent)throw Object.assign(new Error('INVALID_REQUEST'),{code:'22023'});
    if(!receipts.has(request.operationId)){const r=applyChanges(cloud,request.changes,catalog);cloud=r.cloud;receipts.set(request.operationId,{status:r.conflicts.length?'conflict':'ok',conflicts:r.conflicts,acceptedRevision:cloud.revision,acceptedVersions:structuredClone(cloud.versions)});}
    if(fail)throw new Error('network-after-commit');return{...receipts.get(request.operationId),cloud:structuredClone(cloud)};
  }};
  const deviceId=randomUUID();
  const create=()=>createCloudSession({storage,catalog,user,transport,deviceId,onChange(){},schedule:false});
  const session=create();
  return{session,create,user,storage,data,setFail:v=>fail=v,setPullFailure:v=>pullFailure=v,setPermanent:v=>permanent=v,switchUser:()=>current={...user,id:randomUUID()},cloud:()=>cloud,calls:()=>calls};
}
test('lost server response stays pending and retry cannot duplicate the committed attempt',async()=>{
  const h=harness();await h.session.start();h.setFail(true);
  h.session.change({...h.session.state,read:[q.objectiveId]});await h.session.flush();
  assert.equal(h.session.pendingCount,1);assert.ok(h.session.error);assert.equal(h.cloud().state.read.length,1);
  h.setFail(false);await h.session.flush();assert.equal(h.session.pendingCount,0);assert.equal(h.cloud().revision,1);h.session.stop();
});
test('session identity change blocks a queued write before any RPC mutation',async()=>{
  const h=harness();await h.session.start();h.session.change({...h.session.state,read:[q.objectiveId]});h.switchUser();await h.session.flush();
  assert.equal(h.calls(),0);assert.equal(h.session.pendingCount,1);assert.equal(h.session.needsLogin,true);h.session.stop();
});
test('reload resumes an identity-bound uncertain request; guest key is untouched',async()=>{
  const h=harness();h.storage.setItem('internet-security-study-v1','guest-original');await h.session.start();h.setFail(true);
  h.session.change({...h.session.state,read:[q.objectiveId]});await h.session.flush();h.session.stop();
  assert.equal(h.storage.getItem('internet-security-study-v1'),'guest-original');
  const raw=[...h.data.values()].find(v=>v.includes('operationId'));assert.ok(raw);
  assert.ok(!raw.includes('test@example.invalid'));assert.ok(!raw.includes('password'));
  h.setFail(false);const resumed=h.create();await resumed.start();await resumed.flush();
  assert.equal(resumed.pendingCount,0);assert.equal(resumed.state.read.length,1);assert.equal(h.cloud().revision,1);resumed.stop();
});

test('manual sync retries the first cloud read when login succeeded but no cache was created',async()=>{
  const h=harness();h.setPullFailure(true);await h.session.start();assert.equal(h.session.state,null);
  h.setPullFailure(false);await h.session.flush({pull:true});assert.ok(h.session.state);assert.equal(h.session.error,'');h.session.stop();
});

test('permanent server validation failure freezes the exportable queue instead of retrying forever',async()=>{
  const h=harness();await h.session.start();h.session.change({...h.session.state,read:[q.objectiveId]});h.setPermanent(true);await h.session.flush();
  assert.equal(h.session.blocked,'invalid');assert.equal(h.session.pendingCount,1);
  const calls=h.calls();await h.session.flush();assert.equal(h.calls(),calls);assert.match(h.session.pendingBackup(),/operationId/);h.session.stop();
});
test('intervening local write is not overwritten and no non-durable mutation is sent',async()=>{
  const h=harness();await h.session.start();const key=[...h.data.keys()].find(k=>k.startsWith('internet-security-account-v1:'));
  h.storage.setItem(key,'other-tab');h.session.change({...h.session.state,read:[q.objectiveId]});await h.session.flush();
  assert.equal(h.storage.getItem(key),'other-tab');assert.equal(h.calls(),0);assert.ok(h.session.error);h.session.stop();
});
