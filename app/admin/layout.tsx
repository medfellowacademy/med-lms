import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()
  if (profile?.role !== 'admin') redirect('/student')

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        role="admin"
        userName={profile.full_name || profile.email || 'Admin'}
        userEmail={profile.email || ''}
      />
      <div className="app-main" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
