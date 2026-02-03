/*
  # Create Invitations Table

  1. New Tables
    - `invitations`
      - `id` (uuid, primary key)
      - `class_id` (uuid, references classes)
      - `email` (text, the invitee email)
      - `token` (text, unique invitation token)
      - `expires_at` (timestamptz)
      - `accepted_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Teachers can manage invitations for their classes
    - Anyone can read invitation by token (for registration)
*/

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage invitations for own classes"
  ON invitations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = invitations.class_id
      AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes
      WHERE classes.id = invitations.class_id
      AND classes.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read invitation by token for registration"
  ON invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);