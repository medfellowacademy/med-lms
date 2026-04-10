import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// Default admin credentials — change these in .env.local
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@medfellow.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MedAdmin@2025'
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin'

export async function POST() {
  // Disable setup in production for security
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Setup endpoint is disabled in production. Create admin users through Supabase dashboard.' },
      { status: 403 }
    )
  }

  const supabase = createServiceSupabase()

  // Check if any admin already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Admin already exists. Use the login page.' }, { status: 409 })
  }

  // Create the admin user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_NAME },
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Set role to admin in profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'admin', full_name: ADMIN_NAME })
    .eq('id', authData.user.id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  })
}
