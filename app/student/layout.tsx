import { redirect } from 'next/navigation'
import { getCurrentUser, getCurrentProfile } from '@/lib/supabase-server'
import Sidebar from '@/components/Sidebar'
import NotificationCenter from '@/components/NotificationCenter'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  // Admins can also view student area, but redirect them to admin by default
  if (profile.role === 'admin') {
    // Allow admin to browse student area if they explicitly navigate here
  }

  return (
    <div className="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        role={profile.role === 'admin' ? 'admin' : 'student'}
        userName={profile.full_name || profile.email || 'Student'}
        userEmail={profile.email || ''}
      />
      <div className="app-main" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'var(--white)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <NotificationCenter />
        </div>
        {children}
      </div>
    </div>
  )
}
