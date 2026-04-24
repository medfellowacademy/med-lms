'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'

interface Post {
  id: string
  thread_id: string
  user_id: string
  content: string
  parent_post_id: string | null
  likes_count: number
  created_at: string
  profiles: {
    full_name: string
    role: string
  }
  user_liked?: boolean
}

interface Thread {
  id: string
  title: string
  course_id: string
  pinned: boolean
  locked: boolean
  views_count: number
  posts_count: number
  created_at: string
  user_id: string
  profiles: {
    full_name: string
  }
}

export default function ThreadDetailPage({ params }: { params: Promise<{ id: string; threadId: string }> }) {
  const { id: courseId, threadId } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const replyInputRef = useRef<HTMLTextAreaElement>(null)

  const [thread, setThread] = useState<Thread | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadThread()
    loadPosts()
    incrementViews()
    const unsubscribe = subscribeToRealtime()
    getCurrentUser()
    return () => unsubscribe()
  }, [threadId])

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
  }

  async function loadThread() {
    try {
      const { data, error } = await supabase
        .from('discussion_threads')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('id', threadId)
        .single()

      if (error) throw error
      setThread(data)
    } catch (err) {
      console.error('Error loading thread:', err)
    }
  }

  async function loadPosts() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data: postsData, error } = await supabase
        .from('discussion_posts')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Check which posts user has liked
      if (user) {
        const { data: likesData } = await supabase
          .from('discussion_post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', postsData?.map(p => p.id) || [])

        const likedPostIds = new Set(likesData?.map(l => l.post_id))
        
        setPosts(postsData?.map(p => ({
          ...p,
          user_liked: likedPostIds.has(p.id)
        })) || [])
      } else {
        setPosts(postsData || [])
      }
    } catch (err) {
      console.error('Error loading posts:', err)
    } finally {
      setLoading(false)
    }
  }

  async function incrementViews() {
    await supabase
      .from('discussion_threads')
      .update({ views_count: (thread?.views_count || 0) + 1 })
      .eq('id', threadId)
  }

  function subscribeToRealtime() {
    const channel = supabase
      .channel('discussion_posts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'discussion_posts',
          filter: `thread_id=eq.${threadId}`
        },
        () => {
          loadPosts()
          loadThread() // Refresh post count
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function submitReply() {
    if (!replyContent.trim()) return

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('discussion_posts')
        .insert({
          thread_id: threadId,
          user_id: user.id,
          content: replyContent,
          parent_post_id: replyingTo
        })

      if (error) throw error

      // Award XP
      await supabase.rpc('award_xp', {
        user_id_param: user.id,
        action_type_param: 'forum_post',
        xp_amount: 5,
        description_param: 'Posted in discussion'
      })

      setReplyContent('')
      setReplyingTo(null)
    } catch (err) {
      console.error('Error submitting reply:', err)
      alert('Failed to submit reply')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleLike(postId: string, currentlyLiked: boolean) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (currentlyLiked) {
        await supabase
          .from('discussion_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('discussion_post_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          })
      }

      loadPosts()
    } catch (err) {
      console.error('Error toggling like:', err)
    }
  }

  async function deletePost(postId: string) {
    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      const { error } = await supabase
        .from('discussion_posts')
        .delete()
        .eq('id', postId)

      if (error) throw error
    } catch (err) {
      console.error('Error deleting post:', err)
      alert('Failed to delete post')
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

  function handleReplyTo(postId: string) {
    setReplyingTo(postId)
    replyInputRef.current?.focus()
  }

  const topLevelPosts = posts.filter(p => !p.parent_post_id)
  const repliesByParent = posts.reduce((acc, post) => {
    if (post.parent_post_id) {
      if (!acc[post.parent_post_id]) acc[post.parent_post_id] = []
      acc[post.parent_post_id].push(post)
    }
    return acc
  }, {} as Record<string, Post[]>)

  if (loading || !thread) {
    return (
      <div style={{ padding: 28 }}>
        <div className="skeleton" style={{ height: 24, width: 300, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 200, width: '100%' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <Link href={`/student/courses/${courseId}/discussions`}>
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
          ← Back to Discussions
        </button>
      </Link>

      {/* Thread info */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          {thread.pinned && <span className="chip chip-warning">Pinned</span>}
          {thread.locked && <span className="chip chip-neutral">Locked</span>}
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
          {thread.title}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          Started by {thread.profiles.full_name} • {formatTimeAgo(thread.created_at)} • {thread.views_count} views
        </div>
      </div>

      {/* Posts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {topLevelPosts.map((post, idx) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <div className="card card-pad" id={`post-${post.id}`}>
              {/* Post header */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--teal-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600, color: 'var(--teal)',
                  flexShrink: 0
                }}>
                  {post.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{post.profiles.full_name}</span>
                    {post.profiles.role === 'admin' && (
                      <span className="chip chip-success" style={{ fontSize: 10 }}>Instructor</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {formatTimeAgo(post.created_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                    {post.content}
                  </p>
                </div>
              </div>

              {/* Post actions */}
              <div style={{ 
                display: 'flex', 
                gap: 16, 
                paddingTop: 12, 
                borderTop: '1px solid var(--border)',
                marginTop: 12
              }}>
                <button
                  onClick={() => toggleLike(post.id, post.user_liked || false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 12px', borderRadius: 6,
                    background: post.user_liked ? 'var(--teal-soft)' : 'transparent',
                    border: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: 13,
                    color: post.user_liked ? 'var(--teal)' : 'var(--muted)',
                    transition: 'all 0.15s'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/>
                  </svg>
                  {post.likes_count || 0}
                </button>
                {!thread.locked && (
                  <button
                    onClick={() => handleReplyTo(post.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 12px', borderRadius: 6,
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      cursor: 'pointer', fontSize: 13,
                      color: 'var(--muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    Reply
                  </button>
                )}
                {currentUserId === post.user_id && (
                  <button
                    onClick={() => deletePost(post.id)}
                    style={{
                      padding: '4px 12px', borderRadius: 6,
                      background: 'transparent',
                      border: '1px solid var(--danger-border)',
                      cursor: 'pointer', fontSize: 13,
                      color: 'var(--danger)',
                      transition: 'all 0.15s'
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>

              {/* Nested replies */}
              {repliesByParent[post.id] && (
                <div style={{ marginTop: 16, marginLeft: 52, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {repliesByParent[post.id].map(reply => (
                    <div key={reply.id} style={{
                      padding: 12,
                      background: 'var(--bg)',
                      borderRadius: 8,
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'var(--teal-soft)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 600, color: 'var(--teal)',
                          flexShrink: 0
                        }}>
                          {reply.profiles.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{reply.profiles.full_name}</span>
                            {reply.profiles.role === 'admin' && (
                              <span className="chip chip-success" style={{ fontSize: 9 }}>Instructor</span>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                              {formatTimeAgo(reply.created_at)}
                            </span>
                          </div>
                          <p style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {reply.content}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginLeft: 42 }}>
                        <button
                          onClick={() => toggleLike(reply.id, reply.user_liked || false)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 4,
                            background: reply.user_liked ? 'var(--teal-soft)' : 'transparent',
                            border: '1px solid var(--border)',
                            cursor: 'pointer', fontSize: 11,
                            color: reply.user_liked ? 'var(--teal)' : 'var(--muted)'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/>
                          </svg>
                          {reply.likes_count || 0}
                        </button>
                        {currentUserId === reply.user_id && (
                          <button
                            onClick={() => deletePost(reply.id)}
                            style={{
                              padding: '2px 8px', borderRadius: 4,
                              background: 'transparent',
                              border: '1px solid var(--danger-border)',
                              cursor: 'pointer', fontSize: 11,
                              color: 'var(--danger)'
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Reply form */}
      {!thread.locked ? (
        <div className="card card-pad">
          {replyingTo && (
            <div style={{
              padding: 8, background: '#fef3c7', borderRadius: 6,
              marginBottom: 12, display: 'flex', justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: 12, color: '#92400e' }}>
                Replying to a comment
              </span>
              <button
                onClick={() => setReplyingTo(null)}
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', color: '#92400e', fontSize: 12
                }}
              >
                Cancel
              </button>
            </div>
          )}
          <textarea
            ref={replyInputRef}
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply..."
            className="textarea"
            rows={4}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              onClick={submitReply}
              className="btn btn-primary"
              disabled={submitting || !replyContent.trim()}
            >
              {submitting ? 'Posting...' : 'Post Reply'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          padding: 16, background: '#fee2e2', border: '1px solid #fecaca',
          borderRadius: 8, textAlign: 'center'
        }}>
          <p style={{ fontSize: 13, color: '#991b1b' }}>
            🔒 This thread is locked. No new replies can be added.
          </p>
        </div>
      )}
    </div>
  )
}
