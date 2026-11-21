-- Per-student module access overrides
-- Allows admins to unlock/lock specific modules for individual students
-- regardless of the global is_locked flag on the module.

CREATE TABLE IF NOT EXISTS student_module_access (
  student_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,
  module_id   uuid REFERENCES modules(id)  ON DELETE CASCADE,
  is_unlocked boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (student_id, module_id)
);

ALTER TABLE student_module_access ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage student module access" ON student_module_access
  FOR ALL USING (get_my_role() = 'admin');

-- Students can read their own overrides
CREATE POLICY "Students read own module access" ON student_module_access
  FOR SELECT USING (auth.uid() = student_id);
