import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BookOpen, Users, TrendingUp, Plus } from 'lucide-react';
import type { Class } from '../../types/database';

interface TeacherDashboardProps {
  onNavigateToClasses: () => void;
  onNavigateToClass: (classId: string) => void;
}

interface ClassWithStats extends Class {
  studentCount: number;
}

export default function TeacherDashboard({
  onNavigateToClasses,
  onNavigateToClass
}: TeacherDashboardProps) {
  const { profile } = useAuth();
  const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  async function fetchClasses() {
    const { data: classData, error } = await supabase
      .from('classes')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching classes:', error);
      setLoading(false);
      return;
    }

    const classesWithStats: ClassWithStats[] = await Promise.all(
      (classData || []).map(async (cls) => {
        const { count } = await supabase
          .from('enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', cls.id);

        return {
          ...cls,
          studentCount: count || 0
        };
      })
    );

    setClasses(classesWithStats);
    setLoading(false);
  }

  const totalStudents = classes.reduce((sum, cls) => sum + cls.studentCount, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Teacher'}
        </h1>
        <p className="text-slate-600 mt-1">Here is an overview of your classes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{classes.length}</p>
              <p className="text-sm text-slate-600">Active Classes</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
              <p className="text-sm text-slate-600">Total Students</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">--</p>
              <p className="text-sm text-slate-600">Avg. Class Grade</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Your Classes</h2>
          <button
            onClick={onNavigateToClasses}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View All
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No classes yet</h3>
            <p className="text-slate-600 mb-4">Create your first class to get started</p>
            <button
              onClick={onNavigateToClasses}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Class
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {classes.slice(0, 5).map((cls) => (
              <button
                key={cls.id}
                onClick={() => onNavigateToClass(cls.id)}
                className="w-full p-4 hover:bg-slate-50 transition-colors text-left flex items-center justify-between"
              >
                <div>
                  <h3 className="font-medium text-slate-900">{cls.name}</h3>
                  <p className="text-sm text-slate-600">
                    {cls.studentCount} student{cls.studentCount !== 1 ? 's' : ''}
                    {cls.school_year && ` | ${cls.school_year}`}
                  </p>
                </div>
                <div className="text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}