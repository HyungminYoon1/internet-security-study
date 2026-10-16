import {newOutbox,queueChange,project,prepare,prepareRpc,acknowledge,refresh,resolveConflicts} from '../domain/outbox.js';
import {mergeImport,validateCloud,validUuid} from '../domain/sync.js';
import {createAccountStore} from './storage.js';
import {publicError} from './neon.js';
const authFailure=e=>e?.status===401||e?.status===403||['AUTH_REQUIRED','28000','PGRST301','PGRST302'].includes(e?.code);
const permanentFailure=e=>['22023','22007','22008','22P02','23514','42501'].includes(e?.code);

const storageMessages={invalid:'계정 대기 기록을 읽을 수 없습니다. 원본을 보관한 뒤 계정 기록으로 다시 연결해 주세요.',changed:'다른 탭에서 계정 기록을 변경했습니다. 현재 기록을 백업한 뒤 새로고침해 주세요.',unavailable:'브라우저 저장소를 사용할 수 없어 계정 전송을 중단했습니다. 현재 기록을 백업해 주세요.',quota:'기기의 저장 공간이 부족해 계정 전송을 중단했습니다. 현재 기록을 백업해 주세요.',uncertain:'기기에 저장되었는지 확인할 수 없어 계정 전송을 중단했습니다. 현재 기록을 백업해 주세요.'};
export function createCloudSession({storage,catalog,user,transport,deviceId,onChange=()=>{},schedule=true}) {
  if(!validUuid(user?.id)||!user.emailVerified||!validUuid(deviceId))throw new TypeError('인증된 계정과 기기 정보가 필요합니다.');
  const store=createAccountStore(storage,catalog,user.id);
  let box=null,error='',durable=true,closed=false,busy=false,needsLogin=false,timer,work=null;
  let lastSynced=0,serverTime=Date.now(),clockAt=performance.now(),lastResponse=null;
  const emit=()=>{if(!closed)onChange();};
  function rememberClock(cloud){serverTime=cloud.serverNow;clockAt=performance.now();lastSynced=Date.now();}
  function persist(next,replace=false){
    box=next;const r=replace?store.replace(next):store.save(next);
    if(!r.ok){durable=false;error=storageMessages[r.reason]||storageMessages.unavailable;}
    emit();return r.ok;
  }
  async function identity(){
    const now=await transport.session();
    if(!now?.emailVerified||now.id!==user.id){needsLogin=true;throw Object.assign(new Error('SESSION_CHANGED'),{code:'AUTH_REQUIRED'});}
    needsLogin=false;
  }
  function later(delay=700){
    if(!schedule||closed||!durable||needsLogin||box?.blocked||box?.conflicts.length)return;
    clearTimeout(timer);timer=setTimeout(()=>void session.flush(),delay);
  }
  async function execute(pull){
    if(closed||!durable)return;
    if(!box){await session.start();return;}
    if(box.blocked||box.conflicts.length)return;
    busy=true;error='';emit();
    try{
      await identity();
      for(let i=0;i<10&&!closed;i++){
        if(!durable||box.blocked||box.conflicts.length)break;
        const next=prepare(box,catalog);
        if(!next.flight)break;
        if(!box.flight&&!persist(next))break;
        const flight=box.flight;
        const response=await transport.rpc({sync:'study_sync',exam:'study_exam',reset:'study_reset'}[flight.kind],flight.request);
        if(closed||!durable)return;
        lastResponse=response;
        const accepted=acknowledge(box,response,catalog);
        rememberClock(response.cloud);
        if(!persist(accepted))break;
        if(schedule&&box.pending.length)await new Promise(resolve=>setTimeout(resolve,600));
      }
      if(pull&&!closed&&durable&&!box.flight&&!box.blocked&&!box.conflicts.length){
        const cloud=await transport.rpc('study_pull');if(closed)return;
        rememberClock(cloud);persist(refresh(box,cloud,catalog));
      }
    }catch(e){error=publicError(e);if(authFailure(e))needsLogin=true;else if(permanentFailure(e)&&box?.flight)persist({...box,blocked:'invalid'});}
    finally{busy=false;emit();if(!closed&&(box?.flight||box?.pending.length)&&!box?.blocked&&!box?.conflicts.length)later(error?15000:1000);}
  }
  const session={
    user,deviceId,
    get state(){return box?project(box,catalog).state:null;},
    get cloud(){return box?.base??null;},get busy(){return busy;},get error(){return error;},get needsLogin(){return needsLogin;},
    get blocked(){return box?.blocked||(!durable?'storage':null);},get conflicts(){return box?.conflicts??[];},
    get pendingCount(){return (box?.pending.length||0)+(box?.flight&&box.flight.kind!=='sync'?1:0);},
    get lastSynced(){return lastSynced;},get canEditExam(){return !!box?.base.examWriter&&box.base.examWriter.deviceId===deviceId&&!busy&&!box.flight&&!box.blocked&&durable&&!needsLogin;},
    get raw(){return store.raw();},get key(){return store.key;},
    pendingBackup(){return box?JSON.stringify(box,null,2):store.raw();},
    now(){return serverTime+Math.max(0,performance.now()-clockAt);},
    async start(){
      const loaded=store.load();
      if(!loaded.ok){durable=false;error=storageMessages[loaded.reason];emit();return;}
      box=loaded.box;busy=true;error='';emit();
      try{
        await identity();const cloud=validateCloud(await transport.rpc('study_pull'),catalog,user.id);if(closed)return;
        rememberClock(cloud);persist(box?refresh(box,cloud,catalog):newOutbox(cloud));
      }catch(e){error=publicError(e);if(authFailure(e))needsLogin=true;}finally{busy=false;emit();}
      if(box?.flight||box?.pending.length)later();
    },
    change(desired){
      if(!box||closed||box.blocked)throw new Error('먼저 계정 기록을 연결해 주세요.');
      const next=queueChange(box,desired,catalog,crypto.randomUUID());
      const saved=persist(next);if(saved)later();return{ok:saved,state:this.state,message:error};
    },
    flush({pull=false}={}){if(work)return work;clearTimeout(timer);work=execute(pull).finally(()=>{work=null;});return work;},
    async importState(state){this.change(mergeImport(this.state,state,catalog));await this.flush();},
    async resolve(choice){if(!box)return;persist(resolveConflicts(box,choice,catalog,crypto.randomUUID()));await this.flush();},
    async recover(){
      if(closed||busy)return;busy=true;emit();
      try{await identity();const cloud=validateCloud(await transport.rpc('study_pull'),catalog,user.id);if(closed)return;
        durable=true;error='';needsLogin=false;rememberClock(cloud);persist(newOutbox(cloud),true);
      }catch(e){error=publicError(e);}finally{busy=false;emit();}
    },
    async exam(action,payload={}){
      const generation=box?.base.examWriter?.generation,examId=box?.base.state.activeExam?.id;
      await this.flush();
      if(!box||this.pendingCount||busy||!durable||needsLogin)throw new Error('대기 기록을 먼저 동기화해 주세요.');
      if(action!=='start'&&(generation!==box.base.examWriter?.generation||examId!==box.base.state.activeExam?.id))throw new Error('모의고사 기록이 바뀌었습니다. 최신 답안을 확인한 뒤 다시 시도해 주세요.');
      if(['save','finish'].includes(action)&&box.base.examWriter?.deviceId!==deviceId)throw new Error('이 기기에서 이어 풀기를 먼저 선택해 주세요.');
      const request={epoch:box.base.epoch,operationId:crypto.randomUUID(),deviceId,action,...payload};
      if(action!=='start'){request.examId=examId;request.generation=generation;}
      if(!persist(prepareRpc(box,'exam',request,catalog)))return null;
      lastResponse=null;await this.flush();return lastResponse;
    },
    async reset(){
      await this.flush({pull:true});
      if(!box||this.pendingCount||busy||!durable||needsLogin)throw new Error('대기 기록을 먼저 동기화해 주세요.');
      const request={epoch:box.base.epoch,revision:box.base.revision,operationId:crypto.randomUUID()};
      if(!persist(prepareRpc(box,'reset',request,catalog)))return false;
      await this.flush();return !box.flight&&!box.blocked;
    },
    storageChanged(){durable=false;error=storageMessages.changed;clearTimeout(timer);emit();},
    stop(){closed=true;clearTimeout(timer);}
  };
  return session;
}
