/*
  # Create Objectives Table

  1. New Tables
    - `objectives`
      - `id` (uuid, primary key)
      - `unit_id` (uuid, references units)
      - `number` (text, e.g., "1-2", "1-3a")
      - `description` (text)
      - `highest_level` (text: basic, intermediate, advanced)
      - `weight` (decimal, default 1.00)
      - `display_order` (int)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Teachers can manage objectives for their classes
    - Students can view objectives for enrolled classes
*/

CREATE TABLE IF NOT EXISTS objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  number text NOT NULL,
  description text NOT NULL,
  highest_level text NOT NULL CHECK (highest_level IN ('basic', 'intermediate', 'advanced')) DEFAULT 'intermediate',
  weight decimal(5,2) NOT NULL DEFAULT 1.00,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage objectives for own classes"
  ON objectives
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM units
      JOIN classes ON classes.id = units.class_id
      WHERE units.id = objectives.unit_id
      AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM units
      JOIN classes ON classes.id = units.class_id
      WHERE units.id = objectives.unit_id
      AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view objectives for enrolled classes"
  ON objectives
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM units
      JOIN enrollments ON enrollments.class_id = units.class_id
      WHERE units.id = objectives.unit_id
      AND enrollments.student_id = auth.uid()
    )
  );