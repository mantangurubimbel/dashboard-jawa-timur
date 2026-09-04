-- Move database consumers away from the legacy monthly target table.
-- Monthly branch targets are derived from branch weekly targets.

create or replace view public.v_branch_weekly_monthly_target
with (security_invoker = true)
as
select
  t.academic_year,
  t.branch_id,
  public.revenue_academic_month_number(split_part(t.month, ' ', 1)) as month_number,
  sum(t.target_revenue)::bigint as target_revenue
from public.t_branch_weekly_target t
where t.branch_id <> 100
  and public.revenue_academic_month_number(split_part(t.month, ' ', 1)) is not null
group by
  t.academic_year,
  t.branch_id,
  public.revenue_academic_month_number(split_part(t.month, ' ', 1));

create or replace view public.v_revenue_monthly_target_by_region
with (security_invoker = true)
as
select
  t.academic_year,
  t.month_number,
  b.region_id,
  r.region_name,
  sum(t.target_revenue)::bigint as target_revenue
from public.v_branch_weekly_monthly_target t
join public.t_branch b on b.branch_id = t.branch_id
join public.t_region r on r.region_id = b.region_id
group by t.academic_year, t.month_number, b.region_id, r.region_name;

create or replace view public.v_revenue_monthly_target_summary
with (security_invoker = true)
as
select
  academic_year,
  month_number,
  sum(target_revenue)::bigint as target_revenue
from public.v_branch_weekly_monthly_target
group by academic_year, month_number;

-- Recreate existing RPCs from their current definitions while replacing only
-- the legacy monthly table reference. This preserves all existing parameters
-- and result shapes without duplicating the large dashboard function body.
do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_revenue_dashboard_v2'
    and p.pronargs = 6;

  if function_definition is not null then
    function_definition := replace(
      function_definition,
      'public.t_revenue_monthly_target',
      'public.v_branch_weekly_monthly_target'
    );
    execute function_definition;
  end if;
end;
$$;

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(p.oid)
    into function_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_branch_revenue_performance'
    and p.pronargs = 4;

  if function_definition is not null then
    function_definition := replace(
      function_definition,
      'public.t_revenue_monthly_target',
      'public.v_branch_weekly_monthly_target'
    );
    execute function_definition;
  end if;
end;
$$;

-- The monthly compatibility projection is no longer refreshed because no
-- active dashboard consumer depends on it. Keep the table for rollback during
-- the observation period, but remove its weekly-change trigger/functions.
drop trigger if exists refresh_monthly_targets_after_branch_weekly_change
  on public.t_branch_weekly_target;
drop function if exists public.refresh_revenue_monthly_targets_from_branch_weekly();
drop function if exists public.sync_revenue_monthly_targets_from_branch_weekly();
