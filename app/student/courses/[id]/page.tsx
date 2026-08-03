import { redirect } from 'next/navigation'
import { createServerSupabase, createServiceSupabase, getCurrentUser } from '@/lib/supabase-server'
import StudentCourseClient from './StudentCourseClient'

export default async function StudentCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const supabase = await createServerSupabase()

  const serviceSupabase = createServiceSupabase()

  // All of these only depend on courseId/user.id, not on each other — run them together
  // instead of one-by-one (each round trip to Supabase was previously awaited sequentially).
  const [
    { data: enrollment },
    { data: profile },
    { data: course },
    { data: courseEbooks },
    { data: rawModules },
  ] = await Promise.all([
    supabase.from('enrollments').select('course_id').eq('user_id', user.id).eq('course_id', courseId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('courses').select('id, title, description').eq('id', courseId).single(),
    // Use service role to bypass RLS for ebooks (same pattern as videos)
    serviceSupabase.from('course_ebooks').select('id, course_id, title, storage_path, created_at').eq('course_id', courseId).order('created_at'),
    // Use service role so students can see locked modules (but not access content)
    serviceSupabase.from('modules').select('id, title, order_index, is_locked').eq('course_id', courseId).order('order_index'),
  ])

  if (!enrollment && profile?.role !== 'admin') redirect('/student/courses')
  if (!course) redirect('/student/courses')

  // Apply per-student module access overrides
  const { data: studentOverrides } = await serviceSupabase
    .from('student_module_access')
    .select('module_id, is_unlocked')
    .eq('student_id', user.id)
    .in('module_id', (rawModules || []).map(m => m.id))

  const overrideMap: Record<string, boolean> = {}
  for (const row of studentOverrides || []) {
    overrideMap[row.module_id] = row.is_unlocked
  }

  // Merge: override takes priority over global is_locked
  const modules = (rawModules || []).map(m => ({
    ...m,
    is_locked: m.id in overrideMap ? !overrideMap[m.id] : m.is_locked,
  }))

  const accessibleModuleIds = modules
    .filter(m => !m.is_locked)
    .map(m => m.id)

  let subTopicsByModule: Record<string, any[]> = {}
  let contentByModule: Record<string, any[]> = {}
  let contentBySubTopic: Record<string, any[]> = {}
  let videoUrls: Record<string, string> = {}
  let assessmentsByModule: Record<string, any[]> = {}

  if (accessibleModuleIds.length > 0) {
    // Sub-topics, content, and assessments are all independent of each other — fetch together
    const [{ data: subTopics }, { data: contentItems }, { data: assessments }] = await Promise.all([
      supabase.from('sub_topics').select('*').in('module_id', accessibleModuleIds).order('order_index'),
      supabase.from('module_content').select('*').in('module_id', accessibleModuleIds).eq('approval_status', 'approved').order('order_index'),
      supabase.from('assessments')
        .select('id, module_id, title, type, time_limit_minutes, max_attempts, due_date, published')
        .in('module_id', accessibleModuleIds).eq('published', true).order('created_at', { ascending: false }),
    ])

    for (const topic of subTopics || []) {
      if (!subTopicsByModule[topic.module_id]) subTopicsByModule[topic.module_id] = []
      subTopicsByModule[topic.module_id].push(topic)
    }

    for (const item of contentItems || []) {
      if (item.sub_topic_id) {
        if (!contentBySubTopic[item.sub_topic_id]) contentBySubTopic[item.sub_topic_id] = []
        contentBySubTopic[item.sub_topic_id].push(item)
      } else {
        if (!contentByModule[item.module_id]) contentByModule[item.module_id] = []
        contentByModule[item.module_id].push(item)
      }
    }

    for (const assessment of assessments || []) {
      if (!assessmentsByModule[assessment.module_id]) assessmentsByModule[assessment.module_id] = []
      assessmentsByModule[assessment.module_id].push(assessment)
    }

    // Videos are served through our own same-origin streaming proxy (/api/stream) instead
    // of a direct cross-origin Supabase signed URL. Safari's media engine enforces CORS on
    // Range-based streaming far more strictly than Chrome, which caused videos to load
    // fine on Chrome/Android/Windows but hang indefinitely on Mac/iPad/iPhone. A same-origin
    // URL sidesteps CORS entirely. The proxy route re-checks access itself per request.
    for (const item of contentItems || []) {
      if (item.type === 'video') {
        videoUrls[item.id] = `/api/stream/${item.id}`
      }
    }
  }

  return (
    <StudentCourseClient
      course={course}
      courseEbooks={courseEbooks || []}
      modules={modules || []}
      subTopicsByModule={subTopicsByModule}
      contentByModule={contentByModule}
      contentBySubTopic={contentBySubTopic}
      videoUrls={videoUrls}
      assessmentsByModule={assessmentsByModule}
    />
  )
}
