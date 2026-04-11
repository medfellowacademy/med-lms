-- =============================================
-- ADD COURSE E-BOOKS FEATURE
-- Run this on existing databases
-- =============================================

create table if not exists public.course_ebooks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses on delete cascade not null,
  title text not null,
  storage_path text not null,
  created_at timestamptz default now()
);

create index if not exists idx_course_ebooks_course_id on public.course_ebooks(course_id);

alter table public.course_ebooks enable row level security;

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

do $$
begin
  raise notice '✅ Course e-books feature added successfully!';
  raise notice '📘 PDFs can now be attached directly to a course';
end $$;