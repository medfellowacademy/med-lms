-- =============================================
-- ASSESSMENT & GRADING SYSTEM
-- Phase 2: Quizzes, Assignments, Exams
-- Run this after supabase-schema.sql
-- =============================================

-- ASSESSMENTS (quizzes, assignments, exams)
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules on delete cascade,
  sub_topic_id uuid references public.sub_topics on delete cascade,
  title text not null,
  description text,
  type text not null check (type in ('quiz', 'assignment', 'exam')),
  time_limit_minutes int, -- null means no time limit
  passing_score int default 70,
  max_attempts int default 1, -- -1 means unlimited
  show_correct_answers boolean default true,
  shuffle_questions boolean default false,
  published boolean default false,
  due_date timestamptz,
  available_from timestamptz,
  created_by uuid references public.profiles on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_assessments_module on public.assessments(module_id);
create index if not exists idx_assessments_subtopic on public.assessments(sub_topic_id);
create index if not exists idx_assessments_created_by on public.assessments(created_by);

-- ASSESSMENT QUESTIONS
create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.assessments on delete cascade not null,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank')),
  points int default 1,
  order_index int default 0,
  
  -- For multiple choice/true_false
  options jsonb, -- [{text: "Option A", is_correct: true}, {text: "Option B", is_correct: false}]
  
  -- For short answer/essay grading guidance
  sample_answer text,
  grading_rubric text,
  
  -- For fill in the blank
  blank_answers jsonb, -- ["answer1", "answer2"] - accepts any of these
  
  explanation text, -- shown after submission if enabled
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_questions_assessment on public.assessment_questions(assessment_id);
create index if not exists idx_questions_order on public.assessment_questions(assessment_id, order_index);

-- STUDENT SUBMISSIONS (attempt tracking)
create table if not exists public.student_submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.assessments on delete cascade not null,
  user_id uuid references public.profiles on delete cascade not null,
  attempt_number int default 1,
  
  started_at timestamptz default now(),
  submitted_at timestamptz,
  time_spent_seconds int default 0,
  
  -- Answers stored as JSON: {question_id: "answer_text" or ["option_id1", "option_id2"]}
  answers jsonb,
  
  -- Scoring
  score int,
  max_score int,
  percentage int,
  passed boolean,
  
  -- Grading
  graded_by uuid references public.profiles on delete set null,
  graded_at timestamptz,
  feedback text,
  
  -- Per-question feedback
  question_feedback jsonb, -- {question_id: {points: 5, feedback: "Good answer", is_correct: true}}
  
  status text default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')),
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_submissions_assessment on public.student_submissions(assessment_id);
create index if not exists idx_submissions_user on public.student_submissions(user_id);
create index if not exists idx_submissions_status on public.student_submissions(status);
create index if not exists idx_submissions_user_assessment on public.student_submissions(user_id, assessment_id);

-- QUESTION BANK (reusable questions library)
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles on delete set null,
  question_text text not null,
  question_type text not null check (question_type in ('multiple_choice', 'true_false', 'short_answer', 'essay', 'fill_blank')),
  options jsonb,
  sample_answer text,
  grading_rubric text,
  blank_answers jsonb,
  explanation text,
  tags text[], -- ["anatomy", "cardiology", "difficult"]
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  points int default 1,
  times_used int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_question_bank_created_by on public.question_bank(created_by);
create index if not exists idx_question_bank_tags on public.question_bank using gin(tags);
create index if not exists idx_question_bank_type on public.question_bank(question_type);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.student_submissions enable row level security;
alter table public.question_bank enable row level security;

-- ASSESSMENTS POLICIES
drop policy if exists "assessments_admin_all" on public.assessments;
create policy "assessments_admin_all" on public.assessments for all
  using (get_my_role() = 'admin');

drop policy if exists "assessments_student_select" on public.assessments;
create policy "assessments_student_select" on public.assessments for select
  using (
    published = true
    and (
      (module_id is not null and exists(
        select 1 from public.modules m
        join public.enrollments e on e.course_id = m.course_id
        where m.id = assessments.module_id
          and m.is_locked = false
          and e.user_id = auth.uid()
      ))
      or
      (sub_topic_id is not null and exists(
        select 1 from public.sub_topics st
        join public.modules m on m.id = st.module_id
        join public.enrollments e on e.course_id = m.course_id
        where st.id = assessments.sub_topic_id
          and st.is_locked = false
          and m.is_locked = false
          and e.user_id = auth.uid()
      ))
    )
  );

-- QUESTIONS POLICIES
drop policy if exists "questions_admin_all" on public.assessment_questions;
create policy "questions_admin_all" on public.assessment_questions for all
  using (get_my_role() = 'admin');

drop policy if exists "questions_student_select" on public.assessment_questions;
create policy "questions_student_select" on public.assessment_questions for select
  using (
    exists(
      select 1 from public.assessments a
      where a.id = assessment_questions.assessment_id
        and a.published = true
        and (
          (a.module_id is not null and exists(
            select 1 from public.modules m
            join public.enrollments e on e.course_id = m.course_id
            where m.id = a.module_id
              and m.is_locked = false
              and e.user_id = auth.uid()
          ))
          or
          (a.sub_topic_id is not null and exists(
            select 1 from public.sub_topics st
            join public.modules m on m.id = st.module_id
            join public.enrollments e on e.course_id = m.course_id
            where st.id = a.sub_topic_id
              and st.is_locked = false
              and m.is_locked = false
              and e.user_id = auth.uid()
          ))
        )
    )
  );

