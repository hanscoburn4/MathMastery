/*
  # Fix Circular Dependency in Classes RLS

  ## Problem
  The classes table has an RLS policy that queries the profiles table,
  which can create an infinite recursion when profiles policies query
  parent_student_links, which in turn references classes through enrollments.

  ## Changes
  1. Drop the "Parents can view linked student classes" policy that queries profiles
  2. Recreate it using JWT metadata instead of querying profiles table
     - Uses auth.jwt() -> 'user_metadata' ->> 'role' to check if user is a parent
     - This breaks the circular dependency while maintaining security

  ## Security
  - Parents can only view classes for students they're linked to
  - Teachers and students maintain their existing access
*/

-- Drop the problematic policy that queries profiles table
DROP POLICY IF EXISTS "Parents can view linked student classes" ON classes;

-- Recreate policy using JWT metadata instead of profiles table query
CREATE POLICY "Parents can view linked student classes"
  ON classes
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'parent')
    AND EXISTS (
      SELECT 1
      FROM parent_student_links psl
      JOIN enrollments e ON e.student_id = psl.student_id
      WHERE psl.parent_id = auth.uid()
      AND e.class_id = classes.id
    )
  );
