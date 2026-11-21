-- ============================================================================
-- FIX: Student exams/quizzes hidden when their module is unlocked per-student
-- ============================================================================
-- Problem:
--   The "assessments_student_select" and "questions_student_select" RLS policies
--   only let a student read an assessment when the parent module's GLOBAL
--   modules.is_locked = false. They ignored the per-student override table
--   student_module_access. So a published exam on a globally-locked module
--   stayed invisible to a student even after an admin unlocked that module
--   for that specific student.
--
-- Fix:
--   Make the module-lock check honour student_module_access, using the same
--   effective-lock rule as app/student/courses/[id]/page.tsx:
--     override row present -> accessible iff is_unlocked = true
--     no override row      -> accessible iff modules.is_locked = false
--
-- Safe to run multiple times.
-- ============================================================================

drop policy if exists "assessments_student_select" on public.assessments;
create policy "assessments_student_select" on public.assessments for select
  using (
    published = true
    and (
      (module_id is not null and exists(
        select 1 from public.modules m
        join public.enrollments e on e.course_id = m.course_id
        where m.id = assessments.module_id
          and e.user_id = auth.uid()
          and (
            case
              when exists(
                select 1 from public.student_module_access sma
                where sma.student_id = auth.uid() and sma.module_id = m.id
              )
              then exists(
                select 1 from public.student_module_access sma
                where sma.student_id = auth.uid() and sma.module_id = m.id
                  and sma.is_unlocked = true
              )
              else m.is_locked = false
            end
          )
      ))
      or
      (sub_topic_id is not null and exists(
        select 1 from public.sub_topics st
        join public.modules m on m.id = st.module_id
        join public.enrollments e on e.course_id = m.course_id
        where st.id = assessments.sub_topic_id
          and st.is_locked = false
          and e.user_id = auth.uid()
          and (
            case
              when exists(
                select 1 from public.student_module_access sma
                where sma.student_id = auth.uid() and sma.module_id = m.id
              )
              then exists(
                select 1 from public.student_module_access sma
                where sma.student_id = auth.uid() and sma.module_id = m.id
                  and sma.is_unlocked = true
              )
              else m.is_locked = false
            end
          )
      ))
    )
  );

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
              and e.user_id = auth.uid()
              and (
                case
                  when exists(
                    select 1 from public.student_module_access sma
                    where sma.student_id = auth.uid() and sma.module_id = m.id
                  )
                  then exists(
                    select 1 from public.student_module_access sma
                    where sma.student_id = auth.uid() and sma.module_id = m.id
                      and sma.is_unlocked = true
                  )
                  else m.is_locked = false
                end
              )
          ))
          or
          (a.sub_topic_id is not null and exists(
            select 1 from public.sub_topics st
            join public.modules m on m.id = st.module_id
            join public.enrollments e on e.course_id = m.course_id
            where st.id = a.sub_topic_id
              and st.is_locked = false
              and e.user_id = auth.uid()
              and (
                case
                  when exists(
                    select 1 from public.student_module_access sma
                    where sma.student_id = auth.uid() and sma.module_id = m.id
                  )
                  then exists(
                    select 1 from public.student_module_access sma
                    where sma.student_id = auth.uid() and sma.module_id = m.id
                      and sma.is_unlocked = true
                  )
                  else m.is_locked = false
                end
              )
          ))
        )
    )
  );
