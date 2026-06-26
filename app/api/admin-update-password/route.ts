import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: Request) {
  // Authenticate admin
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Parse request
  const { userId, newPassword } = await req.json()
  if (!userId || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Update password using Supabase Admin API
  const service = createServiceSupabase()
  const { error } = await service.auth.admin.updateUserById(userId, { password: newPassword })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
