import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Fetch threads for a course
// POST - Create a new thread
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('course_id')

    if (!courseId) {
      return NextResponse.json({ error: 'course_id is required' }, { status: 400 })
    }

    const { data: threads, error } = await supabase
      .from('discussion_threads')
      .select(`
        *,
        profiles(full_name, role)
      `)
      .eq('course_id', courseId)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ threads })
  } catch (error: any) {
    console.error('Error fetching threads:', error)
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

    // Create thread
    const { data: thread, error: threadError } = await supabase
      .from('discussion_threads')
      .insert({
        course_id,
        module_id,
        sub_topic_id,
        title,
        user_id: user.id
      })
      .select()
      .single()

    if (threadError) throw threadError

    // Create first post
    const { error: postError } = await supabase
      .from('discussion_posts')
      .insert({
        thread_id: thread.id,
        user_id: user.id,
        content
      })

    if (postError) throw postError

    // Award XP
    await supabase.rpc('award_xp', {
      user_id_param: user.id,
      action_type_param: 'forum_post',
      xp_amount: 5,
      description_param: 'Created discussion thread'
    })

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('Error creating thread:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update thread (pin, lock, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { thread_id, pinned, locked } = body

    if (!thread_id) {
      return NextResponse.json({ error: 'thread_id is required' }, { status: 400 })
    }

    const updates: any = {}
    if (pinned !== undefined) updates.pinned = pinned
    if (locked !== undefined) updates.locked = locked

    const { data: thread, error } = await supabase
      .from('discussion_threads')
      .update(updates)
      .eq('id', thread_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ thread })
  } catch (error: any) {
    console.error('Error updating thread:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a thread
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get('thread_id')

    if (!threadId) {
      return NextResponse.json({ error: 'thread_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('discussion_threads')
      .delete()
      .eq('id', threadId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting thread:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
