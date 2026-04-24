import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import DashboardClient from './DashboardClient'

export default async function StudentDashboardPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .eq('id', user.id)
    .single()

  // Get enrolled courses with progress
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      course_id,
      enrolled_at,
      courses(id, title, description, created_at)
    `)
    .eq('user_id', user.id)
    .order('enrolled_at', { ascending: false })

  const courses = (enrollments || []).map((e: any) => e.courses).filter(Boolean)

  // Calculate statistics for each course
  const courseStats = await Promise.all(
    courses.map(async (course: any) => {
      // Get module IDs for this course
      const { data: modules } = await supabase
        .from('modules')
        .select('id')
        .eq('course_id', course.id)
      
      const moduleIds = (modules || []).map(m => m.id)

      // Total modules
      const { count: totalModules } = await supabase
        .from('modules')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', course.id)

      // Unlocked modules
      const { count: unlockedModules } = await supabase
        .from('modules')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', course.id)
        .eq('is_locked', false)

      // Completed modules
      let completedModules = 0
      if (moduleIds.length > 0) {
        const { count } = await supabase
          .from('module_completion')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('completed', true)
          .in('module_id', moduleIds)
        completedModules = count || 0
      }

      // Get content IDs for video counting
      const { data: contentItems } = await supabase
        .from('module_content')
        .select('id, type')
        .in('module_id', moduleIds.length > 0 ? moduleIds : ['00000000-0000-0000-0000-000000000000'])

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
        totalModules: totalModules || 0,
        unlockedModules: unlockedModules || 0,
        completedModules,
        totalVideos,
        completedVideos,
        progress: totalVideos ? Math.round((completedVideos || 0) / totalVideos * 100) : 0
      }
    })
  )

  // Get recent activity
  const { data: recentActivity } = await supabase
    .from('activity_log')
    .select(`
      id,
      activity_type,
      created_at,
      courses(title),
      modules(title),
      sub_topics(title),
      module_content(title, type)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Get "Continue Where You Left Off" videos (in-progress, not completed)
  const { data: continueWatching } = await supabase
    .from('video_progress')
    .select(`
      id,
      content_id,
      watch_time_seconds,
      total_duration_seconds,
      last_watched_at,
      module_content (
        id,
        title,
        type,
        storage_path,
        module_id,
        modules (
          id,
          title,
          course_id,
          courses (
            id,
            title
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('completed', false)
    .gt('watch_time_seconds', 10) // Must have watched at least 10 seconds
    .order('last_watched_at', { ascending: false })
    .limit(3)

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
