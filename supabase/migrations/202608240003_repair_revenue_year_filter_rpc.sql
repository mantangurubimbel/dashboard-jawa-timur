-- Repair the academic year filter RPC and refresh PostgREST schema cache.

create or replace function public.get_revenue_academic_year_options()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', years.academic_year,
        'label', years.academic_year
      )
      order by years.start_year desc, years.academic_year desc
    ),
    '[]'::jsonb
  )
  from (
    select
      academic_year,
      case
        when split_part(academic_year, '/', 1) ~ '^[0-9]+$'
          then split_part(academic_year, '/', 1)::integer
        else -1
      end as start_year
    from public.t_revenue_txn
    where academic_year is not null
      and btrim(academic_year) <> ''
    group by academic_year
    order by start_year desc, academic_year desc
    limit 3
  ) years;
$$;

revoke execute on function public.get_revenue_academic_year_options() from public;
grant execute on function public.get_revenue_academic_year_options() to service_role;

notify pgrst, 'reload schema';
