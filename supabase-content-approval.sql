-- =============================================
-- CONTENT APPROVAL SYSTEM
-- Run this in your Supabase SQL Editor
-- =============================================

-- Step 1: Add approval columns to module_content table
alter table public.module_content 
  add column if not exists approval_status text default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists uploaded_by uuid references public.profiles(id),
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

-- Step 2: Update type enum to include audio
alter table public.module_content 
  drop constraint if exists module_content_type_check;

alter table public.module_content 
  add constraint module_content_type_check 
  check (type in ('video', 'ppt', 'pdf', 'audio', 'document'));

-- Step 3: Create indexes for efficient querying
create index if not exists idx_module_content_approval_status on public.module_content(approval_status);
create index if not exists idx_module_content_uploaded_by on public.module_content(uploaded_by);
create index if not exists idx_module_content_approved_by on public.module_content(approved_by);

-- Step 4: Add course_ebooks approval columns
alter table public.course_ebooks
  add column if not exists approval_status text default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists uploaded_by uuid references public.profiles(id),
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text;

create index if not exists idx_course_ebooks_approval_status on public.course_ebooks(approval_status);

-- Step 5: Update RLS policies for module_content
-- Students can only see APPROVED content
drop policy if exists "content_student_select" on public.module_content;
create policy "content_student_select" on public.module_content for select
  using (
    approval_status = 'approved' 
    and exists (
      select 1 from public.modules m
      join public.enrollments e on e.course_id = m.course_id
      where m.id = module_content.module_id 
        and e.user_id = auth.uid()
        and m.is_locked = false
    )
  );

-- Admins can see ALL content (pending, approved, rejected)
drop policy if exists "content_admin" on public.module_content;
create policy "content_admin" on public.module_content for all
  using (public.get_my_role() = 'admin');

-- Step 6: Update RLS policies for course_ebooks
-- Students can only see APPROVED ebooks
drop policy if exists "course_ebooks_student_select" on public.course_ebooks;
create policy "course_ebooks_student_select" on public.course_ebooks for select
  using (
    approval_status = 'approved'
    and exists (
      select 1 from public.enrollments e
      where e.course_id = course_ebooks.course_id 
        and e.user_id = auth.uid()
    )
  );

-- Admins can see ALL ebooks
drop policy if exists "course_ebooks_admin" on public.course_ebooks;
create policy "course_ebooks_admin" on public.course_ebooks for all
  using (public.get_my_role() = 'admin');

-- Step 7: Update existing content to be approved (OPTIONAL)
-- Uncomment if you want existing content to be automatically approved
-- update public.module_content 
-- set approval_status = 'approved', 
--     approved_at = now() 
-- where approval_status = 'pending';

-- update public.course_ebooks 
-- set approval_status = 'approved', 
--     approved_at = now() 
-- where approval_status = 'pending';

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Check content by approval status
-- SELECT approval_status, count(*) 
-- FROM public.module_content 
-- GROUP BY approval_status;

-- Check pending content
-- SELECT mc.*, m.title as module_title, c.title as course_title, p.full_name as uploaded_by_name
-- FROM public.module_content mc
-- JOIN public.modules m ON m.id = mc.module_id
-- JOIN public.courses c ON c.id = m.course_id
-- LEFT JOIN public.profiles p ON p.id = mc.uploaded_by
-- WHERE mc.approval_status = 'pending'
-- ORDER BY mc.created_at DESC;

-- =============================================
-- HELPER FUNCTION: Get pending content count
-- =============================================
create or replace function public.get_pending_content_count()
returns integer
language sql
security definer
stable
as $$
  select count(*)::integer
  from public.module_content
  where approval_status = 'pending';
$$;
