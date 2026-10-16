import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {buildCatalog,WEEK_NUMBERS} from '../dist/src/domain/content.js';
import {emptyCloud,applyChanges} from '../dist/src/domain/sync.js';
import {newOutbox,queueChange,project,prepare,prepareRpc,acknowledge,refresh,resolveConflicts,validateOutbox} from '../dist/src/domain/outbox.js';
import {newExam} from '../dist/src/domain/learning.js';

const catalog=buildCatalog(await Promise.all(WEEK_NUMBERS.map(n=>readFile(new URL(`../dist/content/week-${String(n).padStart(2,'0')}.json`,import.meta.url),'utf8').then(JSON.parse))));
const userId=randomUUID(),q=catalog.questions[0];
const fresh=()=>newOutbox(emptyCloud(userId,randomUUID()));
const change=(box,patch)=>queueChange(box,{...project(box,catalog).state,...patch},catalog,randomUUID());
const answer=id=>({id,questionId:q.id,objectiveId:q.objectiveId,family:q.family,answerId:q.answerId,correct:true,confidence:'sure',at:100,mode:'practice'});
const server=(cloud,request)=>{const r=applyChanges(cloud,request.changes,catalog);return{status:r.conflicts.length?'conflict':'ok',...r,acceptedVersions:r.cloud.versions,acceptedRevision:r.cloud.revision};};

test('outbox persists only account-bound progress; no guest import is implicit',()=>{
  const box=fresh();assert.deepEqual(project(box,catalog).state.attempts,[]);
  assert.throws(()=>validateOutbox(box,catalog,randomUUID()));
  assert.deepEqual(validateOutbox(JSON.parse(JSON.stringify(box)),catalog,userId),box);
});
test('a request stays byte-equivalent across retries and local changes during flight are retained',()=>{
  let box=change(fresh(),{attempts:[answer('one')]});box=prepare(box,catalog);
  const request=structuredClone(box.flight.request);
  box=change(box,{attempts:[answer('one'),answer('two')]});
  assert.deepEqual(prepare(box,catalog).flight.request,request);
  box=acknowledge(box,server(box.base,request),catalog);
  assert.equal(project(box,catalog).state.attempts.length,2);assert.equal(box.pending.length,1);
  box=prepare(box,catalog);box=acknowledge(box,server(box.base,box.flight.request),catalog);
  assert.equal(box.pending.length,0);assert.equal(box.base.state.attempts.length,2);
});
test('queued field edits use symbolic dependencies, never guessed server versions',()=>{
  let box=fresh();box=change(box,{bookmarks:[q.id]});box=prepare(box,catalog);
  box=change(box,{bookmarks:[]});
  assert.deepEqual(box.pending[1].changes.bookmarks[0].baseVersion,{after:box.pending[0].operationId});
  const other={read:[q.objectiveId],attempts:[],bookmarks:[],settings:[],examHistory:[]};
  const remote=applyChanges(box.base,other,catalog).cloud;
  const response=server(remote,box.flight.request);
  box=acknowledge(box,response,catalog);
  assert.equal(box.pending[0].changes.bookmarks[0].baseVersion,response.acceptedVersions.bookmarks[q.id]);
  box=prepare(box,catalog);assert.equal(acknowledge(box,server(box.base,box.flight.request),catalog).base.state.bookmarks.length,0);
});
test('a delayed retry uses the original accepted version, not the newest remote version',()=>{
  let box=fresh();box=change(box,{settings:{...box.base.state.settings,examDate:'2026-10-19'}});box=prepare(box,catalog);
  box=change(box,{settings:{...box.base.state.settings,examDate:'2026-10-20'}});
  const accepted=server(box.base,box.flight.request);
  const next=applyChanges(accepted.cloud,{read:[],attempts:[],bookmarks:[],settings:[{key:'examDate',value:'2026-10-21',baseVersion:accepted.cloud.revision}],examHistory:[]},catalog).cloud;
  box=acknowledge(box,{...accepted,cloud:next},catalog);box=prepare(box,catalog);
  const response=server(next,box.flight.request);assert.equal(response.status,'conflict');
  box=acknowledge(box,response,catalog);assert.equal(box.conflicts.length,1);assert.equal(prepare(box,catalog).flight,null);
  const remote=resolveConflicts(box,'remote',catalog,randomUUID());assert.equal(project(remote,catalog).state.settings.examDate,'2026-10-21');
  const local=resolveConflicts(box,'local',catalog,randomUUID());assert.equal(project(local,catalog).state.settings.examDate,'2026-10-20');
});
test('reset epoch mismatch freezes old work instead of silently resurrecting records',()=>{
  let box=change(fresh(),{attempts:[answer('old')]});box=prepare(box,catalog);
  const next=emptyCloud(userId,randomUUID());
  box=acknowledge(box,{status:'epoch-conflict',cloud:next},catalog);
  assert.equal(box.blocked,'epoch');assert.equal(box.pending.length,1);assert.equal(box.remote.epoch,next.epoch);
  assert.throws(()=>queueChange(box,box.base.state,catalog,randomUUID()));
  assert.equal(project(box,catalog).state.attempts[0].id,'old');
});
test('refresh merges remote baseline with pending additions but preserves conflict anchors',()=>{
  let box=change(fresh(),{bookmarks:[q.id],attempts:[answer('offline')]});
  let remote=applyChanges(box.base,{read:[],attempts:[],bookmarks:[{id:q.id,value:true,baseVersion:0}],settings:[],examHistory:[]},catalog).cloud;
  remote=applyChanges(remote,{read:[],attempts:[],bookmarks:[{id:q.id,value:false,baseVersion:remote.revision}],settings:[],examHistory:[]},catalog).cloud;
  box=refresh(box,remote,catalog);box=prepare(box,catalog);
  assert.equal(server(remote,box.flight.request).status,'conflict');
});
test('malformed, future dependency, oversized and prototype fields are rejected without replacing original',()=>{
  const box=change(fresh(),{bookmarks:[q.id]});
  const bad=structuredClone(box);bad.pending[0].changes.bookmarks[0].baseVersion={after:randomUUID()};
  assert.throws(()=>validateOutbox(bad,catalog,userId));
  assert.throws(()=>validateOutbox({...box,extra:1},catalog,userId));
  assert.throws(()=>validateOutbox({...box,pending:Array(501).fill(box.pending[0])},catalog,userId));
  const pollution=JSON.parse(JSON.stringify(box));pollution.pending[0].changes.settings=[{key:'__proto__',value:{x:1},baseVersion:0}];
  assert.throws(()=>validateOutbox(pollution,catalog,userId));assert.equal({}.x,undefined);
});

