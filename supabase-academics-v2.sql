-- Add enrollment status (pass/fail/discontinued/active)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'pass', 'fail', 'discontinued'));

-- Student documents table
CREATE TABLE IF NOT EXISTS student_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        text NOT NULL,
  file_type    text NOT NULL DEFAULT 'file',
  storage_path text NOT NULL,
  uploaded_at  timestamptz DEFAULT now()
);

ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage student documents" ON student_documents
  FOR ALL USING (get_my_role() = 'admin');

-- Allow the storage bucket to serve student-docs folder
-- Run this in your Supabase dashboard > Storage > Policies on the medfellow-content bucket
-- or create a separate bucket named "student-docs" with admin-only access.
