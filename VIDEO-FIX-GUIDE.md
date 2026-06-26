# Video Display Issue - Diagnosis & Fix Guide

## Problem
Videos are not showing in the LMS student course pages.

## Root Causes Identified

### 1. **Missing Environment Variables**
The service role key may not be configured properly.

**Check:** Verify your `.env.local` file contains:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # ⚠️ CRITICAL for video signed URLs
```

**To Get Service Role Key:**
1. Go to Supabase Dashboard
2. Project Settings → API
3. Copy the `service_role` secret key (NOT the anon key)
4. Add to `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

### 2. **Storage Bucket Not Created**
The `medfellow-content` bucket must exist in Supabase Storage.

**Fix:**
1. Open your Supabase Dashboard
2. Go to Storage section
3. Check if `medfellow-content` bucket exists
4. If not, run the SQL from `supabase-schema.sql` (lines 183-213)
5. OR manually create bucket:
   - Click "New bucket"
   - Name: `medfellow-content`
   - Public: **OFF** (must be private for security)

### 3. **Storage Policies May Need Service Role Exception**
While service role should bypass RLS, explicit policies help.

**Run this SQL in Supabase SQL Editor:**
```sql
-- Add service role policy for storage access
drop policy if exists "service_role_storage_access" on storage.objects;
create policy "service_role_storage_access" on storage.objects for all
  using (bucket_id = 'medfellow-content');
```

### 4. **Videos Not Actually Uploaded**
Check if videos exist in storage.

**Verify:**
1. Go to Supabase Dashboard → Storage → medfellow-content
2. Check if `videos/` folder contains files
3. If empty, upload test video via Admin panel: `/admin/courses/[id]/upload`

### 5. **Database Records Missing Storage Paths**
Content records may have incorrect or missing `storage_path` values.

**Check Database:**
```sql
-- Run this in Supabase SQL Editor
select 
  id, 
  title, 
  type, 
  storage_path,
  approval_status
from public.module_content 
where type = 'video'
limit 10;
```

**Expected:** `storage_path` should be like: `videos/1234567890-abc123.mp4`

If paths are wrong or missing, videos won't load.

## Quick Diagnostic Steps

### Step 1: Check Browser Console
1. Open student course page
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for errors like:
   - "Failed to create signed URL"
   - "No signed URL returned"
   - Network errors (404, 403)

### Step 2: Check Server Logs
In your terminal running the dev server, look for:
```
Created signed URL for video ${id}: ${title}
Total video URLs generated: X
```

If you see:
- "Failed to create signed URL" → Storage/auth issue
- "No signed URL returned" → File doesn't exist
- "Total video URLs generated: 0" → No videos in database or wrong module selected

### Step 3: Test Storage Access
Create a test API route to verify storage works:

```typescript
// app/api/test-storage/route.ts
import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createServiceSupabase()
  
  // List files in bucket
  const { data: files, error: listError } = await supabase.storage
    .from('medfellow-content')
    .list('videos')
  
  if (listError) {
    return NextResponse.json({ error: 'Cannot list files', details: listError }, { status: 500 })
  }
  
  // Try to create a signed URL for first video
  if (files && files.length > 0) {
    const { data, error } = await supabase.storage
      .from('medfellow-content')
      .createSignedUrl(`videos/${files[0].name}`, 3600)
    
    return NextResponse.json({ 
      filesFound: files.length,
      firstFile: files[0].name,
      signedUrlCreated: !!data?.signedUrl,
      signedUrl: data?.signedUrl,
      error: error?.message 
    })
  }
  
  return NextResponse.json({ filesFound: 0 })
}
```

Access: `http://localhost:3000/api/test-storage`

### Step 4: Verify Video Records
```sql
-- Check if videos are approved
select 
  mc.id,
  mc.title,
  mc.type,
  mc.storage_path,
  mc.approval_status,
  m.title as module_title,
  m.is_locked
from public.module_content mc
join public.modules m on m.id = mc.module_id
where mc.type = 'video'
order by mc.created_at desc;
```

**Important:** Videos must have `approval_status = 'approved'` to show to students!

## Complete Fix Checklist

- [ ] 1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`
- [ ] 2. Restart Next.js dev server after adding env var
- [ ] 3. Verify `medfellow-content` bucket exists in Supabase Storage
- [ ] 4. Run storage policy SQL if needed
- [ ] 5. Upload test video via admin panel
- [ ] 6. Approve video in Content Review page (`/admin/content-review`)
- [ ] 7. Check video record has correct `storage_path` in database
- [ ] 8. Verify module is unlocked (`is_locked = false`)
- [ ] 9. Check browser console for errors
- [ ] 10. Test with `/api/test-storage` route

## Common Error Messages & Fixes

### "Video not available - This video is being processed..."
**Cause:** No signed URL was generated
**Fix:** Check service role key, storage bucket exists, file exists at storage_path

### "Failed to create signed URL for {path}"
**Cause:** Service role key missing/wrong, or file doesn't exist
**Fix:** Verify SUPABASE_SERVICE_ROLE_KEY and check file exists in storage

### Video player shows but won't play
**Cause:** Signed URL expired or CORS issue
**Fix:** Refresh page (generates new signed URL), check bucket CORS settings

### "Cannot read properties of undefined (videoUrls)"
**Cause:** No videos found in unlocked modules
**Fix:** Unlock module or add video to an unlocked module

## Testing After Fix

1. **Upload a test video:**
   - Go to `/admin/courses/[course-id]/upload`
   - Upload a small test video (keep it under 50MB for testing)
   - Note the module you upload it to

2. **Approve the video:**
   - Go to `/admin/content-review`
   - Find your video
   - Click "Approve"

3. **Unlock the module:**
   - Go to `/admin/courses/[course-id]`
   - Find the module with your video
   - Make sure it's not locked (or unlock it)

4. **Test as student:**
   - Go to `/student/courses/[course-id]`
   - Select the module
   - Video should appear and play

## Still Not Working?

If videos still don't show after following all steps:

1. **Check the exact error** in browser console
2. **Share the error** from server logs
3. **Verify** one uploaded video file:
   - Check it exists: Supabase Storage → medfellow-content → videos
   - Check database record: Has correct storage_path, is approved
   - Check module: Is unlocked, has correct course_id

4. **Test with minimal setup:**
   - Create fresh course
   - Create one module (unlocked)
   - Upload one small video
   - Approve it immediately
   - Test student view

## Need Help?

Provide these details:
- Error messages from browser console
- Error messages from server logs (terminal)
- Result from `/api/test-storage` test
- Screenshot of Supabase Storage bucket contents
- Result of the "Check if videos are approved" SQL query
