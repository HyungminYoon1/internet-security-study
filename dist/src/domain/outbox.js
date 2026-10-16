import {makeChanges,applyChanges,validateCloud,hasChanges,validUuid,equal} from './sync.js';
import {validateState} from './backup.js';

export const MAX_OUTBOX_BYTES=4*1024*1024;
const fail=message=>{throw new TypeError(message);};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const shape=(v,keys)=>{if(!plain(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('계정 대기 기록의 형식을 확인해 주세요.');};
const clone=structuredClone;
const number=v=>Number.isSafeInteger(v)&&v>=0;
const fields=['bookmarks','settings'];
const fieldId=(group,item)=>group==='bookmarks'?item.id:item.key;

export function newOutbox(cloud) {
  return {schemaVersion:1,userId:cloud.userId,base:clone(cloud),pending:[],flight:null,conflicts:[],blocked:null,remote:null};
}

function checkChanges(changes,earlier) {
  shape(changes,['read','attempts','bookmarks','settings','examHistory']);
  for(const group of fields) {
    if(!Array.isArray(changes[group])) fail('대기 중인 변경 목록이 잘못되었습니다.');
    const seen=new Set();
    for(const item of changes[group]) {
      const id=fieldId(group,item); if(seen.has(id))fail('같은 항목의 변경이 중복되었습니다.');seen.add(id);
      if(!number(item.baseVersion)) {
        shape(item.baseVersion,['after']);
        if(!earlier.has(item.baseVersion.after))fail('대기 기록의 순서가 잘못되었습니다.');
      }
    }
  }
}

export function project(box,catalog) {
  let current=clone(box.base);const anchors=clone(current.versions),earlier=new Set();
  for(const item of box.pending) {
    shape(item,['operationId','changes']);
    if(!validUuid(item.operationId)||earlier.has(item.operationId))fail('대기 기록 식별자가 잘못되었습니다.');
    checkChanges(item.changes,earlier);
    const forced=clone(item.changes);
    for(const group of fields)for(const change of forced[group]) change.baseVersion=current.versions[group][fieldId(group,change)]||0;
    current=applyChanges(current,forced,catalog).cloud;
    for(const group of fields)for(const change of item.changes[group]) anchors[group][fieldId(group,change)]={after:item.operationId};
    earlier.add(item.operationId);
  }
  if(box.flight?.kind==='exam'&&box.flight.request.action==='save'&&current.state.activeExam?.id===box.flight.request.examId) {
    const {answers,flagged,position}=box.flight.request;
    current.state.activeExam={...current.state.activeExam,answers:clone(answers),flagged:[...flagged],position};
  }
  validateState(current.state,catalog);
  return {state:current.state,versions:anchors};
}

export function validateOutbox(box,catalog,userId) {
  if(new TextEncoder().encode(JSON.stringify(box)).length>MAX_OUTBOX_BYTES)fail('계정 대기 기록이 4MB를 초과했습니다. 백업을 보관해 주세요.');
  shape(box,['schemaVersion','userId','base','pending','flight','conflicts','blocked','remote']);
  if(box.schemaVersion!==1||box.userId!==userId||!validUuid(userId))fail('다른 계정의 대기 기록입니다.');
  validateCloud(box.base,catalog,userId);
  if(!Array.isArray(box.pending)||box.pending.length>500)fail('대기 중인 변경이 너무 많습니다. 먼저 동기화해 주세요.');
  if(![null,'epoch','stale','writer','invalid'].includes(box.blocked))fail('동기화 중단 상태가 잘못되었습니다.');
  if(box.remote!==null)validateCloud(box.remote,catalog,userId);
  validateConflicts(box.conflicts,box.base,catalog);
  project(box,catalog);
  if(box.flight!==null) {
    shape(box.flight,['kind','request']); const req=box.flight.request;
    if(!['sync','exam','reset'].includes(box.flight.kind)||!plain(req)||!validUuid(req.operationId)||req.epoch!==box.base.epoch)fail('전송 중인 기록이 잘못되었습니다.');
    if(box.flight.kind==='sync') {
      shape(req,['epoch','operationId','baseRevision','changes']);
      if(!number(req.baseRevision)||req.operationId!==box.pending[0]?.operationId||!equal(req.changes,box.pending[0].changes))fail('전송 중인 변경이 일치하지 않습니다.');
      checkChanges(req.changes,new Set());
    }else if(box.flight.kind==='reset') {
      shape(req,['epoch','operationId','revision']);
      if(box.pending.length||!number(req.revision)||req.revision!==box.base.revision)fail('초기화 요청의 버전이 잘못되었습니다.');
    }else {
      const common=['epoch','operationId','deviceId','action'];
      if(!validUuid(req.deviceId)||!['start','save','takeover','finish'].includes(req.action))fail('모의고사 요청이 잘못되었습니다.');
      if(req.action==='start') {
        shape(req,[...common,'exam']);
        if(!req.exam)fail('시작할 모의고사가 없습니다.');
        validateState({...box.base.state,activeExam:req.exam},catalog);
      }else {
        shape(req,[...common,'examId','generation',...(req.action==='save'?['answers','flagged','position']:[])]);
        if(!validUuid(req.generation)||req.examId!==box.base.state.activeExam?.id||req.generation!==box.base.examWriter?.generation)fail('모의고사 진행 버전이 잘못되었습니다.');
        if(req.action==='save')validateState({...box.base.state,activeExam:{...box.base.state.activeExam,answers:req.answers,flagged:req.flagged,position:req.position}},catalog);
      }
    }
  }
  return clone(box);
}

function validateConflicts(conflicts,cloud,catalog) {
  if(!Array.isArray(conflicts)||conflicts.length>3003)fail('충돌 목록이 잘못되었습니다.');
  for(const item of conflicts) {
    shape(item,['kind','key','local','remote']);
    if(!['bookmark','setting'].includes(item.kind))fail('충돌 종류가 잘못되었습니다.');
    for(const side of ['local','remote']) {
      const state=clone(cloud.state);
      if(item.kind==='bookmark') {
        if(!catalog.questionIds.has(item.key)||typeof item[side]!=='boolean')fail('북마크 충돌이 잘못되었습니다.');
      }else{
        if(!['exam','examDate','lesson'].includes(item.key))fail('설정 충돌이 잘못되었습니다.');
        if(item.key==='lesson'){shape(item[side],['lastObjective','lessonStep']);Object.assign(state.settings,item[side]);}
        else state.settings[item.key]=item[side];
        validateState(state,catalog);
      }
    }
  }
}

export function queueChange(box,desired,catalog,operationId) {
  if(box.blocked||box.flight?.kind==='reset')fail('계정 기록을 확인한 뒤 변경을 계속해 주세요.');
  const current=project(box,catalog),changes=makeChanges(current,desired,catalog);
  if(!hasChanges(changes))return clone(box);
  const next=clone(box);next.pending.push({operationId,changes});
  return validateOutbox(next,catalog,next.userId);
}

export function prepare(box,catalog) {
  if(box.flight||box.blocked||box.conflicts.length||!box.pending.length)return clone(box);
  const next=clone(box),first=next.pending[0];
  checkChanges(first.changes,new Set());
  next.flight={kind:'sync',request:{epoch:next.base.epoch,operationId:first.operationId,baseRevision:next.base.revision,changes:clone(first.changes)}};
  return validateOutbox(next,catalog,next.userId);
}

export function acknowledge(box,response,catalog) {
  if(!box.flight)fail('대기 중인 요청이 없습니다.');
  const cloud=validateCloud(response.cloud,catalog,box.userId),next=clone(box);
  if(response.status==='epoch-conflict'||(cloud.epoch!==box.base.epoch&&box.flight.kind!=='reset')) {
    next.blocked='epoch';next.remote=cloud;return next;
  }
  if(response.status==='stale') {next.blocked='stale';next.remote=cloud;return next;}
  if(box.flight.kind==='reset'&&response.status==='conflict'){next.blocked=cloud.epoch===box.base.epoch?'stale':'epoch';next.remote=cloud;return next;}
  if(box.flight.kind==='sync') {
    if(!['ok','conflict'].includes(response.status))fail('동기화 응답을 확인해 주세요.');
    validateConflicts(response.conflicts,cloud,catalog);
    if(!number(response.acceptedRevision)||response.acceptedRevision>cloud.revision)fail('저장 확인 버전이 잘못되었습니다.');
    validateCloud({...cloud,state:{...cloud.state,revision:response.acceptedRevision},revision:response.acceptedRevision,versions:response.acceptedVersions},catalog,box.userId);
    const id=next.pending.shift().operationId;
    for(const item of next.pending)for(const group of fields)for(const change of item.changes[group]) {
      if(plain(change.baseVersion)&&change.baseVersion.after===id)change.baseVersion=response.acceptedVersions[group][fieldId(group,change)]||0;
    }
    next.conflicts=clone(response.conflicts);next.base=cloud;next.flight=null;
  }else if(box.flight.kind==='reset'&&response.status==='ok')return newOutbox(cloud);
  else if(box.flight.kind==='exam'&&['ok','expired','exam-missing','exam-exists'].includes(response.status)) {
    next.base=cloud;next.flight=null;
  }else {next.blocked='writer';next.remote=cloud;return next;}
  return validateOutbox(next,catalog,next.userId);
}

export function refresh(box,value,catalog) {
  const cloud=validateCloud(value,catalog,box.userId),next=clone(box);
  if(cloud.epoch!==box.base.epoch) {
    if(!box.pending.length&&!box.flight&&!box.conflicts.length)return newOutbox(cloud);
    next.blocked='epoch';next.remote=cloud;return next;
  }
  if(box.flight||box.blocked)return next;
  if(cloud.revision<box.base.revision)fail('서버 기록이 이전 버전입니다. 다시 확인해 주세요.');
  next.base=cloud;return validateOutbox(next,catalog,next.userId);
}

export function resolveConflicts(box,choice,catalog,operationId) {
  if(!['local','remote'].includes(choice)||box.blocked||box.flight)fail('충돌 해결 방법을 확인해 주세요.');
  const next=clone(box),local=[];
  for(const conflict of next.conflicts) {
    const group=conflict.kind==='bookmark'?'bookmarks':'settings';let value=conflict.local;
    for(const item of next.pending) {
      for(const edit of item.changes[group])if(fieldId(group,edit)===conflict.key)value=edit.value;
      item.changes[group]=item.changes[group].filter(edit=>fieldId(group,edit)!==conflict.key);
    }
    local.push({...conflict,value});
  }
  next.pending=next.pending.filter(item=>hasChanges(item.changes));next.conflicts=[];
  if(choice==='remote')return validateOutbox(next,catalog,next.userId);
  const desired=project(next,catalog).state;
  for(const item of local) {
    if(item.kind==='bookmark')desired.bookmarks=item.value?[...new Set([...desired.bookmarks,item.key])]:desired.bookmarks.filter(id=>id!==item.key);
    else if(item.key==='lesson')Object.assign(desired.settings,item.value);
    else desired.settings[item.key]=item.value;
  }
  return queueChange(next,desired,catalog,operationId);
}

export function prepareRpc(box,kind,request,catalog) {
  if(box.pending.length||box.flight||box.conflicts.length||box.blocked||!['exam','reset'].includes(kind))fail('기존 기록의 동기화를 먼저 완료해 주세요.');
  const next=clone(box);next.flight={kind,request:clone(request)};
  return validateOutbox(next,catalog,next.userId);
}
