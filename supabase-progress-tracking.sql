-- =============================================
-- MedFellow LMS - Progress Tracking & Analytics
-- Run this in your Supabase SQL Editor
-- =============================================

-- VIDEO PROGRESS (tracks where user left off + completion)
create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  content_id uuid references public.module_content on delete cascade not null,
  watch_time_seconds int default 0,
  total_duration_seconds int default 0,
  completed boolean default false,
  last_watched_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, content_id)
);

create index if not exists idx_video_progress_user on public.video_progress(user_id);
create index if not exists idx_video_progress_content on public.video_progress(content_id);

-- MODULE COMPLETION (tracks overall module progress)
create table if not exists public.module_completion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  module_id uuid references public.modules on delete cascade not null,
  videos_watched int default 0,
  total_videos int default 0,
  resources_downloaded int default 0,
  time_spent_seconds int default 0,
  completed boolean default false,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, module_id)
);

create index if not exists idx_module_completion_user on public.module_completion(user_id);
create index if not exists idx_module_completion_module on public.module_completion(module_id);

-- COURSE PROGRESS (overall course completion)
create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  course_id uuid references public.courses on delete cascade not null,
  modules_completed int default 0,
  total_modules int default 0,
  total_time_spent_seconds int default 0,
  progress_percentage int default 0,
  last_accessed_at timestamptz default now(),
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, course_id)
);

create index if not exists idx_course_progress_user on public.course_progress(user_id);
create index if not exists idx_course_progress_course on public.course_progress(course_id);

-- STUDY STREAKS (daily login tracking)
create table if not exists public.study_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  current_streak int default 0,
  longest_streak int default 0,
  last_activity_date date default current_date,
  total_study_days int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

create index if not exists idx_study_streaks_user on public.study_streaks(user_id);

-- DAILY ACTIVITY LOG (track daily engagement)
create table if not exists public.daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  activity_date date default current_date,
  videos_watched int default 0,
  time_spent_seconds int default 0,
  modules_completed int default 0,
  notes_created int default 0,
  created_at timestamptz default now(),
  unique(user_id, activity_date)
);

create index if not exists idx_daily_activity_user on public.daily_activity(user_id);
create index if not exists idx_daily_activity_date on public.daily_activity(activity_date);

-- ACHIEVEMENTS/MILESTONES
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  description text,
  icon text,
  category text check (category in ('completion', 'streak', 'time', 'engagement')),
  requirement_value int default 0,
  created_at timestamptz default now()
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  achievement_id uuid references public.achievements on delete cascade not null,
  unlocked_at timestamptz default now(),
  unique(user_id, achievement_id)
);

create index if not exists idx_user_achievements_user on public.user_achievements(user_id);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================
alter table public.video_progress enable row level security;
alter table public.module_completion enable row level security;
alter table public.course_progress enable row level security;
alter table public.study_streaks enable row level security;
alter table public.daily_activity enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- =============================================
-- RLS POLICIES
-- =============================================

-- video_progress policies
drop policy if exists "Users can view own video progress" on public.video_progress;
create policy "Users can view own video progress" on public.video_progress
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own video progress" on public.video_progress;
create policy "Users can insert own video progress" on public.video_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own video progress" on public.video_progress;
create policy "Users can update own video progress" on public.video_progress
  for update using (auth.uid() = user_id);

drop policy if exists "Admins can view all video progress" on public.video_progress;
create policy "Admins can view all video progress" on public.video_progress
  for select using (get_my_role() = 'admin');

-- module_completion policies
drop policy if exists "Users can view own module completion" on public.module_completion;
create policy "Users can view own module completion" on public.module_completion
  for select using (auth.uid() = user_id);

drop policy if exists "Users can manage own module completion" on public.module_completion;
create policy "Users can manage own module completion" on public.module_completion
  for all using (auth.uid() = user_id);

drop policy if exists "Admins can view all module completion" on public.module_completion;
create policy "Admins can view all module completion" on public.module_completion
  for select using (get_my_role() = 'admin');

-- course_progress policies
drop policy if exists "Users can view own course progress" on public.course_progress;
create policy "Users can view own course progress" on public.course_progress
  for select using (auth.uid() = user_id);

drop policy if exists "Users can manage own course progress" on public.course_progress;
create policy "Users can manage own course progress" on public.course_progress
  for all using (auth.uid() = user_id);

drop policy if exists "Admins can view all course progress" on public.course_progress;
create policy "Admins can view all course progress" on public.course_progress
  for select using (get_my_role() = 'admin');

-- study_streaks policies
drop policy if exists "Users can view own study streaks" on public.study_streaks;
create policy "Users can view own study streaks" on public.study_streaks
  for select using (auth.uid() = user_id);

