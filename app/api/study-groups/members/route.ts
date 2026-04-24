import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Fetch members of a study group
// POST - Add a member to the group (join)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('group_id')

    if (!groupId) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    const { data: members, error } = await supabase
      .from('study_group_members')
      .select(`
        *,
        profiles(full_name, role)
      `)
      .eq('group_id', groupId)
      .order('role', { ascending: true })
      .order('joined_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ members })
  } catch (error: any) {
    console.error('Error fetching members:', error)
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
    const { group_id } = body

    if (!group_id) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    // Check if group is full
    const { data: group } = await supabase
      .from('study_groups')
      .select('max_members')
      .eq('id', group_id)
      .single()

    const { data: currentMembers } = await supabase
      .from('study_group_members')
      .select('id')
      .eq('group_id', group_id)

    if (currentMembers && group && currentMembers.length >= group.max_members) {
      return NextResponse.json({ error: 'Group is full' }, { status: 400 })
    }

    // Add member
    const { data: member, error } = await supabase
      .from('study_group_members')
      .insert({
        group_id,
        user_id: user.id,
        role: 'member'
      })
      .select()
      .single()

    if (error) throw error

    // Award XP
    await supabase.rpc('award_xp', {
      user_id_param: user.id,
      action_type_param: 'study_group',
      xp_amount: 5,
      description_param: 'Joined study group'
    })

    return NextResponse.json({ member })
  } catch (error: any) {
    console.error('Error joining group:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove a member from the group (leave or kick)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('member_id')
    const groupId = searchParams.get('group_id')
    const userId = searchParams.get('user_id')

    if (!groupId) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    // If removing by user_id (leaving)
    if (userId) {
      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // If removing by member_id (kicking)
    if (memberId) {
      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Either member_id or user_id is required' }, { status: 400 })
  } catch (error: any) {
    console.error('Error removing member:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
