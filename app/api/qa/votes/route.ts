import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// POST - Vote on a question or answer
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { votable_type, votable_id, vote_type } = body

    if (!votable_type || !votable_id || vote_type === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['question', 'answer'].includes(votable_type)) {
      return NextResponse.json({ error: 'Invalid votable_type' }, { status: 400 })
    }

    if (![1, -1].includes(vote_type)) {
      return NextResponse.json({ error: 'Invalid vote_type (must be 1 or -1)' }, { status: 400 })
    }

    // Check if user already voted
    const { data: existingVote } = await supabase
      .from('qa_votes')
      .select('vote_type')
      .eq('votable_type', votable_type)
      .eq('votable_id', votable_id)
      .eq('user_id', user.id)
      .single()

    if (existingVote) {
      // If same vote, remove it
      if (existingVote.vote_type === vote_type) {
        const { error } = await supabase
          .from('qa_votes')
          .delete()
          .eq('votable_type', votable_type)
          .eq('votable_id', votable_id)
          .eq('user_id', user.id)

        if (error) throw error
        return NextResponse.json({ success: true, action: 'removed' })
      } else {
        // Change vote
        const { error } = await supabase
          .from('qa_votes')
          .update({ vote_type })
          .eq('votable_type', votable_type)
          .eq('votable_id', votable_id)
          .eq('user_id', user.id)

        if (error) throw error
        return NextResponse.json({ success: true, action: 'updated' })
      }
    } else {
      // Add new vote
      const { error } = await supabase
        .from('qa_votes')
        .insert({
          votable_type,
          votable_id,
          user_id: user.id,
          vote_type
        })

      if (error) throw error
      return NextResponse.json({ success: true, action: 'added' })
    }
  } catch (error: any) {
    console.error('Error voting:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
