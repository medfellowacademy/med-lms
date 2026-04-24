import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// POST - Toggle like on a post
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { post_id, liked } = body

    if (!post_id) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
    }

    if (liked) {
      // Remove like
      const { error } = await supabase
        .from('discussion_post_likes')
        .delete()
        .eq('post_id', post_id)
        .eq('user_id', user.id)

      if (error) throw error
    } else {
      // Add like
      const { error } = await supabase
        .from('discussion_post_likes')
        .insert({
          post_id,
          user_id: user.id
        })

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error toggling like:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
