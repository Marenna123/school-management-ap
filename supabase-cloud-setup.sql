-- Cloud ownership + RLS setup for School Management V2.
-- Run this migration in the Supabase project before real school data is used.
alter table public.schools add column if not exists owner_id uuid;
alter table public.schools add constraint schools_owner_id_key unique (owner_id);

alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.subjects enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.attendance enable row level security;
alter table public.exams enable row level security;
alter table public.marks enable row level security;

create or replace function public.user_school_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$ select id from public.schools where owner_id = auth.uid() $$;

create policy schools_owner_select on public.schools for select using (owner_id = auth.uid());
create policy schools_owner_insert on public.schools for insert with check (owner_id = auth.uid());
create policy schools_owner_update on public.schools for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy classes_owner_all on public.classes for all using (school_id in (select public.user_school_ids())) with check (school_id in (select public.user_school_ids()));
create policy students_owner_all on public.students for all using (school_id in (select public.user_school_ids())) with check (school_id in (select public.user_school_ids()));
create policy teachers_owner_all on public.teachers for all using (school_id in (select public.user_school_ids())) with check (school_id in (select public.user_school_ids()));
create policy attendance_owner_all on public.attendance for all using (school_id in (select public.user_school_ids())) with check (school_id in (select public.user_school_ids()));
create policy exams_owner_all on public.exams for all using (school_id in (select public.user_school_ids())) with check (school_id in (select public.user_school_ids()));

create policy sections_owner_all on public.sections for all using (class_id in (select id from public.classes where school_id in (select public.user_school_ids()))) with check (class_id in (select id from public.classes where school_id in (select public.user_school_ids())));
create policy subjects_owner_all on public.subjects for all using (class_id in (select id from public.classes where school_id in (select public.user_school_ids()))) with check (class_id in (select id from public.classes where school_id in (select public.user_school_ids())));
create policy marks_owner_all on public.marks for all using (exam_id in (select id from public.exams where school_id in (select public.user_school_ids()))) with check (exam_id in (select id from public.exams where school_id in (select public.user_school_ids())));

create unique index if not exists classes_school_name_uq on public.classes(school_id,name);
create unique index if not exists sections_class_name_uq on public.sections(class_id,name);
create unique index if not exists subjects_class_name_uq on public.subjects(class_id,name);
create unique index if not exists schools_owner_uq on public.schools(owner_id);
