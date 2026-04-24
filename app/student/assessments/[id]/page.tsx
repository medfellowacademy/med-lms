'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase'

interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank'
  points: number
  order_index: number
  options?: { text: string; is_correct: boolean }[]
  explanation?: string
}

interface Assessment {
  id: string
  title: string
  description: string
  type: 'quiz' | 'assignment' | 'exam'
  time_limit_minutes: number | null
  passing_score: number
  max_attempts: number
  show_correct_answers: boolean
  shuffle_questions: boolean
  due_date: string | null
}

interface Submission {
  id: string
  attempt_number: number
  started_at: string
  status: 'in_progress' | 'submitted' | 'graded'
}

export default function TakeAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: assessmentId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [canTake, setCanTake] = useState(true)
  const [error, setError] = useState('')
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)
  const [viewMode, setViewMode] = useState<'one-per-page' | 'all-at-once'>('one-per-page')

  // Load assessment and check if can take
  useEffect(() => {
    loadAssessment()
  }, [assessmentId])

  async function loadAssessment() {
    try {
      // Get assessment details
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', assessmentId)
        .single()

      if (assessmentError || !assessmentData) {
        setError('Assessment not found')
        setLoading(false)
        return
      }

      setAssessment(assessmentData)

      // Check if can take
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: canTakeData } = await supabase.rpc('can_take_assessment', {
        assessment_id_param: assessmentId,
        user_id_param: user.id
      })

      if (!canTakeData) {
        setCanTake(false)
        setError('You have reached the maximum number of attempts or this assessment is not available.')
        setLoading(false)
        return
      }

      // Check for existing in-progress submission
      const { data: existingSubmission } = await supabase
        .from('student_submissions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('user_id', user.id)
        .eq('status', 'in_progress')
        .single()

      if (existingSubmission) {
        setSubmission(existingSubmission)
        setAnswers(existingSubmission.answers || {})
        
        // Calculate time remaining if timed
        if (assessmentData.time_limit_minutes) {
          const startedAt = new Date(existingSubmission.started_at).getTime()
          const elapsed = (Date.now() - startedAt) / 1000
          const limit = assessmentData.time_limit_minutes * 60
          const remaining = limit - elapsed
          setTimeRemaining(remaining > 0 ? remaining : 0)
        }
      }

      // Get questions
      const { data: questionsData } = await supabase
        .from('assessment_questions')
        .select('*')
        .eq('assessment_id', assessmentId)
        .order('order_index')

      const loadedQuestions = questionsData || []
      
      // Shuffle if needed
      if (assessmentData.shuffle_questions && !existingSubmission) {
        loadedQuestions.sort(() => Math.random() - 0.5)
      }

      setQuestions(loadedQuestions)
      setLoading(false)
    } catch (err) {
      console.error('Error loading assessment:', err)
      setError('Failed to load assessment')
      setLoading(false)
    }
  }

  // Start assessment (create submission)
  async function startAssessment() {
    try {
      const res = await fetch('/api/assessments/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_id: assessmentId })
      })

      if (!res.ok) throw new Error('Failed to start assessment')

      const { submission: newSubmission } = await res.json()
      setSubmission(newSubmission)

      // Start timer if timed
      if (assessment?.time_limit_minutes) {
        setTimeRemaining(assessment.time_limit_minutes * 60)
      }
    } catch (err) {
      console.error('Error starting assessment:', err)
      setError('Failed to start assessment')
    }
  }

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          // Time's up! Auto-submit
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timeRemaining])

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!submission || submission.status !== 'in_progress') return

    const interval = setInterval(() => {
      saveProgress()
    }, 30000)

    return () => clearInterval(interval)
  }, [submission, answers])

  async function saveProgress() {
    if (!submission) return

    try {
      await fetch('/api/assessments/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submission.id,
          answers
        })
      })
    } catch (err) {
      console.error('Failed to save progress:', err)
    }
  }

  // Handle answer change
  function handleAnswerChange(questionId: string, answer: any) {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  // Submit assessment
  async function handleSubmit() {
    if (!submission) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/assessments/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submission.id,
          action: 'submit',
          answers,
          time_spent_seconds: assessment?.time_limit_minutes 
            ? (assessment.time_limit_minutes * 60 - (timeRemaining || 0))
            : Math.floor((Date.now() - new Date(submission.started_at).getTime()) / 1000)
        })
      })

      if (!res.ok) throw new Error('Failed to submit')

      const { submission: updatedSubmission } = await res.json()

      // Redirect to results page
      router.push(`/student/assessments/${assessmentId}/results?submission=${updatedSubmission.id}`)
    } catch (err) {
      console.error('Error submitting:', err)
      setError('Failed to submit assessment')
    } finally {
      setSubmitting(false)
    }
  }

  // Format time
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
        <div className="card card-pad">
          <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 16, width: '80%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, width: '70%' }} />
        </div>
      </div>
    )
  }

  // Error or cannot take
  if (error || !canTake || !assessment) {
    return (
      <div style={{ padding: 28, maxWidth: 700, margin: '0 auto' }}>
        <div className="empty-state">
          <div className="emoji">⚠️</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{error || 'Cannot take assessment'}</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            {error || 'You may have reached the maximum number of attempts or this assessment is not available.'}
          </p>
          <button onClick={() => router.back()} className="btn btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Not started yet - show intro
  if (!submission) {
    return (
      <div style={{ padding: 28, maxWidth: 700, margin: '0 auto' }}>
        <div className="card card-pad">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 64, height: 64, background: 'var(--teal-soft)', borderRadius: 14,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16
            }}>
              <svg width="28" height="28" viewBox="0 0 20 20" fill="var(--teal)">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/>
              </svg>
            </div>
            <h1 className="page-title" style={{ marginBottom: 8 }}>{assessment.title}</h1>
            {assessment.description && (
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>{assessment.description}</p>
            )}
          </div>

          <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Questions</p>
                <p style={{ fontSize: 18, fontWeight: 600 }}>{questions.length}</p>
              </div>
              {assessment.time_limit_minutes && (
                <div>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Limit</p>
                  <p style={{ fontSize: 18, fontWeight: 600 }}>{assessment.time_limit_minutes} min</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Passing Score</p>
                <p style={{ fontSize: 18, fontWeight: 600 }}>{assessment.passing_score}%</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attempts</p>
                <p style={{ fontSize: 18, fontWeight: 600 }}>{assessment.max_attempts === 1 ? '1 only' : `Up to ${assessment.max_attempts}`}</p>
              </div>
            </div>
          </div>

          {assessment.due_date && (
            <div style={{ padding: 12, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: '#92400e' }}>
                <strong>Due:</strong> {new Date(assessment.due_date).toLocaleString()}
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => router.back()} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={startAssessment} className="btn btn-primary btn-lg">
              Start Assessment
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Taking assessment
  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((Object.keys(answers).length / questions.length) * 100).toFixed(0)

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>
      {/* Header with timer */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>{assessment.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Progress: {Object.keys(answers).length} / {questions.length} answered ({progress}%)
          </p>
        </div>
        {timeRemaining !== null && (
          <div style={{
            padding: '10px 16px', background: timeRemaining < 300 ? '#fef2f2' : 'var(--teal-soft)',
            borderRadius: 8, border: `1px solid ${timeRemaining < 300 ? '#fecaca' : '#9FE1CB'}`
          }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>Time Remaining</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: timeRemaining < 300 ? '#dc2626' : 'var(--teal)' }}>
              {formatTime(timeRemaining)}
            </p>
          </div>
        )}
      </div>

      {/* View mode toggle */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={() => setViewMode('one-per-page')}
          className={`btn btn-sm ${viewMode === 'one-per-page' ? 'btn-primary' : 'btn-ghost'}`}
        >
          One per page
        </button>
        <button
          onClick={() => setViewMode('all-at-once')}
          className={`btn btn-sm ${viewMode === 'all-at-once' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Show all
        </button>
      </div>

      {/* Questions */}
      {viewMode === 'one-per-page' ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <QuestionCard
              question={currentQuestion}
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={questions.length}
              answer={answers[currentQuestion.id]}
              onChange={(answer) => handleAnswerChange(currentQuestion.id, answer)}
            />

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button
                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="btn btn-secondary"
              >
                ← Previous
              </button>
              {currentQuestionIndex === questions.length - 1 ? (
                <button
                  onClick={() => setShowConfirmSubmit(true)}
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Assessment'}
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  className="btn btn-primary"
                >
                  Next →
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              questionNumber={index + 1}
              totalQuestions={questions.length}
              answer={answers[question.id]}
              onChange={(answer) => handleAnswerChange(question.id, answer)}
            />
          ))}

          <button
            onClick={() => setShowConfirmSubmit(true)}
            className="btn btn-primary btn-lg"
            disabled={submitting}
            style={{ marginTop: 20 }}
          >
            {submitting ? 'Submitting...' : 'Submit Assessment'}
          </button>
        </div>
      )}

      {/* Confirm submit modal */}
      <AnimatePresence>
        {showConfirmSubmit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}
            onClick={() => setShowConfirmSubmit(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card card-pad"
              style={{ maxWidth: 400, width: '90%' }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Submit Assessment?</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
                You have answered {Object.keys(answers).length} out of {questions.length} questions.
                {Object.keys(answers).length < questions.length && ' Unanswered questions will be marked as incorrect.'}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowConfirmSubmit(false)} className="btn btn-ghost" disabled={submitting}>
                  Keep Working
                </button>
                <button onClick={handleSubmit} className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Yes, Submit'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Question Card Component
function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  answer,
  onChange
}: {
  question: Question
  questionNumber: number
  totalQuestions: number
  answer: any
  onChange: (answer: any) => void
}) {
  return (
    <div className="card card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1 }}>
          <div style={{
            width: 32, height: 32, background: 'var(--teal-soft)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 600, color: 'var(--teal)', flexShrink: 0
          }}>
            {questionNumber}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6, marginBottom: 4 }}>
              {question.question_text}
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              {question.points} {question.points === 1 ? 'point' : 'points'}
            </p>
          </div>
        </div>
      </div>

      {/* Multiple Choice */}
      {question.question_type === 'multiple_choice' && question.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {question.options.map((option, idx) => (
            <label
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, border: '1px solid var(--border)', borderRadius: 8,
                cursor: 'pointer', transition: 'all 0.15s ease',
                background: answer === option.text ? 'var(--teal-soft)' : 'var(--white)'
              }}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={answer === option.text}
                onChange={() => onChange(option.text)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14 }}>{option.text}</span>
            </label>
          ))}
        </div>
      )}

      {/* True/False */}
      {question.question_type === 'true_false' && (
        <div style={{ display: 'flex', gap: 10 }}>
          {['True', 'False'].map(option => (
            <label
              key={option}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 12, border: '1px solid var(--border)', borderRadius: 8,
                cursor: 'pointer', transition: 'all 0.15s ease',
                background: answer === option ? 'var(--teal-soft)' : 'var(--white)'
              }}
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={answer === option}
                onChange={() => onChange(option)}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 14, fontWeight: 500 }}>{option}</span>
            </label>
          ))}
        </div>
      )}

      {/* Short Answer */}
      {question.question_type === 'short_answer' && (
        <input
          type="text"
          value={answer || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your answer..."
          className="input"
        />
      )}

      {/* Essay */}
      {question.question_type === 'essay' && (
        <textarea
          value={answer || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your essay answer..."
          className="textarea"
          rows={6}
        />
      )}

      {/* Fill in the Blank */}
      {question.question_type === 'fill_blank' && (
        <textarea
          value={answer || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Fill in the blank..."
          className="textarea"
          rows={3}
        />
      )}
    </div>
  )
}
