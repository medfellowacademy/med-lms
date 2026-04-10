import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { content_id, watch_time_seconds, total_duration_seconds, completed } = body

    if (!content_id) {
      return NextResponse.json({ error: 'content_id is required' }, { status: 400 })
    }

    // Upsert video progress
    const { data, error } = await supabase
      .from('video_progress')
      .upsert({
        user_id: user.id,
        content_id,
        watch_time_seconds: watch_time_seconds || 0,
        total_duration_seconds: total_duration_seconds || 0,
        completed: completed || false,
        last_watched_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,content_id'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log activity if completed
    if (completed) {
      await supabase.from('activity_log').insert({
        user_id: user.id,
        content_id,
        activity_type: 'viewed_video'
      })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const content_id = searchParams.get('content_id')

    if (!content_id) {
      // Return all progress for user
      const { data, error } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data })
    } else {
      // Return specific video progress
      const { data, error } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_id', content_id)
        .single()

      if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data: data || null })
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
