import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - List assessments (optionally filtered by module/subtopic)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const moduleId = searchParams.get('module_id')
    const subTopicId = searchParams.get('sub_topic_id')

    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('assessments')
      .select(`
        *,
        modules(id, title, course_id),
        sub_topics(id, title, module_id)
      `)
      .order('created_at', { ascending: false })

    if (moduleId) {
      query = query.eq('module_id', moduleId)
    }
    if (subTopicId) {
      query = query.eq('sub_topic_id', subTopicId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching assessments:', error)
      return NextResponse.json({ error: 'Failed to fetch assessments' }, { status: 500 })
    }

    return NextResponse.json({ assessments: data || [] })
  } catch (error) {
    console.error('Assessments GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new assessment
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      module_id,
      sub_topic_id,
      title,
      description,
      type,
      time_limit_minutes,
      passing_score,
      max_attempts,
      show_correct_answers,
      shuffle_questions,
      due_date,
      available_from,
      questions
    } = body

    // Create assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .insert({
        module_id,
        sub_topic_id,
        title,
        description,
        type,
        time_limit_minutes,
        passing_score: passing_score || 70,
        max_attempts: max_attempts || 1,
        show_correct_answers: show_correct_answers !== false,
        shuffle_questions: shuffle_questions || false,
        due_date,
        available_from,
        created_by: user.id,
        published: false
      })
      .select()
      .single()

    if (assessmentError) {
      console.error('Error creating assessment:', assessmentError)
      return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 })
    }

    // Create questions if provided
    if (questions && questions.length > 0) {
      const questionsToInsert = questions.map((q: any, index: number) => ({
        assessment_id: assessment.id,
        question_text: q.question_text,
        question_type: q.question_type,
        points: q.points || 1,
        order_index: index,
        options: q.options || null,
        sample_answer: q.sample_answer || null,
        grading_rubric: q.grading_rubric || null,
        blank_answers: q.blank_answers || null,
        explanation: q.explanation || null
      }))

      const { error: questionsError } = await supabase
        .from('assessment_questions')
        .insert(questionsToInsert)

      if (questionsError) {
        console.error('Error creating questions:', questionsError)
        // Don't fail the whole request, assessment was created
      }
    }

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Assessments POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update assessment (including publish)
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
      return NextResponse.json({ error: 'Assessment ID required' }, { status: 400 })
    }

    const { data: assessment, error } = await supabase
      .from('assessments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating assessment:', error)
      return NextResponse.json({ error: 'Failed to update assessment' }, { status: 500 })
    }

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Assessments PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete assessment
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
      return NextResponse.json({ error: 'Assessment ID required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('assessments')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting assessment:', error)
      return NextResponse.json({ error: 'Failed to delete assessment' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Assessments DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
