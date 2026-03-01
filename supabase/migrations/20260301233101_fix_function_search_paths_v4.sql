/*
  # Fix Function Search Paths

  1. Security Improvements
    - Set immutable search_path on all functions
    - Prevents security vulnerabilities from search_path manipulation
    - Each function now explicitly uses public schema
  
  2. Functions Updated
    - `is_student_enrolled_in_class` - Set search_path
    - `is_teacher_of_class` - Set search_path
    - `generate_class_code` - Set search_path (cascade to update class default)
    - `is_parent_of_student` - Set search_path
    - `handle_new_user` - Set search_path (cascade to update trigger)
*/

-- Drop trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.is_student_enrolled_in_class(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_teacher_of_class(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_parent_of_student(uuid, uuid);
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.generate_class_code() CASCADE;

-- Recreate is_student_enrolled_in_class with search_path
CREATE FUNCTION public.is_student_enrolled_in_class(student_user_id uuid, target_class_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM enrollments
    WHERE student_id = student_user_id
    AND class_id = target_class_id
  );
END;
$$;

-- Recreate is_teacher_of_class with search_path
CREATE FUNCTION public.is_teacher_of_class(teacher_user_id uuid, target_class_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM classes
    WHERE id = target_class_id
    AND teacher_id = teacher_user_id
  );
END;
$$;

-- Recreate generate_class_code with search_path
CREATE FUNCTION public.generate_class_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM classes WHERE class_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$;

-- Restore the default value on classes.class_code
ALTER TABLE classes 
  ALTER COLUMN class_code SET DEFAULT generate_class_code();

-- Recreate is_parent_of_student with search_path
CREATE FUNCTION public.is_parent_of_student(parent_user_id uuid, target_student_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM parent_student_links
    WHERE parent_id = parent_user_id
    AND student_id = target_student_id
  );
END;
$$;

-- Recreate handle_new_user with search_path
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'student')
  );
  RETURN new;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();