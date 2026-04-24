'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import ProgressDashboard from '@/components/ProgressDashboard'
import CourseRoadmap from '@/components/CourseRoadmap'
import { StaggerGrid, StaggerItem } from '@/components/motion/StaggerGrid'
import CountUp from '@/components/motion/CountUp'
import { createClient } from '@/lib/supabase'

interface CourseStats {
  id: string
  title: string
  description: string
  totalModules: number
  unlockedModules: number
  completedModules: number
  totalVideos: number
  completedVideos: number
  progress: number
}

interface Activity {
  id: string
  activity_type: string
  created_at: string
  courses?: any
  modules?: any
  sub_topics?: any
  module_content?: any
}

interface ContinueWatchingItem {
  id: string
  content_id: string
  watch_time_seconds: number
  total_duration_seconds: number
  last_watched_at: string
  module_content: {
    id: string
    title: string
    type: string
    storage_path: string
    module_id: string
    modules: {
      id: string
      title: string
      course_id: string
      courses: {
        id: string
        title: string
      }[]
    }[]
  }[]
}

interface Props {
  profile: any
  courseStats: CourseStats[]
  recentActivity: Activity[]
  continueWatching: ContinueWatchingItem[]
  overallStats: {
    totalCourses: number
    totalCompleted: number
    totalInProgress: number
    totalModulesCompleted: number
    totalVideosWatched: number
  }
}

