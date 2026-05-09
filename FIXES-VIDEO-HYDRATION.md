# 🔧 Video Access & Hydration Error - Complete Fix Guide

## Issues Fixed

### ✅ Issue 1: React Hydration Error (#418)
**Problem:** The date in the dashboard banner was rendering differently on server vs client, causing a hydration mismatch.

**Root Cause:** Using `new Date().toLocaleDateString()` directly in JSX creates different timestamps on server and client renders.

**Fix Applied:** Modified [DashboardClient.tsx](components/DashboardClient.tsx) to:
- Use `useState` to store the date
- Set the date only on the client side with `useEffect`
- Prevents server/client mismatch

---

### ✅ Issue 2: Limited Videos in Student Account
**Problem:** Students can only see videos with `approval_status = 'approved'`.

**Root Cause:** The Content Approval System filters videos by approval status. When videos are uploaded, they default to `'pending'` status and require admin approval.

**How Video Access Works:**

1. **Upload** → Video stored in Supabase Storage
2. **Database Record** → Created in `module_content` table with `approval_status = 'pending'`
3. **Admin Approval** → Admin must approve via `/admin/content-review` page
4. **Student Access** → Only `approval_status = 'approved'` videos show to students

**Student Query Filter (from [page.tsx](app/student/courses/[id]/page.tsx#L80)):**
```typescript
const { data: contentItems } = await supabase
  .from('module_content')
  .select('*')
  .in('module_id', accessibleModuleIds)
  .eq('approval_status', 'approved')  // ← This filters videos!
  .order('order_index')
```

---

## How to Fix the Limited Videos Issue

### Option 1: Quick Fix - Approve All Videos (Recommended)

Run the SQL script I created: [fix-video-approval.sql](fix-video-approval.sql)

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy and run the entire script
4. This will:
   - Show you which videos are pending
   - Approve ALL pending/null videos
   - Verify the fix
   - Optionally set auto-approve for future uploads

**Key SQL Command:**
```sql
UPDATE module_content 
SET 
  approval_status = 'approved',
  approved_at = now()
WHERE type = 'video' 
  AND (approval_status = 'pending' OR approval_status IS NULL);
```

### Option 2: Manual Approval via Admin Panel

1. Login as admin
2. Go to `/admin/content-review`
3. Review and approve each video individually
4. This maintains the approval workflow

### Option 3: Auto-Approve Future Uploads

If you want to bypass approval for all future uploads:

```sql
ALTER TABLE module_content 
  ALTER COLUMN approval_status SET DEFAULT 'approved';
```

⚠️ **Warning:** This means new uploads are immediately visible to students without review.

---

## How to Check if Fix Worked

### Method 1: Check via Supabase Dashboard

```sql
-- Count videos by status
SELECT 
  approval_status, 
  COUNT(*) as count
FROM module_content
WHERE type = 'video'
GROUP BY approval_status;
```

**Expected Result:**
```
approval_status | count
-----------------+-------
approved        | 15    ← All your videos should be here
```

### Method 2: Check via Student Account

1. Login as a student
2. Navigate to a course
3. Check if all videos are now visible
4. Videos should display with thumbnails and be playable

### Method 3: Check Browser Console

1. Open a course page as a student
2. Open browser DevTools (F12) → Console
3. Look for: `Created signed URL for video ${id}: ${title}`
4. Should see: `Total video URLs generated: X` (where X = total videos)

---

## Understanding the Approval System

### Why Does This System Exist?

The Content Approval System was added to:
- Allow admins to review content before publishing
- Prevent students from seeing incomplete/test uploads
- Maintain quality control

### Tables Affected

1. **`module_content`**
   - `approval_status`: 'pending' | 'approved' | 'rejected'
   - `approved_at`: Timestamp when approved
   - `approved_by`: Admin user ID who approved

2. **`course_ebooks`**
   - Same approval columns
   - Also filtered for students

### Database Policies (RLS)

**Student Policy:**
```sql
create policy "content_student_select" on public.module_content for select
  using (
    approval_status = 'approved'  -- ← Students only see approved
    AND exists(...)  -- Also checks enrollment & module unlock
  );
```

**Admin Policy:**
```sql
create policy "content_admin" on public.module_content for all
  using (get_my_role() = 'admin');  -- Admins see everything
```

---

## Future Prevention

### Best Practices

1. **After uploading videos, always approve them** via `/admin/content-review`
2. **Check approval status** before telling students content is available
3. **Use auto-approve** (Option 3 above) if you don't need manual review
4. **Test with student account** after uploading new content

### Monitoring Videos

Create a simple dashboard query:

```sql
-- See all pending content
SELECT 
  mc.title,
  mc.type,
  mc.approval_status,
  m.title as module,
  c.title as course
FROM module_content mc
JOIN modules m ON m.id = mc.module_id
JOIN courses c ON c.id = m.course_id
WHERE mc.approval_status = 'pending'
ORDER BY mc.created_at DESC;
```

---

## Related Files

- [DashboardClient.tsx](app/student/DashboardClient.tsx) - Hydration fix applied
- [page.tsx](app/student/courses/[id]/page.tsx) - Video filtering logic
- [fix-video-approval.sql](fix-video-approval.sql) - SQL fix script
- [supabase-content-approval.sql](supabase-content-approval.sql) - Approval system schema
- [CONTENT-APPROVAL-GUIDE.md](CONTENT-APPROVAL-GUIDE.md) - Full approval system docs

---

## Summary

✅ **React Error Fixed** - Hydration issue resolved in DashboardClient  
✅ **SQL Script Created** - Run `fix-video-approval.sql` to approve all videos  
✅ **Future Prevention** - Use `/admin/content-review` or enable auto-approve  

**Next Steps:**
1. Run the SQL script in Supabase
2. Refresh student course pages
3. All videos should now be visible
4. React hydration error should be gone
