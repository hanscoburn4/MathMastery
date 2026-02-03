/*
  # Auto-enroll students when they register via invitation

  1. Changes
    - Creates a function to automatically enroll students when they register
    - The function checks for pending invitations matching the user's email
    - If found, it creates an enrollment and marks the invitation as accepted

  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only processes invitations that haven't been accepted yet
*/

CREATE OR REPLACE FUNCTION public.handle_student_enrollment()
RETURNS trigger AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  IF NEW.role = 'student' THEN
    FOR invitation_record IN
      SELECT id, class_id 
      FROM invitations 
      WHERE email = NEW.email 
      AND accepted_at IS NULL 
      AND expires_at > now()
    LOOP
      INSERT INTO enrollments (class_id, student_id)
      VALUES (invitation_record.class_id, NEW.id)
      ON CONFLICT (class_id, student_id) DO NOTHING;
      
      UPDATE invitations 
      SET accepted_at = now() 
      WHERE id = invitation_record.id;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_enroll ON profiles;
CREATE TRIGGER on_profile_created_enroll
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_student_enrollment();