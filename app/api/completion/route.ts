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
    const { module_id, sub_topic_id, completed } = body

    if (!module_id && !sub_topic_id) {
      return NextResponse.json({ error: 'module_id or sub_topic_id is required' }, { status: 400 })
    }

    // Handle module completion
    if (module_id) {
      const { data, error } = await supabase
        .from('module_completion')
        .upsert({
          user_id: user.id,
          module_id,
          completed: completed !== undefined ? completed : true,
          completed_at: completed ? new Date().toISOString() : null
        }, {
          onConflict: 'user_id,module_id'
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Log activity
      if (completed) {
        await supabase.from('activity_log').insert({
          user_id: user.id,
          module_id,
          activity_type: 'completed_module'
        })
      }

      return NextResponse.json({ success: true, data })
    }

    // Handle sub-topic completion
    if (sub_topic_id) {
      const { data, error } = await supabase
        .from('subtopic_completion')
        .upsert({
          user_id: user.id,
          sub_topic_id,
          completed: completed !== undefined ? completed : true,
          completed_at: completed ? new Date().toISOString() : null
        }, {
          onConflict: 'user_id,sub_topic_id'
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, data })
    }
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
    const module_id = searchParams.get('module_id')
    const sub_topic_id = searchParams.get('sub_topic_id')

    if (module_id) {
      const { data, error } = await supabase
        .from('module_completion')
        .select('*')
        .eq('user_id', user.id)
        .eq('module_id', module_id)
        .single()

      if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data: data || null })
    }

    if (sub_topic_id) {
      const { data, error } = await supabase
        .from('subtopic_completion')
        .select('*')
        .eq('user_id', user.id)
        .eq('sub_topic_id', sub_topic_id)
        .single()

      if (error && error.code !== 'PGRST116') {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data: data || null })
    }

    return NextResponse.json({ error: 'module_id or sub_topic_id required' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
