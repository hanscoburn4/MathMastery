import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  BookOpen,
  Plus,
  Mail,
  UserPlus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  ClipboardList,
  Copy,
  Check
} from 'lucide-react';
import type { Class, Unit, Objective, Profile, Invitation, ProgressRecord, DifficultyLevel } from '../../types/database';
import AdminAddStudentModal from '../../components/AdminAddStudentModal';
import ParentLinkModal from '../../components/ParentLinkModal';

interface ClassDetailPageProps {
  classId: string;
  onNavigateToStudentProgress: (classId: string, studentId: string) => void;
}

interface StudentWithEnrollment extends Profile {
  enrollmentId: string;
}

interface UnitScore {
  unitId: string;
  percentage: number;
}

export default function ClassDetailPage({ classId, onNavigateToStudentProgress }: ClassDetailPageProps) {
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<StudentWithEnrollment[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [objectives, setObjectives] = useState<Record<string, Objective[]>>({});
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [activeTab, setActiveTab] = useState<'students' | 'curriculum'>('students');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [studentUnitScores, setStudentUnitScores] = useState<Record<string, UnitScore[]>>({});
  const [copiedClassCode, setCopiedClassCode] = useState(false);
  const [showParentLinkModal, setShowParentLinkModal] = useState(false);
  const [selectedStudentForParentLink, setSelectedStudentForParentLink] = useState<StudentWithEnrollment | null>(null);

  useEffect(() => {
    fetchClassData();
  }, [classId]);

  async function fetchClassData() {
    setLoading(true);

    const { data: cls } = await supabase
      .from('classes')
      .select('*')
      .eq('id', classId)
      .maybeSingle();

    setClassData(cls);

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, student_id')
      .eq('class_id', classId);

    if (enrollments && enrollments.length > 0) {
      const studentIds = enrollments.map(e => e.student_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', studentIds);

      const studentsWithEnrollment = (profiles || []).map(p => ({
        ...p,
        enrollmentId: enrollments.find(e => e.student_id === p.id)?.id || ''
      }));

      setStudents(studentsWithEnrollment.sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '')
      ));
    }

    const { data: unitsData } = await supabase
      .from('units')
      .select('*')
      .eq('class_id', classId)
      .order('display_order');

    setUnits(unitsData || []);

    let allObjectives: Objective[] = [];
    if (unitsData && unitsData.length > 0) {
      const unitIds = unitsData.map(u => u.id);
      const { data: objectivesData } = await supabase
        .from('objectives')
        .select('*')
        .in('unit_id', unitIds)
        .order('display_order');

      allObjectives = objectivesData || [];
      const objectivesByUnit: Record<string, Objective[]> = {};
      allObjectives.forEach(obj => {
        if (!objectivesByUnit[obj.unit_id]) {
          objectivesByUnit[obj.unit_id] = [];
        }
        objectivesByUnit[obj.unit_id].push(obj);
      });
      setObjectives(objectivesByUnit);

      setExpandedUnits(new Set(unitsData.map(u => u.id)));
    }

    const { data: invitations } = await supabase
      .from('invitations')
      .select('*')
      .eq('class_id', classId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    setPendingInvitations(invitations || []);

    // Fetch progress records for all students
    if (enrollments && enrollments.length > 0) {
      const studentIds = enrollments.map(e => e.student_id);
      const { data: progressData } = await supabase
        .from('progress_records')
        .select('*')
        .in('student_id', studentIds);

      setProgressRecords(progressData || []);

      // Calculate unit scores for each student
      if (unitsData && allObjectives.length > 0 && progressData) {
        const scores: Record<string, UnitScore[]> = {};

        studentIds.forEach(studentId => {
          const studentScores: UnitScore[] = unitsData.map(unit => {
            const unitObjectives = allObjectives.filter(obj => obj.unit_id === unit.id);

            if (unitObjectives.length === 0) {
              return { unitId: unit.id, percentage: 0 };
            }

            let totalPoints = 0;
            let earnedPoints = 0;

            unitObjectives.forEach(obj => {
              const weight = obj.weight || 1;
              const maxPoints = getLevelPoints(obj.highest_level) * weight;
              totalPoints += maxPoints;

              const objScore = calculateObjectiveScore(obj, studentId, progressData);
              earnedPoints += objScore * weight;
            });

            const percentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
            return { unitId: unit.id, percentage };
          });

          scores[studentId] = studentScores;
        });

        setStudentUnitScores(scores);
      }
    }

    setLoading(false);
  }

  function calculateMastery(objectiveId: string, level: DifficultyLevel, studentId: string, records: ProgressRecord[]): boolean {
    const levelRecords = records.filter(
      r => r.objective_id === objectiveId &&
           r.level === level &&
           r.student_id === studentId &&
           r.mark_type !== 'x' &&
           r.mark_type !== 'dot'
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
      } else if (current.is_after_unit && next.is_after_unit) {
        if (current.after_unit_number && next.after_unit_number &&
            next.after_unit_number === current.after_unit_number + 1) {
          return true;
        }
      }
    }

    return false;
  }

  function calculateObjectiveScore(objective: Objective, studentId: string, records: ProgressRecord[]): number {
    const levels: DifficultyLevel[] = ['advanced', 'intermediate', 'basic'];
    const points = { advanced: 5, intermediate: 4, basic: 3 };

    for (const level of levels) {
      if (calculateMastery(objective.id, level, studentId, records)) {
        return points[level];
      }
    }

    return 0;
  }

  async function handleRemoveStudent(enrollmentId: string) {
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('id', enrollmentId);

    if (!error) {
      setStudents(students.filter(s => s.enrollmentId !== enrollmentId));
    }
  }

  async function handleDeleteUnit(unitId: string) {
    const { error } = await supabase.from('units').delete().eq('id', unitId);
    if (!error) {
      setUnits(units.filter(u => u.id !== unitId));
      const newObjectives = { ...objectives };
      delete newObjectives[unitId];
      setObjectives(newObjectives);
    }
  }

  async function handleDeleteObjective(objectiveId: string, unitId: string) {
    const { error } = await supabase.from('objectives').delete().eq('id', objectiveId);
    if (!error) {
      setObjectives({
        ...objectives,
        [unitId]: objectives[unitId].filter(o => o.id !== objectiveId)
      });
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

  function handleCopyClassCode() {
    if (classData?.class_code) {
      navigator.clipboard.writeText(classData.class_code);
      setCopiedClassCode(true);
      setTimeout(() => setCopiedClassCode(false), 2000);
    }
  }

  function getLevelBadgeColor(level: string) {
    switch (level) {
      case 'basic': return 'bg-green-100 text-green-700';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  function getLevelPoints(level: string) {
    switch (level) {
      case 'basic': return 3;
      case 'intermediate': return 4;
      case 'advanced': return 5;
      default: return 0;
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!classData) {
    return <div className="text-center py-12 text-slate-600">Class not found</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{classData.name}</h1>
        {classData.school_year && (
          <p className="text-slate-600 mt-1">{classData.school_year}</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('students')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'students'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Students ({students.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('curriculum')}
              className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'curriculum'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Curriculum ({units.length} units)
              </span>
            </button>
          </div>
        </div>

        {activeTab === 'students' && (
          <div className="p-6">
            <div className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-blue-900 mb-1">Class Code</h3>
                  <p className="text-sm text-blue-700 mb-3">Share this code with students to join the class</p>
                  <div className="flex items-center gap-3">
                    <div className="bg-white px-6 py-3 rounded-lg border-2 border-blue-300">
                      <span className="text-3xl font-bold text-blue-900 font-mono tracking-wider">
                        {classData.class_code}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyClassCode}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
                    >
                      {copiedClassCode ? (
                        <>
                          <Check className="w-4 h-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Code
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mb-4">
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="flex items-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Student
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Invite Students
              </button>
            </div>

            {pendingInvitations.length > 0 && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-medium text-amber-800 mb-3">Pending Invitations</h3>
                <p className="text-xs text-amber-700 mb-3">
                  Note: Email sending is not configured. Share these links directly with students:
                </p>
                <div className="space-y-3">
                  {pendingInvitations.map(inv => (
                    <div key={inv.id} className="bg-white rounded-lg p-3 border border-amber-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-amber-900">{inv.email}</span>
                        <span className="text-amber-600 text-xs">
                          Expires {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={`${window.location.origin}?register=${inv.token}`}
                          readOnly
                          className="flex-1 text-xs px-2 py-1.5 bg-amber-50 border border-amber-200 rounded"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}?register=${inv.token}`);
                          }}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded font-medium"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {students.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No students yet</h3>
                <p className="text-slate-600">Invite students to join this class</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Email</th>
                      {units.map(unit => (
                        <th key={unit.id} className="text-center py-3 px-2 text-sm font-medium text-slate-600">
                          Unit {unit.number}
                        </th>
                      ))}
                      <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map(student => {
                      const scores = studentUnitScores[student.id] || [];
                      return (
                        <tr key={student.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <button
                              onClick={() => onNavigateToStudentProgress(classId, student.id)}
                              className="font-medium text-slate-900 hover:text-blue-600"
                            >
                              {student.full_name || 'Unnamed Student'}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{student.email}</td>
                          {units.map(unit => {
                            const unitScore = scores.find(s => s.unitId === unit.id);
                            const percentage = unitScore?.percentage || 0;
                            return (
                              <td key={unit.id} className="py-3 px-2 text-center">
                                <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                                  percentage >= 90 ? 'bg-green-100 text-green-700' :
                                  percentage >= 80 ? 'bg-blue-100 text-blue-700' :
                                  percentage >= 70 ? 'bg-yellow-100 text-yellow-700' :
                                  percentage >= 60 ? 'bg-orange-100 text-orange-700' :
                                  percentage > 0 ? 'bg-red-100 text-red-700' :
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {percentage > 0 ? `${percentage.toFixed(0)}%` : '-'}
                                </span>
                              </td>
                            );
                          })}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => onNavigateToStudentProgress(classId, student.id)}
                                className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                                title="View Progress"
                              >
                                <ClipboardList className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedStudentForParentLink(student);
                                  setShowParentLinkModal(true);
                                }}
                                className="p-2 hover:bg-amber-50 rounded-lg text-amber-600"
                                title="Manage Parent Access"
                              >
                                <Users className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRemoveStudent(student.enrollmentId)}
                                className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                                title="Remove Student"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'curriculum' && (
          <div className="p-6">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setEditingUnit(null);
                  setShowUnitModal(true);
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Unit
              </button>
            </div>

            {units.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No units yet</h3>
                <p className="text-slate-600">Add units and objectives to build your curriculum</p>
              </div>
            ) : (
              <div className="space-y-4">
                {units.map(unit => (
                  <div key={unit.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-4 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => toggleUnit(unit.id)}
                    >
                      {expandedUnits.has(unit.id) ? (
                        <ChevronDown className="w-5 h-5 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-500" />
                      )}
                      <div className="flex-1">
                        <span className="font-semibold text-blue-600">Unit {unit.number}</span>
                        <span className="mx-2 text-slate-400">|</span>
                        <span className="font-medium text-slate-900">{unit.title}</span>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingUnit(unit);
                            setShowUnitModal(true);
                          }}
                          className="p-2 hover:bg-slate-200 rounded-lg text-slate-600"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUnit(unit.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {expandedUnits.has(unit.id) && (
                      <div className="p-4 border-t border-slate-200">
                        <div className="flex justify-end mb-3">
                          <button
                            onClick={() => {
                              setSelectedUnitId(unit.id);
                              setEditingObjective(null);
                              setShowObjectiveModal(true);
                            }}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Add Objective
                          </button>
                        </div>

                        {(!objectives[unit.id] || objectives[unit.id].length === 0) ? (
                          <p className="text-center text-slate-500 py-4 text-sm">No objectives yet</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="text-left py-2 px-3 font-medium text-slate-600 w-20">Obj #</th>
                                  <th className="text-left py-2 px-3 font-medium text-slate-600">Description</th>
                                  <th className="text-center py-2 px-3 font-medium text-slate-600 w-32">Highest Level</th>
                                  <th className="text-center py-2 px-3 font-medium text-slate-600 w-20">Weight</th>
                                  <th className="text-center py-2 px-3 font-medium text-slate-600 w-20">Points</th>
                                  <th className="w-20"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {objectives[unit.id].map(obj => (
                                  <tr key={obj.id} className="hover:bg-slate-50">
                                    <td className="py-2 px-3 font-medium text-slate-900">{obj.number}</td>
                                    <td className="py-2 px-3 text-slate-700">{obj.description}</td>
                                    <td className="py-2 px-3 text-center">
                                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getLevelBadgeColor(obj.highest_level)}`}>
                                        {obj.highest_level.charAt(0).toUpperCase() + obj.highest_level.slice(1)}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center text-slate-600">{obj.weight}</td>
                                    <td className="py-2 px-3 text-center font-medium text-slate-900">
                                      {getLevelPoints(obj.highest_level)}
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="flex items-center gap-1 justify-end">
                                        <button
                                          onClick={() => {
                                            setSelectedUnitId(unit.id);
                                            setEditingObjective(obj);
                                            setShowObjectiveModal(true);
                                          }}
                                          className="p-1.5 hover:bg-slate-200 rounded text-slate-600"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteObjective(obj.id, unit.id)}
                                          className="p-1.5 hover:bg-red-50 rounded text-red-600"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showInviteModal && (
        <InviteStudentModal
          classId={classId}
          onClose={() => setShowInviteModal(false)}
          onInvited={fetchClassData}
        />
      )}

      {showUnitModal && (
        <UnitModal
          classId={classId}
          editingUnit={editingUnit}
          existingUnits={units}
          onClose={() => {
            setShowUnitModal(false);
            setEditingUnit(null);
          }}
          onSaved={fetchClassData}
        />
      )}

      {showObjectiveModal && selectedUnitId && (
        <ObjectiveModal
          unitId={selectedUnitId}
          editingObjective={editingObjective}
          existingObjectives={objectives[selectedUnitId] || []}
          onClose={() => {
            setShowObjectiveModal(false);
            setEditingObjective(null);
            setSelectedUnitId(null);
          }}
          onSaved={fetchClassData}
        />
      )}

      {showAddStudentModal && (
        <AdminAddStudentModal
          classId={classId}
          onClose={() => setShowAddStudentModal(false)}
          onAdded={fetchClassData}
        />
      )}

      {showParentLinkModal && selectedStudentForParentLink && (
        <ParentLinkModal
          studentId={selectedStudentForParentLink.id}
          studentName={selectedStudentForParentLink.full_name || selectedStudentForParentLink.email}
          onClose={() => {
            setShowParentLinkModal(false);
            setSelectedStudentForParentLink(null);
          }}
          onUpdate={fetchClassData}
        />
      )}
    </div>
  );
}

function InviteStudentModal({
  classId,
  onClose,
  onInvited
}: {
  classId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [emails, setEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');

    const emailList = emails.split(/[\n,]/).map(e => e.trim()).filter(e => e);

    if (emailList.length === 0) {
      setError('Please enter at least one email address');
      setSending(false);
      return;
    }

    const invitations = emailList.map(email => ({
      class_id: classId,
      email: email.toLowerCase()
    }));

    const { error: insertError } = await supabase
      .from('invitations')
      .insert(invitations);

    if (insertError) {
      setError(insertError.message);
      setSending(false);
      return;
    }

    setSuccess(true);
    setSending(false);
    onInvited();
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-md p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Invitations Created!</h2>
          <p className="text-slate-600 mb-6">
            Students can now register using their invitation links.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Invite Students</h2>
          <p className="text-sm text-slate-600 mt-1">Enter email addresses to send invitations</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="emails" className="block text-sm font-medium text-slate-700 mb-1.5">
              Email Addresses
            </label>
            <textarea
              id="emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={5}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Enter emails separated by commas or new lines&#10;student1@school.edu&#10;student2@school.edu"
            />
            <p className="text-xs text-slate-500 mt-1">
              Separate multiple emails with commas or new lines
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Invitations'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UnitModal({
  classId,
  editingUnit,
  existingUnits,
  onClose,
  onSaved
}: {
  classId: string;
  editingUnit: Unit | null;
  existingUnits: Unit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [number, setNumber] = useState(editingUnit?.number || '');
  const [title, setTitle] = useState(editingUnit?.title || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const displayOrder = editingUnit?.display_order ?? existingUnits.length;

    if (editingUnit) {
      const { error: updateError } = await supabase
        .from('units')
        .update({ number, title })
        .eq('id', editingUnit.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('units')
        .insert({
          class_id: classId,
          number,
          title,
          display_order: displayOrder
        });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {editingUnit ? 'Edit Unit' : 'Add Unit'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="number" className="block text-sm font-medium text-slate-700 mb-1.5">
              Unit Number *
            </label>
            <input
              id="number"
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 1, 2, D"
            />
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1.5">
              Unit Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Tools of Geometry"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingUnit ? 'Save Changes' : 'Add Unit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ObjectiveModal({
  unitId,
  editingObjective,
  existingObjectives,
  onClose,
  onSaved
}: {
  unitId: string;
  editingObjective: Objective | null;
  existingObjectives: Objective[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [number, setNumber] = useState(editingObjective?.number || '');
  const [description, setDescription] = useState(editingObjective?.description || '');
  const [highestLevel, setHighestLevel] = useState(editingObjective?.highest_level || 'intermediate');
  const [weight, setWeight] = useState(editingObjective?.weight?.toString() || '1.00');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const displayOrder = editingObjective?.display_order ?? existingObjectives.length;

    if (editingObjective) {
      const { error: updateError } = await supabase
        .from('objectives')
        .update({
          number,
          description,
          highest_level: highestLevel,
          weight: parseFloat(weight)
        })
        .eq('id', editingObjective.id);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from('objectives')
        .insert({
          unit_id: unitId,
          number,
          description,
          highest_level: highestLevel,
          weight: parseFloat(weight),
          display_order: displayOrder
        });

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">
            {editingObjective ? 'Edit Objective' : 'Add Objective'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="number" className="block text-sm font-medium text-slate-700 mb-1.5">
                Objective Number *
              </label>
              <input
                id="number"
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 1-2, 1-3a"
              />
            </div>

            <div>
              <label htmlFor="highestLevel" className="block text-sm font-medium text-slate-700 mb-1.5">
                Highest Level Assessed *
              </label>
              <select
                id="highestLevel"
                value={highestLevel}
                onChange={(e) => setHighestLevel(e.target.value as 'basic' | 'intermediate' | 'advanced')}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="basic">Basic (3 pts)</option>
                <option value="intermediate">Intermediate (4 pts)</option>
                <option value="advanced">Advanced (5 pts)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1.5">
              Description *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Describe what students should be able to do"
            />
          </div>

          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-slate-700 mb-1.5">
              Weight
            </label>
            <input
              id="weight"
              type="number"
              step="0.01"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingObjective ? 'Save Changes' : 'Add Objective'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}