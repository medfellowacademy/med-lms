import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  // Verify the caller is an admin
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, password, full_name, role = 'student' } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

  const service = createServiceSupabase()

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || email },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Update profile with name and role
  await service
    .from('profiles')
    .update({ full_name: full_name || email, role })
    .eq('id', authData.user.id)

  return NextResponse.json({ success: true, user: { id: authData.user.id, email, full_name, role } })
}
