-- =============================================
-- STUDENT PORTAL FEATURES
-- Progress tracking, completion status, activity logs
-- Run this AFTER the main schema and sub-topics schema
-- =============================================

-- 1. VIDEO PROGRESS TRACKING
-- Track how much of each video a student has watched
create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  content_id uuid references public.module_content on delete cascade not null,
  watch_time_seconds int default 0,
  total_duration_seconds int default 0,
  completed boolean default false,
  last_watched_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, content_id)
);

-- 2. MODULE COMPLETION TRACKING
-- Track which modules students have completed
create table if not exists public.module_completion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  module_id uuid references public.modules on delete cascade not null,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, module_id)
);

-- 3. SUB-TOPIC COMPLETION TRACKING
-- Track which sub-topics students have completed
create table if not exists public.subtopic_completion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  sub_topic_id uuid references public.sub_topics on delete cascade not null,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, sub_topic_id)
);

-- 4. ACTIVITY LOG
-- Track student activity for recent activity feed
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  course_id uuid references public.courses on delete cascade,
  module_id uuid references public.modules on delete cascade,
  sub_topic_id uuid references public.sub_topics on delete cascade,
  content_id uuid references public.module_content on delete cascade,
  activity_type text not null, -- 'viewed_video', 'downloaded_resource', 'started_module', etc.
  created_at timestamptz default now()
);

-- 5. COURSE PROGRESS (calculated view)
-- Helpful view to calculate overall course progress
create or replace view public.course_progress as
select 
  e.user_id,
  e.course_id,
  c.title as course_title,
  count(distinct m.id) as total_modules,
  count(distinct mc.module_id) filter (where mc.completed = true) as completed_modules,
  count(distinct st.id) as total_subtopics,
  count(distinct sc.sub_topic_id) filter (where sc.completed = true) as completed_subtopics,
  count(distinct cnt.id) filter (where cnt.type = 'video') as total_videos,
  count(distinct vp.content_id) filter (where vp.completed = true) as completed_videos
from public.enrollments e
join public.courses c on c.id = e.course_id
left join public.modules m on m.course_id = e.course_id
left join public.module_completion mc on mc.module_id = m.id and mc.user_id = e.user_id
left join public.sub_topics st on st.module_id = m.id
left join public.subtopic_completion sc on sc.sub_topic_id = st.id and sc.user_id = e.user_id
left join public.module_content cnt on cnt.module_id = m.id
left join public.video_progress vp on vp.content_id = cnt.id and vp.user_id = e.user_id
group by e.user_id, e.course_id, c.title;

-- Create indexes for performance
create index if not exists idx_video_progress_user on public.video_progress(user_id);
create index if not exists idx_video_progress_content on public.video_progress(content_id);
create index if not exists idx_module_completion_user on public.module_completion(user_id);
create index if not exists idx_subtopic_completion_user on public.subtopic_completion(user_id);
create index if not exists idx_activity_log_user on public.activity_log(user_id);
create index if not exists idx_activity_log_created on public.activity_log(created_at desc);

-- Enable RLS
alter table public.video_progress enable row level security;
alter table public.module_completion enable row level security;
alter table public.subtopic_completion enable row level security;
alter table public.activity_log enable row level security;

-- RLS POLICIES

-- Video Progress
drop policy if exists "video_progress_own" on public.video_progress;
create policy "video_progress_own" on public.video_progress for all
  using (auth.uid() = user_id);

-- Module Completion
drop policy if exists "module_completion_own" on public.module_completion;
create policy "module_completion_own" on public.module_completion for all
  using (auth.uid() = user_id);

-- SubTopic Completion
drop policy if exists "subtopic_completion_own" on public.subtopic_completion;
create policy "subtopic_completion_own" on public.subtopic_completion for all
  using (auth.uid() = user_id);

-- Activity Log
drop policy if exists "activity_log_own" on public.activity_log;
create policy "activity_log_own" on public.activity_log for all
  using (auth.uid() = user_id);

-- Allow admins to view all progress
drop policy if exists "video_progress_admin" on public.video_progress;
create policy "video_progress_admin" on public.video_progress for select
  using (get_my_role() = 'admin');

drop policy if exists "module_completion_admin" on public.module_completion;
create policy "module_completion_admin" on public.module_completion for select
  using (get_my_role() = 'admin');

drop policy if exists "subtopic_completion_admin" on public.subtopic_completion;
create policy "subtopic_completion_admin" on public.subtopic_completion for select
  using (get_my_role() = 'admin');

drop policy if exists "activity_log_admin" on public.activity_log;
create policy "activity_log_admin" on public.activity_log for select
  using (get_my_role() = 'admin');

-- Success message
do $$
begin
  raise notice '✅ Student portal features added successfully!';
  raise notice '📊 Progress tracking enabled for videos and modules';
  raise notice '📝 Activity logging enabled';
  raise notice '🎯 Completion tracking for modules and sub-topics';
end $$;
