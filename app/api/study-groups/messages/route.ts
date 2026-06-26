import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Fetch messages for a study group
// POST - Send a message to the group
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('group_id')

    if (!groupId) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    const { data: messages, error } = await supabase
      .from('study_group_messages')
      .select(`
        *,
        profiles(full_name, role)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) throw error

    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error('Error fetching messages:', error)
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
    const { group_id, message } = body

    if (!group_id || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user is member of group
    const { data: membership } = await supabase
      .from('study_group_members')
      .select('id')
      .eq('group_id', group_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'You must be a member to send messages' }, { status: 403 })
    }

    const { data: newMessage, error } = await supabase
      .from('study_group_messages')
      .insert({
        group_id,
        user_id: user.id,
        message
      })
      .select(`
        *,
        profiles(full_name, role)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ message: newMessage })
  } catch (error: any) {
    console.error('Error sending message:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a message
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('message_id')

    if (!messageId) {
      return NextResponse.json({ error: 'message_id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('study_group_messages')
      .delete()
      .eq('id', messageId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting message:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
