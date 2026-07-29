import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {}
        },
      },
    }
  )
}

// supabase.auth.getUser() makes a real network round trip to Supabase's Auth server
// (it re-validates the JWT, unlike getSession()). Layouts and pages each used to call
// it independently, paying that latency 2-4x per single page load. React's cache()
// memoizes this per request, so every Server Component in the same render tree shares
// one result instead of hitting the network repeatedly.
export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const supabase = await createServerSupabase()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()
  return profile
})

export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
