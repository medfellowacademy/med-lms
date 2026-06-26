import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createServiceSupabase()
  
  try {
    // Test 1: Check if we can access the bucket
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    
    if (bucketError) {
      return NextResponse.json({ 
        success: false,
        error: 'Cannot list buckets',
        details: bucketError.message 
      }, { status: 500 })
    }
    
    const medFellowBucket = buckets?.find(b => b.id === 'medfellow-content')
    
    if (!medFellowBucket) {
      return NextResponse.json({
        success: false,
        error: 'Bucket medfellow-content does not exist',
        availableBuckets: buckets?.map(b => b.id) || []
      }, { status: 404 })
    }
    
    // Test 2: List files in the videos folder
    const { data: files, error: listError } = await supabase.storage
      .from('medfellow-content')
      .list('videos', { limit: 10 })
    
    if (listError) {
      return NextResponse.json({ 
        success: false,
        error: 'Cannot list files in videos folder',
        details: listError.message 
      }, { status: 500 })
    }
    
    // Test 3: Get video records from database
    const { data: videoRecords, error: dbError } = await supabase
      .from('module_content')
      .select('id, title, storage_path, approval_status, type')
      .eq('type', 'video')
      .limit(5)
    
    if (dbError) {
      return NextResponse.json({ 
        success: false,
        error: 'Cannot query video records from database',
        details: dbError.message 
      }, { status: 500 })
    }
    
    // Test 4: Try to create a signed URL for the first video file
    let signedUrlTest = null
    if (files && files.length > 0) {
      const testPath = `videos/${files[0].name}`
      const { data: urlData, error: urlError } = await supabase.storage
        .from('medfellow-content')
        .createSignedUrl(testPath, 3600)
      
      signedUrlTest = {
        filePath: testPath,
        success: !!urlData?.signedUrl,
        url: urlData?.signedUrl ? urlData.signedUrl.substring(0, 100) + '...' : null,
        error: urlError?.message
      }
    }
    
    // Test 5: Check if service role key is set
    const serviceRoleKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      checks: {
        bucketExists: true,
        bucketName: medFellowBucket.name,
        bucketPublic: medFellowBucket.public,
        serviceRoleKeySet,
        filesInStorage: files?.length || 0,
        videoRecordsInDb: videoRecords?.length || 0,
        signedUrlTest
      },
      storageFiles: files?.map(f => ({
        name: f.name,
        size: f.metadata?.size,
        created: f.created_at
      })),
      databaseRecords: videoRecords?.map(v => ({
        id: v.id,
        title: v.title,
        storage_path: v.storage_path,
        approval_status: v.approval_status
      })),
      recommendations: [
        !serviceRoleKeySet && '⚠️ SUPABASE_SERVICE_ROLE_KEY not set in environment',
        files?.length === 0 && '⚠️ No files found in videos folder - upload videos via admin panel',
        videoRecords?.length === 0 && '⚠️ No video records in database',
        videoRecords?.some(v => v.approval_status !== 'approved') && '⚠️ Some videos are not approved - approve them in /admin/content-review'
      ].filter(Boolean)
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false,
      error: 'Unexpected error during storage test',
      details: error.message 
    }, { status: 500 })
  }
}
