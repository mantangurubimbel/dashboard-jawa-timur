create or replace function public.get_bulk_buying_growth(
  p_academic_year text,
  p_from_date date,
  p_to_date date
) returns jsonb language sql security definer set search_path = public stable as $$
  with scoped as (
    select revenue, is_bulkbuying,
      public.revenue_academic_year_from_month(month) as ay,
      payment_date
    from public.t_revenue_txn
    where is_bulkbuying = true
  )
  select jsonb_build_object(
    'currentRevenue', coalesce(sum(revenue) filter (where ay = p_academic_year and payment_date between p_from_date and p_to_date), 0),
    'previousRevenue', coalesce(sum(revenue) filter (where ay =
      lpad(((split_part(p_academic_year, '/', 1)::integer + 99) % 100)::text, 2, '0') || '/' || split_part(p_academic_year, '/', 1)
      and payment_date between (p_from_date - interval '1 year')::date and (p_to_date - interval '1 year')::date), 0)
  ) from scoped;
$$;
revoke execute on function public.get_bulk_buying_growth(text, date, date) from public;
grant execute on function public.get_bulk_buying_growth(text, date, date) to service_role;
