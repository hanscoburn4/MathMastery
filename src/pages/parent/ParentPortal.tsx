import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import SettingsModal from '../../components/SettingsModal';
import { ChevronDown, ChevronRight, GraduationCap, BookOpen, LogOut, HelpCircle, Users, Settings } from 'lucide-react';
import type { Class, Unit, Objective, ProgressRecord, MarkType, DifficultyLevel, Profile } from '../../types/database';

const MARK_DISPLAY: Record<MarkType, { label: string; color: string }> = {
  'check': { label: '\u2713', color: 'bg-green-500 text-white' },
  'check_s': { label: '\u2713s', color: 'bg-green-400 text-white' },
  'check_c': { label: '\u2713c', color: 'bg-green-400 text-white' },
  'check_o': { label: '\u2713o', color: 'bg-green-400 text-white' },
  'G': { label: 'G', color: 'bg-blue-400 text-white' },
  'H': { label: 'H', color: 'bg-yellow-400 text-slate-900' },
  'PC': { label: 'PC', color: 'bg-orange-400 text-white' },
  'N': { label: 'N', color: 'bg-slate-300 text-slate-700' },
  'X': { label: '\u2717', color: 'bg-red-500 text-white' },
};

const ATTEMPT_NUMBERS = [1, 2, 3, 4, 5];
const AFTER_UNIT_NUMBERS = [1, 2];