-- SUBMISSIONS POLICIES
drop policy if exists "submissions_insert_own" on public.student_submissions;
create policy "submissions_insert_own" on public.student_submissions for insert
  with check (auth.uid() = user_id);

drop policy if exists "submissions_update_own" on public.student_submissions;
create policy "submissions_update_own" on public.student_submissions for update
  using (auth.uid() = user_id or get_my_role() = 'admin');

drop policy if exists "submissions_select_own_or_admin" on public.student_submissions;
create policy "submissions_select_own_or_admin" on public.student_submissions for select
  using (auth.uid() = user_id or get_my_role() = 'admin');

-- QUESTION BANK POLICIES
drop policy if exists "question_bank_admin_all" on public.question_bank;
create policy "question_bank_admin_all" on public.question_bank for all
  using (get_my_role() = 'admin');

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Auto-grade multiple choice and true/false questions
create or replace function public.auto_grade_submission(submission_id_param uuid)
returns jsonb language plpgsql security definer as $$
declare
  submission_record record;
  question_record record;
  total_score int := 0;
  max_score int := 0;
  question_feedback jsonb := '{}';
  answer_text text;
  is_correct boolean;
  points_earned int;
begin
  -- Get submission
  select * into submission_record
  from public.student_submissions
  where id = submission_id_param;

  if not found then
    return jsonb_build_object('error', 'Submission not found');
  end if;

  -- Loop through questions
  for question_record in
    select * from public.assessment_questions
    where assessment_id = submission_record.assessment_id
    order by order_index
  loop
    max_score := max_score + question_record.points;
    
    -- Get student's answer
    answer_text := submission_record.answers->>question_record.id::text;
    
    -- Auto-grade multiple choice and true/false
    if question_record.question_type in ('multiple_choice', 'true_false') then
      is_correct := false;
      points_earned := 0;
      
      -- Check if answer matches correct option
      if question_record.options is not null then
        for i in 0..jsonb_array_length(question_record.options) - 1 loop
          if (question_record.options->i->>'is_correct')::boolean = true then
            if (question_record.options->i->>'text') = answer_text then
              is_correct := true;
              points_earned := question_record.points;
              exit;
            end if;
          end if;
        end loop;
      end if;
      
      total_score := total_score + points_earned;
      question_feedback := question_feedback || jsonb_build_object(
        question_record.id::text,
        jsonb_build_object(
          'points', points_earned,
          'is_correct', is_correct,
          'feedback', case when is_correct then 'Correct!' else 'Incorrect' end
        )
      );
    end if;
    
    -- Short answer, essay, fill_blank need manual grading (skip for now)
    
  end loop;

  -- Update submission with scores
  update public.student_submissions
  set 
    score = total_score,
    max_score = max_score,
    percentage = case when max_score > 0 then round((total_score::float / max_score) * 100) else 0 end,
    question_feedback = question_feedback,
    status = case 
      when exists(
        select 1 from public.assessment_questions
        where assessment_id = submission_record.assessment_id
          and question_type in ('short_answer', 'essay', 'fill_blank')
      ) then 'submitted' -- needs manual grading
      else 'graded'
    end,
    updated_at = now()
  where id = submission_id_param;

  return jsonb_build_object(
    'success', true,
    'score', total_score,
    'max_score', max_score,
    'percentage', case when max_score > 0 then round((total_score::float / max_score) * 100) else 0 end
  );
end;
$$;

-- Check if student can take assessment (based on max attempts)
create or replace function public.can_take_assessment(assessment_id_param uuid, user_id_param uuid)
returns boolean language plpgsql security definer as $$
declare
  assessment_record record;
  attempt_count int;
begin
  select * into assessment_record
  from public.assessments
  where id = assessment_id_param;

  if not found then
    return false;
  end if;

  -- Check if published
  if not assessment_record.published then
    return false;
  end if;

  -- Check max attempts (-1 = unlimited)
  if assessment_record.max_attempts = -1 then
    return true;
  end if;

  -- Count completed attempts
  select count(*) into attempt_count
  from public.student_submissions
  where assessment_id = assessment_id_param
    and user_id = user_id_param
    and status in ('submitted', 'graded');

  return attempt_count < assessment_record.max_attempts;
end;
$$;

-- Get assessment statistics for admin
create or replace function public.get_assessment_stats(assessment_id_param uuid)
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
  avg_score numeric;
  avg_time numeric;
  total_attempts int;
  pass_rate numeric;
begin
  select 
    count(*) as total,
    round(avg(percentage), 1) as avg_score,
    round(avg(time_spent_seconds) / 60.0, 1) as avg_time_mins,
    round(count(*) filter (where passed = true)::numeric / nullif(count(*), 0) * 100, 1) as pass_rate
  into total_attempts, avg_score, avg_time, pass_rate
  from public.student_submissions
  where assessment_id = assessment_id_param
    and status = 'graded';

  result := jsonb_build_object(
    'total_attempts', total_attempts,
    'average_score', coalesce(avg_score, 0),
    'average_time_minutes', coalesce(avg_time, 0),
    'pass_rate', coalesce(pass_rate, 0)
  );

  return result;
end;
$$;
