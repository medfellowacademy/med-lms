'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { motion } from 'framer-motion'

interface AssessmentStats {
  assessment_id: string
  title: string
  type: string
  course_title: string
  module_title: string
  total_attempts: number
  average_score: number
  average_time_minutes: number
  pass_rate: number
}

interface QuestionAnalysis {
  question_id: string
  question_text: string
  points: number
  times_answered: number
  times_correct: number
  correct_percentage: number
  average_points: number
}

interface AtRiskStudent {
  user_id: string
  full_name: string
  email: string
  assessments_taken: number
  assessments_failed: number
  average_score: number
}

interface VideoItem {
  id: string
  title: string
  order_index: number
  storage_path: string
  duration: number | null // seconds; null = not probed yet or unreadable
  probing: boolean
}

interface ModuleVideos {
  id: string
  title: string
  order_index: number
  videos: VideoItem[]
  pptCount: number
  pdfCount: number
}

interface CourseVideos {
  id: string
  title: string
  modules: ModuleVideos[]
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatHoursDecimal(seconds: number | null): string {
  if (seconds == null) return '—'
  return (seconds / 3600).toFixed(2)
}

function csvEscape(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function getVideoDuration(url: string): Promise<number | null> {
  return new Promise(resolve => {
    const el = document.createElement('video')
    el.preload = 'metadata'
    const timeout = setTimeout(() => { cleanup(); resolve(null) }, 15000)
    function cleanup() {
      clearTimeout(timeout)
      el.onloadedmetadata = null
      el.onerror = null
      el.removeAttribute('src')
      el.load()
    }
    el.onloadedmetadata = () => {
      const d = el.duration
      cleanup()
      resolve(Number.isFinite(d) ? d : null)
    }
    el.onerror = () => { cleanup(); resolve(null) }
    el.src = url
  })
}

export default function AdminReportsPage() {
  const supabase = createClient()
  const [assessmentStats, setAssessmentStats] = useState<AssessmentStats[]>([])
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null)
  const [questionAnalysis, setQuestionAnalysis] = useState<QuestionAnalysis[]>([])
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'overview' | 'questions' | 'students' | 'videos'>('overview')

  // Video content report state
  const [videoCourses, setVideoCourses] = useState<CourseVideos[]>([])
  const [videoReportLoading, setVideoReportLoading] = useState(false)
  const [videoReportLoaded, setVideoReportLoaded] = useState(false)
  const [videoProbeDone, setVideoProbeDone] = useState(0)
  const [videoProbeTotal, setVideoProbeTotal] = useState(0)
  const [expandedVideoCourses, setExpandedVideoCourses] = useState<Set<string>>(new Set())
  const [probedCourseIds, setProbedCourseIds] = useState<Set<string>>(new Set())
  const [computingTotal, setComputingTotal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (activeView === 'videos' && !videoReportLoaded) loadVideoReport()
  }, [activeView])

