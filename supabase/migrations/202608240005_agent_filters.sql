-- Agent performance filters aligned with the month-based revenue periods.

create or replace function public.get_agent_performance(
  p_academic_year text default null,
  p_branch_id integer default null,
  p_from_date date default null,
  p_to_date date default null
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
        'agent', x.agent,
        'branch', x.branch,
        'schools', x.schools,
        'revenueNonBulkBuying', x.revenue_non_bulk_buying,
        'revenueNewTxnNonBulkBuying', x.revenue_new_txn_non_bulk_buying,
        'newTxnNonBulkBuying', x.new_txn_non_bulk_buying,
        'transactionsNonBulkBuying', x.transactions_non_bulk_buying
      )
      order by x.revenue_non_bulk_buying desc, x.agent
    ),
    '[]'::jsonb
  )
  from (
    select
      tx.agent_id,
      coalesce(a.agent_name, 'Agent #' || tx.agent_id::text) as agent,
      coalesce(b.branch_name, 'Branch #' || tx.branch_id::text) as branch,
      count(distinct tx.npsn)::integer as schools,
      coalesce(sum(tx.revenue), 0)::numeric as revenue_non_bulk_buying,
      coalesce(sum(tx.revenue) filter (where tx.is_newtxn), 0)::numeric as revenue_new_txn_non_bulk_buying,
      count(*) filter (where tx.is_newtxn)::integer as new_txn_non_bulk_buying,
      count(*)::integer as transactions_non_bulk_buying
    from public.t_revenue_txn tx
    left join public.t_agent a on a.agent_id = tx.agent_id
    left join public.t_branch b on b.branch_id = tx.branch_id
    where tx.agent_id is not null
      and tx.is_bulkbuying = false
      and (
        p_academic_year is null
        or public.revenue_academic_year_from_month(tx.month) = p_academic_year
      )
      and (p_branch_id is null or tx.branch_id = p_branch_id)
      and (p_from_date is null or tx.payment_date >= p_from_date)
      and (p_to_date is null or tx.payment_date <= p_to_date)
    group by tx.agent_id, a.agent_name, tx.branch_id, b.branch_name
  ) x;
$$;

revoke execute on function public.get_agent_performance(text, integer) from public;
revoke execute on function public.get_agent_performance(text, integer, date, date) from public;
grant execute on function public.get_agent_performance(text, integer, date, date) to service_role;

notify pgrst, 'reload schema';
