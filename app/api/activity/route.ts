import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { parseJson } from '@/lib/validate'
import { activitySchema } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = await parseJson(req, activitySchema)
    if (parsed.error) return parsed.error
    const { course_id, module_id, sub_topic_id, content_id, activity_type } = parsed.data

    const { data, error } = await supabase
      .from('activity_log')
      .insert({
        user_id: user.id,
        course_id,
        module_id,
        sub_topic_id,
        content_id,
        activity_type
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
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
    const limit = parseInt(searchParams.get('limit') || '20')

    const { data, error } = await supabase
      .from('activity_log')
      .select(`
        id,
        activity_type,
        created_at,
        courses(title),
        modules(title),
        sub_topics(title),
        module_content(title, type)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
