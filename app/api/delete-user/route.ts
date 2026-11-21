import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function DELETE(req: NextRequest) {
  // Authenticate admin
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('id')
  if (!userId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 })

  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const service = createServiceSupabase()

  // Remove dependent rows first in case FKs aren't set to cascade
  await service.from('enrollments').delete().eq('user_id', userId)
  await service.from('profiles').delete().eq('id', userId)

  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
