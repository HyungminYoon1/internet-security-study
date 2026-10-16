BEGIN;
GRANT CREATE ON SCHEMA public TO study_service;
SET LOCAL ROLE study_service;

CREATE FUNCTION study_private.finish_exam(p study_private.progress) RETURNS study_private.progress
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE e jsonb := p.body->'activeExam'; qid text; q study_private.questions; a jsonb; c jsonb;
  correct_count integer := 0; unanswered integer := 0; ended bigint;
BEGIN
  IF e IS NULL OR e='null'::jsonb THEN RETURN p; END IF;
  ended := least((e->>'deadline')::bigint,greatest((e->>'startAt')::bigint,floor(extract(epoch FROM clock_timestamp())*1000)::bigint));
  FOR qid IN SELECT jsonb_array_elements_text(e->'questionIds') LOOP
    SELECT * INTO STRICT q FROM study_private.questions WHERE id=qid;
    IF NOT (e->'answers' ? qid) THEN unanswered := unanswered+1; CONTINUE; END IF;
    IF e->'answers'->>qid=q.answer_id THEN correct_count := correct_count+1; END IF;
    a := jsonb_build_object('id',(e->>'id')||'-'||qid,'questionId',qid,'objectiveId',q.objective_id,'family',q.family,
      'answerId',e->'answers'->qid,'correct',(e->'answers'->>qid=q.answer_id),'confidence','unsure','at',ended,'mode','exam');
    PERFORM study_private.valid_attempt(a);
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p.body->'attempts') x WHERE x->>'id'=a->>'id' AND x<>a) THEN
      RAISE EXCEPTION 'ATTEMPT_CONFLICT' USING ERRCODE='22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.body->'attempts') x WHERE x->>'id'=a->>'id') THEN
      p.body := jsonb_set(p.body,'{attempts}',p.body->'attempts'||jsonb_build_array(a));
    END IF;
  END LOOP;
  e := e || jsonb_build_object('status','finished','finishedAt',ended,'correct',correct_count,'unanswered',unanswered,
    'score',round(1000.0*correct_count/jsonb_array_length(e->'questionIds'))/10);
  PERFORM study_private.valid_exam(e,true);
  p.body := jsonb_set(jsonb_set(p.body,'{activeExam}','null'),'{examHistory}',p.body->'examHistory'||jsonb_build_array(e));
  SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO c FROM jsonb_array_elements(p.body->'examHistory') WITH ORDINALITY a(value,ord)
    WHERE ord > greatest(0,jsonb_array_length(p.body->'examHistory')-20);
  p.body := jsonb_set(p.body,'{examHistory}',c);
  SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO c FROM jsonb_array_elements(p.body->'attempts') WITH ORDINALITY a(value,ord)
    WHERE ord > greatest(0,jsonb_array_length(p.body->'attempts')-3000);
  p.revision := p.revision+1; p.exam_writer := NULL;
  p.body := jsonb_set(jsonb_set(p.body,'{attempts}',c),'{revision}',to_jsonb(p.revision));
  UPDATE study_private.progress SET body=p.body,revision=p.revision,exam_writer=NULL,updated_at=clock_timestamp() WHERE user_id=p.user_id;
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.study_pull() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET row_security = on SET statement_timeout = '5s' SET lock_timeout = '2s' AS $$
DECLARE uid text := study_private.require_user(); p study_private.progress;
BEGIN
  p := study_private.lock_progress(uid);
  IF p.body->'activeExam'<>'null'::jsonb AND (p.body->'activeExam'->>'deadline')::bigint <= floor(extract(epoch FROM clock_timestamp())*1000)::bigint THEN
    p := study_private.finish_exam(p);
  END IF;
  RETURN study_private.envelope(p);
END $$;

