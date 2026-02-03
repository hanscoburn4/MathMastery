/*
  # Fix Circular Dependencies in RLS Policies

  ## Problem
  The RLS policies created circular dependency chains that caused login to hang:
  - profiles table queries parent_student_links
  - parent_student_links queries enrollments and classes
  - enrollments and classes query back to parent_student_links (circular!)

  ## Solution
  1. Remove problematic policies from enrollments and classes that query parent_student_links
  2. Parents will access student data through the application layer using student_id
  3. Add new policies that allow parents to query enrollments/classes by student_id
     without creating circular dependencies

  ## Changes
  - Drop "Parents can view linked student enrollments" policy from enrollments
  - Drop "Parents can view linked student classes" policy from classes
  - Add new parent policies that use a helper function to avoid circular dependencies
*/

-- First, create a helper function that checks parent-student relationship
-- This function has SECURITY DEFINER to bypass RLS and avoid circular dependencies
CREATE OR REPLACE FUNCTION is_parent_of_student(p_student_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM parent_student_links 
    WHERE parent_id = auth.uid() 
      AND student_id = p_student_id
  );
END;
$$;

-- Drop the problematic policies that create circular dependencies
DROP POLICY IF EXISTS "Parents can view linked student enrollments" ON enrollments;
DROP POLICY IF EXISTS "Parents can view linked student classes" ON classes;

-- Recreate parent policies using the helper function (no circular dependency)
CREATE POLICY "Parents can view student enrollments"
  ON enrollments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'parent') 
    AND is_parent_of_student(student_id)
  );

CREATE POLICY "Parents can view student classes"
  ON classes
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'parent')
    AND EXISTS (
      SELECT 1 
      FROM enrollments e
      WHERE e.class_id = classes.id
        AND is_parent_of_student(e.student_id)
    )
  );
