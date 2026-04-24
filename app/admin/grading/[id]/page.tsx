'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface Question {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay' | 'fill_blank'
  points: number
  order_index: number
  options?: { text: string; is_correct: boolean }[]
  sample_answer?: string
  grading_rubric?: string
}

interface Submission {
  id: string
  assessment_id: string
  user_id: string
  attempt_number: number
  submitted_at: string
  status: 'submitted' | 'graded'
  score: number | null
  max_score: number
  percentage: number | null
  feedback: string | null
  question_feedback: Record<string, any> | null
  answers: Record<string, any>
  profiles: {
    full_name: string
    email: string
  }
  assessments: {
    title: string
    type: 'quiz' | 'assignment' | 'exam'
    passing_score: number
  }
}

export default function GradeSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: submissionId } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionScores, setQuestionScores] = useState<Record<string, { points: number; feedback: string }>>({})
  const [overallFeedback, setOverallFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubmission()
  }, [submissionId])

  async function loadSubmission() {
    try {
      const { data: submissionData, error: subError } = await supabase
        .from('student_submissions')
        .select(`
          *,
          profiles(full_name, email),
          assessments(title, type, passing_score)
        `)
        .eq('id', submissionId)
        .single()

      if (subError || !submissionData) throw new Error('Submission not found')

      setSubmission(submissionData as any)
      setOverallFeedback(submissionData.feedback || '')

      // Load questions
      const { data: questionsData } = await supabase
        .from('assessment_questions')
        .select('*')
        .eq('assessment_id', submissionData.assessment_id)
        .order('order_index')

      setQuestions(questionsData || [])

      // Initialize scores from existing question_feedback or auto-graded results
      const initialScores: Record<string, { points: number; feedback: string }> = {}
      questionsData?.forEach(q => {
        const existingFeedback = submissionData.question_feedback?.[q.id]
        initialScores[q.id] = {
          points: existingFeedback?.points_earned ?? (existingFeedback?.is_correct ? q.points : 0),
          feedback: existingFeedback?.feedback || ''
        }
      })
      setQuestionScores(initialScores)

      setLoading(false)
    } catch (err) {
      console.error('Error loading submission:', err)
      setLoading(false)
    }
  }

  function updateQuestionScore(questionId: string, points: number, feedback: string) {
    setQuestionScores(prev => ({
      ...prev,
      [questionId]: { points, feedback }
    }))
  }

  async function handleSaveAndGrade() {
    if (!submission) return

    setSaving(true)
    try {
      // Calculate total score
      let totalScore = 0
      const questionFeedback: Record<string, any> = {}

      questions.forEach(q => {
        const score = questionScores[q.id]
        if (score) {
          totalScore += score.points
          questionFeedback[q.id] = {
            points_earned: score.points,
            feedback: score.feedback,
            is_correct: score.points === q.points
          }
        }
      })

      const percentage = (totalScore / submission.max_score) * 100
      const passed = percentage >= submission.assessments.passing_score

      const res = await fetch('/api/assessments/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submissionId,
          action: 'grade',
          score: totalScore,
          percentage,
          passed,
          feedback: overallFeedback,
          question_feedback: questionFeedback
        })
      })

      if (!res.ok) throw new Error('Failed to save grades')

      // Redirect back to grading list
      router.push('/admin/grading')
    } catch (err) {
      console.error('Error saving grades:', err)
      alert('Failed to save grades. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 28, maxWidth: 1000, margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 20 }} />
        <div className="card card-pad">
          <div className="skeleton" style={{ height: 80, width: '100%' }} />
        </div>
      </div>
    )
  }

  if (!submission) {
    return (
      <div style={{ padding: 28, maxWidth: 700, margin: '0 auto' }}>
        <div className="empty-state">
          <div className="emoji">❓</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Submission not found</h3>
          <Link href="/admin/grading">
            <button className="btn btn-secondary">Back to Grading</button>
          </Link>
        </div>
      </div>
    )
  }

  const totalPossible = submission.max_score
  const currentTotal = Object.values(questionScores).reduce((sum, s) => sum + s.points, 0)
  const currentPercentage = (currentTotal / totalPossible) * 100

  return (
    <div style={{ padding: 28, maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/grading">
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}>
            ← Back to Grading
          </button>
        </Link>
        <h1 className="page-title" style={{ marginBottom: 4 }}>Grade Submission</h1>
        <p className="page-subtitle">
          {submission.profiles.full_name} • {submission.assessments.title}
        </p>
      </div>

      {/* Student info */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</p>
            <p style={{ fontSize: 14, fontWeight: 600 }}>{submission.profiles.full_name}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>{submission.profiles.email}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submitted</p>
            <p style={{ fontSize: 14, fontWeight: 600 }}>
              {new Date(submission.submitted_at).toLocaleString()}
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attempt</p>
            <p style={{ fontSize: 14, fontWeight: 600 }}>{submission.attempt_number}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Score</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)' }}>
              {currentTotal} / {totalPossible}
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              {currentPercentage.toFixed(1)}% 
              {currentPercentage >= submission.assessments.passing_score ? ' (Pass)' : ' (Fail)'}
            </p>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
        {questions.map((question, idx) => {
          const userAnswer = submission.answers[question.id]
          const currentScore = questionScores[question.id] || { points: 0, feedback: '' }
          
          let correctAnswer = null
          if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
            correctAnswer = question.options?.find(o => o.is_correct)?.text
          }

          const isAutoGraded = question.question_type === 'multiple_choice' || question.question_type === 'true_false'
          const isCorrect = isAutoGraded && userAnswer === correctAnswer

          return (
            <div 
              key={question.id}
              className="card card-pad"
              style={{ border: `2px solid ${isCorrect ? 'var(--success)' : 'var(--border)'}` }}
            >
              {/* Question header */}
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 28, height: 28, background: 'var(--teal-soft)', borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, color: 'var(--teal)', flexShrink: 0
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.6, marginBottom: 4 }}>
                      {question.question_text}
                    </p>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {question.points} {question.points === 1 ? 'point' : 'points'}
                      </span>
                      {isAutoGraded && (
                        <span className={`chip ${isCorrect ? 'chip-success' : 'chip-warning'}`}>
                          {isCorrect ? 'Auto-graded: Correct' : 'Auto-graded: Incorrect'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Left: Student answer */}
                <div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Student Answer
                  </p>
                  <div style={{
                    padding: 12,
                    background: 'var(--bg)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    minHeight: 60
                  }}>
                    <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {userAnswer || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No answer provided</span>}
                    </p>
                  </div>
                </div>

                {/* Right: Reference */}
                <div>
                  {correctAnswer && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Correct Answer
                      </p>
                      <div style={{
                        padding: 12,
                        background: 'var(--success-bg)',
                        borderRadius: 8,
                        border: '1px solid #bbf7d0'
                      }}>
                        <p style={{ fontSize: 14, color: 'var(--success)', fontWeight: 500 }}>
                          {correctAnswer}
                        </p>
                      </div>
                    </div>
                  )}

                  {question.sample_answer && (
                    <div style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Sample Answer
                      </p>
                      <div style={{
                        padding: 12,
                        background: '#fef3c7',
                        borderRadius: 8,
                        border: '1px solid #fcd34d'
                      }}>
                        <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: '#78350f' }}>
                          {question.sample_answer}
                        </p>
                      </div>
                    </div>
                  )}

                  {question.grading_rubric && (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Grading Rubric
                      </p>
                      <div style={{
                        padding: 12,
                        background: 'var(--bg)',
                        borderRadius: 8,
                        border: '1px solid var(--border)'
                      }}>
                        <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {question.grading_rubric}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Grading inputs */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div style={{ flex: '0 0 120px' }}>
                    <label className="field-label" style={{ marginBottom: 6 }}>Points Earned</label>
                    <input
                      type="number"
                      min={0}
                      max={question.points}
                      step={0.5}
                      value={currentScore.points}
                      onChange={(e) => updateQuestionScore(question.id, parseFloat(e.target.value) || 0, currentScore.feedback)}
                      className="input"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="field-label" style={{ marginBottom: 6 }}>Feedback (optional)</label>
                    <input
                      type="text"
                      value={currentScore.feedback}
                      onChange={(e) => updateQuestionScore(question.id, currentScore.points, e.target.value)}
                      placeholder="Provide specific feedback for this question..."
                      className="input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Overall feedback */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <label className="field-label" style={{ marginBottom: 8 }}>Overall Feedback (optional)</label>
        <textarea
          value={overallFeedback}
          onChange={(e) => setOverallFeedback(e.target.value)}
          placeholder="Provide general comments or feedback on the entire submission..."
          className="textarea"
          rows={4}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
        <Link href="/admin/grading">
          <button className="btn btn-ghost" disabled={saving}>
            Cancel
          </button>
        </Link>
        <button
          onClick={handleSaveAndGrade}
          className="btn btn-primary btn-lg"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save & Publish Grade'}
        </button>
      </div>
    </div>
  )
}
