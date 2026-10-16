-- Initialize Neon's lazily loaded JWT extension in the authenticated INVOKER
-- context, before entering the narrowly privileged implementation functions.
-- No identity supplied by a client is accepted; implementations still derive it
-- independently and enforce verified email, RLS and all existing validations.
BEGIN;
ALTER FUNCTION public.study_pull() SET SCHEMA study_private;
ALTER FUNCTION public.study_sync(jsonb) SET SCHEMA study_private;
ALTER FUNCTION public.study_exam(jsonb) SET SCHEMA study_private;
ALTER FUNCTION public.study_reset(jsonb) SET SCHEMA study_private;

CREATE FUNCTION public.study_pull() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM auth.user_id();
  RETURN study_private.study_pull();
END $$;
CREATE FUNCTION public.study_sync(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM auth.user_id();
  RETURN study_private.study_sync(p_request);
END $$;
CREATE FUNCTION public.study_exam(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM auth.user_id();
  RETURN study_private.study_exam(p_request);
END $$;
CREATE FUNCTION public.study_reset(p_request jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  PERFORM auth.user_id();
  RETURN study_private.study_reset(p_request);
END $$;

REVOKE ALL ON FUNCTION public.study_pull(),public.study_sync(jsonb),public.study_exam(jsonb),public.study_reset(jsonb) FROM PUBLIC,anonymous;
GRANT EXECUTE ON FUNCTION public.study_pull(),public.study_sync(jsonb),public.study_exam(jsonb),public.study_reset(jsonb) TO authenticated;
GRANT USAGE ON SCHEMA study_private TO authenticated;
GRANT EXECUTE ON FUNCTION study_private.study_pull(),study_private.study_sync(jsonb),study_private.study_exam(jsonb),study_private.study_reset(jsonb) TO authenticated;
-- Schema visibility grants neither table access nor access to other helpers.
REVOKE ALL ON ALL TABLES IN SCHEMA study_private FROM PUBLIC,authenticated,anonymous;
COMMIT;
