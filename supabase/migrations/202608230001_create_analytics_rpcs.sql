-- Fast analytics endpoints for the agent, product, and school pages.

create index if not exists t_revenue_txn_academic_year_agent_idx
on public.t_revenue_txn (academic_year, agent_id);

create index if not exists t_revenue_txn_academic_year_product_idx
on public.t_revenue_txn (academic_year, product_id);

create index if not exists t_revenue_txn_academic_year_npsn_idx
on public.t_revenue_txn (academic_year, npsn);

create or replace function public.get_agent_performance(
  p_academic_year text default null,
  p_branch_id integer default null
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
      count(*) filter (where tx.is_newtxn)::integer as new_txn_non_bulk_buying,
      count(*)::integer as transactions_non_bulk_buying
    from public.t_revenue_txn tx
    left join public.t_agent a on a.agent_id = tx.agent_id
    left join public.t_branch b on b.branch_id = tx.branch_id
    where tx.agent_id is not null
      and tx.is_bulkbuying = false
      and (p_academic_year is null or tx.academic_year = p_academic_year)
      and (p_branch_id is null or tx.branch_id = p_branch_id)
    group by tx.agent_id, a.agent_name, tx.branch_id, b.branch_name
  ) x;
$$;

revoke execute on function public.get_agent_performance(text, integer) from public;
grant execute on function public.get_agent_performance(text, integer) to service_role;

create or replace function public.get_product_sales()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product', x.product,
        'revenue', x.revenue,
        'transactions', x.transactions,
        'invoices', x.invoices
      )
      order by x.revenue desc, x.product
    ),
    '[]'::jsonb
  )
  from (
    select
      case
        when tx.product_id is null then '(Tidak terpetakan)'
        else coalesce(p.product_name, p.product_code, 'Product #' || tx.product_id::text)
      end as product,
      coalesce(sum(tx.revenue), 0)::numeric as revenue,
      count(*)::integer as transactions,
      count(distinct tx.invoice)::integer as invoices
    from public.t_revenue_txn tx
    left join public.t_revenue_products p on p.product_id = tx.product_id
    group by tx.product_id, p.product_name, p.product_code
  ) x;
$$;

revoke execute on function public.get_product_sales() from public;
grant execute on function public.get_product_sales() to service_role;

create or replace function public.get_school_accounts(
  p_academic_year text default null,
  p_level text default null
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with filtered as (
    select
      tx.npsn,
      tx.branch_id,
      tx.invoice,
      tx.revenue
    from public.t_revenue_txn tx
    left join public.t_master_school s on s.npsn = tx.npsn
    where tx.npsn is not null
      and (p_academic_year is null or tx.academic_year = p_academic_year)
      and (p_level is null or s.level = p_level)
  ),
  school_totals as (
    select
      f.npsn,
      coalesce(s.name, 'Sekolah tidak ditemukan') as school,
      coalesce(sum(f.revenue), 0)::numeric as revenue,
      count(*)::integer as transactions,
      count(distinct f.invoice)::integer as invoices
    from filtered f
    left join public.t_master_school s on s.npsn = f.npsn
    group by f.npsn, s.name
  ),
  branch_totals as (
    select
      f.npsn,
      f.branch_id,
      coalesce(b.branch_name, 'Branch #' || f.branch_id::text) as branch,
      coalesce(sum(f.revenue), 0)::numeric as revenue,
      count(*)::integer as transactions
    from filtered f
    left join public.t_branch b on b.branch_id = f.branch_id
    group by f.npsn, f.branch_id, b.branch_name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'npsn', st.npsn,
        'school', st.school,
        'revenue', st.revenue,
        'transactions', st.transactions,
        'invoices', st.invoices,
        'branches', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'branch', bt.branch,
                'revenue', bt.revenue,
                'transactions', bt.transactions
              )
              order by bt.revenue desc, bt.branch
            )
            from branch_totals bt
            where bt.npsn = st.npsn
          ),
          '[]'::jsonb
        )
      )
      order by st.revenue desc, st.school
    ),
    '[]'::jsonb
  )
  from school_totals st
  where st.revenue > 0;
$$;

revoke execute on function public.get_school_accounts(text, text) from public;
grant execute on function public.get_school_accounts(text, text) to service_role;