drop policy if exists "Users can manage own study streaks" on public.study_streaks;
create policy "Users can manage own study streaks" on public.study_streaks
  for all using (auth.uid() = user_id);

-- daily_activity policies
drop policy if exists "Users can view own daily activity" on public.daily_activity;
create policy "Users can view own daily activity" on public.daily_activity
  for select using (auth.uid() = user_id);

drop policy if exists "Users can manage own daily activity" on public.daily_activity;
create policy "Users can manage own daily activity" on public.daily_activity
  for all using (auth.uid() = user_id);

drop policy if exists "Admins can view all daily activity" on public.daily_activity;
create policy "Admins can view all daily activity" on public.daily_activity
  for select using (get_my_role() = 'admin');

-- achievements policies (public read)
drop policy if exists "Anyone can view achievements" on public.achievements;
create policy "Anyone can view achievements" on public.achievements
  for select using (true);

drop policy if exists "Admins can manage achievements" on public.achievements;
create policy "Admins can manage achievements" on public.achievements
  for all using (get_my_role() = 'admin');

-- user_achievements policies
drop policy if exists "Users can view own achievements" on public.user_achievements;
create policy "Users can view own achievements" on public.user_achievements
  for select using (auth.uid() = user_id);

drop policy if exists "Users can manage own achievements" on public.user_achievements;
create policy "Users can manage own achievements" on public.user_achievements
  for all using (auth.uid() = user_id);

drop policy if exists "Admins can view all user achievements" on public.user_achievements;
create policy "Admins can view all user achievements" on public.user_achievements
  for select using (get_my_role() = 'admin');

-- =============================================
-- SEED DEFAULT ACHIEVEMENTS
-- =============================================
insert into public.achievements (code, title, description, icon, category, requirement_value) values
  ('first_video', 'First Steps', 'Watch your first video', '🎬', 'engagement', 1),
  ('complete_module', 'Module Master', 'Complete your first module', '📚', 'completion', 1),
  ('complete_course', 'Course Champion', 'Complete your first course', '🏆', 'completion', 1),
  ('streak_7', 'Week Warrior', '7-day study streak', '🔥', 'streak', 7),
  ('streak_30', 'Month Master', '30-day study streak', '💪', 'streak', 30),
  ('streak_100', 'Centurion', '100-day study streak', '👑', 'streak', 100),
  ('time_10h', 'Time Traveler', 'Study for 10 hours', '⏱️', 'time', 36000),
  ('time_50h', 'Dedicated Learner', 'Study for 50 hours', '📖', 'time', 180000),
  ('time_100h', 'Learning Legend', 'Study for 100 hours', '🌟', 'time', 360000),
  ('notes_50', 'Note Taker', 'Create 50 notes', '📝', 'engagement', 50)
on conflict (code) do nothing;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to update study streak
create or replace function public.update_study_streak(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_streak record;
  v_days_diff int;
begin
  select * into v_streak from public.study_streaks where user_id = p_user_id;
  
  if v_streak is null then
    -- First time tracking
    insert into public.study_streaks (user_id, current_streak, longest_streak, total_study_days)
    values (p_user_id, 1, 1, 1);
  else
    v_days_diff := current_date - v_streak.last_activity_date;
    
    if v_days_diff = 0 then
      -- Same day, do nothing
      return;
    elsif v_days_diff = 1 then
      -- Consecutive day, increment streak
      update public.study_streaks
      set 
        current_streak = current_streak + 1,
        longest_streak = greatest(longest_streak, current_streak + 1),
        total_study_days = total_study_days + 1,
        last_activity_date = current_date,
        updated_at = now()
      where user_id = p_user_id;
    else
      -- Streak broken, reset
      update public.study_streaks
      set 
        current_streak = 1,
        total_study_days = total_study_days + 1,
        last_activity_date = current_date,
        updated_at = now()
      where user_id = p_user_id;
    end if;
  end if;
end;
$$;

-- Function to log daily activity
create or replace function public.log_daily_activity(
  p_user_id uuid,
  p_activity_type text default 'video_watched'
)
returns void language plpgsql security definer as $$
begin
  insert into public.daily_activity (user_id, activity_date, videos_watched)
  values (p_user_id, current_date, case when p_activity_type = 'video_watched' then 1 else 0 end)
  on conflict (user_id, activity_date)
  do update set
    videos_watched = public.daily_activity.videos_watched + (case when p_activity_type = 'video_watched' then 1 else 0 end),
    notes_created = public.daily_activity.notes_created + (case when p_activity_type = 'note_created' then 1 else 0 end);
  
  -- Update streak
  perform public.update_study_streak(p_user_id);
end;
$$;
