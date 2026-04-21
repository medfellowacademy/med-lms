'use client'

import { useState } from 'react'
import Link from 'next/link'
import ProgressDashboard from '@/components/ProgressDashboard'

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

interface Props {
  profile: any
  courseStats: CourseStats[]
  recentActivity: Activity[]
  overallStats: {
    totalCourses: number
    totalCompleted: number
    totalInProgress: number
    totalModulesCompleted: number
    totalVideosWatched: number
  }
}

export default function DashboardClient({ profile, courseStats, recentActivity, overallStats }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'progress'>('overview')

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'viewed_video':
        return '▶️'
      case 'downloaded_resource':
        return '📥'
      case 'started_module':
        return '📚'
      case 'completed_module':
        return '✅'
      default:
        return '•'
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
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 8 }}>
          Welcome back, {profile?.full_name || 'Student'}!
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>
          Track your learning progress and continue where you left off
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--teal) 0%, #0d9488 100%)',
          borderRadius: 12,
          padding: 20,
          color: 'white'
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{overallStats.totalCourses}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>Enrolled Courses</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          borderRadius: 12,
          padding: 20,
          color: 'white'
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{overallStats.totalModulesCompleted}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>Modules Completed</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
          borderRadius: 12,
          padding: 20,
          color: 'white'
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{overallStats.totalVideosWatched}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>Videos Watched</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          borderRadius: 12,
          padding: 20,
          color: 'white'
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 4 }}>{overallStats.totalInProgress}</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>In Progress</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '12px 0',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              background: 'none',
              color: activeTab === 'overview' ? 'var(--teal)' : 'var(--muted)',
              borderBottom: `2px solid ${activeTab === 'overview' ? 'var(--teal)' : 'transparent'}`,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            My Courses
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            style={{
              padding: '12px 0',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              background: 'none',
              color: activeTab === 'progress' ? 'var(--teal)' : 'var(--muted)',
              borderBottom: `2px solid ${activeTab === 'progress' ? 'var(--teal)' : 'transparent'}`,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            Progress & Achievements
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            style={{
              padding: '12px 0',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              background: 'none',
              color: activeTab === 'activity' ? 'var(--teal)' : 'var(--muted)',
              borderBottom: `2px solid ${activeTab === 'activity' ? 'var(--teal)' : 'transparent'}`,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            Recent Activity
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'progress' ? (
        <ProgressDashboard />
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
              {courseStats.map(course => (
                <Link
                  key={course.id}
                  href={`/student/courses/${course.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
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
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
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
            <div style={{
              background: 'var(--white)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 20
            }}>
              {recentActivity.map(activity => (
                <div
                  key={activity.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border)'
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--teal-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                    flexShrink: 0
                  }}>
                    {getActivityIcon(activity.activity_type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                      {formatActivityText(activity)}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {getTimeAgo(activity.created_at)}
                    </p>
                  </div>
                </div>
              ))}
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
