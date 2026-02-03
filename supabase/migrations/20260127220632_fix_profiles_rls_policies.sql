/*
  # Fix Profiles RLS Policies

  1. Changes
    - Drop the problematic "Teachers can read all profiles" policy
    - Simplify to avoid circular dependency
    - Teachers can read all profiles by checking user metadata directly
    - Students can only read their own profile

  2. Security
    - Uses auth.jwt() to access user metadata without querying profiles table
    - Prevents circular dependency in RLS policies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Teachers can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;

-- Create new simplified policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Teachers can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'teacher'
    OR 
    COALESCE((auth.jwt()->'user_metadata'->>'role')::text, '') = 'teacher'
  );