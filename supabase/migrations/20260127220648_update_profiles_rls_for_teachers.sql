/*
  # Update Profiles RLS for Teachers

  1. Changes
    - Recreate the teacher policy to properly check user metadata
    - Use coalesce to handle different JWT structures
    - Ensure teachers can read all profiles without circular dependency

  2. Security
    - Users can always read their own profile
    - Teachers can read all profiles based on JWT metadata
*/

-- Drop existing teacher policy
DROP POLICY IF EXISTS "Teachers can read all profiles" ON profiles;

-- Recreate with proper JWT metadata check
CREATE POLICY "Teachers can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt()->'user_metadata'->>'role')::text,
      (auth.jwt()->>'role')::text,
      ''
    ) = 'teacher'
  );