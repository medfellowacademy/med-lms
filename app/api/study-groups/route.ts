import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Fetch all accessible study groups
// POST - Create a new study group
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all public groups
    const { data: publicGroups, error: publicError } = await supabase
      .from('study_groups')
      .select(`
        *,
        courses(title),
        profiles(full_name)
      `)
      .eq('private', false)
      .order('created_at', { ascending: false })

    if (publicError) throw publicError

    // Get groups user is member of (including private)
    const { data: memberships } = await supabase
      .from('study_group_members')
      .select('group_id, study_groups(*,courses(title),profiles(full_name))')
      .eq('user_id', user.id)

    const userGroups = memberships?.map(m => m.study_groups).filter(Boolean) || []

    return NextResponse.json({ publicGroups, userGroups })
  } catch (error: any) {
    console.error('Error fetching study groups:', error)
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
    const { name, description, course_id, max_members, private: isPrivate } = body

    if (!name || !course_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create group
    const { data: group, error: groupError } = await supabase
      .from('study_groups')
      .insert({
        name,
        description,
        course_id,
        owner_id: user.id,
        max_members: max_members || 10,
        private: isPrivate || false
      })
      .select()
      .single()

    if (groupError) throw groupError

    // Add creator as member with owner role
    const { error: memberError } = await supabase
      .from('study_group_members')
      .insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner'
      })

    if (memberError) throw memberError

    // Award XP
    await supabase.rpc('award_xp', {
      user_id_param: user.id,
      action_type_param: 'study_group',
      xp_amount: 20,
      description_param: 'Created study group'
    })

    return NextResponse.json({ group })
  } catch (error: any) {
    console.error('Error creating study group:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a study group (owner only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('group_id')

    if (!groupId) {
      return NextResponse.json({ error: 'group_id is required' }, { status: 400 })
    }

    // Verify user is owner
    const { data: group } = await supabase
      .from('study_groups')
      .select('owner_id')
      .eq('id', groupId)
      .single()

    if (group?.owner_id !== user.id) {
      return NextResponse.json({ error: 'Only the owner can delete the group' }, { status: 403 })
    }

    const { error } = await supabase
      .from('study_groups')
      .delete()
      .eq('id', groupId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting study group:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
