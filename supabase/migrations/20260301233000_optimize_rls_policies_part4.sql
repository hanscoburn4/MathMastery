/*
  # Optimize RLS Policies - Part 4 (Progress Records and Parent Student Links)

  1. Performance Improvements
    - Replace `auth.uid()` with `(SELECT auth.uid())` in RLS policies
    - Prevents re-evaluation of auth functions for each row
  
  2. Tables Updated
    - `progress_records` - All RLS policies optimized
    - `parent_student_links` - All RLS policies optimized
*/

-- Drop and recreate progress_records policies
DROP POLICY IF EXISTS "Teachers can manage progress for students in their classes" ON progress_records;
DROP POLICY IF EXISTS "Students can view own progress" ON progress_records;
DROP POLICY IF EXISTS "Parents can view linked student progress" ON progress_records;

CREATE POLICY "Teachers can manage progress for students in their classes"
  ON progress_records FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN classes ON classes.id = enrollments.class_id
      WHERE enrollments.student_id = progress_records.student_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN classes ON classes.id = enrollments.class_id
      WHERE enrollments.student_id = progress_records.student_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Students can view own progress"
  ON progress_records FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()));

CREATE POLICY "Parents can view linked student progress"
  ON progress_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parent_student_links
      WHERE parent_student_links.parent_id = (SELECT auth.uid())
      AND parent_student_links.student_id = progress_records.student_id
    )
  );

-- Drop and recreate parent_student_links policies
DROP POLICY IF EXISTS "Parents can view own student links" ON parent_student_links;
DROP POLICY IF EXISTS "Students can view parent links" ON parent_student_links;
DROP POLICY IF EXISTS "Teachers can view links for their students" ON parent_student_links;
DROP POLICY IF EXISTS "Teachers can create links for their students" ON parent_student_links;
DROP POLICY IF EXISTS "Teachers can delete links for their students" ON parent_student_links;

CREATE POLICY "Parents can view own student links"
  ON parent_student_links FOR SELECT
  TO authenticated
  USING (parent_id = (SELECT auth.uid()));

CREATE POLICY "Students can view parent links"
  ON parent_student_links FOR SELECT
  TO authenticated
  USING (student_id = (SELECT auth.uid()));

CREATE POLICY "Teachers can view links for their students"
  ON parent_student_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN classes ON classes.id = enrollments.class_id
      WHERE enrollments.student_id = parent_student_links.student_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Teachers can create links for their students"
  ON parent_student_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN classes ON classes.id = enrollments.class_id
      WHERE enrollments.student_id = parent_student_links.student_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Teachers can delete links for their students"
  ON parent_student_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN classes ON classes.id = enrollments.class_id
      WHERE enrollments.student_id = parent_student_links.student_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );