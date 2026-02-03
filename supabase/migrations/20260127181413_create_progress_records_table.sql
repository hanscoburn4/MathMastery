/*
  # Create Progress Records Table

  1. New Tables
    - `progress_records`
      - `id` (uuid, primary key)
      - `student_id` (uuid, references profiles)
      - `objective_id` (uuid, references objectives)
      - `level` (text: basic, intermediate, advanced)
      - `attempt_number` (int: 1-5)
      - `is_after_unit` (boolean, for X1/X2 columns)
      - `after_unit_number` (int: 1 or 2, nullable)
      - `mark_type` (text: check, check_s, check_c, check_o, G, H, PC, N, X)
      - `recorded_at` (timestamptz)
      - `recorded_by` (uuid, references profiles)

  2. Security
    - Enable RLS
    - Teachers can manage progress for students in their classes
    - Students can view their own progress

  3. Notes
    - Mark types that count towards mastery: check, check_s, check_c, check_o
    - Mark types that don't count: G (group), H (help/hint), PC (partly correct), N (not attempted), X (incorrect)
*/

CREATE TABLE IF NOT EXISTS progress_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  objective_id uuid NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('basic', 'intermediate', 'advanced')),
  attempt_number int NOT NULL CHECK (attempt_number >= 1 AND attempt_number <= 5),
  is_after_unit boolean NOT NULL DEFAULT false,
  after_unit_number int CHECK (after_unit_number IS NULL OR after_unit_number IN (1, 2)),
  mark_type text NOT NULL CHECK (mark_type IN ('check', 'check_s', 'check_c', 'check_o', 'G', 'H', 'PC', 'N', 'X')),
  recorded_at timestamptz DEFAULT now(),
  recorded_by uuid REFERENCES profiles(id),
  UNIQUE(student_id, objective_id, level, attempt_number, is_after_unit, after_unit_number)
);

ALTER TABLE progress_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage progress for students in their classes"
  ON progress_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM objectives
      JOIN units ON units.id = objectives.unit_id
      JOIN classes ON classes.id = units.class_id
      WHERE objectives.id = progress_records.objective_id
      AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM objectives
      JOIN units ON units.id = objectives.unit_id
      JOIN classes ON classes.id = units.class_id
      WHERE objectives.id = progress_records.objective_id
      AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view own progress"
  ON progress_records
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE INDEX idx_progress_records_student ON progress_records(student_id);
CREATE INDEX idx_progress_records_objective ON progress_records(objective_id);
CREATE INDEX idx_progress_records_student_objective ON progress_records(student_id, objective_id);