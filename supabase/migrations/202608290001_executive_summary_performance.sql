-- Small database-side reads used by the executive summary fast path.

create or replace function public.get_latest_revenue_period(
  p_branch_ids integer[] default null
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with latest as (
    select
      payment_date,
      public.revenue_academic_year_from_month(month) as academic_year
    from public.t_revenue_txn
    where p_branch_ids is null or branch_id = any(p_branch_ids)
    order by payment_date desc, id desc
    limit 1
  ),
  start_row as (
    select tx.payment_date
    from public.t_revenue_txn tx
    join latest
      on latest.academic_year = public.revenue_academic_year_from_month(tx.month)
    where (p_branch_ids is null or tx.branch_id = any(p_branch_ids))
      and tx.month ilike 'Jul %'
    order by tx.payment_date asc, tx.id asc
    limit 1
  )
  select coalesce(
    (
      select jsonb_build_object(
        'latestDate', latest.payment_date,
        'startDate', start_row.payment_date
      )
      from latest
      left join start_row on true
    ),
    jsonb_build_object('latestDate', null, 'startDate', null)
  );
$$;

revoke execute on function public.get_latest_revenue_period(integer[]) from public;
grant execute on function public.get_latest_revenue_period(integer[]) to service_role;

create or replace function public.get_executive_branch_revenue_summary(
  p_academic_year text
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', summary.name,
        'revenue', summary.revenue,
        'newTransactions', summary.new_transactions
      )
      order by summary.revenue desc, summary.name
    ),
    '[]'::jsonb
  )
  from (
    select
      b.branch_name as name,
      coalesce(sum(tx.revenue), 0)::numeric as revenue,
      count(*) filter (where tx.is_newtxn)::integer as new_transactions
    from public.t_revenue_txn tx
    join public.t_branch b on b.branch_id = tx.branch_id
    where public.revenue_academic_year_from_month(tx.month) = p_academic_year
    group by b.branch_id, b.branch_name
    order by revenue desc, name
    limit 8
  ) summary;
$$;

revoke execute on function public.get_executive_branch_revenue_summary(text) from public;
grant execute on function public.get_executive_branch_revenue_summary(text) to service_role;

notify pgrst, 'reload schema';
