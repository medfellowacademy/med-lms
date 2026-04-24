'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'

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
  profiles: {
    full_name: string
    email: string
  }
  assessments: {
    title: string
    type: 'quiz' | 'assignment' | 'exam'
    module_id: string
    modules: {
      title: string
      course_id: string
      courses: {
        title: string
      }
    }
  }
}

export default function AdminGradingPage() {
  const supabase = createClient()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'graded'>('submitted')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'submitted_at' | 'student_name' | 'course'>('submitted_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadSubmissions()
  }, [statusFilter])

  async function loadSubmissions() {
    try {
      let query = supabase
        .from('student_submissions')
        .select(`
          *,
          profiles(full_name, email),
          assessments(
            title,
            type,
            module_id,
            modules(
              title,
              course_id,
              courses(title)
            )
          )
        `)

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      } else {
        query = query.in('status', ['submitted', 'graded'])
      }

      const { data, error } = await query.order('submitted_at', { ascending: false })

      if (error) throw error
      setSubmissions(data as any || [])
    } catch (err) {
      console.error('Error loading submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort
  const filteredAndSorted = submissions
    .filter(sub => {
      if (!searchQuery) return true
      const search = searchQuery.toLowerCase()
      return (
        sub.profiles.full_name.toLowerCase().includes(search) ||
        sub.profiles.email.toLowerCase().includes(search) ||
        sub.assessments.title.toLowerCase().includes(search) ||
        sub.assessments.modules.courses.title.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => {
      let aVal, bVal
      if (sortBy === 'submitted_at') {
        aVal = new Date(a.submitted_at).getTime()
        bVal = new Date(b.submitted_at).getTime()
      } else if (sortBy === 'student_name') {
        aVal = a.profiles.full_name.toLowerCase()
        bVal = b.profiles.full_name.toLowerCase()
      } else {
        aVal = a.assessments.modules.courses.title.toLowerCase()
        bVal = b.assessments.modules.courses.title.toLowerCase()
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

  const needsGradingCount = submissions.filter(s => s.status === 'submitted').length

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 20 }} />
        <div className="skeleton" style={{ height: 60, width: '100%' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Grading Center</h1>
          <p className="page-subtitle">Review and grade student submissions</p>
        </div>
        {needsGradingCount > 0 && (
          <div style={{
            padding: '8px 16px',
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: 8
          }}>
            <p style={{ fontSize: 13, color: '#92400e', fontWeight: 500 }}>
              {needsGradingCount} submission{needsGradingCount !== 1 ? 's' : ''} need grading
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ flex: '1 1 300px' }}>
            <input
              type="text"
              placeholder="Search by student, assessment, or course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
            />
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'submitted', 'graded'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-ghost'}`}
              >
                {status === 'all' ? 'All' : status === 'submitted' ? 'Needs Grading' : 'Graded'}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input"
              style={{ width: 'auto', padding: '6px 10px' }}
            >
              <option value="submitted_at">Date</option>
              <option value="student_name">Student</option>
              <option value="course">Course</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn btn-sm btn-ghost"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 20 20"
                fill="currentColor"
                style={{ transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none' }}
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Submissions list */}
      {filteredAndSorted.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📝</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No submissions found</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {statusFilter === 'submitted' 
              ? 'All submissions have been graded!' 
              : 'No submissions match your filters.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredAndSorted.map((submission, idx) => {
            const typeColor = submission.assessments.type === 'quiz' 
              ? '#a855f7' 
              : submission.assessments.type === 'exam' 
                ? '#f59e0b' 
                : '#3b82f6'

            return (
              <motion.div
                key={submission.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Link href={`/admin/grading/${submission.id}`}>
                  <div className="card card-pad card-hover" style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      {/* Type badge */}
                      <div style={{
                        width: 44, height: 44, background: `${typeColor}15`, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: typeColor,
                        flexShrink: 0
                      }}>
                        {submission.assessments.type === 'quiz' ? 'QZ' : submission.assessments.type === 'exam' ? 'EX' : 'AS'}
                      </div>

                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                            {submission.profiles.full_name}
                          </h3>
                          {submission.status === 'submitted' && (
                            <span className="chip chip-warning">Needs Grading</span>
                          )}
                          {submission.status === 'graded' && (
                            <span className="chip chip-success">Graded</span>
                          )}
                        </div>

                        <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
                          {submission.assessments.title}
                        </p>

                        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {submission.assessments.modules.courses.title} • {submission.assessments.modules.title}
                        </p>
                      </div>

                      {/* Score & date */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {submission.status === 'graded' && submission.percentage !== null ? (
                          <div style={{ marginBottom: 6 }}>
                            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>
                              {submission.percentage}%
                            </p>
                            <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                              {submission.score} / {submission.max_score} pts
                            </p>
                          </div>
                        ) : (
                          <div style={{ marginBottom: 6 }}>
                            <p style={{ fontSize: 14, color: 'var(--muted)', fontStyle: 'italic' }}>
                              Not graded
                            </p>
                          </div>
                        )}
                        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                          Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
