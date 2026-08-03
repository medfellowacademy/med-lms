import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase, getCurrentUser } from '@/lib/supabase-server'

// Streams a video/audio file through our own domain instead of handing the browser a
// direct cross-origin Supabase Storage URL. Safari/WebKit enforces CORS on Range-based
// media streaming much more strictly than Chrome — media loaded fine on Chrome/Android/
// Windows but hung indefinitely (stuck buffering) on Mac/iPad/iPhone. Same-origin requests
// never need CORS headers at all, which removes the problem entirely.
//
// A single video playback issues MANY range requests (browsers fetch video in chunks,
// especially when seeking) — redoing the full auth check + database lookups + a fresh
// signed URL on every single chunk made playback noticeably slower than the old direct-
// signed-URL approach. This cache lets repeat chunk requests for the same (user, content)
// skip straight to fetching bytes instead of re-running the whole access-control chain.
const ACCESS_CACHE_TTL_MS = 5 * 60 * 1000
const accessCache = new Map<string, { signedUrl: string; expiresAt: number }>()

function getCached(key: string): string | null {
  const entry = accessCache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    accessCache.delete(key)
    return null
  }
  return entry.signedUrl
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params

  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const cacheKey = `${user.id}:${contentId}`
  let signedUrl = getCached(cacheKey)

  if (!signedUrl) {
    const service = createServiceSupabase()
    const supabase = await createServerSupabase()

    // Content lookup and the user's own profile role don't depend on each other — fetch together
    const [{ data: content }, { data: profile }] = await Promise.all([
      service
        .from('module_content')
        .select('id, type, storage_path, module_id, sub_topic_id, approval_status')
        .eq('id', contentId)
        .in('type', ['video', 'audio'])
        .single(),
      supabase.from('profiles').select('role').eq('id', user.id).single(),
    ])

    if (!content) return new NextResponse('Not found', { status: 404 })

    const { data: moduleRow } = await service
      .from('modules')
      .select('id, course_id, is_locked')
      .eq('id', content.module_id)
      .single()

    if (!moduleRow) return new NextResponse('Not found', { status: 404 })

    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      if (content.approval_status !== 'approved') return new NextResponse('Forbidden', { status: 403 })

      // Enrollment, per-student override, and sub-topic lock are all independent checks
      const [{ data: enrollment }, { data: override }, { data: subTopic }] = await Promise.all([
        supabase
          .from('enrollments')
          .select('course_id')
          .eq('user_id', user.id)
          .eq('course_id', moduleRow.course_id)
          .single(),
        service
          .from('student_module_access')
          .select('is_unlocked')
          .eq('student_id', user.id)
          .eq('module_id', moduleRow.id)
          .maybeSingle(),
        content.sub_topic_id
          ? service.from('sub_topics').select('is_locked').eq('id', content.sub_topic_id).single()
          : Promise.resolve({ data: null }),
      ])

      if (!enrollment) return new NextResponse('Forbidden', { status: 403 })

      const isModuleLocked = override ? !override.is_unlocked : moduleRow.is_locked
      if (isModuleLocked) return new NextResponse('Forbidden', { status: 403 })

      // Content attached to a sub-topic requires the sub-topic itself to be unlocked too,
      // independent of the parent module's lock state.
      if (content.sub_topic_id && subTopic?.is_locked) return new NextResponse('Forbidden', { status: 403 })
    }

    const { data: signed } = await service.storage
      .from('medfellow-content')
      .createSignedUrl(content.storage_path, ACCESS_CACHE_TTL_MS / 1000 + 60)

    if (!signed?.signedUrl) return new NextResponse('Media not found', { status: 404 })

    signedUrl = signed.signedUrl
    accessCache.set(cacheKey, { signedUrl, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS })
  }

  const range = req.headers.get('range')
  const upstream = await fetch(signedUrl, range ? { headers: { Range: range } } : {})

  if (!upstream.ok || !upstream.body) {
    accessCache.delete(cacheKey) // cached URL may have expired upstream — force a fresh one next time
    return new NextResponse('Failed to fetch media', { status: upstream.status || 502 })
  }

  const headers = new Headers()
  headers.set('Content-Type', upstream.headers.get('content-type') || 'video/mp4')
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Cache-Control', 'private, max-age=3600')
  const contentLength = upstream.headers.get('content-length')
  if (contentLength) headers.set('Content-Length', contentLength)
  const contentRange = upstream.headers.get('content-range')
  if (contentRange) headers.set('Content-Range', contentRange)

  return new NextResponse(upstream.body, { status: upstream.status, headers })
}
