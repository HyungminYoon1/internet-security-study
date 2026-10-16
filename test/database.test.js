import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { randomUUID } from 'node:crypto';
const identities = {alice:'11111111-1111-4111-8111-111111111111',bob:'22222222-2222-4222-8222-222222222222',unverified:'33333333-3333-4333-8333-333333333333',missing:'44444444-4444-4444-8444-444444444444'};

async function fixture() {
  const db = new PGlite();
  try {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anonymous; CREATE SCHEMA auth; CREATE SCHEMA neon_auth;
    CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY, "emailVerified" boolean NOT NULL);
    INSERT INTO neon_auth."user" VALUES ('${identities.alice}',true),('${identities.bob}',true),('${identities.unverified}',false);
    CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '') $$;
    GRANT USAGE ON SCHEMA auth TO PUBLIC; GRANT EXECUTE ON FUNCTION auth.user_id() TO PUBLIC;`);
  await db.exec(await readFile(new URL('../database/001-sync.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../database/002-exam.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../database/003-receipt-versions.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../database/004-account-retention.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../database/005-identity-initialization.sql', import.meta.url), 'utf8'));
  // Managed Neon schema USAGE is not delegated to SQL-created runtime roles.
  await db.exec('REVOKE USAGE ON SCHEMA auth FROM PUBLIC');
  await db.exec(await readFile(new URL('../database/006-bound-identity-helper.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../database/007-exam-active-question-join.sql', import.meta.url), 'utf8'));
  await db.exec(`SET ROLE study_service;
    INSERT INTO study_private.objectives VALUES ('o1'),('o2');
    INSERT INTO study_private.questions VALUES ('q1','o1','f1','midterm','a','["a","b","c","d"]',true),('q2','o2','f2','midterm','b','["a","b","c","d"]',true),('q3','o2','f3','midterm','c','["a","b","c","d"]',true),('q4','o1','f4','midterm','a','["a","b","c","d"]',false);
    RESET ROLE; SET ROLE authenticated;`);
  const user = async id => db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[identities[id] || id]);
  const rpc = async (name, data) => (await db.query(`SELECT public.${name}(${data ? '$1::jsonb' : ''}) AS value`,data ? [JSON.stringify(data)] : [])).rows[0].value;
  await user('alice');
  return { db, user, rpc };
  } catch(error) { await db.close(); throw error; }
}
const changes = (overrides = {}) => ({read:[],attempts:[],bookmarks:[],settings:[],examHistory:[],...overrides});
const request = (base, change, operationId = randomUUID()) => ({epoch:base.epoch,baseRevision:base.revision,operationId,changes:changes(change)});
const attempt = (id='attempt1') => ({id,questionId:'q1',objectiveId:'o1',family:'f1',answerId:'a',correct:true,confidence:'sure',at:1000,mode:'practice'});
const examFixture = id => ({id,exam:'midterm',seed:'test',status:'active',startAt:1000,deadline:3601000,questionIds:['q1','q2','q3'],optionOrders:{q1:['a','b','c','d'],q2:['d','c','b','a'],q3:['a','b','c','d']},answers:{},flagged:[],position:0});

test('database sync invariants, isolation and input boundaries', async t => {
  const {db,user,rpc} = await fixture();
  try {
    await t.test('verified identity is mandatory; another identity has an independent record', async () => {
      await user('unverified'); await assert.rejects(rpc('study_pull'), /AUTH_REQUIRED/);
      await user('missing'); await assert.rejects(rpc('study_pull'), /AUTH_REQUIRED/);
      await user('alice'); const a = await rpc('study_pull');
      assert.equal(a.userId,identities.alice); assert.equal(a.revision,0);
      await rpc('study_sync',request(a,{attempts:[attempt()],read:['o1']}));
      await user('bob'); const b = await rpc('study_pull'); assert.deepEqual(b.state.attempts,[]);
      assert.notEqual(b.epoch,a.epoch);
      const forged = request(b,{read:['o1']}); forged.userId='alice';
      await assert.rejects(rpc('study_sync',forged), /INVALID_FIELDS/);
      await assert.rejects(db.query('SELECT body FROM study_private.progress'));
      await assert.rejects(db.query('SELECT study_private.empty_state()'));
      await user('alice'); assert.equal((await rpc('study_pull')).state.attempts.length,1);
    });
    await t.test('cold identity helper initialization occurs outside a SECURITY DEFINER context',async()=>{
      await db.exec(`RESET ROLE;
        CREATE OR REPLACE FUNCTION auth.user_id() RETURNS text LANGUAGE plpgsql STABLE AS $$
        BEGIN
          IF current_user <> 'authenticated' AND current_setting('test.identity.ready',true) IS DISTINCT FROM 'yes' THEN RETURN NULL; END IF;
          IF current_user = 'authenticated' THEN PERFORM set_config('test.identity.ready','yes',false); END IF;
          RETURN nullif(current_setting('request.jwt.claim.sub',true),'');
        END $$;
        SET ROLE authenticated;`);
      await user('alice');await db.query("SELECT set_config('test.identity.ready','no',false)");
      assert.equal((await rpc('study_pull')).userId,identities.alice);
      await user('bob');assert.equal((await rpc('study_pull')).userId,identities.bob);
      await user('alice');
    });
    await t.test('retries are idempotent, altered operation IDs and altered attempt data are rejected', async () => {
      const base = await rpc('study_pull'), req = request(base,{attempts:[attempt('retry')]});
      const first = await rpc('study_sync',req), second = await rpc('study_sync',req);
      assert.equal(second.cloud.revision,first.cloud.revision);
      assert.deepEqual(second.acceptedVersions,first.acceptedVersions);
      assert.equal(second.cloud.state.attempts.length,2);
      await assert.rejects(rpc('study_sync',{...req,changes:changes({read:['o2']})}), /OPERATION_REUSED/);
      await assert.rejects(rpc('study_sync',request(second.cloud,{attempts:[{...attempt('retry'),confidence:'guess'}]})),/ATTEMPT_CONFLICT/);
    });
    await t.test('concurrent additive work merges; bookmark tombstones and settings detect conflict', async () => {
      const base = await rpc('study_pull');
      const add = request(base,{bookmarks:[{id:'q1',value:true,baseVersion:0}]});
      const added = await rpc('study_sync',add);
      const removed = await rpc('study_sync',request(added.cloud,{bookmarks:[{id:'q1',value:false,baseVersion:added.cloud.revision}]}));
      const stale = await rpc('study_sync',{...add,operationId:randomUUID()});
      assert.equal(stale.status,'conflict'); assert.deepEqual(stale.cloud.state.bookmarks,[]);
      assert.equal(stale.conflicts[0].kind,'bookmark');
      const a = await rpc('study_sync',request(removed.cloud,{settings:[{key:'examDate',value:'2026-10-19',baseVersion:0}],attempts:[attempt('device-a')]}));
      const b = await rpc('study_sync',request(removed.cloud,{settings:[{key:'examDate',value:'2026-10-20',baseVersion:0}],attempts:[attempt('device-b')],read:['o2']}));
      assert.equal(b.status,'conflict'); assert.equal(b.cloud.state.settings.examDate,'2026-10-19');
      assert.ok(b.cloud.state.attempts.some(x=>x.id==='device-a')); assert.ok(b.cloud.state.attempts.some(x=>x.id==='device-b'));
      const same = await rpc('study_sync',request(a.cloud,{settings:[{key:'examDate',value:'2026-10-19',baseVersion:0}]}));
      assert.equal(same.status,'ok');
    });
    await t.test('strict JSON values, grades, unknown IDs and payload limits cannot bypass validation', async () => {
      const base = await rpc('study_pull');
      const invalid = [
        {attempts:[{...attempt('bad'),answerId:'unknown'}]},
        {attempts:[{...attempt('bad'),correct:false}]},
        {attempts:[{...attempt('bad'),at:null}]},
        {read:['missing']}, {read:[null]}, {read:'o1'},
        {bookmarks:[{id:'q1',value:true,baseVersion:null}]},
        {settings:[{key:'exam',value:null,baseVersion:0}]},
        {settings:[{key:'examDate',value:'2026-02-30',baseVersion:0}]},
        {settings:[{key:'lesson',value:{lastObjective:'o1',lessonStep:null},baseVersion:0}]},
        {settings:[{key:'exam',value:'final',baseVersion:'0'}]},
        {activeExam:{}}, {attempts:Array.from({length:3001},(_,i)=>attempt(`limit-${i}`))},
      ];
      for (const bad of invalid) await assert.rejects(rpc('study_sync',request(base,bad)),JSON.stringify(bad).slice(0,120));
      await assert.rejects(rpc('study_sync',{...request(base,{}),padding:'x'.repeat(2097152)}));
      assert.equal((await rpc('study_pull')).revision,base.revision);
    });
    await t.test('reset is version guarded, retry safe, and rejects every old-epoch queued write', async () => {
      const old = await rpc('study_pull');
      const reset = {epoch:old.epoch,revision:old.revision,operationId:randomUUID()};
      assert.equal((await rpc('study_reset',{...reset,revision:old.revision-1})).status,'conflict');
      const cleared = await rpc('study_reset',reset), retry = await rpc('study_reset',reset);
      assert.notEqual(cleared.cloud.epoch,old.epoch); assert.equal(retry.cloud.epoch,cleared.cloud.epoch);
      assert.deepEqual(cleared.cloud.state.attempts,[]);
      assert.equal((await rpc('study_sync',request(old,{attempts:[attempt('old-offline')]}))).status,'epoch-conflict');
      assert.deepEqual((await rpc('study_pull')).state.attempts,[]);
    });
    await t.test('an exam has one writer, server time, idempotent saves, explicit takeover and exact grading', async () => {
      const base = await rpc('study_pull'), deviceA=randomUUID(), deviceB=randomUUID();
      const start = {epoch:base.epoch,operationId:randomUUID(),deviceId:deviceA,action:'start',exam:examFixture('exam1')};
      const retired=examFixture('retired');retired.questionIds=['q4'];retired.optionOrders={q4:['a','b','c','d']};
      await assert.rejects(rpc('study_exam',{...start,operationId:randomUUID(),exam:retired}),/INVALID_NEW_EXAM/);
      const a = await rpc('study_exam',start), repeated = await rpc('study_exam',start);
      assert.equal(a.status,'ok'); assert.equal(repeated.cloud.revision,a.cloud.revision);
      assert.ok(a.cloud.state.activeExam.startAt > 1000);
      assert.equal(a.cloud.state.activeExam.deadline-a.cloud.state.activeExam.startAt,3600000);
      const save = {epoch:base.epoch,operationId:randomUUID(),deviceId:deviceA,action:'save',examId:'exam1',generation:a.cloud.examWriter.generation,answers:{q1:'a',q2:'a'},flagged:['q3'],position:2};
      const denied = await rpc('study_exam',{...save,operationId:randomUUID(),deviceId:deviceB});
      assert.equal(denied.status,'writer-conflict'); assert.deepEqual(denied.cloud.state.activeExam.answers,{});
      const saved=await rpc('study_exam',save); assert.notEqual(saved.cloud.examWriter.generation,a.cloud.examWriter.generation);
      assert.equal((await rpc('study_exam',save)).cloud.revision,saved.cloud.revision);
      const taken=await rpc('study_exam',{epoch:base.epoch,operationId:randomUUID(),deviceId:deviceB,action:'takeover',examId:'exam1',generation:saved.cloud.examWriter.generation});
      assert.equal(taken.cloud.examWriter.deviceId,deviceB); assert.equal(taken.cloud.state.activeExam.deadline,a.cloud.state.activeExam.deadline);
      assert.equal((await rpc('study_exam',{...save,operationId:randomUUID(),generation:saved.cloud.examWriter.generation})).status,'writer-conflict');
      await assert.rejects(rpc('study_exam',{...save,operationId:randomUUID(),deviceId:deviceB,generation:taken.cloud.examWriter.generation,answers:{q1:null}}),/INVALID_EXAM_ANSWER/);
      const done = await rpc('study_exam',{epoch:base.epoch,operationId:randomUUID(),deviceId:deviceB,action:'finish',examId:'exam1',generation:taken.cloud.examWriter.generation});
      assert.equal(done.cloud.state.activeExam,null); assert.equal(done.cloud.examWriter,null);
      const result=done.cloud.state.examHistory.at(-1); assert.equal(result.score,33.3); assert.equal(result.unanswered,1);
      assert.equal(done.cloud.state.attempts.length,2);
      const imported={...result,id:'imported-exam'};
      assert.equal((await rpc('study_sync',request(done.cloud,{examHistory:[imported]}))).status,'ok');
    });
    await t.test('expired exams finish before accepting an answer or takeover and cannot extend the deadline', async () => {
      const base=await rpc('study_pull'), deviceId=randomUUID();
      const start=await rpc('study_exam',{epoch:base.epoch,operationId:randomUUID(),deviceId,action:'start',exam:examFixture('expired')});
      await db.exec(`RESET ROLE; SET ROLE study_service;
        UPDATE study_private.progress SET body=jsonb_set(jsonb_set(body,'{activeExam,startAt}',to_jsonb(floor(extract(epoch FROM now())*1000)::bigint-3601000)),'{activeExam,deadline}',to_jsonb(floor(extract(epoch FROM now())*1000)::bigint-1000)) WHERE user_id=study_private.current_user_id();
        RESET ROLE; SET ROLE authenticated;`);
      const denied=await rpc('study_exam',{epoch:base.epoch,operationId:randomUUID(),deviceId,action:'save',examId:'expired',generation:start.cloud.examWriter.generation,answers:{q1:'a'},flagged:[],position:0});
      assert.equal(denied.status,'expired'); assert.equal(denied.cloud.state.activeExam,null);
      assert.equal(denied.cloud.state.examHistory.at(-1).score,0);
      const pulled=await rpc('study_pull'); assert.equal(pulled.state.examHistory.filter(x=>x.id==='expired').length,1);
    });
    await t.test('per-account RPC admission limit refuses the next request without blocking another account',async()=>{
      await db.exec(`RESET ROLE; SET ROLE study_service;
        UPDATE study_private.progress SET rate_window=now(),rate_count=118 WHERE user_id=study_private.current_user_id();
        RESET ROLE; SET ROLE authenticated;`);
      await rpc('study_pull');await rpc('study_pull');await assert.rejects(rpc('study_pull'),/RATE_LIMIT/);
      await user('bob');assert.equal((await rpc('study_pull')).userId,identities.bob);await user('alice');
    });
    await t.test('deleting an Auth account cascades only that accounts application records',async()=>{
      await db.exec('RESET ROLE');
      await db.query('DELETE FROM neon_auth."user" WHERE id=$1',[identities.alice]);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM study_private.progress WHERE user_id=$1',[identities.alice])).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM study_private.receipts WHERE user_id=$1',[identities.alice])).rows[0].n,0);
      assert.equal((await db.query('SELECT count(*)::int AS n FROM study_private.progress WHERE user_id=$1',[identities.bob])).rows[0].n,1);
    });
  } finally { await db.close(); }
});

test('database denies unauthenticated RPC and direct progress-table access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anonymous; CREATE SCHEMA auth; CREATE SCHEMA neon_auth;
      CREATE TABLE neon_auth."user" (id uuid PRIMARY KEY, "emailVerified" boolean NOT NULL);
      CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '') $$;
      GRANT USAGE ON SCHEMA auth TO PUBLIC; GRANT EXECUTE ON FUNCTION auth.user_id() TO PUBLIC;`);
    const migration = await readFile(new URL('../database/001-sync.sql', import.meta.url), 'utf8');
    try { await db.exec(migration); } catch (error) {
      const position = Number(error.position || error.internalPosition);
      console.error('SQL diagnostic', { code: error.code, position, line: position ? migration.slice(0,position).split('\n').length : null, context: error.where });
      throw error;
    }
    await db.exec('SET ROLE anonymous');
    await assert.rejects(db.query('SELECT public.study_pull()'));
    await assert.rejects(db.query('SELECT * FROM study_private.progress'));
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await assert.rejects(db.query('SELECT public.study_pull()'));
    await assert.rejects(db.query('SELECT * FROM study_private.progress'));
  } finally { await db.close(); }
});