// Grades Tab Component
function GradesTab() {
  const supabase = createClient()
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'graded' | 'pending'>('all')

  useEffect(() => {
    loadGrades()
  }, [])

  async function loadGrades() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('student_submissions')
        .select(`
          *,
          assessments(
            title,
            type,
            passing_score,
            module_id,
            modules(
              title,
              course_id,
              courses(title)
            )
          )
        `)
        .eq('user_id', user.id)
        .in('status', ['submitted', 'graded'])
        .order('submitted_at', { ascending: false })

      if (!error && data) {
        setSubmissions(data)
      }
    } catch (err) {
      console.error('Error loading grades:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredSubmissions = submissions.filter(sub => {
    if (filter === 'all') return true
    if (filter === 'graded') return sub.status === 'graded'
    if (filter === 'pending') return sub.status === 'submitted'
    return true
  })

  const stats = {
    total: submissions.length,
    graded: submissions.filter(s => s.status === 'graded').length,
    pending: submissions.filter(s => s.status === 'submitted').length,
    passed: submissions.filter(s => s.status === 'graded' && s.passed).length,
    averageScore: submissions.filter(s => s.status === 'graded' && s.percentage !== null).length > 0
      ? Math.round(
          submissions
            .filter(s => s.status === 'graded' && s.percentage !== null)
            .reduce((sum, s) => sum + s.percentage, 0) /
          submissions.filter(s => s.status === 'graded' && s.percentage !== null).length
        )
      : 0
  }

  if (loading) {
    return (
      <div className="card card-pad">
        <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 16, width: '80%' }} />
      </div>
    )
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>
            {stats.total}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Assessments
          </div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>
            {stats.passed}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Passed
          </div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
            {stats.pending}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Grading
          </div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--violet)', marginBottom: 4 }}>
            {stats.averageScore}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Average Score
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setFilter('all')}
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('graded')}
          className={`btn btn-sm ${filter === 'graded' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Graded
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Pending
        </button>
      </div>

      {/* Grades List */}
      {filteredSubmissions.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📊</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No grades yet</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Complete assessments to see your grades here
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredSubmissions.map((submission) => {
            const assessment = submission.assessments
            const typeColor = assessment.type === 'quiz' 
              ? '#a855f7' 
              : assessment.type === 'exam' 
                ? '#f59e0b' 
                : '#3b82f6'

            return (
              <Link 
                key={submission.id}
                href={`/student/assessments/${submission.assessment_id}/results?submission=${submission.id}`}
                style={{ textDecoration: 'none' }}
              >
                <motion.div
                  whileHover={{ y: -2 }}
                  className="card card-pad card-hover"
                  style={{ cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    {/* Type badge */}
                    <div style={{
                      width: 48, height: 48, background: `${typeColor}15`, borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: typeColor,
                      flexShrink: 0
                    }}>
                      {assessment.type === 'quiz' ? 'QZ' : assessment.type === 'exam' ? 'EX' : 'AS'}
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                        {assessment.title}
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
                        {assessment.modules.courses.title} • {assessment.modules.title}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                        Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Score */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {submission.status === 'graded' ? (
                        <>
                          <div style={{ 
                            fontSize: 24, 
                            fontWeight: 700, 
                            color: submission.passed ? 'var(--success)' : 'var(--danger)',
                            marginBottom: 4
                          }}>
                            {submission.percentage}%
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                            {submission.score} / {submission.max_score} pts
                          </div>
                          <span className={`chip ${submission.passed ? 'chip-success' : 'chip-warning'}`}>
                            {submission.passed ? 'Passed' : 'Failed'}
                          </span>
                        </>
                      ) : (
                        <span className="chip chip-warning">
                          Pending Grading
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function DashboardClient({ profile, courseStats, recentActivity, continueWatching, overallStats }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'progress' | 'roadmap' | 'grades'>('overview')

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = (watched: number, total: number) => {
    if (total === 0) return 0
    return Math.round((watched / total) * 100)
  }

  const getActivityIcon = (type: string) => {
    const common = { width: 16, height: 16, viewBox: '0 0 20 20', fill: 'currentColor' as const }
    switch (type) {
      case 'viewed_video':
        return (
          <svg {...common}><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
        )
      case 'downloaded_resource':
        return (
          <svg {...common}><path fillRule="evenodd" d="M10 2a.75.75 0 01.75.75v9.19l2.72-2.72a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 111.06-1.06l2.72 2.72V2.75A.75.75 0 0110 2zM3.5 14.75a.75.75 0 01.75.75v.5a.75.75 0 00.75.75h10a.75.75 0 00.75-.75v-.5a.75.75 0 011.5 0v.5A2.25 2.25 0 0115 18H5a2.25 2.25 0 01-2.25-2.25v-.5a.75.75 0 01.75-.75z" clipRule="evenodd"/></svg>
        )
      case 'started_module':
        return (
          <svg {...common}><path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/></svg>
        )
      case 'completed_module':
        return (
          <svg {...common}><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
        )
      default:
        return <svg {...common}><circle cx="10" cy="10" r="3"/></svg>
    }
  }

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'viewed_video': return { bg: 'var(--teal-light)', fg: 'var(--teal)' }
      case 'downloaded_resource': return { bg: '#ede9fe', fg: '#6d28d9' }
      case 'started_module': return { bg: '#fef3c7', fg: '#b45309' }
      case 'completed_module': return { bg: 'var(--success-bg)', fg: 'var(--success)' }
      default: return { bg: '#f3f4f6', fg: 'var(--muted)' }
    }
  }

  const formatActivityText = (activity: Activity) => {
    const course = activity.courses?.title
    const module = activity.modules?.title
    const subtopic = activity.sub_topics?.title
    const content = activity.module_content?.title

    if (activity.activity_type === 'viewed_video' && content) {
      return `Watched "${content}" in ${module || course}`
    }
    if (activity.activity_type === 'downloaded_resource' && content) {
      return `Downloaded "${content}" from ${module || course}`
    }
    if (activity.activity_type === 'started_module' && module) {
      return `Started module "${module}"`
    }
    if (activity.activity_type === 'completed_module' && module) {
      return `Completed module "${module}"`
    }
    return `Activity in ${course}`
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="page-pad" style={{ padding: 28, maxWidth: 1400, margin: '0 auto' }}>
      {/* Welcome banner */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--grad-teal)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 28px',
        marginBottom: 24,
        color: 'white',
        boxShadow: '0 8px 24px rgba(15, 110, 86, 0.18)'
      }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', right: 60, bottom: -60, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, opacity: 0.85, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 30, lineHeight: 1.15, marginBottom: 8 }}>
            Welcome back, {profile?.full_name?.split(' ')[0] || 'Student'} 👋
          </h1>
          <p style={{ fontSize: 14.5, opacity: 0.92, maxWidth: 560 }}>
            {overallStats.totalInProgress > 0
              ? `You have ${overallStats.totalInProgress} course${overallStats.totalInProgress === 1 ? '' : 's'} in progress. Keep the streak going!`
              : 'Ready to start learning? Pick up a course below.'}
          </p>
        </div>
      </div>

      {/* Continue Where You Left Off */}
      {continueWatching.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="var(--teal)">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
            </svg>
            Continue Where You Left Off
          </h2>
          <div className="continue-watching-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {continueWatching.map(item => {
              const progress = getProgressPercentage(item.watch_time_seconds, item.total_duration_seconds)
              const moduleContent = item.module_content?.[0]
              const module = moduleContent?.modules?.[0]
              const course = module?.courses?.[0]
              
              if (!moduleContent || !module || !course) return null
              
              return (
                <Link
                  key={item.id}
                  href={`/student/courses/${course?.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <motion.div
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="card card-hover"
                    style={{ padding: 16, display: 'flex', gap: 12 }}
                  >
                    <div style={{
                      width: 80,
                      height: 80,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #0f6e56 0%, #14b8a6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      <svg width="26" height="26" viewBox="0 0 20 20" fill="white">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                      </svg>
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${progress}%`,
                        background: 'rgba(255,255,255,0.25)',
                        transition: 'height 0.3s'
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {moduleContent.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {course.title} • {module.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                        <div className="progress" style={{ flex: 1, height: 4 }}>
                          <div className="bar" style={{ width: `${progress}%` }} />
                        </div>
                        <span style={{ color: 'var(--teal)', fontWeight: 600, fontSize: 11 }}>{progress}%</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>
                        {formatDuration(item.watch_time_seconds)} / {formatDuration(item.total_duration_seconds)}
                      </div>
                    </div>
                  </motion.div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <StaggerGrid className="responsive-grid stat-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Enrolled Courses', value: overallStats.totalCourses, grad: 'var(--grad-teal)', icon: (<path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z"/>) },
          { label: 'Modules Completed', value: overallStats.totalModulesCompleted, grad: 'var(--grad-violet)', icon: (<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>) },
          { label: 'Videos Watched', value: overallStats.totalVideosWatched, grad: 'var(--grad-pink)', icon: (<path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>) },
          { label: 'In Progress', value: overallStats.totalInProgress, grad: 'var(--grad-amber)', icon: (<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 112 0v3.5a1 1 0 01-2 0V9zm1-5a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/>) },
        ].map(s => (
          <StaggerItem key={s.label} className="stat-card" style={{
            position: 'relative', overflow: 'hidden',
            background: s.grad,
            borderRadius: 'var(--radius)',
            padding: 20,
            color: 'white',
            boxShadow: '0 4px 14px rgba(17, 24, 39, 0.08)'
          }}>
            <div style={{
              position: 'absolute', top: 14, right: 14,
              width: 34, height: 34, borderRadius: 10,
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="white">{s.icon}</svg>
            </div>
            <div className="stat-value" style={{ fontSize: 34, fontWeight: 700, marginBottom: 2, lineHeight: 1.1 }}>
              <CountUp value={s.value} />
            </div>
            <div className="stat-label" style={{ fontSize: 12.5, opacity: 0.95, fontWeight: 500 }}>{s.label}</div>
          </StaggerItem>
        ))}
      </StaggerGrid>

      {/* Tabs */}
      <div style={{ marginBottom: 20 }}>
        <div className="tab-bar" role="tablist">
          <button
            onClick={() => setActiveTab('overview')}
            className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          >
            My Courses
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`tab ${activeTab === 'roadmap' ? 'active' : ''}`}
          >
            Roadmap
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`tab ${activeTab === 'progress' ? 'active' : ''}`}
          >
            Progress & Achievements
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`tab ${activeTab === 'activity' ? 'active' : ''}`}
          >
            Recent Activity
          </button>
          <button
            onClick={() => setActiveTab('grades')}
            className={`tab ${activeTab === 'grades' ? 'active' : ''}`}
          >
            Grades
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'progress' ? (
        <ProgressDashboard />
      ) : activeTab === 'roadmap' ? (
        <div>
          {courseStats.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📋</div>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                No courses to show roadmap for yet
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {courseStats.map(course => (
                <div key={course.id}>
                  <div style={{ marginBottom: 12 }}>
                    <Link 
                      href={`/student/courses/${course.id}`}
                      style={{ 
                        fontSize: 17, 
                        fontWeight: 600, 
                        color: 'var(--text)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      {course.title}
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="var(--teal)">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Link>
                    <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                      {course.completedModules} of {course.totalModules} modules completed • {course.progress}% progress
                    </p>
                  </div>
                  <CourseRoadmap 
                    modules={[]}
                    currentModuleId={undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : activeTab === 'overview' ? (
        <div>
          {courseStats.length === 0 ? (
            <div style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center'
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--teal-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <svg width="28" height="28" viewBox="0 0 20 20" fill="var(--teal)">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Courses Yet</h3>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                Your admin will enroll you in courses soon
              </p>
            </div>
          ) : (
            <StaggerGrid className="responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {courseStats.map(course => (
                <StaggerItem key={course.id}>
                <Link
                  href={`/student/courses/${course.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <motion.div
                    whileHover={{ y: -4, boxShadow: '0 12px 28px rgba(15, 110, 86, 0.12)' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    style={{
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                    className="course-card"
                  >
                    {/* Course Title */}
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
                      {course.title}
                    </h3>
                    {course.description && (
                      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
                        {course.description.substring(0, 100)}{course.description.length > 100 ? '...' : ''}
                      </p>
                    )}

                    {/* Progress Bar */}
                    <div style={{ marginBottom: 16, marginTop: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>Progress</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)' }}>{course.progress}%</span>
                      </div>
                      <div style={{
                        height: 6,
                        background: '#f3f4f6',
                        borderRadius: 3,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${course.progress}%`,
                          height: '100%',
                          background: course.progress === 100 ? '#10b981' : 'var(--teal)',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {course.completedModules}/{course.totalModules}
                        </span> modules
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {course.completedVideos}/{course.totalVideos}
                        </span> videos
                      </div>
                    </div>

                    {/* Continue Badge */}
                    {course.progress > 0 && course.progress < 100 && (
                      <div style={{
                        marginTop: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'var(--teal-light)',
                        color: 'var(--teal)',
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 500
                      }}>
                        <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                        Continue Learning
                      </div>
                    )}

                    {course.progress === 100 && (
                      <div style={{
                        marginTop: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#dcfce7',
                        color: '#16a34a',
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 500
                      }}>
                        <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Completed
                      </div>
                    )}
                  </motion.div>
                </Link>
                </StaggerItem>
              ))}
            </StaggerGrid>
          )}
        </div>
      ) : activeTab === 'grades' ? (
        <GradesTab />
      ) : (
        <div>
          {recentActivity.length === 0 ? (
            <div style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 48,
              textAlign: 'center'
            }}>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>No recent activity</p>
            </div>
          ) : (
            <div className="card card-pad">
              {recentActivity.map((activity, idx) => {
                const colors = getActivityColor(activity.activity_type)
                return (
                  <div
                    key={activity.id}
                    style={{
                      display: 'flex',
                      gap: 14,
                      padding: '14px 0',
                      borderBottom: idx === recentActivity.length - 1 ? 'none' : '1px solid var(--border)'
                    }}
                  >
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: colors.bg,
                      color: colors.fg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13.5, color: 'var(--text)', marginBottom: 2, fontWeight: 500 }}>
                        {formatActivityText(activity)}
                      </p>
                      <p style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {getTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .course-card:hover {
          border-color: #9FE1CB;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
      `}</style>
    </div>
  )
}
