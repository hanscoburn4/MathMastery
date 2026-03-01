/*
  # Optimize RLS Policies - Part 3 (Objectives and Invitations)

  1. Performance Improvements
    - Replace `auth.uid()` with `(SELECT auth.uid())` in RLS policies
    - Prevents re-evaluation of auth functions for each row
  
  2. Tables Updated
    - `objectives` - All RLS policies optimized
    - `invitations` - All RLS policies optimized
*/

-- Drop and recreate objectives policies
DROP POLICY IF EXISTS "Teachers can manage objectives for own classes" ON objectives;
DROP POLICY IF EXISTS "Students can view objectives for enrolled classes" ON objectives;
DROP POLICY IF EXISTS "Parents can view objectives for linked student classes" ON objectives;

CREATE POLICY "Teachers can manage objectives for own classes"
  ON objectives FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM units
      JOIN classes ON classes.id = units.class_id
      WHERE units.id = objectives.unit_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM units
      JOIN classes ON classes.id = units.class_id
      WHERE units.id = objectives.unit_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Students can view objectives for enrolled classes"
  ON objectives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM units
      JOIN enrollments ON enrollments.class_id = units.class_id
      WHERE units.id = objectives.unit_id
      AND enrollments.student_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Parents can view objectives for linked student classes"
  ON objectives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM units
      JOIN enrollments e ON e.class_id = units.class_id
      JOIN parent_student_links psl ON psl.student_id = e.student_id
      WHERE units.id = objectives.unit_id
      AND psl.parent_id = (SELECT auth.uid())
    )
  );

-- Drop and recreate invitations policies
DROP POLICY IF EXISTS "Teachers can manage invitations for own classes" ON invitations;
DROP POLICY IF EXISTS "Anyone can read invitation by token for registration" ON invitations;

CREATE POLICY "Teachers can manage invitations for own classes"
  ON invitations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = invitations.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = invitations.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Anyone can read invitation by token for registration"
  ON invitations FOR SELECT
  TO authenticated
  USING (true);