test('reset and exam outbox requests are strictly validated before persistence and retry',()=>{
  const box=fresh(),common={epoch:box.base.epoch,operationId:randomUUID()};
  for(const request of [{...common},{...common,revision:null},{...common,revision:-1},{...common,revision:0,extra:'secret'}])assert.throws(()=>prepareRpc(box,'reset',request,catalog));
  assert.doesNotThrow(()=>prepareRpc(box,'reset',{...common,revision:0},catalog));
  const start={...common,deviceId:randomUUID(),action:'start',exam:newExam([q],{exam:q.exam,count:1,id:'exam',seed:'one',now:100})};
  for(const edit of [r=>r.action='delete',r=>r.deviceId='broken',r=>delete r.exam,r=>r.exam.answers={unknown:'a'},r=>r.extra=1]){
    const request=structuredClone(start);edit(request);assert.throws(()=>prepareRpc(box,'exam',request,catalog));
  }
  assert.doesNotThrow(()=>prepareRpc(box,'exam',start,catalog));
});

test('reset revision conflict is a stale-record block, not an exam-writer conflict',()=>{
  const box=fresh();const ready=prepareRpc(box,'reset',{epoch:box.base.epoch,operationId:randomUUID(),revision:0},catalog);
  const remote=applyChanges(box.base,{read:[q.objectiveId],attempts:[],bookmarks:[],settings:[],examHistory:[]},catalog).cloud;
  assert.equal(acknowledge(ready,{status:'conflict',cloud:remote},catalog).blocked,'stale');
});
