-- Academic profile fields for students
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registration_number text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS batch_year int;

-- Auto-generate registration numbers for existing users
DO $$
DECLARE
  rec RECORD;
  counter INT := 1;
BEGIN
  FOR rec IN
    SELECT id, created_at FROM profiles
    WHERE registration_number IS NULL
    ORDER BY created_at ASC
  LOOP
    UPDATE profiles
    SET registration_number = 'MF-' || TO_CHAR(rec.created_at, 'YYYY') || '-' || LPAD(counter::text, 4, '0')
    WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- Trigger to auto-assign registration number on new student insert
CREATE OR REPLACE FUNCTION assign_registration_number()
RETURNS TRIGGER AS $$
DECLARE
  year_str text;
  next_num int;
BEGIN
  IF NEW.registration_number IS NULL THEN
    year_str := TO_CHAR(NOW(), 'YYYY');
    SELECT COALESCE(MAX(
      NULLIF(REGEXP_REPLACE(registration_number, '^MF-\d{4}-', ''), '')::int
    ), 0) + 1
    INTO next_num
    FROM profiles
    WHERE registration_number LIKE 'MF-' || year_str || '-%';
    NEW.registration_number := 'MF-' || year_str || '-' || LPAD(next_num::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_registration_number ON profiles;
CREATE TRIGGER trg_assign_registration_number
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION assign_registration_number();

-- Course end date on enrollments
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS course_end_date date;
