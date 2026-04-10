import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const moduleId = new URL(req.url).searchParams.get('module_id')

  if (!moduleId) {
    return NextResponse.json({ error: 'module_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sub_topics')
    .select('*')
    .eq('module_id', moduleId)
    .order('order_index')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { moduleId, title, orderIndex } = await req.json()

  if (!moduleId || !title) {
    return NextResponse.json({ error: 'moduleId and title required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sub_topics')
    .insert({
      module_id: moduleId,
      title: title.trim(),
      order_index: orderIndex || 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { id, title, orderIndex } = await req.json()

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const updates: any = {}
  if (title !== undefined) updates.title = title.trim()
  if (orderIndex !== undefined) updates.order_index = orderIndex

  const { data, error } = await supabase
    .from('sub_topics')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const id = new URL(req.url).searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('sub_topics')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
