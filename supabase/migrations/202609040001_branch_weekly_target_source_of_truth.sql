-- Branch weekly targets are the source of truth for monthly branch targets.
-- Keep the former monthly table as a compatibility projection while existing
-- dashboard RPCs are migrated. The original values are preserved separately.

create table if not exists public.t_revenue_monthly_target_legacy
(like public.t_revenue_monthly_target including all);

insert into public.t_revenue_monthly_target_legacy
select * from public.t_revenue_monthly_target
on conflict do nothing;

alter table public.t_revenue_monthly_target_legacy enable row level security;
drop policy if exists "service role can manage legacy monthly targets"
  on public.t_revenue_monthly_target_legacy;
create policy "service role can manage legacy monthly targets"
  on public.t_revenue_monthly_target_legacy for all
  to service_role
  using (true)
  with check (true);

create or replace function public.sync_revenue_monthly_targets_from_branch_weekly()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.t_revenue_monthly_target;

  insert into public.t_revenue_monthly_target (
    academic_year,
    branch_id,
    month_number,
    target_revenue
  )
  select
    t.academic_year,
    t.branch_id,
    public.revenue_academic_month_number(split_part(t.month, ' ', 1)),
    sum(t.target_revenue)::bigint
  from public.t_branch_weekly_target t
  where t.branch_id <> 100
    and public.revenue_academic_month_number(split_part(t.month, ' ', 1)) is not null
  group by t.academic_year, t.branch_id, public.revenue_academic_month_number(split_part(t.month, ' ', 1));
end;
$$;

revoke execute on function public.sync_revenue_monthly_targets_from_branch_weekly() from public;
grant execute on function public.sync_revenue_monthly_targets_from_branch_weekly() to service_role;

create or replace function public.refresh_revenue_monthly_targets_from_branch_weekly()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_revenue_monthly_targets_from_branch_weekly();
  return null;
end;
$$;

revoke execute on function public.refresh_revenue_monthly_targets_from_branch_weekly() from public;
grant execute on function public.refresh_revenue_monthly_targets_from_branch_weekly() to service_role;

drop trigger if exists refresh_monthly_targets_after_branch_weekly_change
  on public.t_branch_weekly_target;
create trigger refresh_monthly_targets_after_branch_weekly_change
after insert or update or delete on public.t_branch_weekly_target
for each statement execute function public.refresh_revenue_monthly_targets_from_branch_weekly();

select public.sync_revenue_monthly_targets_from_branch_weekly();

-- Monthly target uploads are intentionally retired. Monthly values are now
-- derived from t_branch_weekly_target and must not be written directly.
create or replace function public.import_revenue_monthly_targets(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Monthly target uploads are retired. Upload branch weekly targets instead.';
end;
$$;

revoke execute on function public.import_revenue_monthly_targets(jsonb) from public;
grant execute on function public.import_revenue_monthly_targets(jsonb) to service_role;
