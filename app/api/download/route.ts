import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
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

  const [{ data: moduleContent }, { data: courseEbook }] = await Promise.all([
    supabase
      .from('module_content')
      .select('id')
      .eq('storage_path', path)
      .maybeSingle(),
    supabase
      .from('course_ebooks')
      .select('id')
      .eq('storage_path', path)
      .maybeSingle(),
  ])

  if (!moduleContent && !courseEbook) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Generate a short-lived signed URL (60 seconds)
  const { data, error } = await supabase.storage
    .from('medfellow-content')
    .createSignedUrl(path, 60)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
