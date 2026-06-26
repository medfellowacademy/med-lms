-- =============================================
-- MedFellow LMS - Complete Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================

-- PROFILES (auto-created on signup via trigger)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  role text default 'student' check (role in ('student', 'admin')),
  created_at timestamptz default now()
);

-- COURSES
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz default now()
);

-- COURSE E-BOOKS
create table if not exists public.course_ebooks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses on delete cascade not null,
  title text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

create index if not exists idx_course_ebooks_course_id on public.course_ebooks(course_id);

-- MODULES
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses on delete cascade not null,
  title text not null,
  order_index int default 0,
  is_locked boolean default true,
  created_at timestamptz default now()
);

-- MODULE CONTENT
create table if not exists public.module_content (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules on delete cascade not null,
  type text not null check (type in ('video', 'ppt', 'pdf')),
  title text not null,
  storage_path text not null,
  order_index int default 0,
  created_at timestamptz default now()
);

-- ENROLLMENTS
create table if not exists public.enrollments (
  user_id uuid references public.profiles on delete cascade not null,
  course_id uuid references public.courses on delete cascade not null,
  enrolled_at timestamptz default now(),
  primary key (user_id, course_id)
);

-- Helper function (must be created AFTER profiles table)
create or replace function public.get_my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Auto-create profile on new user signup
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

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_ebooks enable row level security;
alter table public.modules enable row level security;
alter table public.module_content enable row level security;
alter table public.enrollments enable row level security;

-- =============================================
-- RLS POLICIES
-- =============================================

-- PROFILES
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert
  with check (auth.uid() = id);

-- COURSES
drop policy if exists "courses_select" on public.courses;
create policy "courses_select" on public.courses for select
  using (auth.role() = 'authenticated');

drop policy if exists "courses_admin" on public.courses;
create policy "courses_admin" on public.courses for all
  using (get_my_role() = 'admin');

-- COURSE E-BOOKS
drop policy if exists "course_ebooks_admin" on public.course_ebooks;
create policy "course_ebooks_admin" on public.course_ebooks for all
  using (get_my_role() = 'admin');

drop policy if exists "course_ebooks_student_select" on public.course_ebooks;
create policy "course_ebooks_student_select" on public.course_ebooks for select
  using (
    exists(
      select 1 from public.enrollments
      where user_id = auth.uid() and course_id = course_ebooks.course_id
    )
  );

-- MODULES
drop policy if exists "modules_admin" on public.modules;
create policy "modules_admin" on public.modules for all
  using (get_my_role() = 'admin');

drop policy if exists "modules_student_select" on public.modules;
create policy "modules_student_select" on public.modules for select
  using (
    is_locked = false and
    exists(
      select 1 from public.enrollments
      where user_id = auth.uid() and course_id = modules.course_id
    )
  );

-- MODULE CONTENT
drop policy if exists "content_admin" on public.module_content;
create policy "content_admin" on public.module_content for all
  using (get_my_role() = 'admin');

drop policy if exists "content_student_select" on public.module_content;
create policy "content_student_select" on public.module_content for select
  using (
    exists(
      select 1 from public.modules m
      join public.enrollments e on e.course_id = m.course_id
      where m.id = module_content.module_id
        and m.is_locked = false
        and e.user_id = auth.uid()
    )
  );

-- ENROLLMENTS
drop policy if exists "enrollments_admin" on public.enrollments;
create policy "enrollments_admin" on public.enrollments for all
  using (get_my_role() = 'admin');

drop policy if exists "enrollments_student_select" on public.enrollments;
create policy "enrollments_student_select" on public.enrollments for select
  using (user_id = auth.uid());

-- =============================================
-- STORAGE BUCKET
-- =============================================
insert into storage.buckets (id, name, public)
values ('medfellow-content', 'medfellow-content', false)
on conflict (id) do nothing;

drop policy if exists "admin_upload" on storage.objects;
create policy "admin_upload" on storage.objects for insert
  with check (
    bucket_id = 'medfellow-content' and
    (select get_my_role()) = 'admin'
  );

drop policy if exists "admin_select_storage" on storage.objects;
create policy "admin_select_storage" on storage.objects for select
  using (
    bucket_id = 'medfellow-content' and
    (select get_my_role()) = 'admin'
  );

drop policy if exists "admin_delete_storage" on storage.objects;
create policy "admin_delete_storage" on storage.objects for delete
  using (
    bucket_id = 'medfellow-content' and
    (select get_my_role()) = 'admin'
  );

drop policy if exists "authenticated_read_storage" on storage.objects;
create policy "authenticated_read_storage" on storage.objects for select
  using (
    bucket_id = 'medfellow-content' and
    auth.role() = 'authenticated'
  );
