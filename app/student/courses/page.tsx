import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import CourseCard from './CourseCard'

export default async function StudentCoursesPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get enrolled courses
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id, courses(id, title, description, created_at)')
    .eq('user_id', user.id)

  const courses = (enrollments || []).map((e: any) => e.courses).filter(Boolean)

  // Count unlocked modules per course
  const courseIds = courses.map((c: any) => c.id)
  const moduleCounts: Record<string, { total: number; unlocked: number }> = {}

  if (courseIds.length > 0) {
    const { data: mods } = await supabase
      .from('modules')
      .select('course_id, is_locked')
      .in('course_id', courseIds)

    for (const mod of mods || []) {
      if (!moduleCounts[mod.course_id]) moduleCounts[mod.course_id] = { total: 0, unlocked: 0 }
      moduleCounts[mod.course_id].total++
      if (!mod.is_locked) moduleCounts[mod.course_id].unlocked++
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>My Courses</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
          {courses.length} course{courses.length !== 1 ? 's' : ''} enrolled
        </p>
      </div>

      {courses.length === 0 ? (
        <div style={{
          background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 12,
          padding: 48, textAlign: 'center'
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'var(--teal-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="var(--teal)">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No courses yet</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Your admin will enroll you in courses. Contact them if you haven&apos;t been enrolled.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {courses.map((course: any) => {
            const counts = moduleCounts[course.id] || { total: 0, unlocked: 0 }
            return (
              <CourseCard
                key={course.id}
                course={course}
                counts={counts}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
