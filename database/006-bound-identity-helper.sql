-- Bind auth.user_id at CREATE time without widening managed-schema privileges.
-- SQL-standard bodies retain the resolved function dependency; execution remains
-- INVOKER, allowing pg_session_jwt initialization before privileged implementations.
BEGIN;
CREATE FUNCTION study_private.initialize_identity() RETURNS text
  LANGUAGE sql STABLE SECURITY INVOKER
  BEGIN ATOMIC
    SELECT auth.user_id();
  END;
REVOKE ALL ON FUNCTION study_private.initialize_identity() FROM PUBLIC,anonymous;
GRANT EXECUTE ON FUNCTION study_private.initialize_identity() TO authenticated;

CREATE OR REPLACE FUNCTION public.study_pull() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM study_private.initialize_identity();
  RETURN study_private.study_pull();
END $$;
CREATE OR REPLACE FUNCTION public.study_sync(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM study_private.initialize_identity();
  RETURN study_private.study_sync(p_request);
END $$;
CREATE OR REPLACE FUNCTION public.study_exam(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM study_private.initialize_identity();
  RETURN study_private.study_exam(p_request);
END $$;
CREATE OR REPLACE FUNCTION public.study_reset(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM study_private.initialize_identity();
  RETURN study_private.study_reset(p_request);
END $$;
COMMIT;
