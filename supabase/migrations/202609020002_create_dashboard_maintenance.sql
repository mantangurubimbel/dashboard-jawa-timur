-- Global maintenance mode for the dashboard.
create table if not exists public.t_dashboard_maintenance (
  id smallint primary key default 1,
  is_active boolean not null default false,
  message text not null default 'This website is currently under maintenance. Please check back later.',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint t_dashboard_maintenance_singleton_check check (id = 1)
);

insert into public.t_dashboard_maintenance (id, is_active, message)
values (1, false, 'This website is currently under maintenance. Please check back later.')
on conflict (id) do nothing;

alter table public.t_dashboard_maintenance enable row level security;

drop trigger if exists set_t_dashboard_maintenance_updated_at
  on public.t_dashboard_maintenance;
create trigger set_t_dashboard_maintenance_updated_at
before update on public.t_dashboard_maintenance
for each row execute function public.set_updated_at();

drop policy if exists "public can read dashboard maintenance status"
  on public.t_dashboard_maintenance;
create policy "public can read dashboard maintenance status"
  on public.t_dashboard_maintenance for select
  to anon, authenticated
  using (true);

drop policy if exists "service role can manage dashboard maintenance"
  on public.t_dashboard_maintenance;
create policy "service role can manage dashboard maintenance"
  on public.t_dashboard_maintenance for all
  to service_role
  using (true)
  with check (true);
