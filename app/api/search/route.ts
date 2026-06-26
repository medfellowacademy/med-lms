import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

interface SearchResult {
  result_type: string
  id: string
  title: string
  description: string | null
  course_id: string
  module_id: string | null
  rank: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ results: [] })
    }

    const supabase = await createServerSupabase()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'student'

    // Call the search function
    const { data: results, error } = await supabase
      .rpc('search_content', {
        search_query: query.trim(),
        user_role: userRole,
        user_id_param: user.id
      })

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    // Group results by type
    const groupedResults = {
      courses: [] as SearchResult[],
      modules: [] as SearchResult[],
      subtopics: [] as SearchResult[],
      content: [] as SearchResult[]
    }

    results?.forEach((result: SearchResult) => {
      switch (result.result_type) {
        case 'course':
          groupedResults.courses.push(result)
          break
        case 'module':
          groupedResults.modules.push(result)
          break
        case 'subtopic':
          groupedResults.subtopics.push(result)
          break
        case 'content':
          groupedResults.content.push(result)
          break
      }
    })

    return NextResponse.json({ 
      results: groupedResults,
      total: results?.length || 0 
    })
  } catch (error) {
    console.error('Search route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
