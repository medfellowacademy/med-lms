import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase, getCurrentUser } from '@/lib/supabase-server'

// Streams a video/audio file through our own domain instead of handing the browser a
// direct cross-origin Supabase Storage URL. Safari/WebKit enforces CORS on Range-based
// media streaming much more strictly than Chrome — media loaded fine on Chrome/Android/
// Windows but hung indefinitely (stuck buffering) on Mac/iPad/iPhone. Same-origin requests
// never need CORS headers at all, which removes the problem entirely.
export async function GET(req: NextRequest, { params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params

  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const service = createServiceSupabase()

  const { data: content } = await service
    .from('module_content')
    .select('id, type, storage_path, module_id, sub_topic_id, approval_status')
    .eq('id', contentId)
    .in('type', ['video', 'audio'])
    .single()

  if (!content) return new NextResponse('Not found', { status: 404 })

  const { data: moduleRow } = await service
    .from('modules')
    .select('id, course_id, is_locked')
    .eq('id', content.module_id)
    .single()

  if (!moduleRow) return new NextResponse('Not found', { status: 404 })

  const supabase = await createServerSupabase()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  if (!isAdmin) {
    if (content.approval_status !== 'approved') return new NextResponse('Forbidden', { status: 403 })

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('course_id', moduleRow.course_id)
      .single()
    if (!enrollment) return new NextResponse('Forbidden', { status: 403 })

    const { data: override } = await service
      .from('student_module_access')
      .select('is_unlocked')
      .eq('student_id', user.id)
      .eq('module_id', moduleRow.id)
      .maybeSingle()
    const isModuleLocked = override ? !override.is_unlocked : moduleRow.is_locked
    if (isModuleLocked) return new NextResponse('Forbidden', { status: 403 })

    // Content attached to a sub-topic requires the sub-topic itself to be unlocked too,
    // independent of the parent module's lock state.
    if (content.sub_topic_id) {
      const { data: subTopic } = await service
        .from('sub_topics')
        .select('is_locked')
        .eq('id', content.sub_topic_id)
        .single()
      if (subTopic?.is_locked) return new NextResponse('Forbidden', { status: 403 })
    }
  }

  const { data: signed } = await service.storage
    .from('medfellow-content')
    .createSignedUrl(content.storage_path, 60)

  if (!signed?.signedUrl) return new NextResponse('Media not found', { status: 404 })

  const range = req.headers.get('range')
  const upstream = await fetch(signed.signedUrl, range ? { headers: { Range: range } } : {})

  if (!upstream.ok || !upstream.body) {
    return new NextResponse('Failed to fetch media', { status: upstream.status || 502 })
  }

  const headers = new Headers()
  headers.set('Content-Type', upstream.headers.get('content-type') || (content.type === 'audio' ? 'audio/mpeg' : 'video/mp4'))
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'private, max-age=3600')
  const contentLength = upstream.headers.get('content-length')
  if (contentLength) headers.set('Content-Length', contentLength)
  const contentRange = upstream.headers.get('content-range')
  if (contentRange) headers.set('Content-Range', contentRange)

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
