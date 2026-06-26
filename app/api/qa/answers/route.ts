import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Fetch answers for a question
// POST - Create a new answer
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('question_id')

    if (!questionId) {
      return NextResponse.json({ error: 'question_id is required' }, { status: 400 })
    }

    const { data: answers, error } = await supabase
      .from('qa_answers')
      .select(`
        *,
        profiles(full_name, role)
      `)
      .eq('question_id', questionId)
      .order('accepted_answer', { ascending: false })
      .order('votes', { ascending: false })
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ answers })
  } catch (error: any) {
    console.error('Error fetching answers:', error)
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
    const { question_id, content } = body

    if (!question_id || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if user is instructor
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isInstructor = profile?.role === 'admin'

    const { data: answer, error } = await supabase
      .from('qa_answers')
      .insert({
        question_id,
        user_id: user.id,
        content,
        is_instructor_answer: isInstructor
      })
      .select(`
        *,
        profiles(full_name, role)
      `)
      .single()

    if (error) throw error

    // Update question status if instructor answered
    if (isInstructor) {
      await supabase
        .from('qa_questions')
        .update({ status: 'answered' })
        .eq('id', question_id)
    }

    // Award XP
    await supabase.rpc('award_xp', {
      user_id_param: user.id,
      action_type_param: 'qa_answer',
      xp_amount: 15,
      description_param: 'Answered a question'
    })

    return NextResponse.json({ answer })
  } catch (error: any) {
    console.error('Error creating answer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Accept/unaccept answer
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only instructors can accept answers' }, { status: 403 })
    }

    const body = await request.json()
    const { answer_id, question_id, accepted } = body

    if (!answer_id || !question_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (accepted) {
      // Unaccept all answers for this question first
      await supabase
        .from('qa_answers')
        .update({ accepted_answer: false })
        .eq('question_id', question_id)

      // Accept this answer
      await supabase
        .from('qa_answers')
        .update({ accepted_answer: true })
        .eq('id', answer_id)

      // Update question status
      await supabase
        .from('qa_questions')
        .update({ status: 'answered' })
        .eq('id', question_id)
    } else {
      // Unaccept answer
      await supabase
        .from('qa_answers')
        .update({ accepted_answer: false })
        .eq('id', answer_id)

      // Update question status to open if no accepted answers
      const { data: acceptedAnswers } = await supabase
        .from('qa_answers')
        .select('id')
        .eq('question_id', question_id)
        .eq('accepted_answer', true)

      if (!acceptedAnswers || acceptedAnswers.length === 0) {
        await supabase
          .from('qa_questions')
          .update({ status: 'open' })
          .eq('id', question_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error accepting answer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete an answer
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const answerId = searchParams.get('answer_id')

    if (!answerId) {
      return NextResponse.json({ error: 'answer_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('qa_answers')
      .delete()
      .eq('id', answerId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting answer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
