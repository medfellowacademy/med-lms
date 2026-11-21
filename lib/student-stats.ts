import type { SupabaseClient } from '@supabase/supabase-js'

export interface AchievementStatus {
  id: string
  code: string
  title: string
  description: string
  icon: string
  unlocked: boolean
}

export interface StudyStats {
  currentStreak: number
  longestStreak: number
  totalStudyDays: number
  totalSeconds: number
  courseTime: Record<string, { seconds: number; lastAccessed: string | null }>
  achievements: AchievementStatus[]
  recentActivity: any[]
}

// Days are bucketed in IST (the academy's audience) so a late-evening session isn't split by UTC midnight.
const IST_OFFSET_MS = 330 * 60 * 1000
const dayKey = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)

function computeStreaks(days: Set<string>) {
  const sorted = [...days].sort()
  let longest = 0
  let run = 0
  let prev: number | null = null
  for (const d of sorted) {
    const t = Date.parse(d)
    run = prev !== null && t - prev === 86400000 ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = t
  }
  let current = 0
  let cursor = Date.parse(dayKey(new Date()))
  if (!days.has(new Date(cursor).toISOString().slice(0, 10))) cursor -= 86400000
  while (days.has(new Date(cursor).toISOString().slice(0, 10))) {
    current++
    cursor -= 86400000
  }
  return { current, longest }
}

// The streak/achievement/activity tables are never written by the app, so everything here is
// derived from records that are (video_progress, student_submissions, notes).
export async function getStudyStats(
  db: SupabaseClient,
  userId: string,
  moduleToCourse: Record<string, string>,
  totals: { modulesCompleted: number; coursesCompleted: number }
): Promise<StudyStats> {
  const [{ data: videoRows }, { data: submissions }, { data: achievementDefs }, notes] = await Promise.all([
    db.from('video_progress')
      .select('content_id, watch_time_seconds, completed, last_watched_at, module_content(title, module_id, modules(title, courses(title)))')
      .eq('user_id', userId),
    db.from('student_submissions')
      .select('submitted_at, assessment_id, assessments(title, module_id)')
      .eq('user_id', userId).in('status', ['submitted', 'graded']),
    db.from('achievements').select('id, code, title, description, icon, requirement_value'),
    Promise.all(['video_notes', 'module_notes', 'course_notes'].map(t =>
      db.from(t).select('id', { count: 'exact', head: true }).eq('user_id', userId)
    )),
  ])

  const videos = videoRows || []
  const days = new Set<string>()
  const courseTime: StudyStats['courseTime'] = {}
  let totalSeconds = 0

  for (const v of videos as any[]) {
    if (v.last_watched_at) days.add(dayKey(new Date(v.last_watched_at)))
    totalSeconds += v.watch_time_seconds || 0
    const courseId = moduleToCourse[v.module_content?.module_id]
    if (courseId) {
      const entry = courseTime[courseId] || { seconds: 0, lastAccessed: null }
      entry.seconds += v.watch_time_seconds || 0
      if (!entry.lastAccessed || v.last_watched_at > entry.lastAccessed) entry.lastAccessed = v.last_watched_at
      courseTime[courseId] = entry
    }
  }
  for (const s of (submissions || []) as any[]) {
    if (s.submitted_at) days.add(dayKey(new Date(s.submitted_at)))
    const courseId = moduleToCourse[s.assessments?.module_id]
    if (courseId && s.submitted_at) {
      const entry = courseTime[courseId] || { seconds: 0, lastAccessed: null }
      if (!entry.lastAccessed || s.submitted_at > entry.lastAccessed) entry.lastAccessed = s.submitted_at
      courseTime[courseId] = entry
    }
  }

  const { current, longest } = computeStreaks(days)
  const noteCount = notes.reduce((sum, r) => sum + (r.count || 0), 0)
  const anyVideoStarted = videos.some((v: any) => (v.watch_time_seconds || 0) > 0 || v.completed)

  const achievements: AchievementStatus[] = (achievementDefs || []).map((a: any) => {
    const need = a.requirement_value || 1
    let unlocked = false
    if (a.code === 'first_video') unlocked = anyVideoStarted
    else if (a.code === 'complete_module') unlocked = totals.modulesCompleted >= need
    else if (a.code === 'complete_course') unlocked = totals.coursesCompleted >= need
    else if (a.code.startsWith('streak_')) unlocked = longest >= need
    else if (a.code.startsWith('time_')) unlocked = totalSeconds >= need
    else if (a.code.startsWith('notes_')) unlocked = noteCount >= need
    return { id: a.id, code: a.code, title: a.title, description: a.description, icon: a.icon, unlocked }
  })

  const recentActivity = (videos as any[])
    .filter(v => v.last_watched_at && v.module_content)
    .sort((a, b) => (a.last_watched_at < b.last_watched_at ? 1 : -1))
    .slice(0, 10)
    .map(v => ({
      id: `vp-${v.content_id}`,
      activity_type: 'viewed_video',
      created_at: v.last_watched_at,
      courses: v.module_content.modules?.courses,
      modules: v.module_content.modules,
      sub_topics: null,
      module_content: v.module_content,
    }))

  return {
    currentStreak: current,
    longestStreak: longest,
    totalStudyDays: days.size,
    totalSeconds,
    courseTime,
    achievements,
    recentActivity,
  }
}
