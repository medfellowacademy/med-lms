'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

interface StudyGroup {
  id: string
  name: string
  description: string | null
  course_id: string
  owner_id: string
  max_members: number
  private: boolean
  created_at: string
  courses: {
    title: string
  }
  profiles: {
    full_name: string
  }
}

interface Member {
  id: string
  user_id: string
  role: 'owner' | 'moderator' | 'member'
  joined_at: string
  profiles: {
    full_name: string
    role: string
  }
}

interface Message {
  id: string
  user_id: string
  message: string
  created_at: string
  profiles: {
    full_name: string
    role: string
  }
}

export default function StudyGroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)

  const [group, setGroup] = useState<StudyGroup | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [messageContent, setMessageContent] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)

  useEffect(() => {
    loadGroup()
    loadMembers()
    loadMessages()
    getCurrentUser()
    const unsubscribe = subscribeToMessages()
    return () => unsubscribe()
  }, [groupId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      
      // Check if user is member
      const { data: membership } = await supabase
        .from('study_group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single()

      setIsMember(!!membership)
      setCurrentUserRole(membership?.role || null)
    }
  }

  async function loadGroup() {
    try {
      const { data, error } = await supabase
        .from('study_groups')
        .select(`
          *,
          courses(title),
          profiles(full_name)
        `)
        .eq('id', groupId)
        .single()

      if (error) throw error
      setGroup(data)
    } catch (err) {
      console.error('Error loading group:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadMembers() {
    try {
      const { data, error } = await supabase
        .from('study_group_members')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('group_id', groupId)
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true })

      if (error) throw error
      setMembers(data || [])
    } catch (err) {
      console.error('Error loading members:', err)
    }
  }

  async function loadMessages() {
    try {
      const { data, error } = await supabase
        .from('study_group_messages')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error
      setMessages(data || [])
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }

  function subscribeToMessages() {
    const channel = supabase
      .channel('study_group_messages_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'study_group_messages',
          filter: `group_id=eq.${groupId}`
        },
        (payload: any) => {
          // Fetch the complete message with profile
          supabase
            .from('study_group_messages')
            .select(`
              *,
              profiles(full_name, role)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setMessages(prev => [...prev, data])
              }
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function sendMessage() {
    if (!messageContent.trim()) return

    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('study_group_messages')
        .insert({
          group_id: groupId,
          user_id: user.id,
          message: messageContent
        })

      if (error) throw error

      setMessageContent('')
      messageInputRef.current?.focus()
    } catch (err) {
      console.error('Error sending message:', err)
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  async function leaveGroup() {
    if (!confirm('Are you sure you want to leave this group?')) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id)

      if (error) throw error

      router.push('/student/study-groups')
    } catch (err) {
      console.error('Error leaving group:', err)
      alert('Failed to leave group')
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this member from the group?')) return

    try {
      const { error } = await supabase
        .from('study_group_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error

      loadMembers()
    } catch (err) {
      console.error('Error removing member:', err)
      alert('Failed to remove member')
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString)
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'moderator'

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <div className="skeleton" style={{ height: 24, width: 300, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 400, width: '100%' }} />
      </div>
    )
  }

  if (!group) {
    return (
      <div style={{ padding: 28 }}>
        <div className="empty-state">
          <div className="emoji">❌</div>
          <h3>Group not found</h3>
          <Link href="/student/study-groups"><button className="btn btn-primary">Back to Groups</button></Link>
        </div>
      </div>
    )
  }

  if (!isMember) {
    return (
      <div style={{ padding: 28 }}>
        <div className="empty-state">
          <div className="emoji">🔒</div>
          <h3>You're not a member of this group</h3>
          <p>Join the group to access the chat and resources</p>
          <Link href="/student/study-groups"><button className="btn btn-primary">Back to Groups</button></Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 72px)' }}>
      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', background: 'var(--white)',
          borderBottom: '1px solid var(--border)', flexShrink: 0
        }}>
          <Link href="/student/study-groups">
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}>
              ← Back to Groups
            </button>
          </Link>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{group.name}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {group.courses.title} • {members.length} members
          </p>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: 24,
          background: '#f9fafb'
        }}>
          {messages.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 60 }}>
              <div className="emoji">💬</div>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((message, idx) => {
                const prevMessage = messages[idx - 1]
                const showDate = !prevMessage ||
                  new Date(message.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString()
                const isOwn = message.user_id === currentUserId

                return (
                  <div key={message.id}>
                    {showDate && (
                      <div style={{
                        textAlign: 'center', fontSize: 12, color: 'var(--muted)',
                        margin: '16px 0', fontWeight: 500
                      }}>
                        {formatDate(message.created_at)}
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{
                        maxWidth: '70%',
                        background: isOwn ? 'var(--teal)' : 'var(--white)',
                        color: isOwn ? 'white' : 'var(--text)',
                        padding: '10px 14px',
                        borderRadius: 12,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}>
                        {!isOwn && (
                          <div style={{
                            fontSize: 12, fontWeight: 600, marginBottom: 4,
                            display: 'flex', alignItems: 'center', gap: 6
                          }}>
                            {message.profiles.full_name}
                            {message.profiles.role === 'admin' && (
                              <span className="chip chip-success" style={{ fontSize: 9 }}>Instructor</span>
                            )}
                          </div>
                        )}
                        <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                          {message.message}
                        </p>
                        <div style={{
                          fontSize: 11,
                          marginTop: 4,
                          opacity: 0.7,
                          textAlign: 'right'
                        }}>
                          {formatTime(message.created_at)}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message input */}
        <div style={{
          padding: 16, background: 'var(--white)',
          borderTop: '1px solid var(--border)', flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              ref={messageInputRef}
              type="text"
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="input"
              style={{ flex: 1 }}
            />
            <button
              onClick={sendMessage}
              className="btn btn-primary"
              disabled={sending || !messageContent.trim()}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar - Members */}
      <div style={{
        width: 280, background: 'var(--white)',
        borderLeft: '1px solid var(--border)',
        overflowY: 'auto', flexShrink: 0
      }}>
        <div style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Members ({members.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {members.map(member => (
              <div key={member.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: 8, borderRadius: 8,
                background: member.user_id === currentUserId ? 'var(--teal-soft)' : 'transparent'
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--teal-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, color: 'var(--teal)',
                  flexShrink: 0
                }}>
                  {member.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.profiles.full_name}
                    {member.user_id === currentUserId && <span style={{ color: 'var(--muted)' }}> (You)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {member.role === 'owner' ? '👑 Owner' : member.role === 'moderator' ? '⭐ Moderator' : 'Member'}
                  </div>
                </div>
                {canManageMembers && member.role !== 'owner' && member.user_id !== currentUserId && (
                  <button
                    onClick={() => removeMember(member.id)}
                    style={{
                      background: 'transparent', border: 'none',
                      cursor: 'pointer', color: 'var(--danger)',
                      fontSize: 12, padding: 4
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Group actions */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            {group.description && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  About
                </h4>
                <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)' }}>
                  {group.description}
                </p>
              </div>
            )}
            {currentUserRole !== 'owner' && (
              <button
                onClick={leaveGroup}
                className="btn btn-danger-ghost"
                style={{ width: '100%' }}
              >
                Leave Group
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
