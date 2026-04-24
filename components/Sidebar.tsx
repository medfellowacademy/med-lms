'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'
import GlobalSearch from './GlobalSearch'

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
  const [open, setOpen] = useState(false)

  // Auto-close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

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
    {
      href: '/admin/grading',
      label: 'Grading',
      icon: (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd"/>
        </svg>
      ),
    },
    {
      href: '/admin/reports',
      label: 'Reports',
      icon: (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
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
    {
      href: '/student/study-groups',
      label: 'Study Groups',
      icon: (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
        </svg>
      ),
    },
    {
      href: '/student/leaderboard',
      label: 'Leaderboard',
      icon: (
        <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
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
    <>
      {/* Mobile top bar (only visible on mobile via CSS) */}
      <div className="mobile-topbar">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 8,
            background: 'var(--teal-light)', color: 'var(--teal)',
            border: '1px solid var(--border)', cursor: 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 26, height: 26, background: 'var(--teal)', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="white">
              <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11L3.5 14.5L5 9.5L1 6H6Z" />
            </svg>
          </div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 15, color: 'var(--teal)' }}>
            MedFellow
          </div>
        </div>
        <div style={{ width: 38 }} aria-hidden />
      </div>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="sidebar-backdrop open"
            onClick={() => setOpen(false)}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.div
        className={`app-sidebar ${open ? 'open' : ''}`}
        initial={false}
        style={{
          width: 240, background: 'var(--white)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh'
        }}
      >
      {/* Logo */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: 'var(--grad-teal)', borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(15, 110, 86, 0.25)'
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
              <path d="M8 1L10 6H15L11 9.5L12.5 14.5L8 11L3.5 14.5L5 9.5L1 6H6Z" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: 'var(--teal)', lineHeight: 1.1 }}>
              MedFellow
            </div>
            <div style={{ fontSize: 9.5, letterSpacing: '0.1em', color: 'var(--muted)', textTransform: 'uppercase', marginTop: 2 }}>
              Academy
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '16px 12px', flex: 1 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted-2)', padding: '4px 10px 10px', fontWeight: 600 }}>
          {role === 'admin' ? 'Admin' : 'Learning'}
        </div>
        
        {/* Global Search */}
        <div style={{ padding: '0 0 12px 0' }}>
          <GlobalSearch />
        </div>
        
        {nav.map(item => {
          const active = item.href === '/student' 
            ? pathname === '/student'
            : pathname.startsWith(item.href)
          return (
            <motion.div
              key={item.href}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{ position: 'relative', marginBottom: 3 }}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  style={{
                    position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
                    background: 'var(--teal)', borderRadius: '0 3px 3px 0'
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Link href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px',
                borderRadius: 8, fontSize: 13.5, cursor: 'pointer', textDecoration: 'none',
                color: active ? 'var(--teal)' : 'var(--text-soft)',
                background: active ? 'var(--teal-light)' : 'transparent',
                fontWeight: active ? 600 : 500,
                transition: 'background 0.15s ease, color 0.15s ease'
              }}>
                <span style={{ display: 'inline-flex', opacity: active ? 1 : 0.75 }}>{item.icon}</span>
                {item.label}
              </Link>
            </motion.div>
          )
        })}
      </div>

      {/* User + Logout */}
      <div style={{ padding: 14, borderTop: '1px solid var(--border)', background: 'var(--bg-elev)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 10, borderRadius: 10, background: 'var(--white)',
          border: '1px solid var(--border)', marginBottom: 10
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', background: 'var(--grad-teal)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: 'white', flexShrink: 0,
            boxShadow: '0 2px 6px rgba(15, 110, 86, 0.25)'
          }}>
            {initials}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </p>
            <span style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'capitalize' }}>{role}</span>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ width: '100%' }}>
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M19 10a.75.75 0 00-.22-.53l-2.75-2.75a.75.75 0 10-1.06 1.06l1.47 1.47H8.75a.75.75 0 000 1.5h7.69l-1.47 1.47a.75.75 0 101.06 1.06l2.75-2.75A.75.75 0 0019 10z" clipRule="evenodd" />
          </svg>
          Sign Out
        </button>
      </div>
    </motion.div>
    </>
  )
}
