-- Calculate revenue growth against the same calendar-date cutoff in the
-- previous academic years. The dashboard RPC keeps its full-year comparison
-- series for cumulative charts, so this RPC is used only by the revenue KPI
-- cards that need an AYtD-style comparison.

create or replace function public.get_revenue_growth_same_date(
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
  v_current_year text;
  v_ly_year text;
  v_l2y_year text;
  v_cutoff date;
  v_ly_cutoff date;
  v_l2y_cutoff date;
  v_ly_start date;
  v_l2y_start date;
  v_current numeric := 0;
  v_ly numeric := 0;
  v_l2y numeric := 0;
begin
  if p_month is not null and public.revenue_academic_month_number(p_month) is null then
    raise exception 'Bulan tidak valid: %', p_month;
  end if;

  v_current_year := coalesce(
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

  if v_current_year is null or v_current_year !~ '^[0-9]{2}/[0-9]{2}$' then
    return jsonb_build_object(
      'currentRevenue', 0,
      'previousRevenue', 0,
      'lastTwoYearsRevenue', 0,
      'growthVsLy', null,
      'growthVsL2y', null,
      'cutoffDate', null,
      'lyCutoffDate', null,
      'l2yCutoffDate', null
    );
  end if;

  v_ly_year := lpad(((split_part(v_current_year, '/', 1)::integer + 99) % 100)::text, 2, '0')
    || '/' || split_part(v_current_year, '/', 1);
  v_l2y_year := lpad(((split_part(v_current_year, '/', 1)::integer + 98) % 100)::text, 2, '0')
    || '/' || lpad(((split_part(v_current_year, '/', 1)::integer + 99) % 100)::text, 2, '0');

  -- Use the latest current-year payment date after all active filters. If a
  -- date range is supplied, the range still constrains the current period.
  select max(tx.payment_date)
  into v_cutoff
  from public.t_revenue_txn tx
  join public.t_branch b on b.branch_id = tx.branch_id
  where public.revenue_academic_year_from_month(tx.month) = v_current_year
    and (p_month is null or split_part(tx.month, ' ', 1) = p_month)
    and (p_from_date is null or tx.payment_date >= p_from_date)
    and (p_to_date is null or tx.payment_date <= p_to_date)
    and (p_region_id is null or b.region_id = p_region_id)
    and (p_branch_id is null or tx.branch_id = p_branch_id);

  if v_cutoff is not null then
    v_ly_cutoff := (v_cutoff - interval '1 year')::date;
    v_l2y_cutoff := (v_cutoff - interval '2 years')::date;
  end if;

  if p_from_date is not null then
    v_ly_start := (p_from_date - interval '1 year')::date;
    v_l2y_start := (p_from_date - interval '2 years')::date;
  end if;

  with scoped as materialized (
    select
      tx.revenue,
      tx.payment_date,
      public.revenue_academic_year_from_month(tx.month) as derived_academic_year,
      split_part(tx.month, ' ', 1) as month_label
    from public.t_revenue_txn tx
    join public.t_branch b on b.branch_id = tx.branch_id
    where (p_region_id is null or b.region_id = p_region_id)
      and (p_branch_id is null or tx.branch_id = p_branch_id)
      and (p_month is null or split_part(tx.month, ' ', 1) = p_month)
  )
  select
    coalesce(sum(revenue) filter (
      where derived_academic_year = v_current_year
        and (p_from_date is null or payment_date >= p_from_date)
        and payment_date <= v_cutoff
    ), 0)::numeric,
    coalesce(sum(revenue) filter (
      where derived_academic_year = v_ly_year
        and payment_date <= v_ly_cutoff
        and (v_ly_start is null or payment_date >= v_ly_start)
    ), 0)::numeric,
    coalesce(sum(revenue) filter (
      where derived_academic_year = v_l2y_year
        and payment_date <= v_l2y_cutoff
        and (v_l2y_start is null or payment_date >= v_l2y_start)
    ), 0)::numeric
  into v_current, v_ly, v_l2y
  from scoped;

  return jsonb_build_object(
    'currentRevenue', v_current,
    'previousRevenue', v_ly,
    'lastTwoYearsRevenue', v_l2y,
    'growthVsLy', case when v_ly = 0 then null else v_current / v_ly end,
    'growthVsL2y', case when v_l2y = 0 then null else v_current / v_l2y end,
    'cutoffDate', v_cutoff,
    'lyCutoffDate', v_ly_cutoff,
    'l2yCutoffDate', v_l2y_cutoff
  );
end;
$$;

revoke execute on function public.get_revenue_growth_same_date(text, integer, integer, text, date, date) from public;
grant execute on function public.get_revenue_growth_same_date(text, integer, integer, text, date, date) to service_role;

notify pgrst, 'reload schema';
