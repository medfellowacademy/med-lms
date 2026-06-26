import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Fetch announcements
// POST - Create announcement (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('course_id')

    let query = supabase
      .from('announcements')
      .select(`
        *,
        profiles(full_name),
        courses(title)
      `)
      .order('created_at', { ascending: false })

    if (courseId) {
      query = query.or(`course_id.eq.${courseId},course_id.is.null`)
    } else {
      query = query.is('course_id', null)
    }

    const { data: announcements, error } = await query

    if (error) throw error

    return NextResponse.json({ announcements })
  } catch (error: any) {
    console.error('Error fetching announcements:', error)
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only instructors can create announcements' }, { status: 403 })
    }

    const body = await request.json()
    const { course_id, title, content, priority } = body

    if (!title || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        course_id: course_id || null,
        title,
        content,
        priority: priority || 'normal',
        created_by: user.id
      })
      .select()
      .single()

    if (error) throw error

    // Create notifications for affected students
    if (course_id) {
      // Get students enrolled in this course
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('user_id')
        .eq('course_id', course_id)

      if (enrollments) {
        const notifications = enrollments.map(e => ({
          user_id: e.user_id,
          type: 'announcement',
          title: `New ${priority === 'urgent' ? 'Urgent ' : ''}Announcement`,
          content: title,
          link: course_id ? `/student/courses/${course_id}` : null
        }))

        await supabase
          .from('notifications')
          .insert(notifications)
      }
    }

    return NextResponse.json({ announcement })
  } catch (error: any) {
    console.error('Error creating announcement:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete announcement
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const announcementId = searchParams.get('announcement_id')

    if (!announcementId) {
      return NextResponse.json({ error: 'announcement_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting announcement:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
