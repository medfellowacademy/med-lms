import { redirect } from 'next/navigation'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import StudentCourseClient from './StudentCourseClient'

export default async function StudentCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .single()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (!enrollment && profile?.role !== 'admin') redirect('/student/courses')

  // Get course
  const { data: course } = await supabase
    .from('courses')
    .select('id, title, description')
    .eq('id', courseId)
    .single()

  if (!course) redirect('/student/courses')

  const { data: courseEbooks } = await supabase
    .from('course_ebooks')
    .select('id, course_id, title, storage_path, created_at')
    .eq('course_id', courseId)
    .order('created_at')

  // Get ALL modules for this course (students should see full course structure)
  // Use service role to bypass RLS so students can see locked modules (but not access content)
  const serviceSupabase = createServiceSupabase()
  const { data: modules } = await serviceSupabase
    .from('modules')
    .select('id, title, order_index, is_locked')
    .eq('course_id', courseId)
    .order('order_index')

  // Get sub-topics for unlocked modules only
  const accessibleModuleIds = (modules || [])
    .filter(m => !m.is_locked)
    .map(m => m.id)

  let subTopicsByModule: Record<string, any[]> = {}
  
  if (accessibleModuleIds.length > 0) {
    const { data: subTopics } = await supabase
      .from('sub_topics')
      .select('*')
      .in('module_id', accessibleModuleIds)
      .order('order_index')

    for (const topic of subTopics || []) {
      if (!subTopicsByModule[topic.module_id]) subTopicsByModule[topic.module_id] = []
      subTopicsByModule[topic.module_id].push(topic)
    }
  }

  // Get content for all accessible modules and sub-topics
  let contentByModule: Record<string, any[]> = {}
  let contentBySubTopic: Record<string, any[]> = {}
  let videoUrls: Record<string, string> = {}

  if (accessibleModuleIds.length > 0) {
    const { data: contentItems } = await supabase
      .from('module_content')
      .select('*')
      .in('module_id', accessibleModuleIds)
      .order('order_index')

    for (const item of contentItems || []) {
      // Content attached to sub-topic
      if (item.sub_topic_id) {
        if (!contentBySubTopic[item.sub_topic_id]) contentBySubTopic[item.sub_topic_id] = []
        contentBySubTopic[item.sub_topic_id].push(item)
      }
      // Content attached directly to module (backward compatible)
      else {
        if (!contentByModule[item.module_id]) contentByModule[item.module_id] = []
        contentByModule[item.module_id].push(item)
      }
    }
  }

  // Generate signed URLs for videos in module content (use service role for access)
  for (const items of Object.values(contentByModule)) {
    for (const item of items) {
      if (item.type === 'video') {
        const { data, error } = await serviceSupabase.storage
          .from('medfellow-content')
          .createSignedUrl(item.storage_path, 4 * 60 * 60)
        if (error) {
          console.error(`Failed to create signed URL for ${item.storage_path}:`, error)
        }
        if (data?.signedUrl) {
          videoUrls[item.id] = data.signedUrl
          console.log(`Created signed URL for video ${item.id}: ${item.title}`)
        } else {
          console.error(`No signed URL returned for ${item.id}: ${item.title}`)
        }
      }
    }
  }

  // Generate signed URLs for videos in sub-topic content (use service role for access)
  for (const items of Object.values(contentBySubTopic)) {
    for (const item of items) {
      if (item.type === 'video') {
        const { data, error } = await serviceSupabase.storage
          .from('medfellow-content')
          .createSignedUrl(item.storage_path, 4 * 60 * 60)
        if (error) {
          console.error(`Failed to create signed URL for ${item.storage_path}:`, error)
        }
        if (data?.signedUrl) {
          videoUrls[item.id] = data.signedUrl
          console.log(`Created signed URL for video ${item.id}: ${item.title}`)
        } else {
          console.error(`No signed URL returned for ${item.id}: ${item.title}`)
        }
      }
    }
  }

  console.log('Total video URLs generated:', Object.keys(videoUrls).length)

  // Get assessments for accessible modules
  let assessmentsByModule: Record<string, any[]> = {}
  if (accessibleModuleIds.length > 0) {
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id, module_id, title, type, time_limit_minutes, max_attempts, due_date, published')
      .in('module_id', accessibleModuleIds)
      .eq('published', true)
      .order('created_at', { ascending: false })

    for (const assessment of assessments || []) {
      if (!assessmentsByModule[assessment.module_id]) assessmentsByModule[assessment.module_id] = []
      assessmentsByModule[assessment.module_id].push(assessment)
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
