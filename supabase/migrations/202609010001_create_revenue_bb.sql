-- Bulk-buying revenue records.
create table if not exists public.t_revenue_bb (
  academic_year text,
  month text,
  region_id integer,
  branch_id integer,
  branch_injected_id integer,
  package_name text,
  package_name_detail text,
  school_name text,
  redeem_date date,
  qty_accounts integer,
  revenue integer,
  constraint t_revenue_bb_region_id_fkey foreign key (region_id)
    references public.t_region (region_id),
  constraint t_revenue_bb_branch_id_fkey foreign key (branch_id)
    references public.t_branch (branch_id),
  constraint t_revenue_bb_branch_injected_id_fkey foreign key (branch_injected_id)
    references public.t_branch (branch_id)
);

create index if not exists t_revenue_bb_academic_year_idx
  on public.t_revenue_bb (academic_year);
create index if not exists t_revenue_bb_month_idx
  on public.t_revenue_bb (month);
create index if not exists t_revenue_bb_region_id_idx
  on public.t_revenue_bb (region_id);
create index if not exists t_revenue_bb_branch_id_idx
  on public.t_revenue_bb (branch_id);
create index if not exists t_revenue_bb_branch_injected_id_idx
  on public.t_revenue_bb (branch_injected_id);
create index if not exists t_revenue_bb_redeem_date_idx
  on public.t_revenue_bb (redeem_date);

alter table public.t_revenue_bb enable row level security;

drop policy if exists "authenticated can read bulk-buying revenue"
  on public.t_revenue_bb;
create policy "authenticated can read bulk-buying revenue"
  on public.t_revenue_bb for select
  to authenticated
  using (true);

drop policy if exists "service role can manage bulk-buying revenue"
  on public.t_revenue_bb;
create policy "service role can manage bulk-buying revenue"
  on public.t_revenue_bb for all
  to service_role
  using (true)
  with check (true);
