-- Optional bulk-buying scope for school account rankings.

create or replace function public.get_school_accounts(
  p_academic_year text default null,
  p_level text default null,
  p_is_bulkbuying boolean default null
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with filtered as materialized (
    select
      tx.npsn,
      tx.branch_id,
      tx.invoice,
      tx.revenue,
      coalesce(s.name, 'Sekolah tidak ditemukan') as school,
      coalesce(s.city, '-') as city,
      coalesce(b.branch_name, 'Branch #' || tx.branch_id::text) as branch
    from public.t_revenue_txn tx
    left join public.t_master_school s on s.npsn = tx.npsn
    left join public.t_branch b on b.branch_id = tx.branch_id
    where tx.npsn is not null
      and (p_academic_year is null or tx.academic_year = p_academic_year)
      and (p_level is null or s.level = p_level)
      and (p_is_bulkbuying is null or tx.is_bulkbuying = p_is_bulkbuying)
  ),
  school_totals as (
    select
      npsn,
      max(school) as school,
      max(city) as city,
      coalesce(sum(revenue), 0)::numeric as revenue,
      count(*)::integer as transactions,
      count(distinct invoice)::integer as invoices
    from filtered
    group by npsn
  ),
  branch_totals as (
    select
      npsn,
      branch_id,
      max(branch) as branch,
      coalesce(sum(revenue), 0)::numeric as revenue,
      count(*)::integer as transactions
    from filtered
    group by npsn, branch_id
  ),
  branch_json as (
    select
      npsn,
      jsonb_agg(
        jsonb_build_object(
          'branch', branch,
          'revenue', revenue,
          'transactions', transactions
        )
        order by revenue desc, branch
      ) as branches
    from branch_totals
    group by npsn
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'npsn', st.npsn,
        'school', st.school,
        'city', st.city,
        'revenue', st.revenue,
        'transactions', st.transactions,
        'invoices', st.invoices,
        'branches', coalesce(bj.branches, '[]'::jsonb)
      )
      order by st.revenue desc, st.school
    ),
    '[]'::jsonb
  )
  from school_totals st
  left join branch_json bj on bj.npsn = st.npsn
  where st.revenue > 0;
$$;

revoke execute on function public.get_school_accounts(text, text, boolean) from public;
grant execute on function public.get_school_accounts(text, text, boolean) to service_role;

notify pgrst, 'reload schema';
