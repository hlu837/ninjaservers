-- 001_add_unique_constraint_profiles_email.sql
-- Add a UNIQUE constraint/index to the `profiles.email` column to prevent duplicate identities.
-- IMPORTANT: If duplicate emails already exist this will fail. Inspect and resolve duplicates first.

-- 1) Inspect duplicates:
--    SELECT email, count(*) FROM profiles GROUP BY email HAVING count(*) > 1;

-- 2) OPTIONAL: Deduplicate (USE WITH CAUTION). This keeps the earliest `created_at` row per email.
--    BEGIN;
--    WITH duplicates AS (
--      SELECT ctid FROM (
--        SELECT ctid, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) AS rn
--        FROM profiles
--        WHERE email IS NOT NULL
--      ) t WHERE t.rn > 1
--    )
--    DELETE FROM profiles WHERE ctid IN (SELECT ctid FROM duplicates);
--    COMMIT;

-- 3) Add unique constraint (simple, blocks writes while applying):
--    ALTER TABLE profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- OR: Create a unique index concurrently (non-blocking for reads/writes; cannot run inside a transaction):
--    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email_unique ON profiles (email);

-- Choose one of the two approaches above depending on your migration strategy and downtime tolerance.
