import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {buildCatalog,WEEK_NUMBERS} from '../dist/src/domain/content.js';
import {emptyCloud} from '../dist/src/domain/sync.js';
import {newOutbox} from '../dist/src/domain/outbox.js';
import {createAccountStore,accountKey,loadDeviceId} from '../dist/src/cloud/storage.js';
const catalog=buildCatalog(await Promise.all(WEEK_NUMBERS.map(n=>readFile(new URL(`../dist/content/week-${String(n).padStart(2,'0')}.json`,import.meta.url),'utf8').then(JSON.parse))));
const id=randomUUID(),box=()=>newOutbox(emptyCloud(id,randomUUID()));
function memory(){const data=new Map();return{data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('corrupt 36-character device identifiers cannot prevent account login',()=>{
  const storage=memory(),replacement=randomUUID();storage.setItem('internet-security-device-v1','-'.repeat(36));
  assert.equal(loadDeviceId(storage,()=>replacement),replacement);
  assert.equal(loadDeviceId(storage,()=>randomUUID()),replacement);
  assert.equal(storage.getItem('internet-security-study-v1'),null);
});
test('account store cannot overwrite an intervening tab or another account key',()=>{
  const storage=memory(),a=createAccountStore(storage,catalog,id),b=createAccountStore(storage,catalog,id);
  a.load();b.load();assert.equal(a.save(box()).ok,true);
  const raw=storage.getItem(accountKey(id));assert.equal(b.save(box()).reason,'changed');assert.equal(storage.getItem(accountKey(id)),raw);
  assert.equal(storage.getItem('internet-security-study-v1'),null);
});
test('corrupt cache is preserved and automatic save is disabled',()=>{
  const storage=memory();storage.setItem(accountKey(id),'{broken');
  const store=createAccountStore(storage,catalog,id);assert.equal(store.load().reason,'invalid');
  assert.equal(store.save(box()).ok,false);assert.equal(store.raw(),'{broken');
  assert.equal(store.replace(box()).ok,true);
});
test('denied storage and post-write readback failure never claim durable success',()=>{
  const denied=createAccountStore({getItem(){throw new Error('denied');}},catalog,id);
  assert.equal(denied.load().reason,'unavailable');assert.equal(denied.save(box()).ok,false);
  const storage=memory(),store=createAccountStore(storage,catalog,id);store.load();
  let saved=false;const read=storage.getItem;storage.setItem=(k,v)=>{storage.data.set(k,v);saved=true;};storage.getItem=k=>{if(saved)throw new Error('readback');return read(k);};
  assert.equal(store.save(box()).reason,'uncertain');
});
test('malformed account IDs cannot escape the namespace',()=>{
  assert.throws(()=>createAccountStore(memory(),catalog,'internet-security-study-v1'));
});
