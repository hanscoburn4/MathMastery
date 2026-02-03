/*
  # Fix Student Access to Classes
  
  1. Changes
    - Create a security definer function to check if a student is enrolled in a class
    - Add RLS policy for students to view classes they're enrolled in
    - This approach avoids circular dependency issues
  
  2. Security
    - Students can only view classes they are enrolled in
    - Function uses security definer to bypass RLS for enrollment check
    - Maintains data isolation between students
*/

-- Create a security definer function to check if user is enrolled in a class
CREATE OR REPLACE FUNCTION is_student_enrolled_in_class(class_id uuid, student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM enrollments
    WHERE enrollments.class_id = is_student_enrolled_in_class.class_id
    AND enrollments.student_id = is_student_enrolled_in_class.student_id
  );
$$;

-- Add policy for students to view their enrolled classes
CREATE POLICY "Students can view enrolled classes"
  ON classes
  FOR SELECT
  TO authenticated
  USING (is_student_enrolled_in_class(id, auth.uid()));
