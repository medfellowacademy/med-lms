import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Admins can also view student area, but redirect them to admin by default
  if (profile.role === 'admin') {
    // Allow admin to browse student area if they explicitly navigate here
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        role={profile.role === 'admin' ? 'admin' : 'student'}
        userName={profile.full_name || profile.email || 'Student'}
        userEmail={profile.email || ''}
      />
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
