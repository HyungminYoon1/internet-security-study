-- Qualify the table-function column. An unqualified `id` otherwise binds to
-- questions.id, so one retired catalogue row incorrectly blocks every new exam.
BEGIN;
SET LOCAL ROLE study_service;
DO $$
DECLARE definition text;
  old_fragment text := $old$jsonb_array_elements_text(e->'questionIds') id JOIN study_private.questions q ON q.id=id WHERE NOT q.active$old$;
BEGIN
  SELECT pg_get_functiondef('study_private.study_exam(jsonb)'::regprocedure) INTO definition;
  IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'MIGRATION_CONTRACT_CHANGED'; END IF;
  definition := replace(definition,old_fragment,$new$jsonb_array_elements_text(e->'questionIds') AS selected(question_id) JOIN study_private.questions q ON q.id=selected.question_id WHERE NOT q.active$new$);
  EXECUTE definition;
END $$;
RESET ROLE;
COMMIT;
