-- Product sales filters aligned with the month-based revenue periods.

create or replace function public.get_product_sales(
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
    where (
        p_academic_year is null
        or public.revenue_academic_year_from_month(tx.month) = p_academic_year
      )
      and (p_branch_id is null or tx.branch_id = p_branch_id)
      and (p_from_date is null or tx.payment_date >= p_from_date)
      and (p_to_date is null or tx.payment_date <= p_to_date)
    group by tx.product_id, p.product_name, p.product_code, tx.is_bulkbuying
  ) x;
$$;

revoke execute on function public.get_product_sales() from public;
revoke execute on function public.get_product_sales(text, integer, date, date) from public;
grant execute on function public.get_product_sales(text, integer, date, date) to service_role;

notify pgrst, 'reload schema';
