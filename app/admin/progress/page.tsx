'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Student {
  id: string
  full_name: string
  email: string
  registration_number: string | null
}

interface Course {
  id: string
  title: string
}

interface Module {
  id: string
  title: string
  order_index: number
  is_locked: boolean
}

interface StudentProgress {
  student: Student
  totalModules: number
  completedModules: number
  totalVideos: number
  watchedVideos: number
  totalWatchSec: number
  lastActivity: string | null
}

interface ModuleProgress {
  module: Module
  completed: boolean
  completedAt: string | null
  videoCount: number
  videosWatched: number
  watchTimeSec: number
}

function ProgressPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])
  const [progress, setProgress] = useState<StudentProgress[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCourses, setLoadingCourses] = useState(true)

  // Drill-down state
  const [drillStudent, setDrillStudent] = useState<Student | null>(null)
  const [drillModules, setDrillModules] = useState<ModuleProgress[]>([])
  const [loadingDrill, setLoadingDrill] = useState(false)

  // Search
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'activity'>('name')

  useEffect(() => {
    supabase.from('courses').select('id, title').order('title').then(({ data }) => {
      setCourses(data || [])
      // Pre-select from URL param
      const paramCourse = searchParams.get('course')
      const paramStudent = searchParams.get('student')
      if (paramCourse) setSelectedCourse(paramCourse)
      setLoadingCourses(false)
    })
  }, [])

  const loadProgress = useCallback(async (courseId: string) => {
    if (!courseId) return
    setLoading(true)
    setDrillStudent(null)

    // Get all modules for course
    const { data: modules } = await supabase
      .from('modules')
      .select('id, title, order_index, is_locked')
      .eq('course_id', courseId)

    const moduleIds = (modules || []).map(m => m.id)

    // Get all enrollments
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('user_id, profiles!inner(id, full_name, email, registration_number)')
      .eq('course_id', courseId)

    const enrolledStudents: Student[] = (enrollments || []).map((e: any) => e.profiles)
    setStudents(enrolledStudents)

    if (enrolledStudents.length === 0 || moduleIds.length === 0) {
      setProgress([])
      setLoading(false)
      return
    }

    const studentIds = enrolledStudents.map(s => s.id)

    // Get module completions
    const { data: completions } = await supabase
      .from('module_completion')
      .select('user_id, module_id, completed, completed_at')
      .in('user_id', studentIds)
      .in('module_id', moduleIds)

    // Get video progress
    const { data: contentItems } = await supabase
      .from('module_content')
      .select('id, module_id, type')
      .in('module_id', moduleIds)
      .eq('type', 'video')

    const contentIds = (contentItems || []).map(c => c.id)

    let videoProgress: any[] = []
    if (contentIds.length > 0) {
      const { data: vp } = await supabase
        .from('video_progress')
        .select('user_id, content_id, completed, watch_time_seconds, last_watched_at')
        .in('user_id', studentIds)
        .in('content_id', contentIds)
      videoProgress = vp || []
    }

    // Get last activity per student
    const { data: activities } = await supabase
      .from('activity_log')
      .select('user_id, created_at')
      .eq('course_id', courseId)
      .in('user_id', studentIds)
      .order('created_at', { ascending: false })

    const lastActivityMap: Record<string, string> = {}
    for (const a of activities || []) {
      if (!lastActivityMap[a.user_id]) lastActivityMap[a.user_id] = a.created_at
    }

    // Build progress per student
    const result: StudentProgress[] = enrolledStudents.map(student => {
      const studentCompletions = (completions || []).filter(c => c.user_id === student.id && c.completed)
      const studentVideoProg = (videoProgress || []).filter(v => v.user_id === student.id)

      return {
        student,
        totalModules: moduleIds.length,
        completedModules: studentCompletions.length,
        totalVideos: (contentItems || []).length,
        watchedVideos: studentVideoProg.filter(v => v.completed).length,
        totalWatchSec: studentVideoProg.reduce((sum, v) => sum + (v.watch_time_seconds || 0), 0),
        lastActivity: lastActivityMap[student.id] || null,
      }
    })

    setProgress(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (selectedCourse) loadProgress(selectedCourse)
  }, [selectedCourse])

  async function loadDrill(student: Student) {
    if (!selectedCourse) return
    setDrillStudent(student)
    setLoadingDrill(true)

    const { data: modules } = await supabase
      .from('modules')
      .select('id, title, order_index, is_locked')
      .eq('course_id', selectedCourse)
      .order('order_index')

    const moduleIds = (modules || []).map(m => m.id)

    const [{ data: completions }, { data: contentItems }] = await Promise.all([
      supabase.from('module_completion').select('module_id, completed, completed_at').eq('user_id', student.id).in('module_id', moduleIds),
      supabase.from('module_content').select('id, module_id, type').in('module_id', moduleIds).eq('type', 'video'),
    ])

    const contentIds = (contentItems || []).map(c => c.id)
    let videoProgress: any[] = []
    if (contentIds.length > 0) {
      const { data: vp } = await supabase
        .from('video_progress')
        .select('content_id, completed, watch_time_seconds')
        .eq('user_id', student.id)
        .in('content_id', contentIds)
      videoProgress = vp || []
    }

    const drillData: ModuleProgress[] = (modules || []).map(mod => {
      const comp = (completions || []).find(c => c.module_id === mod.id)
      const modVideos = (contentItems || []).filter(c => c.module_id === mod.id)
      const modVP = videoProgress.filter(v => modVideos.some(mv => mv.id === v.content_id))
      return {
        module: mod,
        completed: comp?.completed || false,
        completedAt: comp?.completed_at || null,
        videoCount: modVideos.length,
        videosWatched: modVP.filter(v => v.completed).length,
        watchTimeSec: modVP.reduce((s, v) => s + (v.watch_time_seconds || 0), 0),
      }
    })

    setDrillModules(drillData)
    setLoadingDrill(false)
  }

  function fmtTime(sec: number) {
    if (sec < 60) return `${sec}s`
    if (sec < 3600) return `${Math.floor(sec / 60)}m`
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  }

  function fmtDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const filtered = progress.filter(p => {
    const q = search.toLowerCase()
    return !q || p.student.full_name?.toLowerCase().includes(q) || p.student.email?.toLowerCase().includes(q) || p.student.registration_number?.toLowerCase().includes(q)
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'progress') return (b.completedModules / Math.max(b.totalModules, 1)) - (a.completedModules / Math.max(a.totalModules, 1))
    if (sortBy === 'activity') return (b.lastActivity || '').localeCompare(a.lastActivity || '')
    return (a.student.full_name || '').localeCompare(b.student.full_name || '')
  })

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/admin/academics')} className="btn btn-ghost btn-sm">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/></svg>
          Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">Student Progress</h1>
          <p className="page-subtitle">Track every student's module completion, video watch time and last activity</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={selectedCourse}
          onChange={e => setSelectedCourse(e.target.value)}
          className="input"
          style={{ minWidth: 220, maxWidth: 320 }}
          disabled={loadingCourses}
        >
          <option value="">— Select a course —</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search students..."
          className="input"
          style={{ minWidth: 200, maxWidth: 280 }}
          disabled={!selectedCourse}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input" style={{ width: 160 }} disabled={!selectedCourse}>
          <option value="name">Sort: Name</option>
          <option value="progress">Sort: Progress</option>
          <option value="activity">Sort: Last Active</option>
        </select>
        {selectedCourse && !loading && (
          <span style={{ fontSize: 12.5, color: 'var(--muted)', marginLeft: 4 }}>
            {sorted.length} student{sorted.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!selectedCourse ? (
        <div className="empty-state">
          <div className="emoji">📊</div>
          <h3>Select a course to view progress</h3>
          <p>Choose a course above to see how all enrolled students are performing.</p>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0,1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 12 }} />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">👥</div>
          <h3>No enrolled students</h3>
          <p>No students are enrolled in this course yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Progress table */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Students', value: sorted.length },
                { label: 'Avg Completion', value: sorted.length ? `${Math.round(sorted.reduce((s, p) => s + (p.completedModules / Math.max(p.totalModules, 1)), 0) / sorted.length * 100)}%` : '—' },
                { label: 'Fully Complete', value: sorted.filter(p => p.completedModules === p.totalModules && p.totalModules > 0).length },
                { label: 'Not Started', value: sorted.filter(p => p.completedModules === 0).length },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--teal)' }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.label}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map(p => {
                const pct = p.totalModules > 0 ? Math.round(p.completedModules / p.totalModules * 100) : 0
                const isSelected = drillStudent?.id === p.student.id
                return (
                  <div
                    key={p.student.id}
                    className="card"
                    style={{
                      padding: '14px 16px', cursor: 'pointer',
                      borderColor: isSelected ? 'var(--teal)' : 'var(--border)',
                      background: isSelected ? 'linear-gradient(135deg, var(--teal-soft), var(--white))' : 'var(--white)',
                    }}
                    onClick={() => loadDrill(p.student)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: pct === 100 ? 'var(--grad-teal)' : '#e5e7eb',
                        color: pct === 100 ? '#fff' : '#6b7280',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, flexShrink: 0
                      }}>
                        {(p.student.full_name || p.student.email || '?')[0].toUpperCase()}
                      </div>

                      {/* Name + reg */}
                      <div style={{ minWidth: 160, flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{p.student.full_name || p.student.email}</p>
                        <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {p.student.registration_number || p.student.email}
                        </p>
                      </div>

                      {/* Progress bar + stats */}
                      <div style={{ flex: 2, minWidth: 160 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600 }}>
                            {p.completedModules}/{p.totalModules} modules
                          </span>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: pct === 100 ? 'var(--teal)' : pct > 50 ? '#f59e0b' : 'var(--muted)' }}>
                            {pct}%
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 99, background: '#e5e7eb', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 99,
                            width: `${pct}%`,
                            background: pct === 100 ? 'var(--grad-teal)' : pct > 50 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #6b7280, #9ca3af)',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                      </div>

                      {/* Extras */}
                      <div style={{ display: 'flex', gap: 16, flexShrink: 0, flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 13, fontWeight: 700 }}>{p.watchedVideos}/{p.totalVideos}</p>
                          <p style={{ fontSize: 10, color: 'var(--muted)' }}>Videos</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 13, fontWeight: 700 }}>{fmtTime(p.totalWatchSec)}</p>
                          <p style={{ fontSize: 10, color: 'var(--muted)' }}>Watch time</p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{fmtDate(p.lastActivity)}</p>
                          <p style={{ fontSize: 10, color: 'var(--muted)' }}>Last active</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Drill-down panel */}
          {drillStudent && (
            <div style={{
              width: 300, flexShrink: 0, position: 'sticky', top: 0,
              height: 'fit-content', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto'
            }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{drillStudent.full_name}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>{drillStudent.registration_number || drillStudent.email}</p>
                  </div>
                  <button onClick={() => setDrillStudent(null)} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }}>✕</button>
                </div>

                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Module Breakdown
                </p>

                {loadingDrill ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 8 }} />)}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {drillModules.map(mp => (
                      <div key={mp.module.id} style={{
                        padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: mp.completed ? 'linear-gradient(135deg, #f0fdf4, var(--white))' : 'var(--white)',
                        borderColor: mp.completed ? '#9FE1CB' : 'var(--border)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>
                            {mp.module.order_index + 1}. {mp.module.title}
                          </p>
                          <span style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 6, fontWeight: 600, flexShrink: 0,
                            background: mp.completed ? '#d1fae5' : mp.module.is_locked ? '#f3f4f6' : '#fef3c7',
                            color: mp.completed ? '#065f46' : mp.module.is_locked ? '#9ca3af' : '#92400e',
                          }}>
                            {mp.completed ? 'Done' : mp.module.is_locked ? 'Locked' : 'In Progress'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                            📹 {mp.videosWatched}/{mp.videoCount} videos
                          </span>
                          {mp.watchTimeSec > 0 && (
                            <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                              ⏱ {fmtTime(mp.watchTimeSec)}
                            </span>
                          )}
                          {mp.completedAt && (
                            <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                              ✓ {fmtDate(mp.completedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => router.push(`/admin/academics?student=${drillStudent.id}`)}
                  className="btn btn-sm"
                  style={{ width: '100%', marginTop: 14, background: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}
                >
                  View Full Academic Profile
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProgressPage() {
  return (
    <Suspense fallback={<div style={{ padding: 28 }}>Loading…</div>}>
      <ProgressPageInner />
    </Suspense>
  )
}
