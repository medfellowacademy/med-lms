import { redirect } from 'next/navigation'
import { createServerSupabase, createServiceSupabase, getCurrentUser } from '@/lib/supabase-server'
import { getModuleProgress } from '@/lib/module-progress'
import { getStudyStats } from '@/lib/student-stats'
import DashboardClient from './DashboardClient'

export default async function StudentDashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const supabase = await createServerSupabase()

  // Profile, enrollments, recent activity, and continue-watching are all independent
  // of each other — fetch them together instead of one after another.
  const [{ data: profile }, { data: enrollments }, { data: recentActivity }, { data: continueWatching }] = await Promise.all([
    supabase.from('profiles').select('full_name, email, role').eq('id', user.id).single(),
    supabase.from('enrollments')
      .select(`course_id, enrolled_at, courses(id, title, description, created_at)`)
      .eq('user_id', user.id)
      .order('enrolled_at', { ascending: false }),
    // Recent activity
    supabase.from('activity_log')
      .select(`id, activity_type, created_at, courses(title), modules(title), sub_topics(title), module_content(title, type)`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),
    // "Continue Where You Left Off" videos (in-progress, not completed)
    supabase.from('video_progress')
      .select(`
        id, content_id, watch_time_seconds, total_duration_seconds, last_watched_at,
        module_content (
          id, title, type, storage_path, module_id,
          modules ( id, title, course_id, courses ( id, title ) )
        )
      `)
      .eq('user_id', user.id)
      .eq('completed', false)
      .gt('watch_time_seconds', 10) // Must have watched at least 10 seconds
      .order('last_watched_at', { ascending: false })
      .limit(3),
  ])

  const courses = (enrollments || []).map((e: any) => e.courses).filter(Boolean)
  const serviceSupabase = createServiceSupabase()

  // Modules are read with the service client (like the course page) so locked modules still count
  // toward totals; per-student unlock overrides are applied on top of the global lock.
  const courseIds = courses.map((c: any) => c.id)
  const { data: allModules } = courseIds.length
    ? await serviceSupabase.from('modules').select('id, title, course_id, order_index, is_locked').in('course_id', courseIds).order('order_index')
    : { data: [] as any[] }
  const { data: overrides } = (allModules || []).length
    ? await serviceSupabase.from('student_module_access').select('module_id, is_unlocked')
        .eq('student_id', user.id).in('module_id', (allModules || []).map((m: any) => m.id))
    : { data: [] as any[] }
  const overrideMap = new Map((overrides || []).map((o: any) => [o.module_id, o.is_unlocked as boolean]))
  const modulesAll = (allModules || []).map((m: any) => ({
    ...m,
    is_locked: overrideMap.has(m.id) ? !overrideMap.get(m.id) : m.is_locked,
  }))

  const progressByModule = await getModuleProgress(serviceSupabase, user.id, modulesAll.map((m: any) => m.id))

  const courseStats = courses.map((course: any) => {
    const modules = modulesAll.filter((m: any) => m.course_id === course.id)
    const all = modules.map((m: any) => progressByModule[m.id]).filter(Boolean)
    const totalModules = modules.length
    const completedModules = all.filter(p => p.completed).length
    // Course progress = average of per-module progress so every module counts equally
    const progress = totalModules ? Math.round(all.reduce((sum, p) => sum + p.percent, 0) / totalModules) : 0
    return {
      ...course,
      totalModules,
      unlockedModules: modules.filter((m: any) => !m.is_locked).length,
      completedModules,
      totalVideos: all.reduce((sum, p) => sum + p.videosTotal, 0),
      completedVideos: all.reduce((sum, p) => sum + p.videosDone, 0),
      progress,
      modules: modules.map((m: any) => ({
        id: m.id,
        title: m.title,
        order_index: m.order_index,
        is_locked: m.is_locked,
        completed: !!progressByModule[m.id]?.completed,
      })),
    }
  })

  // Overall statistics
  const totalCourses = courses.length
  const totalCompleted = courseStats.filter(c => c.progress === 100).length
  const totalInProgress = courseStats.filter(c => c.progress > 0 && c.progress < 100).length
  const totalModulesCompleted = courseStats.reduce((sum, c) => sum + c.completedModules, 0)
  const totalVideosWatched = courseStats.reduce((sum, c) => sum + c.completedVideos, 0)

  const moduleToCourse: Record<string, string> = {}
  for (const m of modulesAll) moduleToCourse[m.id] = m.course_id
  const studyStats = await getStudyStats(serviceSupabase, user.id, moduleToCourse, {
    modulesCompleted: totalModulesCompleted,
    coursesCompleted: totalCompleted,
  })

  const courseStatsWithTime = courseStats.map(c => ({
    ...c,
    timeSpentSeconds: studyStats.courseTime[c.id]?.seconds || 0,
    lastAccessedAt: studyStats.courseTime[c.id]?.lastAccessed || null,
  }))

  return (
    <DashboardClient
      profile={profile}
      courseStats={courseStatsWithTime}
      recentActivity={recentActivity && recentActivity.length > 0 ? recentActivity : studyStats.recentActivity}
      continueWatching={continueWatching || []}
      studyStats={{
        currentStreak: studyStats.currentStreak,
        longestStreak: studyStats.longestStreak,
        totalStudyDays: studyStats.totalStudyDays,
        achievements: studyStats.achievements,
      }}
      overallStats={{
        totalCourses,
        totalCompleted,
        totalInProgress,
        totalModulesCompleted,
        totalVideosWatched
      }}
    />
  )
}
