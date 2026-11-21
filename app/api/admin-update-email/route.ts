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
  const { userId, newEmail } = await req.json()
  const email = typeof newEmail === 'string' ? newEmail.trim() : ''
  if (!userId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const service = createServiceSupabase()

  // Update email in Supabase Auth
  const { error } = await service.auth.admin.updateUserById(userId, { email, email_confirm: true })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Keep profile row in sync
  const { error: profileError } = await service.from('profiles').update({ email }).eq('id', userId)
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
