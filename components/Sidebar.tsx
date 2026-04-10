'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface SidebarProps {
  role: 'admin' | 'student'
  userName: string
  userEmail: string
}

export default function Sidebar({ role, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const adminNav: NavItem[] = [
    {
      href: '/admin/courses',
      label: 'Courses',
      icon: (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
        </svg>
      ),
    },
    {
      href: '/admin/users',
      label: 'Students',
      icon: (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
      ),
    },
  ]

  const studentNav: NavItem[] = [
    {
      href: '/student',
      label: 'Dashboard',
      icon: (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
        </svg>
      ),
    },
    {
      href: '/student/courses',
      label: 'My Courses',
      icon: (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0z" />
        </svg>
      ),
    },
  ]

  const nav = role === 'admin' ? adminNav : studentNav
  const initials = userName
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{
      width: 220, background: 'var(--white)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh'
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, background: 'var(--teal)', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="white">
              <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11L3.5 14.5L5 9.5L1 6H6Z" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14, color: 'var(--teal)', lineHeight: 1.1 }}>
              MedFellow
            </div>
            <div style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 1 }}>
              Academy
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '12px 10px', flex: 1 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', padding: '6px 8px 4px' }}>
          {role === 'admin' ? 'Admin' : 'Student'}
        </div>
        {nav.map(item => {
          const active = item.href === '/student' 
            ? pathname === '/student'
            : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 6, fontSize: 13, cursor: 'pointer', textDecoration: 'none',
              color: active ? 'var(--teal)' : 'var(--muted)',
              background: active ? 'var(--teal-light)' : 'transparent',
              fontWeight: active ? 500 : 400,
              marginBottom: 2
            }}>
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </div>

      {/* User + Logout */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: 'var(--teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 500, color: 'white', flexShrink: 0
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </p>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{role}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '6px 0', fontSize: 12, color: 'var(--muted)',
            background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif"
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
