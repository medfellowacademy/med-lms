import type { SupabaseClient } from '@supabase/supabase-js'

export interface ModuleProgress {
  videosDone: number
  videosTotal: number
  assessmentsDone: number
  assessmentsTotal: number
  manuallyCompleted: boolean
  completed: boolean
  percent: number
}

// A module is complete when every approved video has been watched and every published
// assessment has been submitted. Modules with nothing trackable (resource-only) count as
// complete only when the student marks them complete. Derived from source data rather than
// module_completion alone, because nothing else ever writes that table.
export async function getModuleProgress(
  db: SupabaseClient,
  userId: string,
  moduleIds: string[]
): Promise<Record<string, ModuleProgress>> {
  const result: Record<string, ModuleProgress> = {}
  if (moduleIds.length === 0) return result

  const [{ data: content }, { data: assessments }, { data: manual }] = await Promise.all([
    db.from('module_content').select('id, module_id, type')
      .in('module_id', moduleIds).eq('approval_status', 'approved'),
    db.from('assessments').select('id, module_id')
      .in('module_id', moduleIds).eq('published', true),
    db.from('module_completion').select('module_id, completed')
      .eq('user_id', userId).in('module_id', moduleIds),
  ])

  const videos = (content || []).filter(c => c.type === 'video')
  const assessmentIds = (assessments || []).map(a => a.id)

  const [{ data: watched }, { data: submissions }] = await Promise.all([
    videos.length > 0
      ? db.from('video_progress').select('content_id, watch_time_seconds, total_duration_seconds, completed')
          .eq('user_id', userId).in('content_id', videos.map(v => v.id))
      : Promise.resolve({ data: [] as { content_id: string; watch_time_seconds: number; total_duration_seconds: number; completed: boolean }[] }),
    assessmentIds.length > 0
      ? db.from('student_submissions').select('assessment_id')
          .eq('user_id', userId).in('status', ['submitted', 'graded']).in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [] as { assessment_id: string }[] }),
  ])

  const watchedSet = new Set((watched || []).filter(w => w.completed).map(w => w.content_id))
  // Partial credit for videos that are started but not finished
  const videoFraction = new Map((watched || []).map(w => [
    w.content_id,
    w.completed ? 1 : w.total_duration_seconds > 0 ? Math.min((w.watch_time_seconds || 0) / w.total_duration_seconds, 1) : 0,
  ]))
  const submittedSet = new Set((submissions || []).map(s => s.assessment_id))
  const manualSet = new Set((manual || []).filter(m => m.completed).map(m => m.module_id))

  for (const moduleId of moduleIds) {
    const moduleVideos = videos.filter(v => v.module_id === moduleId)
    const moduleAssessments = (assessments || []).filter(a => a.module_id === moduleId)
    const videosDone = moduleVideos.filter(v => watchedSet.has(v.id)).length
    const assessmentsDone = moduleAssessments.filter(a => submittedSet.has(a.id)).length
    const total = moduleVideos.length + moduleAssessments.length
    const done = videosDone + assessmentsDone
    const partial = moduleVideos.reduce((sum, v) => sum + (videoFraction.get(v.id) || 0), 0) + assessmentsDone
    const manuallyCompleted = manualSet.has(moduleId)
    const autoCompleted = total > 0 && done === total

    result[moduleId] = {
      videosDone,
      videosTotal: moduleVideos.length,
      assessmentsDone,
      assessmentsTotal: moduleAssessments.length,
      manuallyCompleted,
      completed: manuallyCompleted || autoCompleted,
      percent: manuallyCompleted ? 100 : total === 0 ? 0 : Math.round((partial / total) * 100),
    }
  }
  return result
}
