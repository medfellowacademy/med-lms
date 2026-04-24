'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'

interface Question {
  id: string
  title: string
  content: string
  user_id: string
  status: 'open' | 'answered' | 'closed'
  views_count: number
  votes: number
  created_at: string
  profiles: {
    full_name: string
  }
  answer_count?: number
  has_accepted_answer?: boolean
}

export default function QAPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [questions, setQuestions] = useState<Question[]>([])
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'answered' | 'closed'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'votes' | 'unanswered'>('recent')
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false)
  const [newQuestionTitle, setNewQuestionTitle] = useState('')
  const [newQuestionContent, setNewQuestionContent] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadQuestions()
    const unsubscribe = subscribeToQuestions()
    return () => unsubscribe()
  }, [courseId])

  useEffect(() => {
    filterAndSortQuestions()
  }, [questions, searchQuery, statusFilter, sortBy])

  async function loadQuestions() {
    try {
      const { data, error } = await supabase
        .from('qa_questions')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Get answer counts and accepted answer status
      const questionsWithMeta = await Promise.all((data || []).map(async (q) => {
        const { data: answers } = await supabase
          .from('qa_answers')
          .select('id, accepted_answer')
          .eq('question_id', q.id)

        return {
          ...q,
          answer_count: answers?.length || 0,
          has_accepted_answer: answers?.some(a => a.accepted_answer) || false
        }
      }))

      setQuestions(questionsWithMeta)
    } catch (err) {
      console.error('Error loading questions:', err)
    } finally {
      setLoading(false)
    }
  }

  function subscribeToQuestions() {
    const channel = supabase
      .channel('qa_questions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'qa_questions',
          filter: `course_id=eq.${courseId}`
        },
        () => {
          loadQuestions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  function filterAndSortQuestions() {
    let filtered = questions.filter(q => {
      const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          q.content.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || q.status === statusFilter
      return matchesSearch && matchesStatus
    })

    if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (sortBy === 'votes') {
      filtered.sort((a, b) => b.votes - a.votes)
    } else if (sortBy === 'unanswered') {
      filtered.sort((a, b) => {
        if ((a.answer_count || 0) === 0 && (b.answer_count || 0) > 0) return -1
        if ((a.answer_count || 0) > 0 && (b.answer_count || 0) === 0) return 1
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }

    setFilteredQuestions(filtered)
  }

  async function createQuestion() {
    if (!newQuestionTitle.trim() || !newQuestionContent.trim()) {
      alert('Please provide both title and content')
      return
    }

    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: question, error } = await supabase
        .from('qa_questions')
        .insert({
          course_id: courseId,
          title: newQuestionTitle,
          content: newQuestionContent,
          user_id: user.id,
          status: 'open'
        })
        .select()
        .single()

      if (error) throw error

      // Award XP
      await supabase.rpc('award_xp', {
        user_id_param: user.id,
        action_type_param: 'qa_question',
        xp_amount: 10,
        description_param: 'Asked a question'
      })

      setShowNewQuestionModal(false)
      setNewQuestionTitle('')
      setNewQuestionContent('')
      router.push(`/student/courses/${courseId}/qa/${question.id}`)
    } catch (err) {
      console.error('Error creating question:', err)
      alert('Failed to create question')
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

  const unansweredCount = questions.filter(q => (q.answer_count || 0) === 0).length

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
          <h1 className="page-title">Q&A</h1>
          <p className="page-subtitle">Get help from instructors and peers</p>
          {unansweredCount > 0 && (
            <div style={{ marginTop: 8 }}>
              <span className="chip chip-warning">{unansweredCount} unanswered</span>
            </div>
          )}
        </div>
        <button onClick={() => setShowNewQuestionModal(true)} className="btn btn-primary">
          + Ask Question
        </button>
      </div>

      {/* Filters */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: '1 1 300px' }}>
            <input
              type="text"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setStatusFilter('all')}
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('open')}
            className={`btn btn-sm ${statusFilter === 'open' ? 'btn-primary' : 'btn-ghost'}`}
          >
            Open
          </button>
          <button
            onClick={() => setStatusFilter('answered')}
            className={`btn btn-sm ${statusFilter === 'answered' ? 'btn-primary' : 'btn-ghost'}`}
          >
            Answered
          </button>
          <button
            onClick={() => setStatusFilter('closed')}
            className={`btn btn-sm ${statusFilter === 'closed' ? 'btn-primary' : 'btn-ghost'}`}
          >
            Closed
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={() => setSortBy('recent')}
              className={`btn btn-sm ${sortBy === 'recent' ? 'btn-secondary' : 'btn-ghost'}`}
            >
              Recent
            </button>
            <button
              onClick={() => setSortBy('votes')}
              className={`btn btn-sm ${sortBy === 'votes' ? 'btn-secondary' : 'btn-ghost'}`}
            >
              Most Voted
            </button>
            <button
              onClick={() => setSortBy('unanswered')}
              className={`btn btn-sm ${sortBy === 'unanswered' ? 'btn-secondary' : 'btn-ghost'}`}
            >
              Unanswered
            </button>
          </div>
        </div>
      </div>

      {/* Questions list */}
      {filteredQuestions.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🤔</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {searchQuery ? 'No questions found' : 'No questions yet'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {searchQuery ? 'Try a different search term' : 'Be the first to ask a question!'}
          </p>
          {!searchQuery && (
            <button onClick={() => setShowNewQuestionModal(true)} className="btn btn-primary">
              + Ask Question
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredQuestions.map((question, idx) => (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Link href={`/student/courses/${courseId}/qa/${question.id}`} style={{ textDecoration: 'none' }}>
                <div className="card card-pad card-hover" style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', gap: 16 }}>
                    {/* Vote count */}
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      minWidth: 60, flexShrink: 0
                    }}>
                      <div style={{
                        fontSize: 20, fontWeight: 700,
                        color: question.votes > 0 ? 'var(--teal)' : 'var(--muted)'
                      }}>
                        {question.votes}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>votes</div>
                      <div style={{
                        marginTop: 8, fontSize: 16, fontWeight: 600,
                        color: (question.answer_count || 0) > 0 ? 'var(--success)' : 'var(--muted)'
                      }}>
                        {question.answer_count || 0}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>answers</div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                          {question.title}
                        </h3>
                        {question.has_accepted_answer && (
                          <span className="chip chip-success">✓ Answered</span>
                        )}
                        {question.status === 'open' && (question.answer_count || 0) === 0 && (
                          <span className="chip chip-warning">Needs Answer</span>
                        )}
                        {question.status === 'closed' && (
                          <span className="chip chip-neutral">Closed</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 8 }}>
                        {question.content.length > 150 ? question.content.slice(0, 150) + '...' : question.content}
                      </p>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
                        <span>Asked by {question.profiles.full_name}</span>
                        <span>•</span>
                        <span>{formatTimeAgo(question.created_at)}</span>
                        <span>•</span>
                        <span>{question.views_count} views</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* New Question Modal */}
      {showNewQuestionModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20
          }}
          onClick={() => setShowNewQuestionModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="card card-pad"
            style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'auto' }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Ask a Question</h2>
            
            <div style={{ marginBottom: 16 }}>
              <label className="field-label" style={{ marginBottom: 8 }}>Title</label>
              <input
                type="text"
                value={newQuestionTitle}
                onChange={(e) => setNewQuestionTitle(e.target.value)}
                placeholder="What's your question?"
                className="input"
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="field-label" style={{ marginBottom: 8 }}>Details</label>
              <textarea
                value={newQuestionContent}
                onChange={(e) => setNewQuestionContent(e.target.value)}
                placeholder="Provide more context and details..."
                className="textarea"
                rows={6}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewQuestionModal(false)}
                className="btn btn-ghost"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={createQuestion}
                className="btn btn-primary"
                disabled={creating || !newQuestionTitle.trim() || !newQuestionContent.trim()}
              >
                {creating ? 'Posting...' : 'Post Question'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
