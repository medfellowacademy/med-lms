import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Get student submissions (for grading or viewing own)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const assessmentId = searchParams.get('assessment_id')
    const userId = searchParams.get('user_id')
    const status = searchParams.get('status')

    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let query = supabase
      .from('student_submissions')
      .select(`
        *,
        assessments(id, title, type, max_score),
        profiles(id, full_name, email)
      `)
      .order('created_at', { ascending: false })

    if (assessmentId) {
      query = query.eq('assessment_id', assessmentId)
    }
    if (userId) {
      query = query.eq('user_id', userId)
    }
    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching submissions:', error)
      return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 })
    }

    return NextResponse.json({ submissions: data || [] })
  } catch (error) {
    console.error('Submissions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create/start new submission
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { assessment_id } = body

    // Enforce the exam's availability window (start time / due date) server-side —
    // the DB's can_take_assessment() function only checks published + attempt count.
    const { data: assessmentWindow } = await supabase
      .from('assessments')
      .select('available_from, due_date')
      .eq('id', assessment_id)
      .single()

    if (assessmentWindow) {
      const now = Date.now()
      if (assessmentWindow.available_from && now < new Date(assessmentWindow.available_from).getTime()) {
        return NextResponse.json({ error: 'This assessment is not open yet' }, { status: 403 })
      }
      if (assessmentWindow.due_date && now > new Date(assessmentWindow.due_date).getTime()) {
        return NextResponse.json({ error: 'This assessment is closed' }, { status: 403 })
      }
    }

    // Check if can take assessment
    const { data: canTake } = await supabase.rpc('can_take_assessment', {
      assessment_id_param: assessment_id,
      user_id_param: user.id
    })

    if (!canTake) {
      return NextResponse.json({ error: 'Maximum attempts reached or assessment not available' }, { status: 403 })
    }

    // Get attempt number
    const { count } = await supabase
      .from('student_submissions')
      .select('*', { count: 'exact', head: true })
      .eq('assessment_id', assessment_id)
      .eq('user_id', user.id)

    const { data: submission, error } = await supabase
      .from('student_submissions')
      .insert({
        assessment_id,
        user_id: user.id,
        attempt_number: (count || 0) + 1,
        answers: {},
        status: 'in_progress'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating submission:', error)
      return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })
    }

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('Submissions POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update submission (save answers, submit, or grade)
// Students may only save answers on their own in-progress attempt and submit it; scores,
// status and pass/fail are never taken from a student's request body. Grading is admin-only.
export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, action } = body

    if (!id) {
      return NextResponse.json({ error: 'Submission ID required' }, { status: 400 })
    }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    const { data: existing } = await supabase
      .from('student_submissions')
      .select('id, user_id, assessment_id, status')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const updates: Record<string, any> = {}

    // Handle grading by instructor
    if (action === 'grade') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      for (const key of ['score', 'max_score', 'percentage', 'feedback', 'question_feedback']) {
        if (body[key] !== undefined) updates[key] = body[key]
      }
      updates.graded_by = user.id
      updates.graded_at = new Date().toISOString()
      updates.status = 'graded'

      const { data: assessmentData } = await supabase
        .from('assessments')
        .select('passing_score')
        .eq('id', existing.assessment_id)
        .single()

      updates.passed = !!assessmentData && updates.percentage >= assessmentData.passing_score
    } else {
      if (existing.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (existing.status !== 'in_progress') {
        return NextResponse.json({ error: 'This attempt has already been submitted' }, { status: 409 })
      }

      if (body.answers !== undefined) updates.answers = body.answers

      if (action === 'submit') {
        if (body.time_spent_seconds !== undefined) updates.time_spent_seconds = body.time_spent_seconds

        // Persist the final answers first so auto-grading sees them
        if (updates.answers !== undefined) {
          await supabase.from('student_submissions').update({ answers: updates.answers }).eq('id', id)
        }

        updates.submitted_at = new Date().toISOString()
        updates.status = 'submitted'

        // Auto-grade if possible
        const { data: result } = await supabase.rpc('auto_grade_submission', {
          submission_id_param: id
        })

        if (result && !result.error) {
          const { data: assessment } = await supabase
            .from('assessments')
            .select('passing_score')
            .eq('id', existing.assessment_id)
            .single()

          if (assessment && result.percentage >= assessment.passing_score) {
            updates.passed = true
          }
        }
      }
    }

    const { data: submission, error } = await supabase
      .from('student_submissions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating submission:', error)
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 })
    }

    return NextResponse.json({ submission })
  } catch (error) {
    console.error('Submissions PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
