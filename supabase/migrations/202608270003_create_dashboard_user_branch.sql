create table if not exists public.t_dashboard_user_branch (
  user_id uuid not null,
  branch_id integer not null,
  created_at timestamptz not null default now(),
  constraint t_dashboard_user_branch_pk primary key (user_id, branch_id),
  constraint t_dashboard_user_branch_user_fkey foreign key (user_id)
    references public.t_app_user(id) on delete cascade,
  constraint t_dashboard_user_branch_branch_fkey foreign key (branch_id)
    references public.t_branch(branch_id) on delete cascade
);

create index if not exists t_dashboard_user_branch_branch_idx
  on public.t_dashboard_user_branch (branch_id);

alter table public.t_dashboard_user_branch enable row level security;

drop policy if exists "authenticated can read own dashboard branches"
  on public.t_dashboard_user_branch;
create policy "authenticated can read own dashboard branches"
  on public.t_dashboard_user_branch for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "service role can manage dashboard branches"
  on public.t_dashboard_user_branch;
create policy "service role can manage dashboard branches"
  on public.t_dashboard_user_branch for all
  to service_role
  using (true)
  with check (true);
