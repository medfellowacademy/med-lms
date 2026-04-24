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
export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, action, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Submission ID required' }, { status: 400 })
    }

    // Handle submission
    if (action === 'submit') {
      updates.submitted_at = new Date().toISOString()
      updates.status = 'submitted'
      
      // Auto-grade if possible
      const { data: result } = await supabase.rpc('auto_grade_submission', {
        submission_id_param: id
      })

      if (result && !result.error) {
        // Check if passed
        const { data: assessment } = await supabase
          .from('assessments')
          .select('passing_score')
          .eq('id', updates.assessment_id || (await supabase.from('student_submissions').select('assessment_id').eq('id', id).single()).data?.assessment_id)
          .single()

        if (assessment && result.percentage >= assessment.passing_score) {
          updates.passed = true
        }
      }
    }

    // Handle grading by instructor
    if (action === 'grade') {
      updates.graded_by = user.id
      updates.graded_at = new Date().toISOString()
      updates.status = 'graded'
      
      // Get passing score from assessment
      const { data: submissionData } = await supabase
        .from('student_submissions')
        .select('assessment_id')
        .eq('id', id)
        .single()

      if (submissionData) {
        const { data: assessmentData } = await supabase
          .from('assessments')
          .select('passing_score')
          .eq('id', submissionData.assessment_id)
          .single()

        if (assessmentData && updates.percentage >= assessmentData.passing_score) {
          updates.passed = true
        } else {
          updates.passed = false
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
