-- ==========================================
-- EBOOK FIX: Check and approve pending ebooks
-- ==========================================

-- Check current ebook status
SELECT 
  id,
  title,
  course_id,
  storage_path,
  approval_status,
  created_at
FROM course_ebooks
ORDER BY created_at DESC;

-- Approve ALL pending ebooks (run this to fix them)
UPDATE course_ebooks 
SET 
  approval_status = 'approved',
  approved_at = now()
WHERE approval_status = 'pending' OR approval_status IS NULL;

-- Verify after update
SELECT approval_status, COUNT(*) as count
FROM course_ebooks
GROUP BY approval_status;


SELECT 
  id,
  title,
  type,
  storage_path,
  approval_status,
  module_id,
  sub_topic_id,
  created_at
FROM module_content 
WHERE type = 'video'
ORDER BY created_at DESC
LIMIT 10;

-- ==========================================
-- STEP 2: Get High Risk Pregnancy course and check its modules
-- ==========================================
SELECT 
  c.id as course_id,
  c.title as course_title,
  m.id as module_id,
  m.title as module_title,
  m.is_locked,
  m.order_index,
  COUNT(mc.id) FILTER (WHERE mc.type = 'video') as video_count
FROM courses c
LEFT JOIN modules m ON m.course_id = c.id
LEFT JOIN module_content mc ON m.id = mc.module_id AND mc.type = 'video'
WHERE c.title ILIKE '%high risk pregnancy%'
GROUP BY c.id, c.title, m.id, m.title, m.is_locked, m.order_index
ORDER BY m.order_index;

-- ==========================================
-- STEP 3: Check MODULE 1 videos specifically
-- ==========================================
SELECT 
  mc.id,
  mc.title,
  mc.type,
  mc.storage_path,
  mc.approval_status,
  mc.order_index,
  mc.sub_topic_id,
  m.title as module_title,
  m.is_locked as module_locked,
  c.title as course_title
FROM module_content mc
JOIN modules m ON m.id = mc.module_id
JOIN courses c ON c.id = m.course_id
WHERE c.title ILIKE '%high risk pregnancy%'
  AND m.title ILIKE '%Basics of High-Risk Pregnancy%'
  AND mc.type = 'video'
ORDER BY mc.order_index;

-- ==========================================
-- STEP 4: Check storage bucket exists
-- ==========================================
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets 
WHERE id = 'medfellow-content';

-- ==========================================
-- STEP 5: Check if there are video files in storage
-- ==========================================
SELECT 
  name,
  bucket_id,
  (metadata->>'size')::bigint / 1024 / 1024 as size_mb,
  created_at
FROM storage.objects 
WHERE bucket_id = 'medfellow-content' 
  AND name LIKE 'videos/%'
ORDER BY created_at DESC
LIMIT 10;

-- ==========================================
-- STEP 6: Check sub-topics for Module 1 (in case videos are there)
-- ==========================================
SELECT 
  st.id as subtopic_id,
  st.title as subtopic_title,
  st.is_locked as subtopic_locked,
  st.order_index,
  m.title as module_title,
  COUNT(mc.id) FILTER (WHERE mc.type = 'video') as video_count
FROM sub_topics st
JOIN modules m ON m.id = st.module_id
JOIN courses c ON c.id = m.course_id
LEFT JOIN module_content mc ON mc.sub_topic_id = st.id AND mc.type = 'video'
WHERE c.title ILIKE '%high risk pregnancy%'
  AND m.title ILIKE '%Basics of High-Risk Pregnancy%'
GROUP BY st.id, st.title, st.is_locked, st.order_index, m.title
ORDER BY st.order_index;
