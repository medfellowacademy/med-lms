# QUICK FIX: Videos Not Showing

## Problem Confirmed
Console shows: `Video URLs: {}` and `Active Video: null`
This means signed URLs are not being generated.

## FIX NOW (5 minutes):

### Step 1: Get Correct Service Role Key
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **⚙️ Project Settings** (bottom left)
4. Click **API** in the sidebar
5. Scroll to **Project API keys** section
6. Find **service_role** key (NOT anon!)
7. Click **👁️ Reveal** button
8. Copy the ENTIRE key (should be ~200+ characters, starts with `eyJ...`)

### Step 2: Update Vercel Environment Variable
1. Go to https://vercel.com/dashboard
2. Select your project: `med-lms`
3. Go to **Settings** → **Environment Variables**
4. Find `SUPABASE_SERVICE_ROLE_KEY`
5. Click **•••** → **Edit**
6. **Delete the current value**
7. **Paste the new service_role key** from Supabase
8. Make sure there are NO extra spaces or line breaks
9. Click **Save**

### Step 3: Redeploy
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **⋯** menu → **Redeploy**
4. Wait for deployment to complete (~2 minutes)

### Step 4: Test
1. Go to your live site
2. Open a course with videos
3. Check browser console - should see:
   ```
   Video URLs: { [id]: "https://..." }
   Active Video: { id: "...", title: "..." }
   ```
4. Videos should now play!

## Still Not Working?

### Run Diagnostic:
Visit: `https://your-site.vercel.app/api/test-storage`

This will tell you:
- ✅ If service role key is now working
- ✅ How many videos are in storage
- ✅ If signed URLs can be generated
- ⚠️ What's still wrong

### Check if Videos Exist:
1. Are there actually videos uploaded?
   - Go to admin panel: `/admin/courses/[id]/upload`
   - Upload a test video

2. Are videos approved?
   - Go to: `/admin/content-review`
   - Approve pending videos

3. Is the module unlocked?
   - Students can't see videos in locked modules
   - Unlock module in admin courses page

## Why This Happened:
- Supabase Storage requires `service_role` key to create signed URLs
- Your key had a "Needs Attention" warning = not working
- Without valid key, no signed URLs = no videos

## Prevention:
- Always verify env vars after adding them
- No "Needs Attention" warnings should exist
- Test with `/api/test-storage` endpoint after deployment
