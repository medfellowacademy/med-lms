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
  course_id: string
  profiles: {
    full_name: string
    role: string
  }
}

interface Answer {
  id: string
  question_id: string
  user_id: string
  content: string
  is_instructor_answer: boolean
  accepted_answer: boolean
  votes: number
  created_at: string
  profiles: {
    full_name: string
    role: string
  }
}

export default function QuestionDetailPage({ params }: { params: Promise<{ id: string; questionId: string }> }) {
  const { id: courseId, questionId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [question, setQuestion] = useState<Question | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [loading, setLoading] = useState(true)
  const [answerContent, setAnswerContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [userVotes, setUserVotes] = useState<Record<string, number>>({})

  useEffect(() => {
    loadQuestion()
    loadAnswers()
    incrementViews()
    getCurrentUser()
    loadUserVotes()
    const unsubscribe = subscribeToRealtime()
    return () => unsubscribe()
  }, [questionId])

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setCurrentUserRole(profile?.role || null)
    }
  }

  async function loadQuestion() {
    try {
      const { data, error } = await supabase
        .from('qa_questions')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('id', questionId)
        .single()

      if (error) throw error
      setQuestion(data)
    } catch (err) {
      console.error('Error loading question:', err)
    }
  }

  async function loadAnswers() {
    try {
      const { data, error } = await supabase
        .from('qa_answers')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('question_id', questionId)
        .order('accepted_answer', { ascending: false })
        .order('votes', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      setAnswers(data || [])
    } catch (err) {
      console.error('Error loading answers:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadUserVotes() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('qa_votes')
        .select('votable_id, vote_type')
        .eq('user_id', user.id)

      if (error) throw error

      const votesMap: Record<string, number> = {}
      data?.forEach(v => {
        votesMap[v.votable_id] = v.vote_type
      })
      setUserVotes(votesMap)
    } catch (err) {
      console.error('Error loading user votes:', err)
    }
  }

  async function incrementViews() {
    await supabase
      .from('qa_questions')
      .update({ views_count: (question?.views_count || 0) + 1 })
      .eq('id', questionId)
  }

  function subscribeToRealtime() {
    const channel = supabase
      .channel('qa_answers_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'qa_answers',
          filter: `question_id=eq.${questionId}`
        },
        () => {
          loadAnswers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function submitAnswer() {
    if (!answerContent.trim()) return

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const isInstructor = currentUserRole === 'admin'

      const { error } = await supabase
        .from('qa_answers')
        .insert({
          question_id: questionId,
          user_id: user.id,
          content: answerContent,
          is_instructor_answer: isInstructor
        })

      if (error) throw error

      // Update question status if instructor answered
      if (isInstructor && question?.status === 'open') {
        await supabase
          .from('qa_questions')
          .update({ status: 'answered' })
          .eq('id', questionId)
      }

      // Award XP
      await supabase.rpc('award_xp', {
        user_id_param: user.id,
        action_type_param: 'qa_answer',
        xp_amount: 15,
        description_param: 'Answered a question'
      })

      setAnswerContent('')
      loadQuestion()
    } catch (err) {
      console.error('Error submitting answer:', err)
      alert('Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  async function vote(type: 'question' | 'answer', id: string, voteType: number) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const currentVote = userVotes[id]

      // If clicking same vote, remove it
      if (currentVote === voteType) {
        await supabase
          .from('qa_votes')
          .delete()
          .eq('votable_type', type)
          .eq('votable_id', id)
          .eq('user_id', user.id)
      } else {
        // Insert or update vote
        await supabase
          .from('qa_votes')
          .upsert({
            votable_type: type,
            votable_id: id,
            user_id: user.id,
            vote_type: voteType
          }, {
            onConflict: 'votable_type,votable_id,user_id'
          })
      }

      loadQuestion()
      loadAnswers()
      loadUserVotes()
    } catch (err) {
      console.error('Error voting:', err)
    }
  }

  async function acceptAnswer(answerId: string) {
    if (currentUserRole !== 'admin') return

    try {
      // Unaccept all answers first
      await supabase
        .from('qa_answers')
        .update({ accepted_answer: false })
        .eq('question_id', questionId)

      // Accept this answer
      await supabase
        .from('qa_answers')
        .update({ accepted_answer: true })
        .eq('id', answerId)

      // Update question status
      await supabase
        .from('qa_questions')
        .update({ status: 'answered' })
        .eq('id', questionId)

      loadAnswers()
      loadQuestion()
    } catch (err) {
      console.error('Error accepting answer:', err)
    }
  }

  async function deleteAnswer(answerId: string) {
    if (!confirm('Are you sure you want to delete this answer?')) return

    try {
      await supabase
        .from('qa_answers')
        .delete()
        .eq('id', answerId)
    } catch (err) {
      console.error('Error deleting answer:', err)
      alert('Failed to delete answer')
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

  if (loading || !question) {
    return (
      <div style={{ padding: 28 }}>
        <div className="skeleton" style={{ height: 24, width: 300, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 200, width: '100%' }} />
      </div>
    )
  }

  const questionVote = userVotes[question.id]

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <Link href={`/student/courses/${courseId}/qa`}>
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
          ← Back to Q&A
        </button>
      </Link>

      {/* Question */}
      <div className="card card-pad" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Vote buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => vote('question', question.id, 1)}
              style={{
                width: 36, height: 36, borderRadius: 6,
                background: questionVote === 1 ? 'var(--teal-soft)' : 'transparent',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: questionVote === 1 ? 'var(--teal)' : 'var(--muted)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>
            <div style={{ fontSize: 20, fontWeight: 700, color: question.votes > 0 ? 'var(--teal)' : question.votes < 0 ? 'var(--danger)' : 'var(--muted)' }}>
              {question.votes}
            </div>
            <button
              onClick={() => vote('question', question.id, -1)}
              style={{
                width: 36, height: 36, borderRadius: 6,
                background: questionVote === -1 ? '#fee2e2' : 'transparent',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: questionVote === -1 ? 'var(--danger)' : 'var(--muted)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {question.status === 'answered' && (
                <span className="chip chip-success">Answered</span>
              )}
              {question.status === 'open' && (
                <span className="chip chip-warning">Open</span>
              )}
              {question.status === 'closed' && (
                <span className="chip chip-neutral">Closed</span>
              )}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>
              {question.title}
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text)', marginBottom: 16 }}>
              {question.content}
            </p>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Asked by {question.profiles.full_name}
              {question.profiles.role === 'admin' && <span className="chip chip-success" style={{ marginLeft: 8, fontSize: 10 }}>Instructor</span>}
              {' • '}{formatTimeAgo(question.created_at)} • {question.views_count} views
            </div>
          </div>
        </div>
      </div>

      {/* Answers */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
          {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
        </h2>

        {answers.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="emoji">💡</div>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              No answers yet. Be the first to help!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {answers.map((answer, idx) => {
              const answerVote = userVotes[answer.id]
              return (
                <motion.div
                  key={answer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <div className="card card-pad" style={{
                    border: answer.accepted_answer ? '2px solid var(--success)' : '1px solid var(--border)',
                    background: answer.accepted_answer ? '#f0fdf4' : 'var(--white)'
                  }}>
                    {answer.accepted_answer && (
                      <div style={{
                        marginBottom: 12, padding: '6px 12px',
                        background: 'var(--success)', color: 'white',
                        borderRadius: 6, fontSize: 12, fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 6
                      }}>
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Accepted Answer
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16 }}>
                      {/* Vote buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={() => vote('answer', answer.id, 1)}
                          style={{
                            width: 32, height: 32, borderRadius: 6,
                            background: answerVote === 1 ? 'var(--teal-soft)' : 'transparent',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: answerVote === 1 ? 'var(--teal)' : 'var(--muted)'
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <div style={{ fontSize: 16, fontWeight: 600, color: answer.votes > 0 ? 'var(--teal)' : answer.votes < 0 ? 'var(--danger)' : 'var(--muted)' }}>
                          {answer.votes}
                        </div>
                        <button
                          onClick={() => vote('answer', answer.id, -1)}
                          style={{
                            width: 32, height: 32, borderRadius: 6,
                            background: answerVote === -1 ? '#fee2e2' : 'transparent',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: answerVote === -1 ? 'var(--danger)' : 'var(--muted)'
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{answer.profiles.full_name}</span>
                          {answer.profiles.role === 'admin' && (
                            <span className="chip chip-success" style={{ fontSize: 10 }}>Instructor</span>
                          )}
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {formatTimeAgo(answer.created_at)}
                          </span>
                        </div>
                        <p style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {answer.content}
                        </p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                          {currentUserRole === 'admin' && !answer.accepted_answer && (
                            <button
                              onClick={() => acceptAnswer(answer.id)}
                              className="btn btn-sm"
                              style={{ background: 'var(--success)', color: 'white', border: 'none' }}
                            >
                              ✓ Accept Answer
                            </button>
                          )}
                          {currentUserId === answer.user_id && (
                            <button
                              onClick={() => deleteAnswer(answer.id)}
                              className="btn btn-sm btn-danger-ghost"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Answer form */}
      <div className="card card-pad">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Your Answer</h3>
        <textarea
          value={answerContent}
          onChange={(e) => setAnswerContent(e.target.value)}
          placeholder="Share your knowledge..."
          className="textarea"
          rows={5}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button
            onClick={submitAnswer}
            className="btn btn-primary"
            disabled={submitting || !answerContent.trim()}
          >
            {submitting ? 'Posting...' : 'Post Answer'}
          </button>
        </div>
      </div>
    </div>
  )
}
