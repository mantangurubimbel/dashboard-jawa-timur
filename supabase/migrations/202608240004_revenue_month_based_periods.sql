-- Revenue periods are defined by t_revenue_txn.month.
-- payment_date remains an optional explicit date filter only.

create or replace function public.revenue_academic_year_from_month(p_month text)
returns text
language plpgsql
immutable
strict
as $$
declare
  v_month text := lower(btrim(split_part(p_month, ' ', 1)));
  v_calendar_year integer;
  v_start_year integer;
begin
  if split_part(p_month, ' ', 2) !~ '^[0-9]{4}$' then
    return null;
  end if;

  v_calendar_year := split_part(p_month, ' ', 2)::integer;
  v_start_year := case
    when v_month in ('jul', 'aug', 'sep', 'oct', 'nov', 'dec')
      then v_calendar_year
    when v_month in ('jan', 'feb', 'mar', 'apr', 'may', 'jun')
      then v_calendar_year - 1
    else null
  end;

  if v_start_year is null then
    return null;
  end if;

  return lpad((v_start_year % 100)::text, 2, '0')
    || '/'
    || lpad(((v_start_year + 1) % 100)::text, 2, '0');
end;
$$;

create or replace function public.get_revenue_academic_year_options()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', years.academic_year, 'label', years.academic_year)
      order by years.start_year desc, years.academic_year desc
    ),
    '[]'::jsonb
  )
  from (
    select
      derived.academic_year,
      split_part(derived.academic_year, '/', 1)::integer as start_year
    from (
      select distinct public.revenue_academic_year_from_month(month) as academic_year
      from public.t_revenue_txn
      where public.revenue_academic_year_from_month(month) is not null
    ) derived
    order by split_part(derived.academic_year, '/', 1)::integer desc,
      derived.academic_year desc
    limit 3
  ) years;
$$;

create index if not exists t_revenue_txn_derived_academic_year_idx
on public.t_revenue_txn (public.revenue_academic_year_from_month(month));

revoke execute on function public.get_revenue_academic_year_options() from public;
grant execute on function public.get_revenue_academic_year_options() to service_role;

