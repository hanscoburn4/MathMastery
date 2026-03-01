/*
  # Optimize RLS Policies - Part 2 (Enrollments and Units)

  1. Performance Improvements
    - Replace `auth.uid()` with `(SELECT auth.uid())` in RLS policies
    - Prevents re-evaluation of auth functions for each row
  
  2. Tables Updated
    - `enrollments` - All RLS policies optimized
    - `units` - All RLS policies optimized
*/

-- Drop and recreate enrollments policies
DROP POLICY IF EXISTS "Students can view own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Teachers can manage enrollments for their classes" ON enrollments;
DROP POLICY IF EXISTS "Parents can view student enrollments" ON enrollments;

CREATE POLICY "Students can view own enrollments"
  ON enrollments FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()));

CREATE POLICY "Teachers can manage enrollments for their classes"
  ON enrollments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = enrollments.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = enrollments.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Parents can view student enrollments"
  ON enrollments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (SELECT auth.uid())
      AND parent_student_links.student_id = enrollments.student_id
    )
  );

-- Drop and recreate units policies
DROP POLICY IF EXISTS "Teachers can manage units for own classes" ON units;
DROP POLICY IF EXISTS "Students can view units for enrolled classes" ON units;
DROP POLICY IF EXISTS "Parents can view units for linked student classes" ON units;

CREATE POLICY "Teachers can manage units for own classes"
  ON units FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = units.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = units.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Students can view units for enrolled classes"
  ON units FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.class_id = units.class_id
      AND enrollments.student_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Parents can view units for linked student classes"
  ON units FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links psl
      JOIN enrollments e ON e.student_id = psl.student_id
      WHERE psl.parent_id = (SELECT auth.uid())
      AND e.class_id = units.class_id
    )
  );