-- =============================================
-- MedFellow LMS - Notes & Bookmarks System
-- Run this in your Supabase SQL Editor
-- =============================================

-- VIDEO NOTES (timestamped notes on videos)
create table if not exists public.video_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  content_id uuid references public.module_content on delete cascade not null,
  module_id uuid references public.modules on delete cascade not null,
  course_id uuid references public.courses on delete cascade not null,
  note_text text not null,
  timestamp_seconds int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_video_notes_user on public.video_notes(user_id);
create index if not exists idx_video_notes_content on public.video_notes(content_id);
create index if not exists idx_video_notes_module on public.video_notes(module_id);
create index if not exists idx_video_notes_course on public.video_notes(course_id);
create index if not exists idx_video_notes_created on public.video_notes(created_at desc);

-- VIDEO BOOKMARKS (save specific timestamps)
create table if not exists public.video_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  content_id uuid references public.module_content on delete cascade not null,
  module_id uuid references public.modules on delete cascade not null,
  title text not null,
  timestamp_seconds int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_video_bookmarks_user on public.video_bookmarks(user_id);
create index if not exists idx_video_bookmarks_content on public.video_bookmarks(content_id);

-- MODULE NOTES (general module notes, not tied to video timestamp)
create table if not exists public.module_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  module_id uuid references public.modules on delete cascade not null,
  course_id uuid references public.courses on delete cascade not null,
  note_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_module_notes_user on public.module_notes(user_id);
create index if not exists idx_module_notes_module on public.module_notes(module_id);
create index if not exists idx_module_notes_course on public.module_notes(course_id);

-- COURSE NOTES (general course notes)
create table if not exists public.course_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles on delete cascade not null,
  course_id uuid references public.courses on delete cascade not null,
  note_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_course_notes_user on public.course_notes(user_id);
create index if not exists idx_course_notes_course on public.course_notes(course_id);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================
alter table public.video_notes enable row level security;
alter table public.video_bookmarks enable row level security;
alter table public.module_notes enable row level security;
alter table public.course_notes enable row level security;

-- =============================================
-- RLS POLICIES
-- =============================================

-- video_notes policies
drop policy if exists "Users can view own video notes" on public.video_notes;
create policy "Users can view own video notes" on public.video_notes
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create own video notes" on public.video_notes;
create policy "Users can create own video notes" on public.video_notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own video notes" on public.video_notes;
create policy "Users can update own video notes" on public.video_notes
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own video notes" on public.video_notes;
create policy "Users can delete own video notes" on public.video_notes
  for delete using (auth.uid() = user_id);

-- video_bookmarks policies
drop policy if exists "Users can view own video bookmarks" on public.video_bookmarks;
create policy "Users can view own video bookmarks" on public.video_bookmarks
  for select using (auth.uid() = user_id);

drop policy if exists "Users can create own video bookmarks" on public.video_bookmarks;
create policy "Users can create own video bookmarks" on public.video_bookmarks
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own video bookmarks" on public.video_bookmarks;
create policy "Users can update own video bookmarks" on public.video_bookmarks
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own video bookmarks" on public.video_bookmarks;
create policy "Users can delete own video bookmarks" on public.video_bookmarks
  for delete using (auth.uid() = user_id);

-- module_notes policies
drop policy if exists "Users can view own module notes" on public.module_notes;
create policy "Users can view own module notes" on public.module_notes
  for select using (auth.uid() = user_id);

drop policy if exists "Users can manage own module notes" on public.module_notes;
create policy "Users can manage own module notes" on public.module_notes
  for all using (auth.uid() = user_id);

-- course_notes policies
drop policy if exists "Users can view own course notes" on public.course_notes;
create policy "Users can view own course notes" on public.course_notes
  for select using (auth.uid() = user_id);

drop policy if exists "Users can manage own course notes" on public.course_notes;
create policy "Users can manage own course notes" on public.course_notes
  for all using (auth.uid() = user_id);

-- =============================================
-- FULL TEXT SEARCH INDEXES
-- =============================================

-- Add tsvector columns for full-text search
alter table public.video_notes add column if not exists search_vector tsvector;
alter table public.module_notes add column if not exists search_vector tsvector;
alter table public.course_notes add column if not exists search_vector tsvector;

-- Create indexes for full-text search
create index if not exists idx_video_notes_search on public.video_notes using gin(search_vector);
create index if not exists idx_module_notes_search on public.module_notes using gin(search_vector);
create index if not exists idx_course_notes_search on public.course_notes using gin(search_vector);

-- Function to update search vectors
create or replace function public.update_note_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('english', coalesce(new.note_text, ''));
  return new;
end;
$$;

-- Triggers to auto-update search vectors
drop trigger if exists video_notes_search_update on public.video_notes;
create trigger video_notes_search_update
  before insert or update on public.video_notes
  for each row execute function public.update_note_search_vector();

drop trigger if exists module_notes_search_update on public.module_notes;
create trigger module_notes_search_update
  before insert or update on public.module_notes
  for each row execute function public.update_note_search_vector();

drop trigger if exists course_notes_search_update on public.course_notes;
create trigger course_notes_search_update
  before insert or update on public.course_notes
  for each row execute function public.update_note_search_vector();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Search all notes for a user
create or replace function public.search_my_notes(search_query text)
returns table (
  id uuid,
  note_type text,
  note_text text,
  course_id uuid,
  module_id uuid,
  content_id uuid,
  timestamp_seconds int,
  created_at timestamptz,
  rank real
) language plpgsql security definer stable as $$
declare
  tsquery_str tsquery;
begin
  tsquery_str := plainto_tsquery('english', search_query);
  
  return query
  select 
    vn.id,
    'video'::text as note_type,
    vn.note_text,
    vn.course_id,
    vn.module_id,
    vn.content_id,
    vn.timestamp_seconds,
    vn.created_at,
    ts_rank(vn.search_vector, tsquery_str) as rank
  from public.video_notes vn
  where vn.user_id = auth.uid() and vn.search_vector @@ tsquery_str
  
  union all
  
  select 
    mn.id,
    'module'::text as note_type,
    mn.note_text,
    mn.course_id,
    mn.module_id,
    null::uuid as content_id,
    0 as timestamp_seconds,
    mn.created_at,
    ts_rank(mn.search_vector, tsquery_str) as rank
  from public.module_notes mn
  where mn.user_id = auth.uid() and mn.search_vector @@ tsquery_str
  
  union all
  
  select 
    cn.id,
    'course'::text as note_type,
    cn.note_text,
    cn.course_id,
    null::uuid as module_id,
    null::uuid as content_id,
    0 as timestamp_seconds,
    cn.created_at,
    ts_rank(cn.search_vector, tsquery_str) as rank
  from public.course_notes cn
  where cn.user_id = auth.uid() and cn.search_vector @@ tsquery_str
  
  order by rank desc, created_at desc;
end;
$$;
