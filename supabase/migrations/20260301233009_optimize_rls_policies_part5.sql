/*
  # Optimize RLS Policies - Part 5 (Bulk Entry Drafts)

  1. Performance Improvements
    - Replace `auth.uid()` with `(SELECT auth.uid())` in RLS policies
    - Prevents re-evaluation of auth functions for each row
  
  2. Tables Updated
    - `bulk_entry_drafts` - All RLS policies optimized
*/

-- Drop and recreate bulk_entry_drafts policies
DROP POLICY IF EXISTS "Teachers can read own drafts" ON bulk_entry_drafts;
DROP POLICY IF EXISTS "Teachers can create drafts for their classes" ON bulk_entry_drafts;
DROP POLICY IF EXISTS "Teachers can update own drafts" ON bulk_entry_drafts;
DROP POLICY IF EXISTS "Teachers can delete own drafts" ON bulk_entry_drafts;

CREATE POLICY "Teachers can read own drafts"
  ON bulk_entry_drafts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = bulk_entry_drafts.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Teachers can create drafts for their classes"
  ON bulk_entry_drafts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = bulk_entry_drafts.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Teachers can update own drafts"
  ON bulk_entry_drafts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = bulk_entry_drafts.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = bulk_entry_drafts.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Teachers can delete own drafts"
  ON bulk_entry_drafts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = bulk_entry_drafts.class_id
      AND classes.teacher_id = (SELECT auth.uid())
    )
  );