create or replace function public.get_revenue_dashboard_v2(
  p_academic_year text default null,
  p_region_id integer default null,
  p_branch_id integer default null,
  p_month text default null,
  p_from_date date default null,
  p_to_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_current_year text := coalesce(
    p_academic_year,
    (
      select derived.academic_year
      from (
        select distinct public.revenue_academic_year_from_month(month) as academic_year
        from public.t_revenue_txn
        where public.revenue_academic_year_from_month(month) is not null
      ) derived
      order by split_part(derived.academic_year, '/', 1)::integer desc
      limit 1
    )
  );
  v_ly_year text;
  v_l2y_year text;
  v_start_date date;
  v_end_date date;
  v_result jsonb;
begin
  v_ly_year := lpad(((split_part(v_current_year, '/', 1)::integer + 99) % 100)::text, 2, '0')
    || '/' || split_part(v_current_year, '/', 1);
  v_l2y_year := lpad(((split_part(v_current_year, '/', 1)::integer + 98) % 100)::text, 2, '0')
    || '/' || lpad(((split_part(v_current_year, '/', 1)::integer + 99) % 100)::text, 2, '0');

  if not exists (
    select 1
    from public.t_revenue_txn
    where public.revenue_academic_year_from_month(month) = v_ly_year
  ) then
    v_ly_year := null;
  end if;

  if not exists (
    select 1
    from public.t_revenue_txn
    where public.revenue_academic_year_from_month(month) = v_l2y_year
  ) then
    v_l2y_year := null;
  end if;

  if p_month is not null and public.revenue_academic_month_number(p_month) is null then
    raise exception 'Bulan tidak valid: %', p_month;
  end if;

  v_start_date := p_from_date;
  v_end_date := p_to_date;

  with
  months(month_label, month_number) as (
    values
      ('Jul', 1), ('Aug', 2), ('Sep', 3), ('Oct', 4), ('Nov', 5), ('Dec', 6),
      ('Jan', 7), ('Feb', 8), ('Mar', 9), ('Apr', 10), ('May', 11), ('Jun', 12)
  ),
  scoped as materialized (
    select
      tx.*,
      public.revenue_academic_year_from_month(tx.month) as derived_academic_year,
      split_part(tx.month, ' ', 1) as month_label,
      coalesce(p.product_name, p.product_code, 'Product #' || tx.product_id::text) as product_name,
      coalesce(b.branch_name, 'Branch #' || tx.branch_id::text) as branch_name,
      coalesce(r.region_name, '(kosong)') as region_name,
      case
        when tx.grade_id is null then '(kosong)'
        else coalesce(
          case
            when g.grade ~ '(SD|SMP|SMA)$' then substring(g.grade from '(SD|SMP|SMA)$')
            else 'Lainnya'
          end,
          'Lainnya'
        )
      end as level_name,
      coalesce(a.agent_name, 'Agent #' || tx.agent_id::text) as agent_name
    from public.t_revenue_txn tx
    left join public.t_branch b on b.branch_id = tx.branch_id
    left join public.t_region r on r.region_id = b.region_id
    left join public.t_revenue_products p on p.product_id = tx.product_id
    left join public.t_grade g on g.grade_id = tx.grade_id
    left join public.t_agent a on a.agent_id = tx.agent_id
    where (p_region_id is null or b.region_id = p_region_id)
      and (p_branch_id is null or tx.branch_id = p_branch_id)
  ),
  current_rows as (
    select *
    from scoped
    where derived_academic_year = v_current_year
      and (p_month is null or month_label = p_month)
      and (v_start_date is null or payment_date >= v_start_date)
      and (v_end_date is null or payment_date <= v_end_date)
  ),
  previous_rows as (
    select *
    from scoped
    where v_ly_year is not null
      and derived_academic_year = v_ly_year
      and (p_month is null or month_label = p_month)
      and (v_start_date is null or payment_date >= (v_start_date - interval '1 year')::date)
      and (v_end_date is null or payment_date <= (v_end_date - interval '1 year')::date)
  ),
  last_two_rows as (
    select *
    from scoped
    where v_l2y_year is not null
      and derived_academic_year = v_l2y_year
      and (p_month is null or month_label = p_month)
      and (v_start_date is null or payment_date >= (v_start_date - interval '2 years')::date)
      and (v_end_date is null or payment_date <= (v_end_date - interval '2 years')::date)
  ),
  actual_by_month as (
    select month_label, sum(revenue)::numeric as revenue, count(*)::integer as transactions
    from current_rows
    group by month_label
  ),
  previous_by_month as (
    select month_label, sum(revenue)::numeric as revenue
    from previous_rows
    group by month_label
  ),
  last_two_by_month as (
    select month_label, sum(revenue)::numeric as revenue
    from last_two_rows
    group by month_label
  ),
  targets_by_month as (
    select t.month_number, sum(t.target_revenue)::numeric as revenue
    from public.t_revenue_monthly_target t
    left join public.t_branch b on b.branch_id = t.branch_id
    where t.academic_year = v_current_year
      and (p_region_id is null or b.region_id = p_region_id)
      and (p_branch_id is null or t.branch_id = p_branch_id)
    group by t.month_number
  ),
  monthly as (
    select
      m.month_label,
      m.month_number,
      coalesce(a.revenue, 0)::numeric as current_revenue,
      coalesce(a.transactions, 0)::integer as current_transactions,
      case when v_ly_year is null then null else coalesce(y.revenue, 0)::numeric end as previous_revenue,
      case when v_l2y_year is null then null else coalesce(z.revenue, 0)::numeric end as last_two_years_revenue,
      coalesce(t.revenue, 0)::numeric as target_revenue
    from months m
    left join actual_by_month a on a.month_label = m.month_label
    left join previous_by_month y on y.month_label = m.month_label
    left join last_two_by_month z on z.month_label = m.month_label
    left join targets_by_month t on t.month_number = m.month_number
  ),
  cumulative as (
    select
      *,
      sum(current_revenue) over (order by month_number) as current_cumulative_revenue,
      case when v_ly_year is null then null else sum(previous_revenue) over (order by month_number) end as previous_cumulative_revenue,
      case when v_l2y_year is null then null else sum(last_two_years_revenue) over (order by month_number) end as last_two_years_cumulative_revenue,
      sum(target_revenue) over (order by month_number) as target_cumulative_revenue
    from monthly
  ),
  kpi as (
    select
      coalesce(sum(revenue), 0)::numeric as total_revenue,
      count(*)::integer as total_transactions,
      count(distinct invoice)::integer as unique_invoices,
      count(distinct branch_id) filter (where branch_id is not null)::integer as active_branches,
      count(distinct agent_id) filter (where agent_id is not null)::integer as active_agents,
      count(distinct npsn) filter (where npsn is not null)::integer as known_schools,
      coalesce(sum(revenue) filter (where is_bulkbuying = false), 0)::numeric as non_bulk_revenue,
      count(*) filter (where is_bulkbuying = false and is_newtxn)::integer as non_bulk_new_transactions
    from current_rows
  ),
  annual_target as (
    select coalesce(sum(t.target_revenue), 0)::numeric as target_revenue
    from public.t_revenue_annual_target t
    left join public.t_branch b on b.branch_id = t.branch_id
    where t.academic_year = v_current_year
      and (p_region_id is null or b.region_id = p_region_id)
      and (p_branch_id is null or t.branch_id = p_branch_id)
  ),
  regional as (
    select region_name as name, sum(revenue)::numeric as revenue, count(*)::integer as transactions
    from current_rows
    group by region_name
    order by revenue desc, name
  ),
  regional_source as (
    select
      region_name as name,
      sum(revenue)::numeric as revenue,
      count(*)::integer as transactions,
      sum(revenue) filter (where is_bulkbuying = false)::numeric as non_bulk_revenue,
      sum(revenue) filter (where is_bulkbuying = true)::numeric as bulk_revenue,
      count(*) filter (where is_bulkbuying = false and is_newtxn)::integer as non_bulk_transactions,
      count(*) filter (where is_bulkbuying = true and is_newtxn)::integer as bulk_transactions
    from current_rows
    group by region_name
    order by revenue desc, name
  ),
  branches as (
    select branch_name as name, sum(revenue)::numeric as revenue, count(*)::integer as transactions
    from current_rows
    group by branch_name
    order by revenue desc, name
    limit 12
  ),
  branch_actuals as (
    select branch_id, sum(revenue)::numeric as revenue
    from current_rows
    group by branch_id
  ),
  branch_targets as (
    select t.branch_id, sum(t.target_revenue)::numeric as target
    from public.t_revenue_annual_target t
    left join public.t_branch b on b.branch_id = t.branch_id
    where p_month is null
      and t.academic_year = v_current_year
      and (p_region_id is null or b.region_id = p_region_id)
      and (p_branch_id is null or t.branch_id = p_branch_id)
    group by t.branch_id
    union all
    select t.branch_id, sum(t.target_revenue)::numeric as target
    from public.t_revenue_monthly_target t
    left join public.t_branch b on b.branch_id = t.branch_id
    where p_month is not null
      and t.academic_year = v_current_year
      and t.month_number = public.revenue_academic_month_number(p_month)
      and (p_region_id is null or b.region_id = p_region_id)
      and (p_branch_id is null or t.branch_id = p_branch_id)
    group by t.branch_id
  ),
  branch_performance as (
    select
      b.branch_name as name,
      coalesce(a.revenue, 0)::numeric as revenue,
      coalesce(t.target, 0)::numeric as target
    from public.t_branch b
    left join branch_actuals a on a.branch_id = b.branch_id
    left join branch_targets t on t.branch_id = b.branch_id
    where a.branch_id is not null
      and (p_region_id is null or b.region_id = p_region_id)
      and (p_branch_id is null or b.branch_id = p_branch_id)
    order by revenue desc, name
  ),
  products as (
    select product_name as name, sum(revenue)::numeric as revenue, count(*)::integer as transactions
    from current_rows
    group by product_name
    order by revenue desc, name
  ),
  retail_products as (
    select product_name as name, sum(revenue)::numeric as revenue, count(*)::integer as transactions
    from current_rows
    where is_bulkbuying = false
    group by product_name
    order by revenue desc, name
  ),
  payment_categories as (
    select 'New Txn / Down Payment' as name, coalesce(sum(revenue) filter (where is_newtxn), 0)::numeric as revenue, count(*) filter (where is_newtxn)::integer as transactions
    from current_rows
    union all
    select 'Full Payment', coalesce(sum(revenue) filter (where is_fullpayment), 0)::numeric, count(*) filter (where is_fullpayment)::integer
    from current_rows
    union all
    select 'Bulk Buying', coalesce(sum(revenue) filter (where is_bulkbuying), 0)::numeric, count(*) filter (where is_bulkbuying)::integer
    from current_rows
  ),
  levels as (
    select level_name as name, sum(revenue)::numeric as revenue, count(*)::integer as transactions
    from current_rows
    group by level_name
    order by revenue desc, name
  ),
  agents as (
    select
      agent_name as agent,
      branch_name as branch,
      count(distinct npsn)::integer as schools,
      sum(revenue) filter (where is_bulkbuying = false)::numeric as revenue_non_bulk_buying,
      count(*) filter (where is_bulkbuying = false and is_newtxn)::integer as new_txn_non_bulk_buying,
      count(*) filter (where is_bulkbuying = false)::integer as transactions_non_bulk_buying
    from current_rows
    where agent_id is not null
    group by agent_name, branch_name
    order by revenue_non_bulk_buying desc, agent
  ),
  quality as (
    select 'Grade ID kosong' as name, count(*) filter (where grade_id is null)::numeric as revenue, count(*) filter (where grade_id is not null)::integer as transactions from current_rows
    union all
    select 'Agent ID kosong', count(*) filter (where agent_id is null)::numeric, count(*) filter (where agent_id is not null)::integer from current_rows
    union all
    select 'Destination branch kosong', count(*) filter (where branch_destination_id is null)::numeric, count(*) filter (where branch_destination_id is not null)::integer from current_rows
    union all
    select 'NPSN kosong', count(*) filter (where npsn is null)::numeric, count(*) filter (where npsn is not null)::integer from current_rows
  )
  select jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'totalRevenue', total_revenue,
        'totalTransactions', total_transactions,
        'uniqueInvoices', unique_invoices,
        'activeBranches', active_branches,
        'activeAgents', active_agents,
        'knownSchools', known_schools,
        'averageOrderValue', case when total_transactions = 0 then 0 else total_revenue / total_transactions end,
        'nonBulkRevenue', non_bulk_revenue,
        'nonBulkNewTransactions', non_bulk_new_transactions,
        'targetAnnualRevenue', (select target_revenue from annual_target),
        'achievement', case when (select target_revenue from annual_target) = 0 then null else total_revenue / (select target_revenue from annual_target) end,
        'varianceToTarget', total_revenue - (select target_revenue from annual_target),
        'growthVsLy', case when coalesce((select sum(revenue) from previous_rows), 0) = 0 then null else total_revenue / (select sum(revenue) from previous_rows) end,
        'growthVsL2y', case when coalesce((select sum(revenue) from last_two_rows), 0) = 0 then null else total_revenue / (select sum(revenue) from last_two_rows) end
      )
      from kpi
    ),
    'monthlyRevenue', coalesce((select jsonb_agg(jsonb_build_object(
      'name', month_label, 'period', month_label, 'revenue', current_revenue, 'transactions', current_transactions
    ) order by month_number) from cumulative), '[]'::jsonb),
    'monthlyRevenueComparison', jsonb_build_object(
      'currentAcademicYear', v_current_year,
      'previousAcademicYear', v_ly_year,
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'month', month_label,
        'currentRevenue', current_revenue,
        'currentCumulativeRevenue', current_cumulative_revenue,
        'currentTransactions', current_transactions,
        'previousRevenue', previous_revenue,
        'previousCumulativeRevenue', previous_cumulative_revenue,
        'previousTransactions', null,
        'lastTwoYearsRevenue', last_two_years_revenue,
        'lastTwoYearsCumulativeRevenue', last_two_years_cumulative_revenue,
        'targetRevenue', target_revenue,
        'targetCumulativeRevenue', target_cumulative_revenue
      ) order by month_number) from cumulative), '[]'::jsonb)
    ),
    'filters', jsonb_build_object(
      'academicYears', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object('id', years.academic_year, 'label', years.academic_year)
            order by years.start_year desc, years.academic_year desc
          ),
          '[]'::jsonb
        )
        from (
          select
            derived.academic_year,
            split_part(derived.academic_year, '/', 1)::integer as start_year
          from (
            select distinct public.revenue_academic_year_from_month(month) as academic_year
            from public.t_revenue_txn
            where public.revenue_academic_year_from_month(month) is not null
          ) derived
        ) years
      ),
      'regions', (select coalesce(jsonb_agg(jsonb_build_object('id', region_id::text, 'label', region_name) order by region_name), '[]'::jsonb) from public.t_region),
      'branches', (select coalesce(jsonb_agg(jsonb_build_object('id', branch_id::text, 'label', branch_name, 'regionId', region_id::text) order by branch_name), '[]'::jsonb) from public.t_branch where region_id is not null),
      'months', (select coalesce(jsonb_agg(jsonb_build_object('id', month_label, 'label', month_label) order by month_number), '[]'::jsonb) from months)
    ),
    'regionalRevenue', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue, 'transactions', transactions)) from regional), '[]'::jsonb),
    'regionalRevenueSource', coalesce((select jsonb_agg(jsonb_build_object(
      'name', name,
      'revenue', revenue,
      'transactions', transactions,
      'nonBulkRevenue', non_bulk_revenue,
      'bulkRevenue', bulk_revenue,
      'nonBulkTransactions', non_bulk_transactions,
      'bulkTransactions', bulk_transactions
    )) from regional_source), '[]'::jsonb),
    'branchRevenue', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue, 'transactions', transactions)) from branches), '[]'::jsonb),
    'branchRevenuePerformance', coalesce((select jsonb_agg(jsonb_build_object(
      'name', name,
      'revenue', revenue,
      'target', target
    )) from branch_performance), '[]'::jsonb),
    'productRevenue', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue, 'transactions', transactions)) from products), '[]'::jsonb),
    'productRevenueRetail', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue, 'transactions', transactions)) from retail_products), '[]'::jsonb),
    'paymentCategoryRevenue', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue, 'transactions', transactions)) from payment_categories), '[]'::jsonb),
    'levelRevenue', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue, 'transactions', transactions)) from levels), '[]'::jsonb),
    'dataQuality', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue, 'transactions', transactions)) from quality), '[]'::jsonb),
    'recentTransactions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'paymentDate', payment_date, 'invoice', invoice, 'product', product_name,
      'branch', branch_name, 'revenue', revenue,
      'flags', array_remove(array[
        case when is_newtxn then 'NEW_TXN' end,
        case when is_fullpayment then 'FULL_PAYMENT' end,
        case when is_bulkbuying then 'BULK_BUYING' end
      ], null)
    ) order by payment_date desc, id desc) from (select * from current_rows order by payment_date desc, id desc limit 10) recent), '[]'::jsonb),
    'agentPerformance', coalesce((select jsonb_agg(jsonb_build_object(
      'agent', agent, 'branch', branch, 'schools', schools,
      'revenue_non_bulk_buying', revenue_non_bulk_buying,
      'new_txn_non_bulk_buying', new_txn_non_bulk_buying,
      'transactions_non_bulk_buying', transactions_non_bulk_buying
    )) from agents), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_revenue_dashboard_v2(text, integer, integer, text, date, date) from public;
grant execute on function public.get_revenue_dashboard_v2(text, integer, integer, text, date, date) to service_role;

notify pgrst, 'reload schema';
