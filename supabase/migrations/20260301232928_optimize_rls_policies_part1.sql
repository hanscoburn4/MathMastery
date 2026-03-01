/*
  # Optimize RLS Policies - Part 1 (Profiles and Classes)

  1. Performance Improvements
    - Replace `auth.uid()` with `(SELECT auth.uid())` in RLS policies
    - This prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale
  
  2. Tables Updated
    - `profiles` - All RLS policies optimized
    - `classes` - All RLS policies optimized
  
  3. Security Notes
    - Policies maintain exact same security logic
    - Only optimization technique is changed
    - All access control rules remain identical
*/

-- Drop and recreate profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Teachers can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Parents can view linked student profiles" ON profiles;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "Teachers can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'teacher'
    )
  );

CREATE POLICY "Parents can view linked student profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (SELECT auth.uid())
      AND parent_student_links.student_id = profiles.id
    )
  );

-- Drop and recreate classes policies
DROP POLICY IF EXISTS "Teachers can manage own classes" ON classes;
DROP POLICY IF EXISTS "Students can view enrolled classes" ON classes;
DROP POLICY IF EXISTS "Parents can view student classes" ON classes;

CREATE POLICY "Teachers can manage own classes"
  ON classes FOR ALL
  TO authenticated
  USING (teacher_id = (SELECT auth.uid()))
  WITH CHECK (teacher_id = (SELECT auth.uid()));

CREATE POLICY "Students can view enrolled classes"
  ON classes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.class_id = classes.id
      AND enrollments.student_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Parents can view student classes"
  ON classes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links psl
      JOIN enrollments e ON e.student_id = psl.student_id
      WHERE psl.parent_id = (SELECT auth.uid())
      AND e.class_id = classes.id
    )
  );