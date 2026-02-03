/*
  # Create Classes Table

  1. New Tables
    - `classes`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `description` (text)
      - `school_year` (text)
      - `teacher_id` (uuid, references profiles)
      - `is_archived` (boolean, default false)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Teachers can manage their own classes
*/

CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  school_year text,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage own classes"
  ON classes
  FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());