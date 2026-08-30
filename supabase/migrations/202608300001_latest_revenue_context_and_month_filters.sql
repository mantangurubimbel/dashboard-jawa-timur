-- Resolve the active revenue period from the transaction data itself.
-- The latest payment date determines the current academic year/month, while
-- month options are limited to months that actually exist in that year.

create or replace function public.get_latest_revenue_context(
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
      tx.payment_date,
      tx.month,
      nullif(btrim(tx.academic_year), '') as stored_academic_year
    from public.t_revenue_txn tx
    where p_branch_ids is null or tx.branch_id = any(p_branch_ids)
    order by tx.payment_date desc, tx.id desc
    limit 1
  ),
  period as (
    select
      latest.payment_date,
      latest.month,
      coalesce(
        public.revenue_academic_year_from_month(latest.month),
        case
          when latest.stored_academic_year ~ '^[0-9]{2}/[0-9]{2}$'
            then latest.stored_academic_year
          else null
        end
      ) as academic_year
    from latest
  ),
  period_with_year as (
    select
      period.*,
      case
        when period.academic_year ~ '^[0-9]{2}/[0-9]{2}$'
          then 2000 + split_part(period.academic_year, '/', 1)::integer
        else null
      end as start_year
    from period
  ),
  available_months as (
    select distinct
      split_part(tx.month, ' ', 1) as month_label,
      public.revenue_academic_month_number(split_part(tx.month, ' ', 1)) as month_number
    from public.t_revenue_txn tx
    cross join period_with_year period
    where period.academic_year is not null
      and public.revenue_academic_year_from_month(tx.month) = period.academic_year
      and public.revenue_academic_month_number(split_part(tx.month, ' ', 1)) is not null
      and (p_branch_ids is null or tx.branch_id = any(p_branch_ids))
  ),
  start_row as (
    select tx.payment_date
    from public.t_revenue_txn tx
    cross join period_with_year period
    where period.academic_year is not null
      and period.start_year is not null
      and tx.month = 'Jul ' || period.start_year::text
      and public.revenue_academic_year_from_month(tx.month) = period.academic_year
      and (p_branch_ids is null or tx.branch_id = any(p_branch_ids))
    order by tx.payment_date asc, tx.id asc
    limit 1
  )
  select coalesce(
    (
      select jsonb_build_object(
        'academicYear', period.academic_year,
        'latestMonth', split_part(period.month, ' ', 1),
        'latestPaymentDate', period.payment_date,
        'startDate', start_row.payment_date,
        'months', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', available_months.month_label,
                'label', available_months.month_label
              )
              order by available_months.month_number
            )
            from available_months
          ),
          '[]'::jsonb
        )
      )
      from period_with_year period
      left join start_row on true
    ),
    jsonb_build_object(
      'academicYear', null,
      'latestMonth', null,
      'latestPaymentDate', null,
      'startDate', null,
      'months', '[]'::jsonb
    )
  );
$$;

revoke execute on function public.get_latest_revenue_context(integer[]) from public;
grant execute on function public.get_latest_revenue_context(integer[]) to service_role;

-- Month-aware product analytics. The previous overloads remain available for
-- compatibility with existing callers.
create or replace function public.get_product_sales(
  p_academic_year text default null,
  p_branch_id integer default null,
  p_from_date date default null,
  p_to_date date default null,
  p_month text default null
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
        'product', x.product,
        'revenue', x.revenue,
        'transactions', x.transactions,
        'invoices', x.invoices,
        'bulkBuying', x.bulk_buying
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
      count(distinct tx.invoice)::integer as invoices,
      tx.is_bulkbuying as bulk_buying
    from public.t_revenue_txn tx
    left join public.t_revenue_products p on p.product_id = tx.product_id
    where (p_academic_year is null or public.revenue_academic_year_from_month(tx.month) = p_academic_year)
      and (p_branch_id is null or tx.branch_id = p_branch_id)
      and (p_from_date is null or tx.payment_date >= p_from_date)
      and (p_to_date is null or tx.payment_date <= p_to_date)
      and (p_month is null or split_part(tx.month, ' ', 1) = p_month)
    group by tx.product_id, p.product_name, p.product_code, tx.is_bulkbuying
  ) x;
$$;

revoke execute on function public.get_product_sales(text, integer, date, date, text) from public;
grant execute on function public.get_product_sales(text, integer, date, date, text) to service_role;

-- Month-aware agent analytics. The previous overloads remain available for
-- compatibility with existing callers.
create or replace function public.get_agent_performance(
  p_academic_year text default null,
  p_branch_id integer default null,
  p_from_date date default null,
  p_to_date date default null,
  p_month text default null
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
      and (p_academic_year is null or public.revenue_academic_year_from_month(tx.month) = p_academic_year)
      and (p_branch_id is null or tx.branch_id = p_branch_id)
      and (p_from_date is null or tx.payment_date >= p_from_date)
      and (p_to_date is null or tx.payment_date <= p_to_date)
      and (p_month is null or split_part(tx.month, ' ', 1) = p_month)
    group by tx.agent_id, a.agent_name, tx.branch_id, b.branch_name
  ) x;
$$;

revoke execute on function public.get_agent_performance(text, integer, date, date, text) from public;
grant execute on function public.get_agent_performance(text, integer, date, date, text) to service_role;

notify pgrst, 'reload schema';
