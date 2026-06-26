import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET /api/student-module-access?course_id=...&student_id=...
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const courseId = searchParams.get('course_id')
  const studentId = searchParams.get('student_id')

  if (!courseId || !studentId) {
    return NextResponse.json({ error: 'Missing course_id or student_id' }, { status: 400 })
  }

  const { data: modules } = await supabase
    .from('modules')
    .select('id')
    .eq('course_id', courseId)

  if (!modules?.length) return NextResponse.json({ data: [] })

  const { data, error } = await supabase
    .from('student_module_access')
    .select('module_id, is_unlocked')
    .eq('student_id', studentId)
    .in('module_id', modules.map(m => m.id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST /api/student-module-access
// body: { student_id, module_id, is_unlocked }
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { student_id, module_id, is_unlocked } = await req.json()

  const { error } = await supabase
    .from('student_module_access')
    .upsert({ student_id, module_id, is_unlocked }, { onConflict: 'student_id,module_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE /api/student-module-access?student_id=...&module_id=...
// Removes override — module falls back to global is_locked
export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('student_id')
  const moduleId = searchParams.get('module_id')

  if (!studentId || !moduleId) {
    return NextResponse.json({ error: 'Missing student_id or module_id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('student_module_access')
    .delete()
    .eq('student_id', studentId)
    .eq('module_id', moduleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
