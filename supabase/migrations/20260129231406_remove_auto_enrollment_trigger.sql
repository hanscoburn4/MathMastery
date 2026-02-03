/*
  # Remove Auto-Enrollment Trigger
  
  1. Changes
    - Drop the `on_profile_created_enroll` trigger from profiles table
    - Drop the `handle_student_enrollment` function
    
  2. Reason
    - The edge function already handles enrollment creation directly
    - The trigger was causing database errors during user creation
    - Removing redundant trigger chain simplifies the system
    
  3. Impact
    - User creation will no longer fail with database errors
    - Enrollment creation will be handled exclusively by the edge function
*/

-- Drop the trigger first
DROP TRIGGER IF EXISTS on_profile_created_enroll ON profiles;

-- Drop the function
DROP FUNCTION IF EXISTS handle_student_enrollment();
