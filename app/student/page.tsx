import { redirect } from 'next/navigation'
import { createServerSupabase, getCurrentUser } from '@/lib/supabase-server'
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

  // Calculate statistics for each course (courses run in parallel with each other)
  const courseStats = await Promise.all(
    courses.map(async (course: any) => {
      // total/unlocked module counts are derived from this fetch, not separate queries
      const { data: modules } = await supabase
        .from('modules')
        .select('id, is_locked')
        .eq('course_id', course.id)

      const moduleIds = (modules || []).map(m => m.id)
      const totalModules = modules?.length || 0
      const unlockedModules = (modules || []).filter(m => !m.is_locked).length

      // Completed-modules count and content items are independent — fetch together
      const [{ count: completedModulesCount }, { data: contentItems }] = await Promise.all([
        moduleIds.length > 0
          ? supabase.from('module_completion').select('*', { count: 'exact', head: true })
              .eq('user_id', user.id).eq('completed', true).in('module_id', moduleIds)
          : Promise.resolve({ count: 0 }),
        supabase.from('module_content').select('id, type')
          .in('module_id', moduleIds.length > 0 ? moduleIds : ['00000000-0000-0000-0000-000000000000']),
      ])
      const completedModules = completedModulesCount || 0

      const videoContentIds = (contentItems || []).filter(c => c.type === 'video').map(c => c.id)
      const totalVideos = videoContentIds.length

      // Completed videos
      let completedVideos = 0
      if (videoContentIds.length > 0) {
        const { count } = await supabase
          .from('video_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('completed', true)
          .in('content_id', videoContentIds)
        completedVideos = count || 0
      }

      return {
        ...course,
        totalModules,
        unlockedModules,
        completedModules,
        totalVideos,
        completedVideos,
        progress: totalVideos ? Math.round((completedVideos || 0) / totalVideos * 100) : 0
      }
    })
  )

  // Overall statistics
  const totalCourses = courses.length
  const totalCompleted = courseStats.filter(c => c.progress === 100).length
  const totalInProgress = courseStats.filter(c => c.progress > 0 && c.progress < 100).length
  const totalModulesCompleted = courseStats.reduce((sum, c) => sum + c.completedModules, 0)
  const totalVideosWatched = courseStats.reduce((sum, c) => sum + c.completedVideos, 0)

  return (
    <DashboardClient
      profile={profile}
      courseStats={courseStats}
      recentActivity={recentActivity || []}
      continueWatching={continueWatching || []}
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
