import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { database, diagnostic } from './db-client.mjs';
import { buildCatalog, WEEK_NUMBERS } from '../dist/src/domain/content.js';
let db;
try {
  db=await database();
  const exists=(await db.query("SELECT to_regclass('study_private.migrations') IS NOT NULL AS present")).rows[0].present;
  const done=exists ? (await db.query('SELECT name,checksum FROM study_private.migrations')).rows : [];
  for (const name of ['001-sync.sql','002-exam.sql','003-receipt-versions.sql','004-account-retention.sql','005-identity-initialization.sql','006-bound-identity-helper.sql','007-exam-active-question-join.sql']) {
    const sql=await readFile(new URL(`../database/${name}`,import.meta.url),'utf8');
    const checksum=createHash('sha256').update(sql.replaceAll('\r\n','\n')).digest('hex'), prior=done.find(x=>x.name===name);
    if(prior) { if(prior.checksum!==checksum) throw new Error('MIGRATION_CHANGED'); continue; }
    await db.query('BEGIN');
    try {
      await db.query(sql.replace(/^BEGIN;\s*/m,'').replace(/COMMIT;\s*$/,''));
      await db.query('RESET ROLE');
      await db.query('CREATE TABLE IF NOT EXISTS study_private.migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())');
      await db.query('INSERT INTO study_private.migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
      await db.query('COMMIT'); console.log(`Applied ${name}`);
    } catch(error) { await db.query('ROLLBACK'); throw error; }
  }
  const weeks=await Promise.all(WEEK_NUMBERS.map(n=>readFile(new URL(`../dist/content/week-${String(n).padStart(2,'0')}.json`,import.meta.url),'utf8').then(JSON.parse)));
  const catalog=buildCatalog(weeks);
  await db.query('BEGIN');
  try {
    await db.query('SET LOCAL ROLE study_service');
    for(const o of catalog.objectives) await db.query('INSERT INTO study_private.objectives(id) VALUES($1) ON CONFLICT DO NOTHING',[o.id]);
    const active=new Set(catalog.questions.map(q=>q.id));
    for(const q of catalog.questionMap.values()) await db.query(`INSERT INTO study_private.questions(id,objective_id,family,exam,answer_id,options,active) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)
      ON CONFLICT(id) DO UPDATE SET objective_id=excluded.objective_id,family=excluded.family,exam=excluded.exam,answer_id=excluded.answer_id,options=excluded.options,active=excluded.active`,
      [q.id,q.objectiveId,q.family,q.exam,q.answerId,JSON.stringify(q.options.map(o=>o.id)),active.has(q.id)]);
    await db.query('COMMIT'); console.log(JSON.stringify({catalogObjectives:catalog.objectives.length,catalogQuestions:catalog.questionMap.size,activeQuestions:active.size}));
  } catch(error) { await db.query('ROLLBACK'); throw error; }
  // Data API schema discovery may be cached. This is a documented PostgREST notification, no data mutation.
  await db.query("NOTIFY pgrst, 'reload schema'");
} catch(error) { diagnostic(error); } finally { await db?.end(); }
