import {validateOutbox} from '../domain/outbox.js';
import {validUuid} from '../domain/sync.js';
export const accountKey=id=>`internet-security-account-v1:${id}`;
export function loadDeviceId(storage,generate=()=>crypto.randomUUID()) {
  const key='internet-security-device-v1';
  try{const existing=storage.getItem(key);if(validUuid(existing))return existing;}catch{/* Memory-only ID; account store reports persistence failure. */}
  const id=generate();if(!validUuid(id))throw new TypeError('기기 식별자를 만들지 못했습니다.');
  try{storage.setItem(key,id);}catch{/* The storage adapter will stop non-durable uploads. */}
  return id;
}
export function createAccountStore(storage,catalog,userId) {
  if(!validUuid(userId))throw new TypeError('계정 식별자가 잘못되었습니다.');
  const key=accountKey(userId);let baseline,readable=false,writable=false,original=null;
  function load(){
    try {baseline=storage.getItem(key);original=baseline;readable=true;}
    catch{return{ok:false,reason:'unavailable'};}
    try {const box=baseline===null?null:validateOutbox(JSON.parse(baseline),catalog,userId);writable=true;return{ok:true,box};}
    catch{return{ok:false,reason:'invalid'};}
  }
  function save(box,confirmed=false){
    if(!readable||(!writable&&!confirmed))return{ok:false,reason:'unavailable'};
    let text;try{text=JSON.stringify(validateOutbox(box,catalog,userId));}catch{return{ok:false,reason:'invalid'};}
    try{if(storage.getItem(key)!==baseline){writable=false;return{ok:false,reason:'changed'};}}
    catch{writable=false;return{ok:false,reason:'unavailable'};}
    try{storage.setItem(key,text);}catch{return{ok:false,reason:'quota'};}
    let readback;for(let i=0;i<2;i++){try{readback=storage.getItem(key);break;}catch{/* One bounded readback retry; no rollback. */}}
    if(readback!==text){writable=false;return{ok:false,reason:'uncertain'};}
    baseline=text;writable=true;return{ok:true};
  }
  return{key,load,save,replace:box=>save(box,true),raw:()=>original};
}
