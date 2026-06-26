-- ==========================================
-- FIX VIDEO APPROVAL STATUS
-- ==========================================
-- Run this script in Supabase SQL Editor to make all videos visible to students

-- ==========================================
-- STEP 1: Check current status of videos
-- ==========================================
SELECT 
  approval_status, 
  COUNT(*) as count
FROM module_content
WHERE type = 'video'
GROUP BY approval_status;

-- ==========================================
-- STEP 2: See which videos are pending/null
-- ==========================================
SELECT 
  mc.id,
  mc.title,
  mc.type,
  mc.storage_path,
  mc.approval_status,
  m.title as module_title,
  m.is_locked,
  c.title as course_title
FROM module_content mc
JOIN modules m ON m.id = mc.module_id
JOIN courses c ON c.id = m.course_id
WHERE mc.type = 'video'
  AND (mc.approval_status = 'pending' OR mc.approval_status IS NULL)
ORDER BY mc.created_at DESC;

-- ==========================================
-- STEP 3: APPROVE ALL PENDING/NULL VIDEOS
-- ==========================================
-- This will make ALL videos visible to students immediately

UPDATE module_content 
SET 
  approval_status = 'approved',
  approved_at = now(),
  approved_by = (SELECT id FROM auth.users WHERE email LIKE '%admin%' LIMIT 1)
WHERE type = 'video' 
  AND (approval_status = 'pending' OR approval_status IS NULL);

-- ==========================================
-- STEP 4: Verify the fix
-- ==========================================
SELECT 
  approval_status, 
  COUNT(*) as count
FROM module_content
WHERE type = 'video'
GROUP BY approval_status;

-- ==========================================
-- STEP 5: Also approve ebooks if needed
-- ==========================================
UPDATE course_ebooks 
SET 
  approval_status = 'approved',
  approved_at = now(),
  approved_by = (SELECT id FROM auth.users WHERE email LIKE '%admin%' LIMIT 1)
WHERE approval_status = 'pending' OR approval_status IS NULL;

-- ==========================================
-- OPTIONAL: Auto-approve all future uploads
-- ==========================================
-- If you want to bypass the approval system entirely,
-- change the default in the schema:

-- For module_content:
ALTER TABLE module_content 
  ALTER COLUMN approval_status SET DEFAULT 'approved';

-- For course_ebooks:
ALTER TABLE course_ebooks 
  ALTER COLUMN approval_status SET DEFAULT 'approved';

-- Note: This means new uploads will be immediately visible to students
-- without admin review. Remove if you want manual approval workflow.

-- ==========================================
-- FINAL VERIFICATION
-- ==========================================
SELECT 
  c.title as course,
  m.title as module,
  m.is_locked,
  COUNT(mc.id) FILTER (WHERE mc.type = 'video' AND mc.approval_status = 'approved') as approved_videos,
  COUNT(mc.id) FILTER (WHERE mc.type = 'video' AND mc.approval_status = 'pending') as pending_videos,
  COUNT(mc.id) FILTER (WHERE mc.type = 'video') as total_videos
FROM courses c
JOIN modules m ON m.course_id = c.id
LEFT JOIN module_content mc ON mc.module_id = m.id
GROUP BY c.title, m.title, m.is_locked
ORDER BY c.title, m.order_index;
