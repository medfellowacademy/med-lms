import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  
  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'

  // Get pending/approved/rejected content with details
  const { data: content, error } = await supabase
    .from('module_content')
    .select(`
      *,
      modules!inner(id, title, course_id, courses!inner(id, title)),
      sub_topics(id, title),
      uploader:uploaded_by(id, full_name, email),
      approver:approved_by(id, full_name, email)
    `)
    .eq('approval_status', status)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Transform the data for easier consumption
  const transformedContent = content?.map(item => ({
    id: item.id,
    title: item.title,
    type: item.type,
    storagePath: item.storage_path,
    approvalStatus: item.approval_status,
    createdAt: item.created_at,
    approvedAt: item.approved_at,
    rejectionReason: item.rejection_reason,
    fileSize: item.file_size,
    mimeType: item.mime_type,
    module: {
      id: item.modules.id,
      title: item.modules.title
    },
    course: {
      id: item.modules.courses.id,
      title: item.modules.courses.title
    },
    subTopic: item.sub_topics ? {
      id: item.sub_topics.id,
      title: item.sub_topics.title
    } : null,
    uploadedBy: item.uploader ? {
      id: item.uploader.id,
      name: item.uploader.full_name || item.uploader.email,
      email: item.uploader.email
    } : null,
    approvedBy: item.approver ? {
      id: item.approver.id,
      name: item.approver.full_name || item.approver.email
    } : null
  }))

  return NextResponse.json({ content: transformedContent || [] })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  
  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { action, contentIds, rejectionReason } = body

  if (!action || !contentIds || !Array.isArray(contentIds)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Approve content
  if (action === 'approve') {
    const { error } = await supabase
      .from('module_content')
      .update({
        approval_status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: null
      })
      .in('id', contentIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      approved: contentIds.length,
      message: `${contentIds.length} item(s) approved successfully` 
    })
  }

  // Reject content
  if (action === 'reject') {
    if (!rejectionReason || rejectionReason.trim() === '') {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('module_content')
      .update({
        approval_status: 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason
      })
      .in('id', contentIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      rejected: contentIds.length,
      message: `${contentIds.length} item(s) rejected` 
    })
  }

  // Delete content
  if (action === 'delete') {
    // First, get storage paths to delete files
    const { data: contentToDelete } = await supabase
      .from('module_content')
      .select('storage_path')
      .in('id', contentIds)

    // Delete from storage
    if (contentToDelete && contentToDelete.length > 0) {
      const paths = contentToDelete.map(c => c.storage_path)
      await supabase.storage.from('medfellow-content').remove(paths)
    }

    // Delete from database
    const { error } = await supabase
      .from('module_content')
      .delete()
      .in('id', contentIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      deleted: contentIds.length,
      message: `${contentIds.length} item(s) deleted successfully` 
    })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
