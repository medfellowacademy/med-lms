import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

// Fields that reveal or drive the correct answer — never sent to students while taking an exam.
function stripAnswers(question: any) {
  const { sample_answer, grading_rubric, blank_answers, explanation, ...safe } = question
  return {
    ...safe,
    options: Array.isArray(question.options)
      ? question.options.map((o: any) => ({ text: o.text }))
      : question.options,
  }
}

// GET - Get questions for an assessment.
// Admins get everything. Students get questions without answers, and only if they are enrolled
// and the exam/module is open to them. Answers are released via include_answers=1 only after
// the student's own attempt has been graded and the exam allows showing them.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const assessmentId = searchParams.get('assessment_id')
    const includeAnswers = searchParams.get('include_answers') === '1'

    if (!assessmentId) {
      return NextResponse.json({ error: 'Assessment ID required' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'
    // Students have no direct read access to assessment_questions, so the checks below stand in for RLS
    const db = isAdmin ? supabase : createServiceSupabase()

    if (!isAdmin) {
      const { data: assessment } = await db
        .from('assessments')
        .select('id, module_id, sub_topic_id, published, available_from, show_correct_answers')
        .eq('id', assessmentId)
        .single()

      if (!assessment || !assessment.published) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      if (assessment.available_from && Date.now() < new Date(assessment.available_from).getTime()) {
        return NextResponse.json({ error: 'This assessment is not open yet' }, { status: 403 })
      }

      let moduleId: string | null = assessment.module_id
      let subTopicLocked = false
      if (!moduleId && assessment.sub_topic_id) {
        const { data: st } = await db.from('sub_topics').select('module_id, is_locked').eq('id', assessment.sub_topic_id).single()
        moduleId = st?.module_id ?? null
        subTopicLocked = !!st?.is_locked
      }
      if (!moduleId || subTopicLocked) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { data: moduleRow } = await db.from('modules').select('course_id, is_locked').eq('id', moduleId).single()
      const [{ data: enrollment }, { data: override }] = await Promise.all([
        db.from('enrollments').select('course_id').eq('user_id', user.id).eq('course_id', moduleRow?.course_id).maybeSingle(),
        db.from('student_module_access').select('is_unlocked').eq('student_id', user.id).eq('module_id', moduleId).maybeSingle(),
      ])
      const unlocked = override ? override.is_unlocked : !moduleRow?.is_locked
      if (!moduleRow || !enrollment || !unlocked) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (includeAnswers) {
        const { data: graded } = await db
          .from('student_submissions')
          .select('id')
          .eq('assessment_id', assessmentId)
          .eq('user_id', user.id)
          .eq('status', 'graded')
          .limit(1)
        if (!assessment.show_correct_answers || !graded || graded.length === 0) {
          return NextResponse.json({ error: 'Answers are not available yet' }, { status: 403 })
        }
      }
    }

    const { data, error } = await db
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('order_index')

    if (error) {
      console.error('Error fetching questions:', error)
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    const questions = isAdmin || includeAnswers ? data || [] : (data || []).map(stripAnswers)
    return NextResponse.json({ questions })
  } catch (error) {
    console.error('Questions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add question to assessment
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      assessment_id,
      question_text,
      question_type,
      points,
      order_index,
      options,
      sample_answer,
      grading_rubric,
      blank_answers,
      explanation
    } = body

    const { data: question, error } = await supabase
      .from('assessment_questions')
      .insert({
        assessment_id,
        question_text,
        question_type,
        points: points || 1,
        order_index: order_index || 0,
        options: options || null,
        sample_answer: sample_answer || null,
        grading_rubric: grading_rubric || null,
        blank_answers: blank_answers || null,
        explanation: explanation || null
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating question:', error)
      return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
    }

    return NextResponse.json({ question })
  } catch (error) {
    console.error('Questions POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update question
export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Question ID required' }, { status: 400 })
    }

    const { data: question, error } = await supabase
      .from('assessment_questions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating question:', error)
      return NextResponse.json({ error: 'Failed to update question' }, { status: 500 })
    }

    return NextResponse.json({ question })
  } catch (error) {
    console.error('Questions PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete question
export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Question ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('assessment_questions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting question:', error)
      return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Questions DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
