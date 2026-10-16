BEGIN;
GRANT REFERENCES(id) ON neon_auth."user" TO study_service;
SET LOCAL ROLE study_service;
-- An Auth account deletion also removes its app progress and idempotency receipts.
ALTER TABLE study_private.progress ADD COLUMN auth_user_id uuid
  GENERATED ALWAYS AS (user_id::uuid) STORED REFERENCES neon_auth."user"(id) ON DELETE CASCADE;
RESET ROLE;
COMMIT;
