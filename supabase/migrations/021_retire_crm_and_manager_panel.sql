-- 021 - Retire CRM daily totals and manager panel access without destroying task history.
BEGIN;
-- Historical manager profiles/tasks remain for audit only. No active manager login is allowed.
UPDATE public.profiles SET is_active = false WHERE role = 'manager' AND is_active = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_only_operator_admin_active'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_only_operator_admin_active
      CHECK (role <> 'manager' OR is_active = false);
  END IF;
END $$;

-- Erase the manual CRM feature, including saved daily CRM totals.
DROP TABLE IF EXISTS public.crm_daily_acceptance;

-- Retire manager-only RPC endpoints and operator task-action API permissions.
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'manager_%' OR p.proname = 'operator_update_task')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   rec.nspname, rec.proname, rec.args);
  END LOOP;
END $$;
COMMIT;
