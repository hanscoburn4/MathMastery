/*
  # Add Class Codes and Parent Account Support

  ## Overview
  This migration adds support for class codes, parent accounts, and parent-student linking.

  ## Changes

  ### 1. Classes Table Updates
    - Add `class_code` column (text, unique, 6-character alphanumeric)
    - Generate unique codes for existing classes
    - Add index for fast class code lookups

  ### 2. Profiles Table Updates
    - Update role check constraint to include 'parent' role
    - Parents can view linked student data but cannot modify

  ### 3. New Table: parent_student_links
    - `id` (uuid, primary key)
    - `parent_id` (uuid, references profiles)
    - `student_id` (uuid, references profiles)
    - `created_at` (timestamptz)
    - Unique constraint on (parent_id, student_id) combination

  ### 4. Security (RLS Policies)
    - Enable RLS on parent_student_links table
    - Teachers can manage parent-student links for their classes
    - Parents can view their own links
    - Students can view who is linked to them
    - Parents can access class/unit/objective/progress data for linked students

  ## Notes
    - Class codes are automatically generated as 6-character uppercase codes
    - Existing classes will receive generated codes
    - Parents have read-only access to linked student data
*/

-- Add class_code column to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_code text UNIQUE;

-- Create function to generate unique class code
CREATE OR REPLACE FUNCTION generate_class_code() RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Generate codes for existing classes
DO $$
DECLARE
  class_record RECORD;
  new_code text;
  code_exists boolean;
BEGIN
  FOR class_record IN SELECT id FROM classes WHERE class_code IS NULL LOOP
    LOOP
      new_code := generate_class_code();
      SELECT EXISTS(SELECT 1 FROM classes WHERE class_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    UPDATE classes SET class_code = new_code WHERE id = class_record.id;
  END LOOP;
END $$;

-- Make class_code NOT NULL after populating existing records
ALTER TABLE classes ALTER COLUMN class_code SET NOT NULL;

-- Add default for new classes
ALTER TABLE classes ALTER COLUMN class_code SET DEFAULT generate_class_code();

-- Create index on class_code for fast lookups
CREATE INDEX IF NOT EXISTS idx_classes_class_code ON classes(class_code);

-- Update profiles role constraint to include 'parent'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('teacher', 'student', 'parent'));

-- Create parent_student_links table
CREATE TABLE IF NOT EXISTS parent_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(parent_id, student_id),
  CHECK (parent_id != student_id)
);

-- Enable RLS on parent_student_links
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for parent_student_links table

-- Parents can view their own links
CREATE POLICY "Parents can view own student links"
  ON parent_student_links FOR SELECT
  TO authenticated
  USING (auth.uid() = parent_id);

-- Students can view their parent links
CREATE POLICY "Students can view parent links"
  ON parent_student_links FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
  );

-- Teachers can view links for students in their classes
CREATE POLICY "Teachers can view links for their students"
  ON parent_student_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
    AND EXISTS (
      SELECT 1 FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = parent_student_links.student_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Teachers can create links for students in their classes
CREATE POLICY "Teachers can create links for their students"
  ON parent_student_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
    AND EXISTS (
      SELECT 1 FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = parent_student_links.student_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Teachers can delete links for students in their classes
CREATE POLICY "Teachers can delete links for their students"
  ON parent_student_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
    AND EXISTS (
      SELECT 1 FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = parent_student_links.student_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Update RLS policies for parents to access student data

-- Parents can view classes their students are enrolled in
CREATE POLICY "Parents can view linked student classes"
  ON classes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'parent'
    )
    AND EXISTS (
      SELECT 1 FROM parent_student_links psl
      JOIN enrollments e ON e.student_id = psl.student_id
      WHERE psl.parent_id = auth.uid()
      AND e.class_id = classes.id
    )
  );

-- Parents can view enrollments for their linked students
CREATE POLICY "Parents can view linked student enrollments"
  ON enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid()
      AND student_id = enrollments.student_id
    )
  );

-- Parents can view units for classes their students are in
CREATE POLICY "Parents can view units for linked student classes"
  ON units FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links psl
      JOIN enrollments e ON e.student_id = psl.student_id
      WHERE psl.parent_id = auth.uid()
      AND e.class_id = units.class_id
    )
  );

-- Parents can view objectives for their students' classes
CREATE POLICY "Parents can view objectives for linked student classes"
  ON objectives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links psl
      JOIN enrollments e ON e.student_id = psl.student_id
      JOIN units u ON u.class_id = e.class_id
      WHERE psl.parent_id = auth.uid()
      AND u.id = objectives.unit_id
    )
  );

-- Parents can view progress records for their linked students
CREATE POLICY "Parents can view linked student progress"
  ON progress_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid()
      AND student_id = progress_records.student_id
    )
  );

-- Parents can view their linked students' profiles
CREATE POLICY "Parents can view linked student profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_id = auth.uid()
      AND student_id = profiles.id
    )
  );