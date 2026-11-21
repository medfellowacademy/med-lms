'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface Assessment {
  id: string
  title: string
  type: 'quiz' | 'assignment' | 'exam'
  published: boolean
  passing_score: number
  max_attempts: number
  time_limit_minutes: number | null
  available_from: string | null
  due_date: string | null
  created_at: string
  modules: { id: string; title: string; course_id: string } | null
  sub_topics: { id: string; title: string; module_id: string } | null
}

interface Stats {
  total_attempts: number
  average_score: number
  average_time_minutes: number
  pass_rate: number
}

export default function AdminAssessmentsPage() {
  const supabase = createClient()
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/assessments')
    const data = await res.json()
    const list: Assessment[] = data.assessments || []
    setAssessments(list)

    const [{ data: qRows }, statsEntries] = await Promise.all([
      supabase.from('assessment_questions').select('assessment_id'),
      Promise.all(list.map(async a => {
        const { data } = await supabase.rpc('get_assessment_stats', { assessment_id_param: a.id })
        return [a.id, data as Stats] as const
      })),
    ])

    const counts: Record<string, number> = {}
    for (const row of qRows || []) {
      counts[row.assessment_id] = (counts[row.assessment_id] || 0) + 1
    }
    setQuestionCounts(counts)
    setStats(Object.fromEntries(statsEntries))
    setLoading(false)
  }

  async function togglePublish(a: Assessment) {
    setBusyId(a.id)
    await fetch('/api/assessments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, published: !a.published }),
    })
    setBusyId(null)
    load()
  }

  async function remove(a: Assessment) {
    if (!confirm(`Delete "${a.title}"? This also deletes its questions and student submissions.`)) return
    setBusyId(a.id)
    await fetch(`/api/assessments?id=${a.id}`, { method: 'DELETE' })
    setBusyId(null)
    load()
  }

  function fmt(dt: string | null) {
    if (!dt) return '—'
    return new Date(dt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="page-pad" style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
        <div>
          <h1 className="page-title">Exams & Quizzes</h1>
          <p className="page-subtitle">Manage assessments, publishing, and results</p>
        </div>
        <Link href="/admin/courses" className="btn btn-primary btn-sm">
          + Create Exam / Quiz
        </Link>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>
      ) : assessments.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          <p>No assessments yet. Open a course module and create a quiz or exam from there.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {assessments.map(a => {
            const s = stats[a.id]
            const questionCount = questionCounts[a.id] || 0
            return (
              <div key={a.id} className="card card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase',
                        letterSpacing: '0.04em', fontWeight: 600,
                        background: a.type === 'exam' ? '#fef3c7' : a.type === 'assignment' ? '#e0e7ff' : 'var(--teal-light)',
                        color: a.type === 'exam' ? '#92400e' : a.type === 'assignment' ? '#3730a3' : 'var(--teal)'
                      }}>
                        {a.type}
                      </span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                        background: a.published ? '#f0fdf4' : '#f3f4f6',
                        color: a.published ? '#15803d' : '#6b7280'
                      }}>
                        {a.published ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 600 }}>{a.title}</h3>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {a.modules?.title || a.sub_topics?.title || 'No module linked'} · {questionCount} question{questionCount === 1 ? '' : 's'} · Passing {a.passing_score}% · {a.max_attempts === -1 ? 'Unlimited attempts' : `${a.max_attempts} attempt${a.max_attempts === 1 ? '' : 's'}`}{a.time_limit_minutes ? ` · ${a.time_limit_minutes} min` : ''}
                    </p>
                    <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>
                      Opens {fmt(a.available_from)} · Closes {fmt(a.due_date)}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--teal)' }}>{s?.total_attempts ?? 0}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Attempts</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 700 }}>{s?.average_score ?? 0}%</div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Avg Score</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#15803d' }}>{s?.pass_rate ?? 0}%</div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>Pass Rate</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Link href={`/admin/grading?assessment_id=${a.id}`} className="btn btn-ghost btn-sm">
                      Submissions
                    </Link>
                    <button
                      onClick={() => togglePublish(a)}
                      disabled={busyId === a.id}
                      className="btn btn-secondary btn-sm"
                    >
                      {a.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      onClick={() => remove(a)}
                      disabled={busyId === a.id}
                      className="btn btn-danger-ghost btn-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
