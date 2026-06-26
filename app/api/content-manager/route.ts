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
  const action = searchParams.get('action')

  // Statistics endpoint
  if (action === 'stats') {
    // Get total courses
    const { count: totalCourses } = await supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })

    // Get total modules
    const { count: totalModules } = await supabase
      .from('modules')
      .select('*', { count: 'exact', head: true })

    // Get total content files
    const { count: totalContent } = await supabase
      .from('module_content')
      .select('*', { count: 'exact', head: true })

    // Get category breakdown
    const { data: categoryData } = await supabase
      .from('courses')
      .select('category')

    const categoryBreakdown: Record<string, number> = {}
    categoryData?.forEach(c => {
      const cat = c.category || 'Uncategorized'
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1
    })

    return NextResponse.json({
      totalCourses: totalCourses || 0,
      totalModules: totalModules || 0,
      totalContent: totalContent || 0,
      categoryBreakdown
    })
  }

  // Get all courses with aggregated data
  const { data: courses, error } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      description,
      category,
      created_at
    `)
    .order('title')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get module counts for each course
  const { data: moduleCounts } = await supabase
    .from('modules')
    .select('course_id')

  const moduleCountMap: Record<string, number> = {}
  moduleCounts?.forEach(m => {
    moduleCountMap[m.course_id] = (moduleCountMap[m.course_id] || 0) + 1
  })

  // Get content counts for each course
  const { data: contentCounts } = await supabase
    .from('module_content')
    .select('module_id')

  const { data: modules } = await supabase
    .from('modules')
    .select('id, course_id')

  const moduleToCourse: Record<string, string> = {}
  modules?.forEach(m => {
    moduleToCourse[m.id] = m.course_id
  })

  const contentCountMap: Record<string, number> = {}
  contentCounts?.forEach(c => {
    const courseId = moduleToCourse[c.module_id]
    if (courseId) {
      contentCountMap[courseId] = (contentCountMap[courseId] || 0) + 1
    }
  })

  // Combine data
  const coursesWithStats = courses?.map(course => ({
    ...course,
    moduleCount: moduleCountMap[course.id] || 0,
    contentCount: contentCountMap[course.id] || 0
  }))

  return NextResponse.json({ courses: coursesWithStats || [] })
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
  const { action, courseIds } = body

  if (!action || !courseIds || !Array.isArray(courseIds)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Bulk delete courses
  if (action === 'delete') {
    const { error } = await supabase
      .from('courses')
      .delete()
      .in('id', courseIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted: courseIds.length })
  }

  // Bulk lock/unlock modules
  if (action === 'lock' || action === 'unlock') {
    const isLocked = action === 'lock'
    
    const { error } = await supabase
      .from('modules')
      .update({ is_locked: isLocked })
      .in('course_id', courseIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, action, courses: courseIds.length })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