export default function ParentPortal() {
  const { profile, signOut } = useAuth();
  const [linkedStudents, setLinkedStudents] = useState<Profile[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [enrolledClasses, setEnrolledClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [objectives, setObjectives] = useState<Record<string, Objective[]>>({});
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);

  useEffect(() => {
    fetchLinkedStudents();
  }, []);

  async function fetchLinkedStudents() {
    const { data: links } = await supabase
      .from('parent_student_links')
      .select('student_id')
      .eq('parent_id', profile?.id);

    if (links && links.length > 0) {
      const studentIds = links.map(l => l.student_id);
      const { data: students } = await supabase
        .from('profiles')
        .select('*')
        .in('id', studentIds);

      setLinkedStudents(students || []);

      if (students && students.length > 0) {
        setSelectedStudent(students[0]);
        await fetchStudentClasses(students[0].id);
      }
    }

    setLoading(false);
  }

  async function fetchStudentClasses(studentId: string) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('class_id')
      .eq('student_id', studentId);

    if (enrollments && enrollments.length > 0) {
      const classIds = enrollments.map(e => e.class_id);
      const { data: classes } = await supabase
        .from('classes')
        .select('*')
        .in('id', classIds)
        .eq('is_archived', false);

      setEnrolledClasses(classes || []);

      if (classes && classes.length > 0) {
        setSelectedClass(classes[0]);
        await fetchClassData(classes[0].id, studentId);
      }
    } else {
      setEnrolledClasses([]);
      setSelectedClass(null);
      setUnits([]);
      setObjectives({});
      setProgressRecords([]);
    }
  }

  async function fetchClassData(classId: string, studentId: string) {
    setLoading(true);

    const { data: unitsData } = await supabase
      .from('units')
      .select('*')
      .eq('class_id', classId)
      .order('display_order');
    setUnits(unitsData || []);

    if (unitsData && unitsData.length > 0) {
      const unitIds = unitsData.map(u => u.id);
      const { data: objectivesData } = await supabase
        .from('objectives')
        .select('*')
        .in('unit_id', unitIds)
        .order('display_order');

      const objectivesByUnit: Record<string, Objective[]> = {};
      const allObjectiveIds: string[] = [];
      (objectivesData || []).forEach(obj => {
        if (!objectivesByUnit[obj.unit_id]) {
          objectivesByUnit[obj.unit_id] = [];
        }
        objectivesByUnit[obj.unit_id].push(obj);
        allObjectiveIds.push(obj.id);
      });
      setObjectives(objectivesByUnit);

      if (allObjectiveIds.length > 0) {
        const { data: records } = await supabase
          .from('progress_records')
          .select('*')
          .eq('student_id', studentId)
          .in('objective_id', allObjectiveIds);
        setProgressRecords(records || []);
      }

      setExpandedUnits(new Set(unitsData.map(u => u.id)));
    }

    setLoading(false);
  }

  function handleStudentChange(studentId: string) {
    const student = linkedStudents.find(s => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
      fetchStudentClasses(studentId);
    }
  }

  function handleClassChange(classId: string) {
    const cls = enrolledClasses.find(c => c.id === classId);
    if (cls && selectedStudent) {
      setSelectedClass(cls);
      fetchClassData(classId, selectedStudent.id);
    }
  }

  function toggleUnit(unitId: string) {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(unitId)) {
      newExpanded.delete(unitId);
    } else {
      newExpanded.add(unitId);
    }
    setExpandedUnits(newExpanded);
  }

  function getMarkForAttempt(
    objectiveId: string,
    level: DifficultyLevel,
    attemptNumber: number,
    isAfterUnit: boolean,
    afterUnitNumber: number | null
  ): ProgressRecord | null {
    return progressRecords.find(
      r =>
        r.objective_id === objectiveId &&
        r.level === level &&
        r.attempt_number === attemptNumber &&
        r.is_after_unit === isAfterUnit &&
        (isAfterUnit ? r.after_unit_number === afterUnitNumber : true)
    ) || null;
  }

  function calculateMastery(objectiveId: string, level: DifficultyLevel): boolean {
    const levelRecords = progressRecords.filter(
      r => r.objective_id === objectiveId &&
           r.level === level &&
           r.mark_type !== 'X' &&
           r.mark_type !== 'N'
    ).sort((a, b) => {
      if (a.is_after_unit !== b.is_after_unit) {
        return a.is_after_unit ? 1 : -1;
      }
      if (a.is_after_unit && a.after_unit_number && b.after_unit_number) {
        return a.after_unit_number - b.after_unit_number;
      }
      return a.attempt_number - b.attempt_number;
    });

    for (let i = 0; i < levelRecords.length - 1; i++) {
      const current = levelRecords[i];
      const next = levelRecords[i + 1];

      if (!current.is_after_unit && !next.is_after_unit) {
        if (next.attempt_number === current.attempt_number + 1) {
          return true;
        }
      }

      if (current.is_after_unit && next.is_after_unit) {
        if (current.after_unit_number && next.after_unit_number &&
            next.after_unit_number === current.after_unit_number + 1) {
          return true;
        }
      }

      if (!current.is_after_unit && next.is_after_unit && next.after_unit_number === 1) {
        return true;
      }
    }

    return false;
  }

  function getLevelBadgeColor(level: string) {
    switch (level) {
      case 'basic': return 'bg-green-100 text-green-700';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (linkedStudents.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Parent Portal</h1>
                  <p className="text-xs text-slate-500">{profile?.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Students Linked</h2>
            <p className="text-slate-600">
              Your teacher needs to link your account to a student before you can view their progress.
            </p>
          </div>
        </div>

        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Parent Portal</h1>
                <p className="text-xs text-slate-500">{profile?.full_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Student</label>
            <select
              value={selectedStudent?.id || ''}
              onChange={(e) => handleStudentChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              {linkedStudents.map(student => (
                <option key={student.id} value={student.id}>
                  {student.full_name || student.email}
                </option>
              ))}
            </select>
          </div>

          {enrolledClasses.length > 0 && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Class</label>
              <select
                value={selectedClass?.id || ''}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                {enrolledClasses.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {enrolledClasses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">No Classes</h2>
            <p className="text-slate-600">
              {selectedStudent?.full_name || 'This student'} is not enrolled in any classes yet.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <button
                    onClick={() => setInfoExpanded(!infoExpanded)}
                    className="flex items-center gap-2 font-medium text-amber-900 hover:text-amber-700 transition-colors"
                  >
                    How to read this chart
                    {infoExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {infoExpanded && (
                    <div className="mt-3 text-sm text-amber-800 space-y-2">
                      <p>Each objective has different levels: Basic, Intermediate, and Advanced. Your child needs to demonstrate mastery by completing two consecutive successful attempts.</p>
                      <div className="space-y-1 mt-2">
                        <p><strong>Marks:</strong></p>
                        <p>\u2713 = Completed successfully</p>
                        <p>G = Getting it</p>
                        <p>H = Help needed</p>
                        <p>PC = Partly correct</p>
                        <p>N = Not assessed</p>
                        <p>\u2717 = Needs more work</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {units.map(unit => (
                <div key={unit.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => toggleUnit(unit.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedUnits.has(unit.id) ? (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                      <div className="text-left">
                        <div className="font-semibold text-slate-900">
                          Unit {unit.number}: {unit.title}
                        </div>
                      </div>
                    </div>
                  </button>

                  {expandedUnits.has(unit.id) && objectives[unit.id] && (
                    <div className="border-t border-slate-200 p-6">
                      <div className="space-y-6">
                        {objectives[unit.id].map(objective => (
                          <div key={objective.id} className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <span className="font-medium text-slate-900">
                                    {objective.number}. {objective.description}
                                  </span>
                                </div>
                                <span className={`ml-4 px-2 py-1 rounded text-xs font-medium ${getLevelBadgeColor(objective.highest_level)}`}>
                                  {objective.highest_level}
                                </span>
                              </div>
                            </div>

                            <div className="p-4 overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-200">
                                    <th className="text-left pb-2 pr-4 font-medium text-slate-700">Level</th>
                                    {ATTEMPT_NUMBERS.map(num => (
                                      <th key={num} className="text-center pb-2 px-2 font-medium text-slate-700">A{num}</th>
                                    ))}
                                    {AFTER_UNIT_NUMBERS.map(num => (
                                      <th key={`au${num}`} className="text-center pb-2 px-2 font-medium text-slate-700">U{num}</th>
                                    ))}
                                    <th className="text-center pb-2 pl-4 font-medium text-slate-700">Mastery</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(['basic', 'intermediate', 'advanced'] as DifficultyLevel[])
                                    .filter(level => {
                                      const levels = ['basic', 'intermediate', 'advanced'];
                                      return levels.indexOf(level) <= levels.indexOf(objective.highest_level);
                                    })
                                    .map(level => {
                                      const isMastered = calculateMastery(objective.id, level);
                                      return (
                                        <tr key={level} className="border-b border-slate-100 last:border-0">
                                          <td className="py-2 pr-4">
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getLevelBadgeColor(level)}`}>
                                              {level}
                                            </span>
                                          </td>
                                          {ATTEMPT_NUMBERS.map(attemptNum => {
                                            const record = getMarkForAttempt(objective.id, level, attemptNum, false, null);
                                            return (
                                              <td key={attemptNum} className="text-center py-2 px-2">
                                                {record ? (
                                                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded ${MARK_DISPLAY[record.mark_type].color} text-xs font-semibold`}>
                                                    {MARK_DISPLAY[record.mark_type].label}
                                                  </div>
                                                ) : (
                                                  <div className="inline-flex items-center justify-center w-8 h-8 rounded border border-slate-200 bg-slate-50 text-slate-300">
                                                    -
                                                  </div>
                                                )}
                                              </td>
                                            );
                                          })}
                                          {AFTER_UNIT_NUMBERS.map(afterUnitNum => {
                                            const record = getMarkForAttempt(objective.id, level, 1, true, afterUnitNum);
                                            return (
                                              <td key={`au${afterUnitNum}`} className="text-center py-2 px-2">
                                                {record ? (
                                                  <div className={`inline-flex items-center justify-center w-8 h-8 rounded ${MARK_DISPLAY[record.mark_type].color} text-xs font-semibold`}>
                                                    {MARK_DISPLAY[record.mark_type].label}
                                                  </div>
                                                ) : (
                                                  <div className="inline-flex items-center justify-center w-8 h-8 rounded border border-slate-200 bg-slate-50 text-slate-300">
                                                    -
                                                  </div>
                                                )}
                                              </td>
                                            );
                                          })}
                                          <td className="text-center py-2 pl-4">
                                            {isMastered ? (
                                              <div className="inline-flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
                                                <span className="text-green-600 text-lg">★</span>
                                              </div>
                                            ) : (
                                              <div className="inline-flex items-center justify-center w-8 h-8">
                                                <span className="text-slate-300 text-lg">☆</span>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
