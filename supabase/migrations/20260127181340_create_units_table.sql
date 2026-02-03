/*
  # Create Units Table

  1. New Tables
    - `units`
      - `id` (uuid, primary key)
      - `class_id` (uuid, references classes)
      - `number` (text, e.g., "1", "2", "D")
      - `title` (text)
      - `display_order` (int)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Teachers can manage units for their classes
    - Students can view units for enrolled classes
*/

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  number text NOT NULL,
  title text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage units for own classes"
  ON units
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = units.class_id
      AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = units.class_id
      AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view units for enrolled classes"
  ON units
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE enrollments.class_id = units.class_id
      AND enrollments.student_id = auth.uid()
    )
  );