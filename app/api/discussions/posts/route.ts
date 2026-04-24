import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Fetch posts for a thread
// POST - Create a new post
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get('thread_id')

    if (!threadId) {
      return NextResponse.json({ error: 'thread_id is required' }, { status: 400 })
    }

    const { data: posts, error } = await supabase
      .from('discussion_posts')
      .select(`
        *,
        profiles(full_name, role)
      `)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Get likes for these posts
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: likes } = await supabase
        .from('discussion_post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', posts.map(p => p.id))

      const likedPostIds = new Set(likes?.map(l => l.post_id))
      posts.forEach((post: any) => {
        post.user_liked = likedPostIds.has(post.id)
      })
    }

    return NextResponse.json({ posts })
  } catch (error: any) {
    console.error('Error fetching posts:', error)
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
    const { thread_id, content, parent_post_id } = body

    if (!thread_id || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: post, error } = await supabase
      .from('discussion_posts')
      .insert({
        thread_id,
        user_id: user.id,
        content,
        parent_post_id
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
      action_type_param: 'forum_post',
      xp_amount: 5,
      description_param: 'Posted in discussion'
    })

    return NextResponse.json({ post })
  } catch (error: any) {
    console.error('Error creating post:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a post
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('post_id')

    if (!postId) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('discussion_posts')
      .delete()
      .eq('id', postId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting post:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
