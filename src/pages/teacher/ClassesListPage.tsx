import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, BookOpen, Users, MoreVertical, Pencil, Archive } from 'lucide-react';
import type { Class } from '../../types/database';

interface ClassesListPageProps {
  onNavigateToClass: (classId: string) => void;
}

interface ClassWithStats extends Class {
  studentCount: number;
}

export default function ClassesListPage({ onNavigateToClass }: ClassesListPageProps) {
  const [classes, setClasses] = useState<ClassWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

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

  async function handleArchiveClass(classId: string) {
    const { error } = await supabase
      .from('classes')
      .update({ is_archived: true })
      .eq('id', classId);

    if (!error) {
      setClasses(classes.filter(c => c.id !== classId));
    }
    setActiveMenu(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Classes</h1>
          <p className="text-slate-600 mt-1">Manage your classes and students</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Class
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No classes yet</h3>
          <p className="text-slate-600 mb-4">Create your first class to start tracking student progress</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => onNavigateToClass(cls.id)}
                  >
                    <h3 className="text-lg font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                      {cls.name}
                    </h3>
                    {cls.school_year && (
                      <p className="text-sm text-slate-500 mt-1">{cls.school_year}</p>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenu(activeMenu === cls.id ? null : cls.id)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-500" />
                    </button>
                    {activeMenu === cls.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setActiveMenu(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                          <button
                            onClick={() => {
                              setEditingClass(cls);
                              setShowCreateModal(true);
                              setActiveMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit Class
                          </button>
                          <button
                            onClick={() => handleArchiveClass(cls.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Archive className="w-4 h-4" />
                            Archive Class
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {cls.description && (
                  <p className="text-sm text-slate-600 mt-3 line-clamp-2">{cls.description}</p>
                )}
              </div>
              <div
                className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center gap-4 cursor-pointer"
                onClick={() => onNavigateToClass(cls.id)}
              >
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="w-4 h-4" />
                  <span>{cls.studentCount} student{cls.studentCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateClassModal
          editingClass={editingClass}
          onClose={() => {
            setShowCreateModal(false);
            setEditingClass(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingClass(null);
            fetchClasses();
          }}
        />
      )}
    </div>
  );
}

interface CreateClassModalProps {
  editingClass: Class | null;
  onClose: () => void;
  onSave: () => void;
}

function CreateClassModal({ editingClass, onClose, onSave }: CreateClassModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState(editingClass?.name || '');
  const [description, setDescription] = useState(editingClass?.description || '');
  const [schoolYear, setSchoolYear] = useState(editingClass?.school_year || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError('');

    if (editingClass) {
      const { error: updateError } = await supabase
        .from('classes')
        .update({
          name,
          description: description || null,
          school_year: schoolYear || null
        })
        .eq('id', editingClass.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('classes')
        .insert({
          name,
          description: description || null,
          school_year: schoolYear || null,
          teacher_id: user.id
        });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {editingClass ? 'Edit Class' : 'Create New Class'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
              Class Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Geometry Period 2"
            />
          </div>

          <div>
            <label htmlFor="schoolYear" className="block text-sm font-medium text-slate-700 mb-1.5">
              School Year
            </label>
            <input
              id="schoolYear"
              type="text"
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 2025-2026"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Optional description for this class"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingClass ? 'Save Changes' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}