import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const serviceSupabase = createServiceSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const path = new URL(req.url).searchParams.get('path') ?? ''

  // Block video downloads via this endpoint
  if (path.startsWith('videos/')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  const [{ data: moduleContent }, { data: courseEbook }, { data: profile }] = await Promise.all([
    serviceSupabase
      .from('module_content')
      .select('id, module_id')
      .eq('storage_path', path)
      .maybeSingle(),
    serviceSupabase
      .from('course_ebooks')
      .select('id, course_id')
      .eq('storage_path', path)
      .maybeSingle(),
    serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  let courseId: string | null = null

  if (courseEbook) {
    courseId = courseEbook.course_id
  } else if (moduleContent) {
    const { data: moduleRow } = await serviceSupabase
      .from('modules')
      .select('course_id')
      .eq('id', moduleContent.module_id)
      .maybeSingle()
    courseId = moduleRow?.course_id ?? null
  }

  if (!courseId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Course e-books require enrollment for students.
  // Admins can still access all downloads.
  if (profile?.role !== 'admin') {
    const { data: enrollment } = await serviceSupabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .maybeSingle()

    if (!enrollment) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Generate a short-lived signed URL (60 seconds)
  const { data, error } = await serviceSupabase.storage
    .from('medfellow-content')
    .createSignedUrl(path, 60)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
