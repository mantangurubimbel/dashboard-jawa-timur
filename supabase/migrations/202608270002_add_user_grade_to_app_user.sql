alter table public.t_app_user
  add column if not exists user_grade integer;

update public.t_app_user
set user_grade = 1
where user_grade is null;

alter table public.t_app_user
  alter column user_grade set default 1,
  alter column user_grade set not null;
