-- =============================================
-- ADD SUB-TOPICS FEATURE
-- Run this AFTER running the main schema
-- =============================================

-- Create sub_topics table
create table if not exists public.sub_topics (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules on delete cascade not null,
  title text not null,
  order_index int default 0,
  is_locked boolean default true,
  created_at timestamptz default now()
);

-- Add is_locked column if table already exists
alter table public.sub_topics 
add column if not exists is_locked boolean default true;

-- Add sub_topic_id to module_content (nullable for backward compatibility)
alter table public.module_content 
add column if not exists sub_topic_id uuid references public.sub_topics on delete cascade;

-- Create index for faster lookups
create index if not exists idx_sub_topics_module_id on public.sub_topics(module_id);
create index if not exists idx_module_content_sub_topic_id on public.module_content(sub_topic_id);

-- Enable RLS on sub_topics
alter table public.sub_topics enable row level security;

-- RLS POLICIES for SUB_TOPICS

-- Admins can do everything with sub_topics
drop policy if exists "sub_topics_admin" on public.sub_topics;
create policy "sub_topics_admin" on public.sub_topics for all
  using (get_my_role() = 'admin');

-- Students can view sub_topics if both module and sub-topic are unlocked and they're enrolled
drop policy if exists "sub_topics_student_select" on public.sub_topics;
create policy "sub_topics_student_select" on public.sub_topics for select
  using (
    is_locked = false and
    exists(
      select 1 from public.modules m
      join public.enrollments e on e.course_id = m.course_id
      where m.id = sub_topics.module_id
        and m.is_locked = false
        and e.user_id = auth.uid()
    )
  );

-- Update content_student_select policy to work with sub_topics
drop policy if exists "content_student_select" on public.module_content;
create policy "content_student_select" on public.module_content for select
  using (
    -- If content has a sub_topic_id, check via sub_topic (both module AND sub-topic must be unlocked)
    (sub_topic_id is not null and exists(
      select 1 from public.sub_topics st
      join public.modules m on m.id = st.module_id
      join public.enrollments e on e.course_id = m.course_id
      where st.id = module_content.sub_topic_id
        and st.is_locked = false
        and m.is_locked = false
        and e.user_id = auth.uid()
    ))
    or
    -- If content has direct module_id (backward compatible), check via module
    (sub_topic_id is null and exists(
      select 1 from public.modules m
      join public.enrollments e on e.course_id = m.course_id
      where m.id = module_content.module_id
        and m.is_locked = false
        and e.user_id = auth.uid()
    ))
  );

-- Success message
do $$
begin
  raise notice '✅ Sub-topics feature added successfully!';
  raise notice '📚 New hierarchy: Course → Module → Sub-topic → Content';
  raise notice '🔒 Sub-topics can be locked/unlocked independently';
  raise notice '⚡ Students can only access content when BOTH module AND sub-topic are unlocked';
end $$;
