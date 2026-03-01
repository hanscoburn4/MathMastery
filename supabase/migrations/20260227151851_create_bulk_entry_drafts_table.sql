/*
  # Create bulk_entry_drafts table

  1. New Tables
    - `bulk_entry_drafts`
      - `id` (uuid, primary key) - Unique identifier for the draft
      - `class_id` (uuid, foreign key) - Reference to the class
      - `teacher_id` (uuid, foreign key) - Reference to the teacher who created the draft
      - `draft_data` (jsonb) - Stores the draft state (selected objectives, pending marks)
      - `created_at` (timestamptz) - When the draft was created
      - `updated_at` (timestamptz) - When the draft was last updated

  2. Security
    - Enable RLS on `bulk_entry_drafts` table
    - Teachers can only read their own drafts
    - Teachers can only create drafts for their own classes
    - Teachers can only update their own drafts
    - Teachers can only delete their own drafts

  3. Indexes
    - Add index on class_id for efficient draft retrieval
    - Add index on teacher_id for efficient user-specific queries
*/

CREATE TABLE IF NOT EXISTS bulk_entry_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bulk_entry_drafts ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bulk_entry_drafts_class_id ON bulk_entry_drafts(class_id);
CREATE INDEX IF NOT EXISTS idx_bulk_entry_drafts_teacher_id ON bulk_entry_drafts(teacher_id);

-- RLS Policies
CREATE POLICY "Teachers can read own drafts"
  ON bulk_entry_drafts
  FOR SELECT
  TO authenticated
  USING (
    teacher_id = auth.uid()
  );

CREATE POLICY "Teachers can create drafts for their classes"
  ON bulk_entry_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    teacher_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = class_id
      AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update own drafts"
  ON bulk_entry_drafts
  FOR UPDATE
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own drafts"
  ON bulk_entry_drafts
  FOR DELETE
  TO authenticated
  USING (teacher_id = auth.uid());