/*
  # Fix Profiles Table Circular Dependency

  ## Problem
  The "Parents can view linked student profiles" policy creates a circular dependency:
  - profiles queries parent_student_links
  - parent_student_links policies query enrollments and classes
  - This creates a circular chain causing 500 errors

  ## Solution
  Update the profiles parent policy to use the is_parent_of_student helper function
  which has SECURITY DEFINER to bypass RLS and prevent circular dependencies

  ## Changes
  - Drop "Parents can view linked student profiles" policy
  - Recreate it using the is_parent_of_student helper function
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Parents can view linked student profiles" ON profiles;

-- Recreate using the helper function (no circular dependency)
CREATE POLICY "Parents can view linked student profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_parent_of_student(id)
  );
