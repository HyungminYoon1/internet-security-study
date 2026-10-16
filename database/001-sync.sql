-- Application-owned objects only. Managed neon_auth/auth schemas are not modified.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'study_service') THEN
    CREATE ROLE study_service NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  EXECUTE format('GRANT study_service TO %I', current_user);
END $$;
CREATE SCHEMA IF NOT EXISTS study_private AUTHORIZATION study_service;
REVOKE ALL ON SCHEMA study_private FROM PUBLIC, authenticated, anonymous;
-- Neon owns auth and does not delegate schema USAGE to custom roles. This parameterless
-- identity bridge is owned by the migration role; all data logic remains NOLOGIN/NOBYPASSRLS.
CREATE FUNCTION study_private.current_user_id() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT auth.user_id() $$;
REVOKE ALL ON FUNCTION study_private.current_user_id() FROM PUBLIC,authenticated,anonymous;
GRANT EXECUTE ON FUNCTION study_private.current_user_id() TO study_service;
GRANT USAGE ON SCHEMA neon_auth TO study_service;
GRANT SELECT (id, "emailVerified") ON neon_auth."user" TO study_service;
GRANT USAGE, CREATE ON SCHEMA public TO study_service;
SET LOCAL ROLE study_service;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE study_private.objectives (id text PRIMARY KEY);
CREATE TABLE study_private.questions (
  id text PRIMARY KEY, objective_id text NOT NULL REFERENCES study_private.objectives(id),
  family text NOT NULL, exam text NOT NULL CHECK (exam IN ('midterm','final')),
  answer_id text NOT NULL, options jsonb NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE study_private.progress (
  user_id text PRIMARY KEY, epoch uuid NOT NULL DEFAULT gen_random_uuid(),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0), body jsonb NOT NULL,
  versions jsonb NOT NULL DEFAULT '{"bookmarks":{},"settings":{}}', exam_writer jsonb,
  rate_window timestamptz NOT NULL DEFAULT now(), rate_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(), last_reset_id uuid,
  CHECK (octet_length(body::text) <= 2097152), CHECK (octet_length(versions::text) <= 262144)
);
CREATE TABLE study_private.receipts (
  user_id text NOT NULL REFERENCES study_private.progress(user_id) ON DELETE CASCADE,
  operation_id uuid NOT NULL, fingerprint text NOT NULL, result jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, operation_id)
);
CREATE INDEX receipts_owner_time ON study_private.receipts(user_id, accepted_at DESC);
ALTER TABLE study_private.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_private.progress FORCE ROW LEVEL SECURITY;
ALTER TABLE study_private.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_private.receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY own_progress ON study_private.progress TO study_service
  USING (user_id = (SELECT study_private.current_user_id())) WITH CHECK (user_id = (SELECT study_private.current_user_id()));
CREATE POLICY own_receipts ON study_private.receipts TO study_service
  USING (user_id = (SELECT study_private.current_user_id())) WITH CHECK (user_id = (SELECT study_private.current_user_id()));

CREATE FUNCTION study_private.empty_state() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT '{"schemaVersion":1,"contentVersion":"2026.10.15","revision":0,"settings":{"exam":"midterm","examDate":"","lastObjective":"","lessonStep":0},"read":[],"attempts":[],"bookmarks":[],"activeExam":null,"examHistory":[]}'::jsonb
$$;
CREATE FUNCTION study_private.require_user() RETURNS text LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE uid text := study_private.current_user_id();
BEGIN
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM neon_auth."user" u WHERE u.id = uid::uuid AND u."emailVerified" = true) THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  RETURN uid;
END $$;
CREATE FUNCTION study_private.shape(v jsonb, allowed text[], required text[] DEFAULT '{}') RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_OBJECT' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(v) k WHERE NOT k = ANY(allowed)) OR NOT (v ?& required) THEN
    RAISE EXCEPTION 'INVALID_FIELDS' USING ERRCODE = '22023';
  END IF;
