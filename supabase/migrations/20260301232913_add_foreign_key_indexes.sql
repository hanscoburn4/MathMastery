/*
  # Add Foreign Key Indexes

  1. Performance Improvements
    - Add indexes on all foreign key columns to improve query performance
    - These indexes speed up JOIN operations and foreign key constraint checks
  
  2. Indexes Added
    - `classes.teacher_id` - For teacher-to-class lookups
    - `enrollments.student_id` - For student enrollment queries
    - `invitations.class_id` - For class invitation lookups
    - `objectives.unit_id` - For unit-to-objectives queries
    - `parent_student_links.student_id` - For student-to-parent lookups
    - `progress_records.recorded_by` - For tracking who recorded progress
    - `units.class_id` - For class-to-units queries
*/

-- Add index on classes.teacher_id
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);

-- Add index on enrollments.student_id
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments(student_id);

-- Add index on invitations.class_id
CREATE INDEX IF NOT EXISTS idx_invitations_class_id ON invitations(class_id);

-- Add index on objectives.unit_id
CREATE INDEX IF NOT EXISTS idx_objectives_unit_id ON objectives(unit_id);

-- Add index on parent_student_links.student_id
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student_id ON parent_student_links(student_id);

-- Add index on progress_records.recorded_by
CREATE INDEX IF NOT EXISTS idx_progress_records_recorded_by ON progress_records(recorded_by);

-- Add index on units.class_id
CREATE INDEX IF NOT EXISTS idx_units_class_id ON units(class_id);