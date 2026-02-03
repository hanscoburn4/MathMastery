/*
  # Fix Classes and Enrollments Circular Dependency
  
  ## Problem
  There is a circular dependency between classes and enrollments RLS policies:
  1. classes "Parents can view student classes" policy queries enrollments
  2. enrollments "Teachers can manage enrollments" policy queries classes
  3. When teachers try to view their classes, this circular query causes failures
  
  ## Solution
  Create a security definer function to check if a user is a teacher of a class,
  then use it in the enrollments policy to break the circular dependency.
  
  ## Changes
  1. Create is_teacher_of_class helper function with SECURITY DEFINER
  2. Update enrollments teacher policy to use the helper function
  3. This breaks the circular dependency: classes -> enrollments -> function (no RLS)
*/

-- Create helper function to check if user is teacher of a class
-- SECURITY DEFINER bypasses RLS to prevent circular dependencies
CREATE OR REPLACE FUNCTION is_teacher_of_class(p_class_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM classes 
    WHERE id = p_class_id 
      AND teacher_id = auth.uid()
  );
END;
$$;

-- Drop and recreate the teacher enrollment policy using the helper function
DROP POLICY IF EXISTS "Teachers can manage enrollments for their classes" ON enrollments;

CREATE POLICY "Teachers can manage enrollments for their classes"
  ON enrollments
  FOR ALL
  TO authenticated
  USING (is_teacher_of_class(class_id))
  WITH CHECK (is_teacher_of_class(class_id));