END $$;
CREATE FUNCTION study_private.array_bound(v jsonb, lim integer) RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF jsonb_typeof(v) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_ARRAY' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length(v) > lim THEN RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE = '22023'; END IF;
END $$;
CREATE FUNCTION study_private.valid_attempt(a jsonb) RETURNS void LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE q study_private.questions;
BEGIN
  PERFORM study_private.shape(a, ARRAY['id','questionId','objectiveId','family','answerId','correct','confidence','at','mode','hinted'], ARRAY['id','questionId','objectiveId','family','answerId','correct','confidence','at','mode']);
  SELECT * INTO q FROM study_private.questions WHERE id = a->>'questionId';
  IF NOT FOUND OR jsonb_typeof(a->'id') IS DISTINCT FROM 'string' OR length(a->>'id') NOT BETWEEN 1 AND 160
    OR a->>'objectiveId' IS DISTINCT FROM q.objective_id OR a->>'family' IS DISTINCT FROM q.family
    OR NOT (q.options ? (a->>'answerId')) OR a->'correct' IS DISTINCT FROM to_jsonb(a->>'answerId' = q.answer_id)
    OR coalesce(a->>'confidence','') NOT IN ('sure','unsure','guess') OR coalesce(a->>'mode','') NOT IN ('practice','exam')
    OR jsonb_typeof(a->'at') IS DISTINCT FROM 'number' OR (a->>'at') !~ '^[0-9]{1,16}$'
    OR (a->>'at')::numeric > 8640000000000000 OR (a ? 'hinted' AND jsonb_typeof(a->'hinted') IS DISTINCT FROM 'boolean') THEN
    RAISE EXCEPTION 'INVALID_ATTEMPT' USING ERRCODE = '22023';
  END IF;
