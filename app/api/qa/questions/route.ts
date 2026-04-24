import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Fetch questions for a course
// POST - Create a new question
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('course_id')

    if (!courseId) {
      return NextResponse.json({ error: 'course_id is required' }, { status: 400 })
    }

    const { data: questions, error } = await supabase
      .from('qa_questions')
      .select(`
        *,
        profiles(full_name, role)
      `)
      .eq('course_id', courseId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ questions })
  } catch (error: any) {
    console.error('Error fetching questions:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { course_id, module_id, sub_topic_id, title, content } = body

    if (!course_id || !title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: question, error } = await supabase
      .from('qa_questions')
      .insert({
        course_id,
        module_id,
        sub_topic_id,
        title,
        content,
        user_id: user.id,
        status: 'open'
      })
      .select(`
        *,
        profiles(full_name, role)
      `)
      .single()

    if (error) throw error

    // Award XP
    await supabase.rpc('award_xp', {
      user_id_param: user.id,
      action_type_param: 'qa_question',
      xp_amount: 10,
      description_param: 'Asked a question'
    })

    return NextResponse.json({ question })
  } catch (error: any) {
    console.error('Error creating question:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update question status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { question_id, status } = body

    if (!question_id || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: question, error } = await supabase
      .from('qa_questions')
      .update({ status })
      .eq('id', question_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ question })
  } catch (error: any) {
    console.error('Error updating question:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a question
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('question_id')

    if (!questionId) {
      return NextResponse.json({ error: 'question_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('qa_questions')
      .delete()
      .eq('id', questionId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting question:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
