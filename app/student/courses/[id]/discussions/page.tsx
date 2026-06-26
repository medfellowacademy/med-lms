'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'

interface Thread {
  id: string
  title: string
  user_id: string
  pinned: boolean
  locked: boolean
  views_count: number
  posts_count: number
  created_at: string
  updated_at: string
  profiles: {
    full_name: string
  }
}

export default function DiscussionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [threads, setThreads] = useState<Thread[]>([])
  const [filteredThreads, setFilteredThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent')
  const [showNewThreadModal, setShowNewThreadModal] = useState(false)
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const [newThreadContent, setNewThreadContent] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadThreads()
    const unsubscribe = subscribeToThreads()
    return () => unsubscribe()
  }, [courseId])

  useEffect(() => {
    filterAndSortThreads()
  }, [threads, searchQuery, sortBy])

  async function loadThreads() {
    try {
      const { data, error } = await supabase
        .from('discussion_threads')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('course_id', courseId)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false })

      if (error) throw error
      setThreads(data || [])
    } catch (err) {
      console.error('Error loading threads:', err)
    } finally {
      setLoading(false)
    }
  }

  function subscribeToThreads() {
    const channel = supabase
      .channel('discussion_threads_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'discussion_threads',
          filter: `course_id=eq.${courseId}`
        },
        () => {
          loadThreads()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  function filterAndSortThreads() {
    let filtered = threads.filter(t =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (sortBy === 'recent') {
      filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      })
    } else {
      filtered.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return b.posts_count - a.posts_count
      })
    }

    setFilteredThreads(filtered)
  }

  async function createThread() {
    if (!newThreadTitle.trim() || !newThreadContent.trim()) {
      alert('Please provide both title and content')
      return
    }

    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create thread
      const { data: thread, error: threadError } = await supabase
        .from('discussion_threads')
        .insert({
          course_id: courseId,
          title: newThreadTitle,
          user_id: user.id
        })
        .select()
        .single()

      if (threadError) throw threadError

      // Create first post
      const { error: postError } = await supabase
        .from('discussion_posts')
        .insert({
          thread_id: thread.id,
          user_id: user.id,
          content: newThreadContent
        })

      if (postError) throw postError

      // Award XP
      await supabase.rpc('award_xp', {
        user_id_param: user.id,
        action_type_param: 'forum_post',
        xp_amount: 5,
        description_param: 'Created discussion thread'
      })

      setShowNewThreadModal(false)
      setNewThreadTitle('')
      setNewThreadContent('')
      router.push(`/student/courses/${courseId}/discussions/${thread.id}`)
    } catch (err) {
      console.error('Error creating thread:', err)
      alert('Failed to create thread')
    } finally {
      setCreating(false)
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    return `${months}mo ago`
  }

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 100, width: '100%' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Link href={`/student/courses/${courseId}`}>
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}>
              ← Back to Course
            </button>
          </Link>
          <h1 className="page-title">Discussions</h1>
          <p className="page-subtitle">Ask questions and share insights with your classmates</p>
        </div>
        <button onClick={() => setShowNewThreadModal(true)} className="btn btn-primary">
          + New Thread
        </button>
      </div>

      {/* Filters */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 300px' }}>
            <input
              type="text"
              placeholder="Search discussions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setSortBy('recent')}
              className={`btn btn-sm ${sortBy === 'recent' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Recent
            </button>
            <button
              onClick={() => setSortBy('popular')}
              className={`btn btn-sm ${sortBy === 'popular' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Popular
            </button>
          </div>
        </div>
      </div>

      {/* Threads list */}
      {filteredThreads.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">💬</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {searchQuery ? 'No threads found' : 'No discussions yet'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {searchQuery ? 'Try a different search term' : 'Be the first to start a discussion!'}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowNewThreadModal(true)} className="btn btn-primary">
              + New Thread
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredThreads.map((thread, idx) => (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Link href={`/student/courses/${courseId}/discussions/${thread.id}`} style={{ textDecoration: 'none' }}>
                <div className="card card-pad card-hover" style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {/* Icon */}
                    <div style={{
                      width: 44, height: 44,
                      background: thread.pinned ? '#fef3c7' : 'var(--teal-soft)',
                      borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill={thread.pinned ? '#f59e0b' : 'var(--teal)'}>
                        {thread.pinned ? (
                          <path d="M10 2a.75.75 0 01.75.75v3.5l1.47 1.47a.75.75 0 01-.53 1.28h-3.38a.75.75 0 01-.53-1.28l1.47-1.47V2.75A.75.75 0 0110 2zM6 9.5v1a1.5 1.5 0 001.5 1.5h.75v5.25a.75.75 0 001.5 0V12h.5v5.25a.75.75 0 001.5 0V12h.75A1.5 1.5 0 0014 10.5v-1H6z"/>
                        ) : (
                          <>
                            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z"/>
                            <path d="M15 7v2a4 4 0 01-4 4v2a6 6 0 006-6V7h-2z"/>
                          </>
                        )}
                      </svg>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                          {thread.title}
                        </h3>
                        {thread.pinned && <span className="chip chip-warning">Pinned</span>}
                        {thread.locked && <span className="chip chip-neutral">Locked</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
                        <span>By {thread.profiles.full_name}</span>
                        <span>•</span>
                        <span>{thread.posts_count} {thread.posts_count === 1 ? 'reply' : 'replies'}</span>
                        <span>•</span>
                        <span>{thread.views_count} views</span>
                        <span>•</span>
                        <span>{formatTimeAgo(thread.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* New Thread Modal */}
      {showNewThreadModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20
          }}
          onClick={() => setShowNewThreadModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="card card-pad"
            style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'auto' }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Start a New Discussion</h2>
            
            <div style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ marginBottom: 8 }}>Title</label>
              <input
                type="text"
                value={newThreadTitle}
                onChange={(e) => setNewThreadTitle(e.target.value)}
                placeholder="What's your question or topic?"
                className="input"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="field-label" style={{ marginBottom: 8 }}>Content</label>
              <textarea
                value={newThreadContent}
                onChange={(e) => setNewThreadContent(e.target.value)}
                placeholder="Provide details or context..."
                className="textarea"
                rows={6}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewThreadModal(false)}
                className="btn btn-ghost"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={createThread}
                className="btn btn-primary"
                disabled={creating || !newThreadTitle.trim() || !newThreadContent.trim()}
              >
                {creating ? 'Creating...' : 'Create Thread'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
