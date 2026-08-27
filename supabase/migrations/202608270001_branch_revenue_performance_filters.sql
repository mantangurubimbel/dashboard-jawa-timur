create or replace function public.get_branch_revenue_performance(
  p_academic_year text,
  p_region_id integer default null,
  p_branch_id integer default null,
  p_month text default null
) returns jsonb language sql security definer set search_path = public stable as $$
  with actuals as (
    select tx.branch_id, coalesce(sum(tx.revenue), 0)::numeric as revenue
    from public.t_revenue_txn tx
    where public.revenue_academic_year_from_month(tx.month) = p_academic_year
      and (p_month is null or split_part(tx.month, ' ', 1) = p_month)
    group by tx.branch_id
  ), targets as (
    select t.branch_id, coalesce(sum(t.target_revenue), 0)::numeric as target
    from public.t_revenue_annual_target t
    where p_month is null and t.academic_year = p_academic_year
    group by t.branch_id
    union all
    select t.branch_id, coalesce(sum(t.target_revenue), 0)::numeric as target
    from public.t_revenue_monthly_target t
    where p_month is not null
      and t.academic_year = p_academic_year
      and t.month_number = public.revenue_academic_month_number(p_month)
    group by t.branch_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', b.branch_name, 'revenue', coalesce(a.revenue, 0), 'target', coalesce(t.target, 0)
  ) order by coalesce(a.revenue, 0) desc, b.branch_name), '[]'::jsonb)
  from public.t_branch b
  join actuals a on a.branch_id = b.branch_id
  left join targets t on t.branch_id = b.branch_id
  where (p_region_id is null or b.region_id = p_region_id)
    and (p_branch_id is null or b.branch_id = p_branch_id);
$$;
revoke execute on function public.get_branch_revenue_performance(text, integer, integer, text) from public;
grant execute on function public.get_branch_revenue_performance(text, integer, integer, text) to service_role;
