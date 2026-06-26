-- =============================================
-- GLOBAL SEARCH ENHANCEMENT
-- Adds full-text search capabilities across the LMS
-- Run this after supabase-schema.sql
-- =============================================

-- Add tsvector columns for full-text search
alter table public.courses 
add column if not exists search_vector tsvector;

alter table public.modules 
add column if not exists search_vector tsvector;

alter table public.sub_topics 
add column if not exists search_vector tsvector;

alter table public.module_content 
add column if not exists search_vector tsvector;

-- Create function to update search vectors
create or replace function public.update_courses_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector := 
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'B');
  return new;
end;
$$;

create or replace function public.update_modules_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector := 
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A');
  return new;
end;
$$;

create or replace function public.update_sub_topics_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector := 
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A');
  return new;
end;
$$;

create or replace function public.update_module_content_search_vector()
returns trigger language plpgsql as $$
begin
  new.search_vector := 
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.type, '')), 'C');
  return new;
end;
$$;

-- Create triggers to auto-update search vectors
drop trigger if exists courses_search_vector_update on public.courses;
create trigger courses_search_vector_update
  before insert or update on public.courses
  for each row execute function public.update_courses_search_vector();

drop trigger if exists modules_search_vector_update on public.modules;
create trigger modules_search_vector_update
  before insert or update on public.modules
  for each row execute function public.update_modules_search_vector();

drop trigger if exists sub_topics_search_vector_update on public.sub_topics;
create trigger sub_topics_search_vector_update
  before insert or update on public.sub_topics
  for each row execute function public.update_sub_topics_search_vector();

drop trigger if exists module_content_search_vector_update on public.module_content;
create trigger module_content_search_vector_update
  before insert or update on public.module_content
  for each row execute function public.update_module_content_search_vector();

-- Create GIN indexes for fast full-text search
create index if not exists courses_search_vector_idx on public.courses using gin(search_vector);
create index if not exists modules_search_vector_idx on public.modules using gin(search_vector);
create index if not exists sub_topics_search_vector_idx on public.sub_topics using gin(search_vector);
create index if not exists module_content_search_vector_idx on public.module_content using gin(search_vector);

-- Backfill existing records with search vectors
update public.courses set search_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B');

update public.modules set search_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A');

update public.sub_topics set search_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A');

update public.module_content set search_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(type, '')), 'C');

-- Add RLS policy for searching (reuse existing SELECT policies)
-- No new policies needed - existing SELECT policies will apply

-- Create helper function for search that respects permissions
create or replace function public.search_content(search_query text, user_role text, user_id_param uuid)
returns table(
  result_type text,
  id uuid,
  title text,
  description text,
  course_id uuid,
  module_id uuid,
  rank real
) language plpgsql security definer as $$
declare
  query_tsquery tsquery;
begin
  -- Convert search query to tsquery
  query_tsquery := plainto_tsquery('english', search_query);
  
  -- Search courses
  return query
    select 
      'course'::text as result_type,
      c.id,
      c.title,
      c.description,
      c.id as course_id,
      null::uuid as module_id,
      ts_rank(c.search_vector, query_tsquery) as rank
    from public.courses c
    where c.search_vector @@ query_tsquery
      and (user_role = 'admin' or exists(
        select 1 from public.enrollments e
        where e.course_id = c.id and e.user_id = user_id_param
      ))
    order by rank desc
    limit 10;
  
  -- Search modules
  return query
    select 
      'module'::text as result_type,
      m.id,
      m.title,
      null::text as description,
      m.course_id,
      m.id as module_id,
      ts_rank(m.search_vector, query_tsquery) as rank
    from public.modules m
    where m.search_vector @@ query_tsquery
      and (user_role = 'admin' or (
        m.is_locked = false and exists(
          select 1 from public.enrollments e
          where e.course_id = m.course_id and e.user_id = user_id_param
        )
      ))
    order by rank desc
    limit 10;
  
  -- Search sub-topics
  return query
    select 
      'subtopic'::text as result_type,
      st.id,
      st.title,
      null::text as description,
      m.course_id,
      st.module_id,
      ts_rank(st.search_vector, query_tsquery) as rank
    from public.sub_topics st
    join public.modules m on m.id = st.module_id
    where st.search_vector @@ query_tsquery
      and (user_role = 'admin' or (
        st.is_locked = false and m.is_locked = false and exists(
          select 1 from public.enrollments e
          where e.course_id = m.course_id and e.user_id = user_id_param
        )
      ))
    order by rank desc
    limit 10;
  
  -- Search content
  return query
    select 
      'content'::text as result_type,
      mc.id,
      mc.title,
      mc.type as description,
      m.course_id,
      mc.module_id,
      ts_rank(mc.search_vector, query_tsquery) as rank
    from public.module_content mc
    join public.modules m on m.id = mc.module_id
    where mc.search_vector @@ query_tsquery
      and (user_role = 'admin' or (
        m.is_locked = false and exists(
          select 1 from public.enrollments e
          where e.course_id = m.course_id and e.user_id = user_id_param
        )
      ))
    order by rank desc
    limit 10;
end;
$$;
