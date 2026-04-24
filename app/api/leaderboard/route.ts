import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET - Fetch leaderboard
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('course_id')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabase
      .from('user_xp')
      .select(`
        *,
        profiles(full_name, role)
      `)
      .order('total_xp', { ascending: false })
      .limit(limit)

    const { data: leaderboard, error } = await query

    if (error) throw error

    return NextResponse.json({ leaderboard })
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
