/*
  # Fix Profiles RLS Circular Reference

  1. Changes
    - Drop the problematic "Teachers can read all profiles" policy that causes circular dependency
    - Create a new policy that checks user role from JWT metadata instead of querying profiles table
    - This avoids the circular reference that was causing 500 errors

  2. Security
    - Teachers can still read all profiles
    - Users can still read their own profiles
    - Uses auth.jwt() to check role without querying profiles table
*/

-- Drop the old policy that causes circular reference
DROP POLICY IF EXISTS "Teachers can read all profiles" ON profiles;

-- Create new policy using JWT metadata
CREATE POLICY "Teachers can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'role'),
      (auth.jwt() ->> 'role'),
      ''
    ) = 'teacher'
  );
