BEGIN;
GRANT CREATE ON SCHEMA public TO study_service;
SET LOCAL ROLE study_service;
-- Preserve the field versions accepted by the original request, even if its response
-- was lost and a retry arrives after a different device has changed the same field.
DO $$
DECLARE definition text; old_fragment text := $old$c := jsonb_build_object('status',CASE WHEN jsonb_array_length(conflicts)>0 THEN 'conflict' ELSE 'ok' END,'conflicts',conflicts);$old$;
BEGIN
  SELECT pg_get_functiondef('public.study_sync(jsonb)'::regprocedure) INTO definition;
  IF position(old_fragment IN definition)=0 THEN RAISE EXCEPTION 'MIGRATION_CONTRACT_CHANGED'; END IF;
  definition := replace(definition,old_fragment,$new$c := jsonb_build_object('status',CASE WHEN jsonb_array_length(conflicts)>0 THEN 'conflict' ELSE 'ok' END,'conflicts',conflicts,'acceptedVersions',p.versions,'acceptedRevision',p.revision);$new$);
  EXECUTE definition;
END $$;
RESET ROLE;
REVOKE CREATE ON SCHEMA public FROM study_service;
COMMIT;