  async function loadData() {
    try {
      await Promise.all([
        loadAssessmentStats(),
        loadAtRiskStudents()
      ])
    } catch (err) {
      console.error('Error loading reports:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadAssessmentStats() {
    const { data: assessments } = await supabase
      .from('assessments')
      .select(`
        id,
        title,
        type,
        module_id,
        modules(
          title,
          course_id,
          courses(title)
        )
      `)
      .eq('published', true)

    if (!assessments) return

    const statsPromises = assessments.map(async (assessment: any) => {
      const { data: statsData } = await supabase.rpc('get_assessment_stats', {
        assessment_id_param: assessment.id
      })

      return {
        assessment_id: assessment.id,
        title: assessment.title,
        type: assessment.type,
        course_title: assessment.modules.courses.title,
        module_title: assessment.modules.title,
        ...(statsData || {
          total_attempts: 0,
          average_score: 0,
          average_time_minutes: 0,
          pass_rate: 0
        })
      }
    })

    const stats = await Promise.all(statsPromises)
    setAssessmentStats(stats)
  }

  async function loadQuestionAnalysis(assessmentId: string) {
    setSelectedAssessment(assessmentId)
    
    // Get all questions for this assessment
    const { data: questions } = await supabase
      .from('assessment_questions')
      .select('id, question_text, question_type, points, options')
      .eq('assessment_id', assessmentId)
      .order('order_index')

    if (!questions) return

    // Get all graded submissions for this assessment
    const { data: submissions } = await supabase
      .from('student_submissions')
      .select('answers, question_feedback')
      .eq('assessment_id', assessmentId)
      .eq('status', 'graded')

    const analysis: QuestionAnalysis[] = questions.map(q => {
      let timesAnswered = 0
      let timesCorrect = 0
      let totalPoints = 0

      submissions?.forEach(sub => {
        if (sub.answers && sub.answers[q.id]) {
          timesAnswered++
          const feedback = sub.question_feedback?.[q.id]
          if (feedback?.is_correct) {
            timesCorrect++
          }
          totalPoints += feedback?.points_earned || 0
        }
      })

      return {
        question_id: q.id,
        question_text: q.question_text,
        points: q.points,
        times_answered: timesAnswered,
        times_correct: timesCorrect,
        correct_percentage: timesAnswered > 0 ? Math.round((timesCorrect / timesAnswered) * 100) : 0,
        average_points: timesAnswered > 0 ? Math.round((totalPoints / timesAnswered) * 10) / 10 : 0
      }
    })

    setQuestionAnalysis(analysis)
  }

  async function loadAtRiskStudents() {
    // Get all graded submissions
    const { data: submissions } = await supabase
      .from('student_submissions')
      .select(`
        user_id,
        passed,
        percentage,
        profiles(full_name, email)
      `)
      .eq('status', 'graded')

    if (!submissions) return

    // Group by student
    const studentMap: Record<string, {
      full_name: string
      email: string
      assessments_taken: number
      assessments_failed: number
      total_score: number
    }> = {}

    submissions.forEach((sub: any) => {
      if (!studentMap[sub.user_id]) {
        studentMap[sub.user_id] = {
          full_name: sub.profiles.full_name,
          email: sub.profiles.email,
          assessments_taken: 0,
          assessments_failed: 0,
          total_score: 0
        }
      }
      studentMap[sub.user_id].assessments_taken++
      if (!sub.passed) studentMap[sub.user_id].assessments_failed++
      studentMap[sub.user_id].total_score += sub.percentage || 0
    })

    // Calculate at-risk students (average score < 60% or fail rate > 40%)
    const atRisk: AtRiskStudent[] = Object.entries(studentMap)
      .map(([user_id, data]) => ({
        user_id,
        full_name: data.full_name,
        email: data.email,
        assessments_taken: data.assessments_taken,
        assessments_failed: data.assessments_failed,
        average_score: Math.round(data.total_score / data.assessments_taken)
      }))
      .filter(s => s.average_score < 60 || (s.assessments_failed / s.assessments_taken) > 0.4)
      .sort((a, b) => a.average_score - b.average_score)

    setAtRiskStudents(atRisk)
  }

  async function loadVideoReport() {
    setVideoReportLoading(true)
    const [{ data: courses }, { data: modules }, { data: content }] = await Promise.all([
      supabase.from('courses').select('id, title').order('title'),
      supabase.from('modules').select('id, title, course_id, order_index').order('order_index'),
      supabase.from('module_content').select('id, title, module_id, type, storage_path, order_index').in('type', ['video', 'ppt', 'pdf']).order('order_index'),
    ])

    const moduleMap: Record<string, ModuleVideos> = {}
    ;(modules || []).forEach((m: any) => {
      moduleMap[m.id] = { id: m.id, title: m.title, order_index: m.order_index, videos: [], pptCount: 0, pdfCount: 0 }
    })
    ;(content || []).forEach((c: any) => {
      const mod = moduleMap[c.module_id]
      if (!mod) return
      if (c.type === 'video') {
        mod.videos.push({ id: c.id, title: c.title, order_index: c.order_index, storage_path: c.storage_path, duration: null, probing: false })
      } else if (c.type === 'ppt') {
        mod.pptCount++
      } else if (c.type === 'pdf') {
        mod.pdfCount++
      }
    })

    const courseList: CourseVideos[] = (courses || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      modules: (modules || []).filter((m: any) => m.course_id === c.id).map((m: any) => moduleMap[m.id]),
    }))

    setVideoCourses(courseList)
    setVideoReportLoading(false)
    setVideoReportLoaded(true)

    const allVideos = courseList.flatMap(c => c.modules.flatMap(m => m.videos))
    setVideoProbeTotal(allVideos.length)
    setVideoProbeDone(0)
    // Durations are NOT probed here — that's slow (each video needs a signed URL +
    // metadata fetch). Instead we probe lazily: per-course when expanded, or in bulk
    // if the admin explicitly asks via "Measure all durations".
  }