END $$;
CREATE FUNCTION study_private.valid_exam(e jsonb, finished boolean) RETURNS void LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE qid text; q study_private.questions; correct_count integer := 0; answered integer; qcount integer; t numeric;
BEGIN
  PERFORM study_private.shape(e, ARRAY['id','exam','seed','startAt','deadline','status','questionIds','optionOrders','answers','flagged','position'] || CASE WHEN finished THEN ARRAY['finishedAt','correct','unanswered','score'] ELSE '{}'::text[] END,
    ARRAY['id','exam','seed','startAt','deadline','status','questionIds','optionOrders','answers','flagged','position']);
  IF jsonb_typeof(e->'id') IS DISTINCT FROM 'string' OR length(e->>'id') NOT BETWEEN 1 AND 160
    OR jsonb_typeof(e->'seed') IS DISTINCT FROM 'string' OR length(e->>'seed') > 160
    OR coalesce(e->>'exam','') NOT IN ('midterm','final') OR e->>'status' IS DISTINCT FROM (CASE WHEN finished THEN 'finished' ELSE 'active' END) THEN
    RAISE EXCEPTION 'INVALID_EXAM' USING ERRCODE = '22023';
  END IF;
  PERFORM study_private.array_bound(e->'questionIds', 200); PERFORM study_private.array_bound(e->'flagged', 200);
  qcount := jsonb_array_length(e->'questionIds');
  IF qcount < 1 OR jsonb_typeof(e->'startAt') IS DISTINCT FROM 'number' OR jsonb_typeof(e->'deadline') IS DISTINCT FROM 'number'
    OR jsonb_typeof(e->'position') IS DISTINCT FROM 'number' OR (e->>'startAt') !~ '^[0-9]{1,16}$' OR (e->>'deadline') !~ '^[0-9]{1,16}$'
    OR (e->>'deadline')::numeric - (e->>'startAt')::numeric <> 3600000
    OR (e->>'deadline')::numeric > 8640000000000000 OR (e->>'position') !~ '^[0-9]{1,3}$'
    OR (e->>'position')::integer >= qcount THEN RAISE EXCEPTION 'INVALID_EXAM_TIME' USING ERRCODE = '22023'; END IF;
  PERFORM study_private.shape(e->'answers', ARRAY(SELECT jsonb_array_elements_text(e->'questionIds')));
  PERFORM study_private.shape(e->'optionOrders', ARRAY(SELECT jsonb_array_elements_text(e->'questionIds')), ARRAY(SELECT jsonb_array_elements_text(e->'questionIds')));
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(e->'questionIds')) <> qcount
    OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(e->'flagged')) <> jsonb_array_length(e->'flagged')
    OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(e->'flagged') f WHERE NOT (e->'questionIds' ? f)) THEN
    RAISE EXCEPTION 'INVALID_EXAM_QUESTIONS' USING ERRCODE = '22023';
  END IF;
  FOR qid IN SELECT jsonb_array_elements_text(e->'questionIds') LOOP
    SELECT * INTO q FROM study_private.questions WHERE id = qid;
    IF NOT FOUND OR q.exam IS DISTINCT FROM e->>'exam' THEN RAISE EXCEPTION 'INVALID_EXAM_SCOPE' USING ERRCODE = '22023'; END IF;
    PERFORM study_private.array_bound(e->'optionOrders'->qid, 4);
    IF jsonb_array_length(e->'optionOrders'->qid) <> 4 OR NOT ((e->'optionOrders'->qid) @> q.options AND q.options @> (e->'optionOrders'->qid))
      OR (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(e->'optionOrders'->qid)) <> 4
      OR (e->'answers' ? qid AND (jsonb_typeof(e->'answers'->qid) IS DISTINCT FROM 'string' OR NOT (q.options ? (e->'answers'->>qid)))) THEN
      RAISE EXCEPTION 'INVALID_EXAM_ANSWER' USING ERRCODE = '22023';
    END IF;
    IF e->'answers'->>qid = q.answer_id THEN correct_count := correct_count + 1; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT family) FROM study_private.questions WHERE id IN (SELECT jsonb_array_elements_text(e->'questionIds'))) <> qcount THEN
    RAISE EXCEPTION 'DUPLICATE_EXAM_FAMILY' USING ERRCODE = '22023';
  END IF;
  IF finished THEN
    answered := (SELECT count(*) FROM jsonb_object_keys(e->'answers'));
    IF NOT (e ?& ARRAY['finishedAt','correct','unanswered','score']) OR jsonb_typeof(e->'finishedAt') IS DISTINCT FROM 'number' OR (e->>'finishedAt') !~ '^[0-9]{1,16}$'
      OR (e->>'finishedAt')::numeric NOT BETWEEN (e->>'startAt')::numeric AND (e->>'deadline')::numeric
      OR e->'correct' IS DISTINCT FROM to_jsonb(correct_count) OR e->'unanswered' IS DISTINCT FROM to_jsonb(qcount - answered)
      OR e->'score' IS DISTINCT FROM to_jsonb(round(1000.0 * correct_count / qcount) / 10) THEN
      RAISE EXCEPTION 'INVALID_EXAM_RESULT' USING ERRCODE = '22023';
    END IF;
  END IF;
END $$;
CREATE FUNCTION study_private.lock_progress(uid text) RETURNS study_private.progress LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE p study_private.progress;
BEGIN
  INSERT INTO study_private.progress(user_id, body) VALUES(uid, study_private.empty_state()) ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT p FROM study_private.progress WHERE user_id = uid FOR UPDATE;
  IF p.rate_window < now() - interval '1 minute' THEN p.rate_window := now(); p.rate_count := 0; END IF;
  IF p.rate_count >= 120 THEN RAISE EXCEPTION 'RATE_LIMIT' USING ERRCODE = 'P0001'; END IF;
  UPDATE study_private.progress SET rate_window = p.rate_window, rate_count = p.rate_count + 1 WHERE user_id = uid;
  RETURN p;
END $$;
CREATE FUNCTION study_private.envelope(p study_private.progress) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT jsonb_build_object('userId',p.user_id,'epoch',p.epoch,'revision',p.revision,'state',p.body,'versions',p.versions,'examWriter',p.exam_writer,'serverNow',floor(extract(epoch FROM clock_timestamp())*1000)::bigint)
$$;
CREATE FUNCTION public.study_pull() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on SET statement_timeout = '5s' SET lock_timeout = '2s' AS $$
DECLARE uid text := study_private.require_user(); p study_private.progress;
BEGIN p := study_private.lock_progress(uid); RETURN study_private.envelope(p); END $$;