CREATE FUNCTION public.study_exam(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET row_security = on SET statement_timeout = '5s' SET lock_timeout = '2s' AS $$
DECLARE uid text := study_private.require_user(); p study_private.progress; e jsonb; c jsonb; op uuid; device uuid;
  fingerprint text; receipt study_private.receipts; action text; now_ms bigint; needed text[];
BEGIN
  IF octet_length(p_request::text)>131072 THEN RAISE EXCEPTION 'LIMIT_EXCEEDED' USING ERRCODE='22023'; END IF;
  action := p_request->>'action';
  IF action NOT IN ('start','save','takeover','finish') OR action IS NULL THEN RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='22023'; END IF;
  needed := ARRAY['epoch','operationId','deviceId','action'] || CASE action
    WHEN 'start' THEN ARRAY['exam'] WHEN 'save' THEN ARRAY['examId','generation','answers','flagged','position']
    ELSE ARRAY['examId','generation'] END;
  PERFORM study_private.shape(p_request,needed,needed);
  op := (p_request->>'operationId')::uuid; device := (p_request->>'deviceId')::uuid;
  IF op IS NULL OR device IS NULL THEN RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE='22023'; END IF;
  fingerprint := encode(sha256(convert_to('exam:'||p_request::text,'UTF8')),'hex');
  p := study_private.lock_progress(uid);
  IF p.epoch::text IS DISTINCT FROM p_request->>'epoch' THEN RETURN jsonb_build_object('status','epoch-conflict','cloud',study_private.envelope(p)); END IF;
  SELECT * INTO receipt FROM study_private.receipts WHERE user_id=uid AND operation_id=op;
  IF FOUND THEN
    IF receipt.fingerprint<>fingerprint THEN RAISE EXCEPTION 'OPERATION_REUSED' USING ERRCODE='22023'; END IF;
    RETURN receipt.result||jsonb_build_object('cloud',study_private.envelope(p));
  END IF;
  e := p.body->'activeExam'; now_ms := floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
  IF e<>'null'::jsonb AND (e->>'deadline')::bigint <= now_ms THEN
    p := study_private.finish_exam(p);
    RETURN jsonb_build_object('status','expired','cloud',study_private.envelope(p));
  END IF;
  IF action='start' THEN
    IF e<>'null'::jsonb THEN RETURN jsonb_build_object('status','exam-exists','cloud',study_private.envelope(p)); END IF;
    e := p_request->'exam'; PERFORM study_private.valid_exam(e,false);
    IF length(e->>'id')>80 OR EXISTS (SELECT 1 FROM jsonb_array_elements(p.body->'examHistory') h WHERE h->>'id'=e->>'id')
      OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(e->'questionIds') id JOIN study_private.questions q ON q.id=id WHERE NOT q.active)
      OR e->'answers'<>'{}'::jsonb OR e->'flagged'<>'[]'::jsonb OR e->'position'<>'0'::jsonb THEN
      RAISE EXCEPTION 'INVALID_NEW_EXAM' USING ERRCODE='22023';
    END IF;
    e := e||jsonb_build_object('startAt',now_ms,'deadline',now_ms+3600000);
    p.exam_writer := jsonb_build_object('deviceId',device,'generation',gen_random_uuid());
  ELSE
    IF e='null'::jsonb OR e->>'id' IS DISTINCT FROM p_request->>'examId' THEN
      RETURN jsonb_build_object('status','exam-missing','cloud',study_private.envelope(p));
    END IF;
    IF p.exam_writer->>'generation' IS DISTINCT FROM p_request->>'generation'
      OR (action<>'takeover' AND p.exam_writer->>'deviceId' IS DISTINCT FROM device::text) THEN
      RETURN jsonb_build_object('status','writer-conflict','cloud',study_private.envelope(p));
    END IF;
    IF action='finish' THEN p := study_private.finish_exam(p);
    ELSIF action='save' THEN
      e := e||jsonb_build_object('answers',p_request->'answers','flagged',p_request->'flagged','position',p_request->'position');
      PERFORM study_private.valid_exam(e,false);
    END IF;
    IF action<>'finish' THEN p.exam_writer := jsonb_build_object('deviceId',device,'generation',gen_random_uuid()); END IF;
  END IF;
  IF action<>'finish' THEN
    p.revision := p.revision+1;
    p.body := jsonb_set(jsonb_set(p.body,'{activeExam}',e),'{revision}',to_jsonb(p.revision));
    UPDATE study_private.progress SET body=p.body,revision=p.revision,exam_writer=p.exam_writer,updated_at=clock_timestamp() WHERE user_id=uid;
  END IF;
  c := jsonb_build_object('status','ok');
  INSERT INTO study_private.receipts(user_id,operation_id,fingerprint,result) VALUES(uid,op,fingerprint,c);
  DELETE FROM study_private.receipts WHERE user_id=uid AND operation_id IN
    (SELECT operation_id FROM study_private.receipts WHERE user_id=uid ORDER BY accepted_at DESC,operation_id OFFSET 128);
  RETURN c||jsonb_build_object('cloud',study_private.envelope(p));
END $$;
REVOKE ALL ON FUNCTION study_private.finish_exam(study_private.progress) FROM PUBLIC,authenticated,anonymous;
REVOKE ALL ON FUNCTION public.study_exam(jsonb) FROM PUBLIC,anonymous;
GRANT EXECUTE ON FUNCTION public.study_exam(jsonb) TO authenticated;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM study_service;
COMMIT;