  function updateVideoInState(videoId: string, patch: Partial<VideoItem>) {
    setVideoCourses(prev => prev.map(c => ({
      ...c,
      modules: c.modules.map(m => ({
        ...m,
        videos: m.videos.map(v => v.id === videoId ? { ...v, ...patch } : v),
      })),
    })))
  }

  async function probeVideos(videos: VideoItem[]) {
    const toProbe = videos.filter(v => v.duration == null)
    const CONCURRENCY = 6
    let idx = 0
    async function worker() {
      while (idx < toProbe.length) {
        const video = toProbe[idx++]
        updateVideoInState(video.id, { probing: true })
        const { data } = await supabase.storage.from('medfellow-content').createSignedUrl(video.storage_path, 300)
        const duration = data?.signedUrl ? await getVideoDuration(data.signedUrl) : null
        updateVideoInState(video.id, { duration, probing: false })
        setVideoProbeDone(d => d + 1)
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  }

  function toggleVideoCourse(courseId: string) {
    const willExpand = !expandedVideoCourses.has(courseId)
    setExpandedVideoCourses(prev => {
      const next = new Set(prev)
      if (next.has(courseId)) next.delete(courseId)
      else next.add(courseId)
      return next
    })
    if (willExpand && !probedCourseIds.has(courseId)) {
      const course = videoCourses.find(c => c.id === courseId)
      const videos = course ? course.modules.flatMap(m => m.videos) : []
      setProbedCourseIds(prev => new Set(prev).add(courseId))
      if (videos.length > 0) probeVideos(videos)
    }
  }

  async function computeAllDurations() {
    setComputingTotal(true)
    setProbedCourseIds(new Set(videoCourses.map(c => c.id)))
    const remaining = videoCourses.flatMap(c => c.modules.flatMap(m => m.videos)).filter(v => v.duration == null)
    await probeVideos(remaining)
    setComputingTotal(false)
  }

  async function exportContentSheet() {
    const allMeasured = videoProbeTotal > 0 && videoProbeDone >= videoProbeTotal
    if (!allMeasured) await computeAllDurations()

    // Re-read latest state via a fresh snapshot after probing settles
    setVideoCourses(latest => {
      const rows: string[] = ['Course,Module,PPTs,Videos,PDFs,Video Duration (h:m:s),Video Duration (hours)']
      let grandPpt = 0, grandVideo = 0, grandPdf = 0, grandSeconds = 0

      for (const course of latest) {
        let coursePpt = 0, courseVideo = 0, coursePdf = 0, courseSeconds = 0
        for (const mod of course.modules) {
          const modSeconds = mod.videos.reduce((s, v) => s + (v.duration || 0), 0)
          rows.push([
            csvEscape(course.title), csvEscape(mod.title), mod.pptCount, mod.videos.length, mod.pdfCount,
            csvEscape(formatDuration(modSeconds)), formatHoursDecimal(modSeconds),
          ].join(','))
          coursePpt += mod.pptCount
          courseVideo += mod.videos.length
          coursePdf += mod.pdfCount
          courseSeconds += modSeconds
        }
        rows.push([
          csvEscape(course.title), 'COURSE TOTAL', coursePpt, courseVideo, coursePdf,
          csvEscape(formatDuration(courseSeconds)), formatHoursDecimal(courseSeconds),
        ].join(','))
        grandPpt += coursePpt
        grandVideo += courseVideo
        grandPdf += coursePdf
        grandSeconds += courseSeconds
      }

      rows.push(['GRAND TOTAL', '', grandPpt, grandVideo, grandPdf, csvEscape(formatDuration(grandSeconds)), formatHoursDecimal(grandSeconds)].join(','))

      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `content-sheet-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      return latest
    })
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
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Assessment Reports & Analytics</h1>
        <p className="page-subtitle">Performance insights and student progress tracking</p>
      </div>

      {/* View tabs */}
      <div className="tab-bar" style={{ marginBottom: 24 }}>
        <button
          onClick={() => setActiveView('overview')}
          className={`tab ${activeView === 'overview' ? 'active' : ''}`}
        >
          Assessment Overview
        </button>
        <button
          onClick={() => setActiveView('questions')}
          className={`tab ${activeView === 'questions' ? 'active' : ''}`}
        >
          Question Analysis
        </button>
        <button
          onClick={() => setActiveView('videos')}
          className={`tab ${activeView === 'videos' ? 'active' : ''}`}
        >
          Content Sheet
        </button>
        <button
          onClick={() => setActiveView('students')}
          className={`tab ${activeView === 'students' ? 'active' : ''}`}
        >
          At-Risk Students
        </button>
      </div>

      {/* Overview */}
      {activeView === 'overview' && (
        <div>
          {assessmentStats.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📊</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No assessment data yet</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                Publish assessments and wait for student submissions to see analytics
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {assessmentStats.map(stat => {
                const typeColor = stat.type === 'quiz' 
                  ? '#a855f7' 
                  : stat.type === 'exam' 
                    ? '#f59e0b' 
                    : '#3b82f6'

                return (
                  <motion.div
                    key={stat.assessment_id}
                    whileHover={{ y: -2 }}
                    className="card card-pad"
                  >
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 48, height: 48, background: `${typeColor}15`, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: typeColor,
                        flexShrink: 0
                      }}>
                        {stat.type === 'quiz' ? 'QZ' : stat.type === 'exam' ? 'EX' : 'AS'}
                      </div>

                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                          {stat.title}
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                          {stat.course_title} • {stat.module_title}
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Attempts</p>
                            <p style={{ fontSize: 18, fontWeight: 600 }}>{stat.total_attempts}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Avg Score</p>
                            <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--teal)' }}>
                              {stat.average_score}%
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Pass Rate</p>
                            <p style={{ fontSize: 18, fontWeight: 600, color: stat.pass_rate >= 70 ? 'var(--success)' : '#f59e0b' }}>
                              {stat.pass_rate}%
                            </p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Avg Time</p>
                            <p style={{ fontSize: 18, fontWeight: 600 }}>
                              {stat.average_time_minutes} min
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            loadQuestionAnalysis(stat.assessment_id)
                            setActiveView('questions')
                          }}
                          className="btn btn-sm btn-ghost"
                          style={{ marginTop: 12 }}
                        >
                          View Question Analysis →
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Question Analysis */}
      {activeView === 'questions' && (
        <div>
          {!selectedAssessment ? (
            <div className="empty-state">
              <div className="emoji">🎯</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Select an assessment</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                Go to Assessment Overview and click "View Question Analysis"
              </p>
              <button onClick={() => setActiveView('overview')} className="btn btn-secondary">
                Go to Overview
              </button>
            </div>
          ) : questionAnalysis.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📝</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No data yet</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                No graded submissions for this assessment
              </p>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => setActiveView('overview')} className="btn btn-ghost btn-sm">
                  ← Back to Overview
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {questionAnalysis.map((q, idx) => {
                  const difficulty = q.correct_percentage >= 70 ? 'Easy' : q.correct_percentage >= 50 ? 'Medium' : 'Hard'
                  const difficultyColor = q.correct_percentage >= 70 ? 'var(--success)' : q.correct_percentage >= 50 ? '#f59e0b' : 'var(--danger)'

                  return (
                    <div key={q.question_id} className="card card-pad">
                      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                        <div style={{
                          width: 32, height: 32, background: 'var(--teal-soft)', borderRadius: 8,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 600, color: 'var(--teal)', flexShrink: 0
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                            {q.question_text}
                          </p>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <div>
                              <p style={{ fontSize: 11, color: 'var(--muted)' }}>Answered</p>
                              <p style={{ fontSize: 16, fontWeight: 600 }}>{q.times_answered}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: 11, color: 'var(--muted)' }}>Correct</p>
                              <p style={{ fontSize: 16, fontWeight: 600, color: difficultyColor }}>
                                {q.correct_percentage}%
                              </p>
                            </div>
                            <div>
                              <p style={{ fontSize: 11, color: 'var(--muted)' }}>Avg Points</p>
                              <p style={{ fontSize: 16, fontWeight: 600 }}>
                                {q.average_points} / {q.points}
                              </p>
                            </div>
                            <div>
                              <p style={{ fontSize: 11, color: 'var(--muted)' }}>Difficulty</p>
                              <p style={{ fontSize: 14, fontWeight: 600, color: difficultyColor }}>
                                {difficulty}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="progress" style={{ height: 6 }}>
                        <div 
                          className="bar"
                          style={{ 
                            width: `${q.correct_percentage}%`,
                            background: difficultyColor
                          }} 
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content Sheet */}
      {activeView === 'videos' && (
        <div>
          {videoReportLoading && videoCourses.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10 }} />)}
            </div>
          ) : (() => {
            const totalModules = videoCourses.reduce((sum, c) => sum + c.modules.length, 0)
            const totalPpts = videoCourses.reduce((sum, c) => sum + c.modules.reduce((s, m) => s + m.pptCount, 0), 0)
            const totalPdfs = videoCourses.reduce((sum, c) => sum + c.modules.reduce((s, m) => s + m.pdfCount, 0), 0)
            const totalVideos = videoCourses.reduce((sum, c) => sum + c.modules.reduce((s, m) => s + m.videos.length, 0), 0)
            const knownSeconds = videoCourses.reduce((sum, c) => sum + c.modules.reduce((s, m) => s + m.videos.reduce((vs, v) => vs + (v.duration || 0), 0), 0), 0)
            const allMeasured = videoProbeTotal > 0 && videoProbeDone >= videoProbeTotal
            return (
              <>
                <div style={{
                  display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap',
                  padding: '14px 18px', border: '1px solid var(--border)', borderRadius: 10,
                  background: 'var(--teal-soft)', marginBottom: 8,
                }}>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>Courses</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{videoCourses.length}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>Modules</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{totalModules}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>PPTs</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{totalPpts}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>Videos</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{totalVideos}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>PDFs</p>
                    <p style={{ fontSize: 20, fontWeight: 700 }}>{totalPdfs}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Video Hours{!allMeasured && videoProbeDone > 0 ? ' (partial)' : ''}
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)' }}>{formatDuration(knownSeconds)}</p>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                    {computingTotal ? (
                      <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Measuring… {videoProbeDone}/{videoProbeTotal}
                      </p>
                    ) : !allMeasured ? (
                      <button onClick={computeAllDurations} className="btn btn-secondary btn-sm">
                        Measure all durations ({videoProbeTotal - videoProbeDone} left)
                      </button>
                    ) : null}
                    <button onClick={exportContentSheet} disabled={computingTotal} className="btn btn-primary btn-sm">
                      Export CSV
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 20 }}>
                  PPT/PDF/video counts are exact and instant. Video lengths aren't stored, so they're measured on demand by reading each video's real metadata — expand a course to measure it, or "Measure all durations" / "Export CSV" for the full accurate total (Export automatically measures everything first).
                </p>

                {videoCourses.length === 0 ? (
                  <div className="empty-state">
                    <div className="emoji">🎬</div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No courses yet</h3>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Course / Module</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PPTs</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Videos</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>PDFs</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Video Duration</th>
                          <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {videoCourses.map(course => {
                          const courseVideos = course.modules.flatMap(m => m.videos)
                          const coursePpt = course.modules.reduce((s, m) => s + m.pptCount, 0)
                          const coursePdf = course.modules.reduce((s, m) => s + m.pdfCount, 0)
                          const courseSeconds = courseVideos.reduce((s, v) => s + (v.duration || 0), 0)
                          const isProbed = probedCourseIds.has(course.id)
                          const coursePending = courseVideos.some(v => v.probing)
                          const expanded = expandedVideoCourses.has(course.id)
                          const durationLabel = courseVideos.length === 0
                            ? '—'
                            : !isProbed
                              ? 'Tap to measure'
                              : `${formatDuration(courseSeconds)}${coursePending ? '…' : ''}`
                          return (
                            <Fragment key={course.id}>
                              <tr
                                onClick={() => toggleVideoCourse(course.id)}
                                style={{ cursor: 'pointer', background: expanded ? 'var(--teal-soft)' : 'var(--white)', borderBottom: '1px solid var(--border)' }}
                              >
                                <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                                  <span style={{ display: 'inline-block', width: 14, color: 'var(--muted)' }}>{expanded ? '▾' : '▸'}</span>
                                  {course.title}
                                  <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 8, fontSize: 11.5 }}>
                                    ({course.modules.length} module{course.modules.length !== 1 ? 's' : ''})
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{coursePpt}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{courseVideos.length}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{coursePdf}</td>
                                <td style={{
                                  padding: '10px 14px', textAlign: 'right', fontWeight: 700,
                                  color: !isProbed && courseVideos.length > 0 ? 'var(--muted)' : 'var(--teal)',
                                  fontStyle: !isProbed && courseVideos.length > 0 ? 'italic' : 'normal',
                                }}>
                                  {durationLabel}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--muted)' }}>
                                  {isProbed ? formatHoursDecimal(courseSeconds) : '—'}
                                </td>
                              </tr>
                              {expanded && course.modules.map(mod => {
                                const modSeconds = mod.videos.reduce((s, v) => s + (v.duration || 0), 0)
                                const modPending = mod.videos.some(v => v.probing)
                                return (
                                  <tr key={mod.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '8px 14px 8px 38px', color: 'var(--text)' }}>{mod.title}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right' }}>{mod.pptCount}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right' }}>{mod.videos.length}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right' }}>{mod.pdfCount}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600 }}>
                                      {modPending ? '…' : formatDuration(modSeconds)}
                                    </td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--muted)' }}>
                                      {modPending ? '…' : formatHoursDecimal(modSeconds)}
                                    </td>
                                  </tr>
                                )
                              })}
                            </Fragment>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f9fafb', borderTop: '2px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700 }}>GRAND TOTAL</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{totalPpts}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{totalVideos}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>{totalPdfs}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--teal)' }}>{formatDuration(knownSeconds)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--muted)' }}>{formatHoursDecimal(knownSeconds)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* At-Risk Students */}
      {activeView === 'students' && (
        <div>
          {atRiskStudents.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">✅</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>All students performing well!</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                No students are currently at risk (average score &lt; 60% or fail rate &gt; 40%)
              </p>
            </div>
          ) : (
            <div>
              <div style={{ 
                padding: 12, 
                background: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: 8,
                marginBottom: 20
              }}>
                <p style={{ fontSize: 13, color: '#991b1b' }}>
                  <strong>{atRiskStudents.length}</strong> student{atRiskStudents.length !== 1 ? 's' : ''} may need additional support
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {atRiskStudents.map(student => (
                  <div key={student.user_id} className="card card-pad">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                          {student.full_name}
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                          {student.email}
                        </p>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--muted)' }}>Assessments Taken</p>
                            <p style={{ fontSize: 16, fontWeight: 600 }}>{student.assessments_taken}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 11, color: 'var(--muted)' }}>Failed</p>
                            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>
                              {student.assessments_failed}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Average Score</p>
                        <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>
                          {student.average_score}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
