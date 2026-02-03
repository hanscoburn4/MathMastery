export type MarkType = 'check' | 'check_s' | 'check_c' | 'check_o' | 'G' | 'H' | 'PC' | 'N' | 'X';
export type DifficultyLevel = 'basic' | 'intermediate' | 'advanced';
export type UserRole = 'teacher' | 'student' | 'parent';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          school_year: string | null;
          teacher_id: string;
          class_code: string;
          is_archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          school_year?: string | null;
          teacher_id: string;
          class_code?: string;
          is_archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          school_year?: string | null;
          teacher_id?: string;
          class_code?: string;
          is_archived?: boolean;
          created_at?: string;
        };
      };
      enrollments: {
        Row: {
          id: string;
          class_id: string;
          student_id: string;
          enrolled_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          student_id: string;
          enrolled_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          student_id?: string;
          enrolled_at?: string;
        };
      };
      units: {
        Row: {
          id: string;
          class_id: string;
          number: string;
          title: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          number: string;
          title: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          number?: string;
          title?: string;
          display_order?: number;
          created_at?: string;
        };
      };
      objectives: {
        Row: {
          id: string;
          unit_id: string;
          number: string;
          description: string;
          highest_level: DifficultyLevel;
          weight: number;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          number: string;
          description: string;
          highest_level?: DifficultyLevel;
          weight?: number;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          number?: string;
          description?: string;
          highest_level?: DifficultyLevel;
          weight?: number;
          display_order?: number;
          created_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          class_id: string;
          email: string;
          token: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          email: string;
          token?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          email?: string;
          token?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
      };
      progress_records: {
        Row: {
          id: string;
          student_id: string;
          objective_id: string;
          level: DifficultyLevel;
          attempt_number: number;
          is_after_unit: boolean;
          after_unit_number: number | null;
          mark_type: MarkType;
          recorded_at: string;
          recorded_by: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          objective_id: string;
          level: DifficultyLevel;
          attempt_number: number;
          is_after_unit?: boolean;
          after_unit_number?: number | null;
          mark_type: MarkType;
          recorded_at?: string;
          recorded_by?: string | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          objective_id?: string;
          level?: DifficultyLevel;
          attempt_number?: number;
          is_after_unit?: boolean;
          after_unit_number?: number | null;
          mark_type?: MarkType;
          recorded_at?: string;
          recorded_by?: string | null;
        };
      };
      parent_student_links: {
        Row: {
          id: string;
          parent_id: string;
          student_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_id: string;
          student_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string;
          student_id?: string;
          created_at?: string;
        };
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Class = Database['public']['Tables']['classes']['Row'];
export type Enrollment = Database['public']['Tables']['enrollments']['Row'];
export type Unit = Database['public']['Tables']['units']['Row'];
export type Objective = Database['public']['Tables']['objectives']['Row'];
export type Invitation = Database['public']['Tables']['invitations']['Row'];
export type ProgressRecord = Database['public']['Tables']['progress_records']['Row'];
export type ParentStudentLink = Database['public']['Tables']['parent_student_links']['Row'];