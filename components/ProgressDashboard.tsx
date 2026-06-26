'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface CourseProgress {
  course_id: string
  course_title: string
  modules_completed: number
  total_modules: number
  progress_percentage: number
  total_time_spent_seconds: number
  last_accessed_at: string
}

interface StudyStreak {
  current_streak: number
  longest_streak: number
  total_study_days: number
  last_activity_date: string
}

interface Achievement {
  id: string
  code: string
  title: string
  description: string
  icon: string
  category: string
  unlocked_at?: string
}

export default function ProgressDashboard() {
  const supabase = createClient()
  const [courseProgress, setCourseProgress] = useState<CourseProgress[]>([])
  const [streak, setStreak] = useState<StudyStreak | null>(null)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProgress()
  }, [])

  async function loadProgress() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load course progress
      const { data: progressData } = await supabase
        .from('course_progress')
        .select(`
          *,
          courses!inner(title)
        `)
        .eq('user_id', user.id)

      if (progressData) {
        const formattedProgress = progressData.map((p: any) => ({
          course_id: p.course_id,
          course_title: p.courses.title,
          modules_completed: p.modules_completed,
          total_modules: p.total_modules,
          progress_percentage: p.progress_percentage,
          total_time_spent_seconds: p.total_time_spent_seconds,
          last_accessed_at: p.last_accessed_at
        }))
        setCourseProgress(formattedProgress)
      }

      // Load study streak
      const { data: streakData } = await supabase
        .from('study_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (streakData) setStreak(streakData)

      // Load achievements (both unlocked and locked)
      const [allAch, userAch] = await Promise.all([
        supabase.from('achievements').select('*'),
        supabase
          .from('user_achievements')
          .select('achievement_id, unlocked_at')
          .eq('user_id', user.id)
      ])

      if (allAch.data) {
        const unlockedIds = new Set(userAch.data?.map(a => a.achievement_id) || [])
        const unlockedMap = new Map(userAch.data?.map(a => [a.achievement_id, a.unlocked_at]) || [])
        
        const formattedAch = allAch.data.map(ach => ({
          ...ach,
          unlocked_at: unlockedMap.get(ach.id)
        }))
        setAchievements(formattedAch)
      }

      setLoading(false)
    } catch (error) {
      console.error('Failed to load progress:', error)
      setLoading(false)
    }
  }

  function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading progress...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Streak Card */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 12,
        padding: 24,
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 8 }}>Study Streak</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontSize: 48, fontWeight: 700 }}>{streak?.current_streak || 0}</div>
            <div style={{ fontSize: 20, opacity: 0.8 }}>🔥 days</div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 24, fontSize: 13 }}>
            <div>
              <div style={{ opacity: 0.8 }}>Longest Streak</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                {streak?.longest_streak || 0} days
              </div>
            </div>
            <div>
              <div style={{ opacity: 0.8 }}>Total Study Days</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>
                {streak?.total_study_days || 0} days
              </div>
            </div>
          </div>
        </div>
        <div style={{
          position: 'absolute',
          top: -20,
          right: -20,
          fontSize: 120,
          opacity: 0.1
        }}>🔥</div>
      </div>

      {/* Course Progress */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Course Progress</h3>
        {courseProgress.length === 0 ? (
          <div style={{
            background: 'var(--white)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 40,
            textAlign: 'center'
          }}>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              No courses enrolled yet. Visit the courses page to get started!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {courseProgress.map(progress => (
              <div
                key={progress.course_id}
                style={{
                  background: 'var(--white)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 16
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 600 }}>{progress.course_title}</h4>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      Last accessed {formatDate(progress.last_accessed_at)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)' }}>
                      {progress.progress_percentage}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {formatTime(progress.total_time_spent_seconds)} spent
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                <div style={{
                  width: '100%',
                  height: 8,
                  background: 'var(--bg)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: 8
                }}>
                  <div style={{
                    width: `${progress.progress_percentage}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #14b8a6, #0d9488)',
                    transition: 'width 0.3s ease'
                  }} />
                </div>

                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {progress.modules_completed} of {progress.total_modules} modules completed
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Achievements */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Achievements</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12
        }}>
          {achievements.map(achievement => {
            const isUnlocked = !!achievement.unlocked_at
            return (
              <div
                key={achievement.id}
                style={{
                  background: isUnlocked ? 'var(--white)' : 'var(--bg)',
                  border: `1px solid ${isUnlocked ? 'var(--teal)' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding: 16,
                  textAlign: 'center',
                  opacity: isUnlocked ? 1 : 0.5,
                  position: 'relative'
                }}
                title={achievement.description}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{achievement.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {achievement.title}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                  {achievement.description}
                </div>
                {isUnlocked && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 20,
                    height: 20,
                    background: 'var(--teal)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10
                  }}>
                    ✓
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
