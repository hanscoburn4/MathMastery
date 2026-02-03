/*
  # Fix Circular Dependency in Parent-Student Links RLS

  ## Problem
  The parent_student_links table has RLS policies that query the profiles table,
  which creates an infinite recursion when profiles policies query parent_student_links.

  ## Changes
  1. Drop the three teacher policies that cause circular dependency:
     - "Teachers can view links for their students"
     - "Teachers can create links for their students"
     - "Teachers can delete links for their students"
  
  2. Recreate these policies using JWT metadata instead of querying profiles table
     - Uses auth.jwt() -> 'user_metadata' ->> 'role' to check if user is a teacher
     - This breaks the circular dependency while maintaining security

  ## Security
  - Teachers can only access links for students they teach (verified via enrollments)
  - Parents can only see their own student links
  - Students can only see their own parent links
*/

-- Drop the problematic policies that query profiles table
DROP POLICY IF EXISTS "Teachers can view links for their students" ON parent_student_links;
DROP POLICY IF EXISTS "Teachers can create links for their students" ON parent_student_links;
DROP POLICY IF EXISTS "Teachers can delete links for their students" ON parent_student_links;

-- Recreate policies using JWT metadata instead of profiles table query
CREATE POLICY "Teachers can view links for their students"
  ON parent_student_links
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher')
    AND EXISTS (
      SELECT 1
      FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = parent_student_links.student_id
      AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can create links for their students"
  ON parent_student_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher')
    AND EXISTS (
      SELECT 1
      FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = parent_student_links.student_id
      AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete links for their students"
  ON parent_student_links
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher')
    AND EXISTS (
      SELECT 1
      FROM enrollments e
      JOIN classes c ON c.id = e.class_id
      WHERE e.student_id = parent_student_links.student_id
      AND c.teacher_id = auth.uid()
    )
  );