CREATE FUNCTION public.study_sync(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on SET statement_timeout = '5s' SET lock_timeout = '2s' AS $$
DECLARE uid text := study_private.require_user(); p study_private.progress; c jsonb; item jsonb; old jsonb; k text; v jsonb;
  changes jsonb; conflicts jsonb := '[]'; op uuid; fingerprint text; receipt study_private.receipts; n bigint; seen text[] := '{}';
BEGIN
  IF octet_length(p_request::text) > 2097152 THEN RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE = '22023'; END IF;
  PERFORM study_private.shape(p_request, ARRAY['epoch','operationId','baseRevision','changes'], ARRAY['epoch','operationId','baseRevision','changes']);
  op := (p_request->>'operationId')::uuid; fingerprint := encode(sha256(convert_to(p_request::text, 'UTF8')), 'hex');
  IF op IS NULL OR jsonb_typeof(p_request->'baseRevision') IS DISTINCT FROM 'number' OR (p_request->>'baseRevision') !~ '^[0-9]{1,15}$' THEN RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023'; END IF;
  p := study_private.lock_progress(uid);
  IF p.epoch::text IS DISTINCT FROM p_request->>'epoch' THEN RETURN jsonb_build_object('status','epoch-conflict','cloud',study_private.envelope(p),'conflicts','[]'::jsonb); END IF;
  SELECT * INTO receipt FROM study_private.receipts WHERE user_id = uid AND operation_id = op;
  IF FOUND THEN
    IF receipt.fingerprint <> fingerprint THEN RAISE EXCEPTION 'OPERATION_REUSED' USING ERRCODE = '22023'; END IF;
    RETURN receipt.result || jsonb_build_object('cloud',study_private.envelope(p));
  END IF;
  IF (p_request->>'baseRevision')::bigint > p.revision OR (p_request->>'baseRevision')::bigint < greatest(0,p.revision-128) THEN
    RETURN jsonb_build_object('status','stale','cloud',study_private.envelope(p),'conflicts','[]'::jsonb);
  END IF;
  changes := p_request->'changes';
  PERFORM study_private.shape(changes, ARRAY['read','attempts','bookmarks','settings','examHistory'], ARRAY['read','attempts','bookmarks','settings','examHistory']);
  PERFORM study_private.array_bound(changes->'read', 1000); PERFORM study_private.array_bound(changes->'attempts', 3000);
  PERFORM study_private.array_bound(changes->'bookmarks', 3000); PERFORM study_private.array_bound(changes->'settings', 3); PERFORM study_private.array_bound(changes->'examHistory', 20);
  n := p.revision + 1;
  FOR item IN SELECT value FROM jsonb_array_elements(changes->'attempts') LOOP
    PERFORM study_private.valid_attempt(item);
    SELECT value INTO old FROM jsonb_array_elements(p.body->'attempts') WHERE value->>'id' = item->>'id';
    IF FOUND AND old IS DISTINCT FROM item THEN RAISE EXCEPTION 'ATTEMPT_CONFLICT' USING ERRCODE = '22023'; END IF;
    IF NOT FOUND THEN p.body := jsonb_set(p.body,'{attempts}',p.body->'attempts' || jsonb_build_array(item)); END IF;
  END LOOP;
  SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO c FROM jsonb_array_elements(p.body->'attempts') WITH ORDINALITY a(value,ord)
    WHERE ord > greatest(0,jsonb_array_length(p.body->'attempts')-3000);
  p.body := jsonb_set(p.body,'{attempts}',c);
  FOR item IN SELECT value FROM jsonb_array_elements(changes->'read') LOOP
    k := item #>> '{}';
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' OR NOT EXISTS(SELECT 1 FROM study_private.objectives WHERE id=k) THEN RAISE EXCEPTION 'INVALID_OBJECTIVE' USING ERRCODE = '22023'; END IF;
    IF NOT (p.body->'read' ? k) THEN p.body := jsonb_set(p.body,'{read}',p.body->'read' || jsonb_build_array(k)); END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(changes->'bookmarks') LOOP
    PERFORM study_private.shape(item, ARRAY['id','value','baseVersion'], ARRAY['id','value','baseVersion']); k := item->>'id';
    IF NOT EXISTS(SELECT 1 FROM study_private.questions WHERE id=k) OR jsonb_typeof(item->'value') IS DISTINCT FROM 'boolean'
      OR jsonb_typeof(item->'baseVersion') IS DISTINCT FROM 'number' OR (item->>'baseVersion') !~ '^[0-9]{1,15}$' OR k=ANY(seen) THEN RAISE EXCEPTION 'INVALID_BOOKMARK' USING ERRCODE = '22023'; END IF;
    seen := array_append(seen,k); old := to_jsonb(p.body->'bookmarks' ? k);
    IF old = item->'value' THEN CONTINUE; END IF;
    IF coalesce(p.versions->'bookmarks'->k,'0') <> item->'baseVersion' THEN
      conflicts := conflicts || jsonb_build_array(jsonb_build_object('kind','bookmark','key',k,'local',item->'value','remote',old)); CONTINUE;
    END IF;
    IF item->'value' = 'true' THEN p.body := jsonb_set(p.body,'{bookmarks}',p.body->'bookmarks' || jsonb_build_array(k));
    ELSE SELECT coalesce(jsonb_agg(value),'[]') INTO c FROM jsonb_array_elements(p.body->'bookmarks') WHERE value #>> '{}' <> k; p.body := jsonb_set(p.body,'{bookmarks}',c); END IF;
    p.versions := jsonb_set(p.versions,ARRAY['bookmarks',k],to_jsonb(n));
  END LOOP;
  seen := '{}';
  FOR item IN SELECT value FROM jsonb_array_elements(changes->'settings') LOOP
    PERFORM study_private.shape(item, ARRAY['key','value','baseVersion'], ARRAY['key','value','baseVersion']); k := item->>'key'; v := item->'value';
    IF k NOT IN ('exam','examDate','lesson') OR k IS NULL OR k=ANY(seen) OR jsonb_typeof(item->'baseVersion') IS DISTINCT FROM 'number' OR (item->>'baseVersion') !~ '^[0-9]{1,15}$' THEN RAISE EXCEPTION 'INVALID_SETTING' USING ERRCODE = '22023'; END IF;
    seen := array_append(seen,k);
    IF k='exam' AND (jsonb_typeof(v) IS DISTINCT FROM 'string' OR (v #>> '{}') NOT IN ('midterm','final')) THEN RAISE EXCEPTION 'INVALID_SETTING' USING ERRCODE = '22023'; END IF;
    IF k='examDate' THEN
      IF jsonb_typeof(v) IS DISTINCT FROM 'string' OR length(v #>> '{}') > 10 THEN RAISE EXCEPTION 'INVALID_DATE' USING ERRCODE = '22023'; END IF;
      IF v #>> '{}' <> '' AND ((v #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR to_char((v #>> '{}')::date,'YYYY-MM-DD') <> v #>> '{}') THEN RAISE EXCEPTION 'INVALID_DATE' USING ERRCODE = '22023'; END IF;
    END IF;
    IF k='lesson' THEN
      PERFORM study_private.shape(v,ARRAY['lastObjective','lessonStep'],ARRAY['lastObjective','lessonStep']);
      IF jsonb_typeof(v->'lastObjective') IS DISTINCT FROM 'string' OR ((v->>'lastObjective') <> '' AND NOT EXISTS(SELECT 1 FROM study_private.objectives WHERE id=v->>'lastObjective'))
        OR NOT ((v->'lessonStep') = ANY(ARRAY['0','1','2','3']::jsonb[])) THEN RAISE EXCEPTION 'INVALID_LESSON' USING ERRCODE = '22023'; END IF;
      old := jsonb_build_object('lastObjective',p.body->'settings'->'lastObjective','lessonStep',p.body->'settings'->'lessonStep');
    ELSE old := p.body->'settings'->k; END IF;
    IF old = v THEN CONTINUE; END IF;
    IF coalesce(p.versions->'settings'->k,'0') <> item->'baseVersion' THEN
      conflicts := conflicts || jsonb_build_array(jsonb_build_object('kind','setting','key',k,'local',v,'remote',old)); CONTINUE;
    END IF;
    IF k='lesson' THEN p.body := jsonb_set(p.body,'{settings}',p.body->'settings' || v);
    ELSE p.body := jsonb_set(p.body,ARRAY['settings',k],v); END IF;
    p.versions := jsonb_set(p.versions,ARRAY['settings',k],to_jsonb(n));
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(changes->'examHistory') LOOP
    PERFORM study_private.valid_exam(item,true);
    IF p.body->'activeExam'->>'id' = item->>'id' THEN RAISE EXCEPTION 'EXAM_ACTIVE' USING ERRCODE = '22023'; END IF;
    SELECT value INTO old FROM jsonb_array_elements(p.body->'examHistory') WHERE value->>'id' = item->>'id';
    IF FOUND AND old IS DISTINCT FROM item THEN RAISE EXCEPTION 'EXAM_CONFLICT' USING ERRCODE = '22023'; END IF;
    IF NOT FOUND THEN p.body := jsonb_set(p.body,'{examHistory}',p.body->'examHistory' || jsonb_build_array(item)); END IF;
  END LOOP;
  SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO c FROM jsonb_array_elements(p.body->'examHistory') WITH ORDINALITY a(value,ord)
    WHERE ord > greatest(0,jsonb_array_length(p.body->'examHistory')-20);
  p.body := jsonb_set(jsonb_set(p.body,'{examHistory}',c),'{revision}',to_jsonb(n)); p.revision := n;
  UPDATE study_private.progress SET body=p.body,versions=p.versions,revision=n,updated_at=clock_timestamp() WHERE user_id=uid;
  c := jsonb_build_object('status',CASE WHEN jsonb_array_length(conflicts)>0 THEN 'conflict' ELSE 'ok' END,'conflicts',conflicts);
  INSERT INTO study_private.receipts(user_id,operation_id,fingerprint,result) VALUES(uid,op,fingerprint,c);
  DELETE FROM study_private.receipts WHERE user_id=uid AND operation_id IN
    (SELECT operation_id FROM study_private.receipts WHERE user_id=uid ORDER BY accepted_at DESC,operation_id OFFSET 128);
  RETURN c || jsonb_build_object('cloud',study_private.envelope(p));
END $$;

CREATE FUNCTION public.study_reset(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET row_security = on SET statement_timeout = '5s' SET lock_timeout = '2s' AS $$
DECLARE uid text := study_private.require_user(); p study_private.progress; op uuid;
BEGIN
  PERFORM study_private.shape(p_request,ARRAY['epoch','revision','operationId'],ARRAY['epoch','revision','operationId']);
  op := (p_request->>'operationId')::uuid; IF op IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  p := study_private.lock_progress(uid);
  IF p.last_reset_id=op THEN RETURN jsonb_build_object('status','ok','cloud',study_private.envelope(p)); END IF;
  IF p.epoch::text IS DISTINCT FROM p_request->>'epoch' OR to_jsonb(p.revision) IS DISTINCT FROM p_request->'revision' THEN
    RETURN jsonb_build_object('status','conflict','cloud',study_private.envelope(p));
  END IF;
  UPDATE study_private.progress SET epoch=gen_random_uuid(),revision=0,body=study_private.empty_state(),versions='{"bookmarks":{},"settings":{}}',exam_writer=NULL,last_reset_id=op,updated_at=clock_timestamp()
    WHERE user_id=uid RETURNING * INTO p;
  DELETE FROM study_private.receipts WHERE user_id=uid;
  RETURN jsonb_build_object('status','ok','cloud',study_private.envelope(p));
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA study_private FROM PUBLIC, authenticated, anonymous;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA study_private FROM PUBLIC, authenticated, anonymous;
REVOKE ALL ON FUNCTION public.study_pull(), public.study_sync(jsonb), public.study_reset(jsonb) FROM PUBLIC, anonymous;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.study_pull(), public.study_sync(jsonb), public.study_reset(jsonb) TO authenticated;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM study_service;
COMMIT;
