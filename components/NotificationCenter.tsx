'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

interface Notification {
  id: string
  type: 'announcement' | 'discussion' | 'qa' | 'badge' | 'grade'
  title: string
  content: string
  link: string | null
  read: boolean
  created_at: string
}

export default function NotificationCenter() {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadNotifications()
    const unsubscribe = subscribeToNotifications()

    // Close dropdown when clicking outside
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      unsubscribe()
    }
  }, [])

  async function loadNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.read).length || 0)
    } catch (err) {
      console.error('Error loading notifications:', err)
    }
  }

  function subscribeToNotifications() {
    const channel = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => {
          loadNotifications()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) throw error
      loadNotifications()
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }

  async function markAllRead() {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true })
      })

      if (!response.ok) throw new Error('Failed to mark all read')
      loadNotifications()
    } catch (err) {
      console.error('Error marking all read:', err)
    }
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
    if (notification.link) {
      router.push(notification.link)
    }
    setOpen(false)
  }

  function getIcon(type: string) {
    switch (type) {
      case 'announcement': return '📢'
      case 'discussion': return '💬'
      case 'qa': return '❓'
      case 'badge': return '🏆'
      case 'grade': return '📝'
      default: return '🔔'
    }
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 8,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        className="hover:bg-gray-100"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--danger)',
            color: 'white',
            fontSize: 10,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              width: 380,
              maxHeight: 500,
              background: 'var(--white)',
              borderRadius: 12,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              zIndex: 1000
            }}
          >
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: 'var(--teal)',
                    fontWeight: 500
                  }}
                >
                  Mark all read
                </button>
              )}
            </div>

            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
                  <p style={{ color: 'var(--muted)', fontSize: 14 }}>No notifications yet</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border)',
                      cursor: notification.link ? 'pointer' : 'default',
                      background: !notification.read ? 'var(--teal-soft)' : 'transparent',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                      transition: 'background 0.15s ease'
                    }}
                    className="hover:bg-gray-50"
                  >
                    <div style={{ fontSize: 20, flexShrink: 0 }}>
                      {getIcon(notification.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4
                      }}>
                        <h4 style={{
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1
                        }}>
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: 'var(--teal)',
                            flexShrink: 0
                          }} />
                        )}
                      </div>
                      <p style={{
                        fontSize: 12,
                        color: 'var(--muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: 4
                      }}>
                        {notification.content}
                      </p>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
