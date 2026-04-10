-- =============================================
-- MedFellow LMS — FUNCTIONS + TRIGGERS + POLICIES ONLY
-- (Tables already exist — this just adds the missing logic)
-- Run in Supabase SQL Editor
-- =============================================

-- 1. Helper role function
create or replace function public.get_my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- 2. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Enable RLS
alter table public.profiles      enable row level security;
alter table public.courses        enable row level security;
alter table public.modules        enable row level security;
alter table public.module_content enable row level security;
alter table public.enrollments    enable row level security;

-- 4. PROFILES policies
drop policy if exists "profiles_select"       on public.profiles;
drop policy if exists "profiles_insert"       on public.profiles;
drop policy if exists "profiles_insert_own"   on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
drop policy if exists "profiles_admin_update" on public.profiles;

create policy "profiles_select"       on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles_insert"       on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own"   on public.profiles for update using (auth.uid() = id);
create policy "profiles_update_admin" on public.profiles for update using (get_my_role() = 'admin');
create policy "profiles_delete_admin" on public.profiles for delete using (get_my_role() = 'admin');

-- 5. COURSES policies
drop policy if exists "courses_select" on public.courses;
drop policy if exists "courses_insert" on public.courses;
drop policy if exists "courses_update" on public.courses;
drop policy if exists "courses_delete" on public.courses;
drop policy if exists "courses_admin"  on public.courses;

create policy "courses_select" on public.courses for select using (auth.role() = 'authenticated');
create policy "courses_insert" on public.courses for insert with check (get_my_role() = 'admin');
create policy "courses_update" on public.courses for update using (get_my_role() = 'admin');
create policy "courses_delete" on public.courses for delete using (get_my_role() = 'admin');

-- 6. MODULES policies
drop policy if exists "modules_admin_all"       on public.modules;
drop policy if exists "modules_admin"           on public.modules;
drop policy if exists "modules_student_select"  on public.modules;

create policy "modules_admin_all" on public.modules for all using (get_my_role() = 'admin');
create policy "modules_student_select" on public.modules for select using (
  is_locked = false and
  exists(select 1 from public.enrollments where user_id = auth.uid() and course_id = modules.course_id)
);

-- 7. MODULE CONTENT policies
drop policy if exists "content_admin_all"      on public.module_content;
drop policy if exists "content_admin"          on public.module_content;
drop policy if exists "content_student_select" on public.module_content;

create policy "content_admin_all" on public.module_content for all using (get_my_role() = 'admin');
create policy "content_student_select" on public.module_content for select using (
  exists(
    select 1 from public.modules m
    join public.enrollments e on e.course_id = m.course_id
    where m.id = module_content.module_id
      and m.is_locked = false
      and e.user_id = auth.uid()
  )
);

-- 8. ENROLLMENTS policies
drop policy if exists "enrollments_admin_all"      on public.enrollments;
drop policy if exists "enrollments_admin"          on public.enrollments;
drop policy if exists "enrollments_student_select" on public.enrollments;

create policy "enrollments_admin_all"      on public.enrollments for all    using (get_my_role() = 'admin');
create policy "enrollments_student_select" on public.enrollments for select using (user_id = auth.uid());

-- 9. Storage bucket + policies
insert into storage.buckets (id, name, public)
values ('medfellow-content', 'medfellow-content', false)
on conflict (id) do nothing;

drop policy if exists "storage_admin_insert"      on storage.objects;
drop policy if exists "storage_admin_select"      on storage.objects;
drop policy if exists "storage_admin_delete"      on storage.objects;
drop policy if exists "storage_auth_select"       on storage.objects;
drop policy if exists "admin_upload"              on storage.objects;
drop policy if exists "admin_select_storage"      on storage.objects;
drop policy if exists "admin_delete_storage"      on storage.objects;
drop policy if exists "authenticated_read_storage" on storage.objects;

create policy "storage_admin_insert" on storage.objects for insert
  with check (bucket_id = 'medfellow-content' and (select get_my_role()) = 'admin');
create policy "storage_admin_select" on storage.objects for select
  using (bucket_id = 'medfellow-content' and (select get_my_role()) = 'admin');
create policy "storage_admin_delete" on storage.objects for delete
  using (bucket_id = 'medfellow-content' and (select get_my_role()) = 'admin');
create policy "storage_auth_select" on storage.objects for select
  using (bucket_id = 'medfellow-content' and auth.role() = 'authenticated');

-- DONE ✓
