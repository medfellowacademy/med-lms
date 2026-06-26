'use client'

import { use, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface Question {
  id: string
  question_text: string
  question_type: string
  points: number
  options?: { text: string; is_correct: boolean }[]
  explanation?: string
}

interface Submission {
  id: string
  assessment_id: string
  attempt_number: number
  score: number
  max_score: number
  percentage: number
  passed: boolean
  status: 'in_progress' | 'submitted' | 'graded'
  feedback?: string
  question_feedback?: Record<string, any>
  answers: Record<string, any>
  assessments: {
    title: string
    passing_score: number
    show_correct_answers: boolean
  }
}

export default function AssessmentResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: assessmentId } = use(params)
  const searchParams = useSearchParams()
  const submissionId = searchParams.get('submission')
  const router = useRouter()
  const supabase = createClient()

  const [submission, setSubmission] = useState<Submission | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (submissionId) {
      loadResults()
    }
  }, [submissionId])

  async function loadResults() {
    try {
      const { data: submissionData } = await supabase
        .from('student_submissions')
        .select(`
          *,
          assessments(title, passing_score, show_correct_answers)
        `)
        .eq('id', submissionId)
        .single()

      if (submissionData) {
        setSubmission(submissionData as any)

        // Get questions if showing correct answers
        if (submissionData.assessments.show_correct_answers && submissionData.status === 'graded') {
          const { data: questionsData } = await supabase
            .from('assessment_questions')
            .select('*')
            .eq('assessment_id', submissionData.assessment_id)
            .order('order_index')

          setQuestions(questionsData || [])
        }
      }
      setLoading(false)
    } catch (err) {
      console.error('Error loading results:', err)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 28, maxWidth: 700, margin: '0 auto' }}>
        <div className="card card-pad">
          <div className="skeleton" style={{ height: 24, width: '60%', marginBottom: 16 }} />
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
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Results not found</h3>
          <button onClick={() => router.back()} className="btn btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    )
  }

  const isPending = submission.status === 'submitted' && submission.score === null
  const hasFailed = submission.status === 'graded' && !submission.passed

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 80, height: 80,
          background: isPending 
            ? '#fef3c7' 
            : submission.passed 
              ? 'var(--success-bg)' 
              : 'var(--danger-bg)',
          borderRadius: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16
        }}>
          {isPending ? (
            <svg width="36" height="36" viewBox="0 0 20 20" fill="#d97706">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
          ) : submission.passed ? (
            <svg width="36" height="36" viewBox="0 0 20 20" fill="var(--success)">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
          ) : (
            <svg width="36" height="36" viewBox="0 0 20 20" fill="var(--danger)">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
          )}
        </div>
        <h1 className="page-title" style={{ marginBottom: 8 }}>
          {isPending ? 'Submission Pending' : submission.passed ? 'Congratulations!' : 'Assessment Complete'}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--muted)' }}>
          {submission.assessments.title} - Attempt {submission.attempt_number}
        </p>
      </div>

      {/* Score Card */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        {isPending ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>Your submission is being graded</p>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              This assessment contains questions that require manual grading. You'll be notified when your results are ready.
            </p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>Your Score</p>
              <div style={{ fontSize: 48, fontWeight: 700, color: submission.passed ? 'var(--success)' : 'var(--danger)' }}>
                {submission.percentage}%
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>
                {submission.score} / {submission.max_score} points
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
              <div style={{
                padding: '8px 16px',
                background: submission.passed ? 'var(--success-bg)' : 'var(--danger-bg)',
                borderRadius: 8,
                border: `1px solid ${submission.passed ? '#bbf7d0' : 'var(--danger-border)'}`
              }}>
                <p style={{ fontSize: 12, color: submission.passed ? 'var(--success)' : 'var(--danger)', fontWeight: 500 }}>
                  {submission.passed ? '✓ Passed' : '✗ Did Not Pass'}
                </p>
              </div>
              <div style={{
                padding: '8px 16px',
                background: 'var(--bg)',
                borderRadius: 8,
                border: '1px solid var(--border)'
              }}>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Passing Score: {submission.assessments.passing_score}%
                </p>
              </div>
            </div>

            {submission.feedback && (
              <div style={{
                padding: 16,
                background: 'var(--bg)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                marginTop: 16
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Instructor Feedback</p>
                <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{submission.feedback}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Answers (if enabled and graded) */}
      {submission.assessments.show_correct_answers && submission.status === 'graded' && questions.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Review Answers</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {questions.map((question, idx) => {
              const userAnswer = submission.answers[question.id]
              const questionFeedback = submission.question_feedback?.[question.id]
              const isCorrect = questionFeedback?.is_correct
              const pointsEarned = questionFeedback?.points_earned || 0

              let correctAnswer = null
              if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
                correctAnswer = question.options?.find(o => o.is_correct)?.text
              }

              return (
                <div 
                  key={question.id}
                  style={{
                    padding: 16,
                    background: 'var(--bg)',
                    borderRadius: 8,
                    border: `2px solid ${isCorrect ? 'var(--success)' : '#f3f4f6'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{
                        width: 24, height: 24, background: 'var(--white)', borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 600
                      }}>
                        {idx + 1}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{question.question_text}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 12, color: isCorrect ? 'var(--success)' : 'var(--muted)', fontWeight: 500 }}>
                        {pointsEarned} / {question.points} pts
                      </p>
                    </div>
                  </div>

                  <div style={{ marginLeft: 32 }}>
                    <div style={{ marginBottom: 8 }}>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Your Answer:</p>
                      <p style={{ fontSize: 13 }}>{userAnswer || '(No answer)'}</p>
                    </div>

                    {correctAnswer && (
                      <div style={{ marginBottom: 8 }}>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Correct Answer:</p>
                        <p style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>{correctAnswer}</p>
                      </div>
                    )}

                    {question.explanation && (
                      <div style={{
                        marginTop: 10,
                        padding: 10,
                        background: 'var(--white)',
                        borderRadius: 6,
                        border: '1px solid var(--border)'
                      }}>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Explanation:</p>
                        <p style={{ fontSize: 13, lineHeight: 1.5 }}>{question.explanation}</p>
                      </div>
                    )}

                    {questionFeedback?.feedback && (
                      <div style={{
                        marginTop: 10,
                        padding: 10,
                        background: '#fef3c7',
                        borderRadius: 6,
                        border: '1px solid #fcd34d'
                      }}>
                        <p style={{ fontSize: 12, color: '#92400e', marginBottom: 4 }}>Instructor Feedback:</p>
                        <p style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>{questionFeedback.feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <Link href={`/student/courses/${submission.assessment_id}`}>
          <button className="btn btn-secondary">
            Back to Course
          </button>
        </Link>
        {hasFailed && (
          <button onClick={() => router.push(`/student/assessments/${assessmentId}`)} className="btn btn-primary">
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
