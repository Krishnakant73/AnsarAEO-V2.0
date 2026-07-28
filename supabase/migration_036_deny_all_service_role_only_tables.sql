-- Applied to remote 2026-07-23 as `migration_036_deny_all_service_role_only_tables`.
-- Adds an explicit deny-all RLS policy to tables that are service-role-only
-- (cron writers, partitioned history, seed data). They already had RLS enabled
-- with no policies, so the Supabase linter (0008_rls_enabled_no_policy) flagged
-- 14 INFO warnings. Service-role bypasses RLS regardless — this just codifies
-- the "no end-user access" intent and quiets the linter.

do $$
declare
  t text;
  tables text[] := array[
    'engines',
    'plan_limits',
    'public_scans',
    'sources',
    'history_events_2026_07',
    'history_events_2026_08',
    'history_events_2026_09',
    'history_events_2026_10',
    'history_events_2026_11',
    'history_observations_2026_07',
    'history_observations_2026_08',
    'history_observations_2026_09',
    'history_observations_2026_10',
    'history_observations_2026_11'
  ];
begin
  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('drop policy if exists %I on public.%I', 'service_role_only_' || t, t);
      execute format(
        'create policy %I on public.%I as restrictive for all to public using (false) with check (false)',
        'service_role_only_' || t, t
      );
    end if;
  end loop;
end $$;
