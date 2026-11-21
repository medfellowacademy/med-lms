import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { parseJson } from '@/lib/validate'
import { createUserSchema } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is an admin
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const parsed = await parseJson(req, createUserSchema)
    if (parsed.error) return parsed.error
    const { email, password, full_name, role } = parsed.data

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    console.log('create-user: url present:', !!supabaseUrl, 'service key present:', !!serviceKey, 'key prefix:', serviceKey?.slice(0, 20))

    const service = createServiceSupabase()

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    })

    if (authError) {
      console.error('create-user authError:', JSON.stringify(authError))
      return NextResponse.json({ error: authError.message, code: authError.code, details: authError }, { status: 500 })
    }

    // Upsert profile — handles cases where the trigger didn't create it
    const { error: profileError } = await service
      .from('profiles')
      .upsert({ id: authData.user.id, email, full_name: full_name || email, role }, { onConflict: 'id' })

    if (profileError) {
      console.error('create-user profileError:', JSON.stringify(profileError))
    }

    return NextResponse.json({ success: true, user: { id: authData.user.id, email, full_name, role } })
  } catch (err: any) {
    console.error('create-user unexpected error:', err?.message, err?.stack)
    return NextResponse.json({ error: err?.message || 'Unexpected server error', stack: err?.stack }, { status: 500 })
  }
}
