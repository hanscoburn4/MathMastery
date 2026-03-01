import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronDown, ChevronRight, X, HelpCircle } from 'lucide-react';
import type { Profile, Unit, Objective, ProgressRecord, MarkType, DifficultyLevel } from '../../types/database';

interface StudentProgressPageProps {
  classId: string;
  studentId: string;
  onNavigateToStudent?: (studentId: string) => void;
}

const MARK_TYPES: { value: MarkType; label: string; shortLabel: string; color: string; countsMastery: boolean }[] = [
  { value: 'check', label: 'Correct', shortLabel: '\u2713', color: 'bg-green-500 text-white', countsMastery: true },
  { value: 'check_s', label: 'Correct (Silly Mistake)', shortLabel: '\u2713s', color: 'bg-green-400 text-white', countsMastery: true },
  { value: 'check_c', label: 'Correct (Conversation)', shortLabel: '\u2713c', color: 'bg-green-400 text-white', countsMastery: true },
  { value: 'check_o', label: 'Correct (Observation)', shortLabel: '\u2713o', color: 'bg-green-400 text-white', countsMastery: true },
  { value: 'G', label: 'Group Work', shortLabel: 'G', color: 'bg-blue-400 text-white', countsMastery: false },
  { value: 'H', label: 'Help/Hint', shortLabel: 'H', color: 'bg-yellow-400 text-slate-900', countsMastery: false },
  { value: 'PC', label: 'Partly Correct', shortLabel: 'PC', color: 'bg-orange-400 text-white', countsMastery: false },
  { value: 'N', label: 'Not Attempted', shortLabel: 'N', color: 'bg-slate-300 text-slate-700', countsMastery: false },
  { value: 'X', label: 'Incorrect', shortLabel: '\u2717', color: 'bg-red-500 text-white', countsMastery: false },
];

const ATTEMPT_NUMBERS = [1, 2, 3, 4, 5];
const AFTER_UNIT_NUMBERS = [1, 2];

interface CellPosition {
  objectiveId: string;
  level: DifficultyLevel;
  attemptNumber: number;
  isAfterUnit: boolean;
  afterUnitNumber?: number;
}

export default function StudentProgressPage({ classId, studentId, onNavigateToStudent }: StudentProgressPageProps) {
  const { user } = useAuth();
  const [student, setStudent] = useState<Profile | null>(null);
  const [students, setStudents] = useState<Profile[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [objectives, setObjectives] = useState<Record<string, Objective[]>>({});
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeCell, setActiveCell] = useState<CellPosition | null>(null);
  const [backfillMode, setBackfillMode] = useState(true);
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    if (activeCell && menuRef.current) {
      menuRef.current.focus();
    }
  }, [activeCell]);

  useEffect(() => {
    fetchData();
  }, [classId, studentId]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveCell(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!activeCell) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setActiveCell(null);
        setSelectedMenuIndex(0);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedMenuIndex(prev => Math.min(prev + 1, MARK_TYPES.length));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedMenuIndex(prev => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (selectedMenuIndex === MARK_TYPES.length) {
          handleMarkSelect(null);
        } else {
          handleMarkSelect(MARK_TYPES[selectedMenuIndex].value);
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeCell, selectedMenuIndex]);

  async function fetchData() {
    setLoading(true);

    const { data: studentData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();
    setStudent(studentData);

    // Fetch all students enrolled in this class
    const { data: enrollmentsData } = await supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(*)')
      .eq('class_id', classId)
      .order('profiles(full_name)');

    if (enrollmentsData) {
      const studentsList = enrollmentsData
        .map(e => e.profiles as unknown as Profile)
        .filter(Boolean)
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      setStudents(studentsList);
    }

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

  function getRecord(objectiveId: string, level: DifficultyLevel, attemptNumber: number, isAfterUnit: boolean, afterUnitNumber?: number) {
    return progressRecords.find(r =>
      r.objective_id === objectiveId &&
      r.level === level &&
      r.attempt_number === attemptNumber &&
      r.is_after_unit === isAfterUnit &&
      (isAfterUnit ? r.after_unit_number === afterUnitNumber : true)
    );
  }

  async function handleCellClick(
    e: React.MouseEvent,
    objectiveId: string,
    level: DifficultyLevel,
    attemptNumber: number,
    isAfterUnit: boolean,
    afterUnitNumber?: number
  ) {
    setActiveCell({ objectiveId, level, attemptNumber, isAfterUnit, afterUnitNumber });
    setSelectedMenuIndex(0);
  }

  async function handleMarkSelect(markType: MarkType | null) {
    if (!activeCell || !user) return;

    const { objectiveId, level, attemptNumber, isAfterUnit, afterUnitNumber } = activeCell;
    const existingRecord = getRecord(objectiveId, level, attemptNumber, isAfterUnit, afterUnitNumber);
    const masteryMarks: MarkType[] = ['check', 'check_s', 'check_c', 'check_o'];

    let newRecords: ProgressRecord[] = [];

    if (markType === null) {
      if (existingRecord) {
        await supabase.from('progress_records').delete().eq('id', existingRecord.id);
        setProgressRecords(progressRecords.filter(r => r.id !== existingRecord.id));
      }
    } else if (existingRecord) {
      await supabase
        .from('progress_records')
        .update({ mark_type: markType, recorded_by: user.id })
        .eq('id', existingRecord.id);
      setProgressRecords(progressRecords.map(r =>
        r.id === existingRecord.id ? { ...r, mark_type: markType } : r
      ));
    } else {
      const newRecord = {
        student_id: studentId,
        objective_id: objectiveId,
        level,
        attempt_number: attemptNumber,
        is_after_unit: isAfterUnit,
        after_unit_number: isAfterUnit ? afterUnitNumber : null,
        mark_type: markType,
        recorded_by: user.id
      };

      const { data } = await supabase
        .from('progress_records')
        .insert(newRecord)
        .select()
        .single();

      if (data) {
        newRecords.push(data);
      }

      // Backfill mode: if this is a mastery mark at a higher level, fill lower levels
      if (backfillMode && markType && masteryMarks.includes(markType)) {
        const levelsToBackfill: DifficultyLevel[] = [];

        if (level === 'advanced') {
          levelsToBackfill.push('intermediate', 'basic');
        } else if (level === 'intermediate') {
          levelsToBackfill.push('basic');
        }

        for (const backfillLevel of levelsToBackfill) {
          // Find the next available box (first empty attempt number)
          let nextAttempt = 1;
          for (let i = 1; i <= 5; i++) {
            const existing = getRecord(objectiveId, backfillLevel, i, false);
            if (!existing) {
              nextAttempt = i;
              break;
            }
          }

          // Only backfill if we found an empty slot
          if (nextAttempt <= 5) {
            const backfillRecord = {
              student_id: studentId,
              objective_id: objectiveId,
              level: backfillLevel,
              attempt_number: nextAttempt,
              is_after_unit: false,
              after_unit_number: null,
              mark_type: markType,
              recorded_by: user.id
            };

            const { data: backfillData } = await supabase
              .from('progress_records')
              .insert(backfillRecord)
              .select()
              .single();

            if (backfillData) {
              newRecords.push(backfillData);
            }
          }
        }
      }

      setProgressRecords([...progressRecords, ...newRecords]);
    }

    setActiveCell(null);
    setSelectedMenuIndex(0);
  }

  function isLevelEnabled(objective: Objective, level: DifficultyLevel): boolean {
    const levelOrder: DifficultyLevel[] = ['basic', 'intermediate', 'advanced'];
    const objectiveMaxIndex = levelOrder.indexOf(objective.highest_level);
    const currentLevelIndex = levelOrder.indexOf(level);
    return currentLevelIndex <= objectiveMaxIndex;
  }

  function calculateMastery(objectiveId: string, level: DifficultyLevel): boolean {
    const levelRecords = progressRecords
      .filter(r => r.objective_id === objectiveId && r.level === level)
      .sort((a, b) => {
        if (a.is_after_unit !== b.is_after_unit) return a.is_after_unit ? 1 : -1;
        if (a.is_after_unit && b.is_after_unit) {
          return (a.after_unit_number || 0) - (b.after_unit_number || 0);
        }
        return a.attempt_number - b.attempt_number;
      });

    const masteryMarks: MarkType[] = ['check', 'check_s', 'check_c', 'check_o'];
    let consecutiveCount = 0;

    for (const record of levelRecords) {
      if (masteryMarks.includes(record.mark_type)) {
        consecutiveCount++;
        if (consecutiveCount >= 2) return true;
      } else {
        consecutiveCount = 0;
      }
    }

    return false;
  }

  function calculateObjectiveScore(objective: Objective): number {
    const levels: DifficultyLevel[] = ['advanced', 'intermediate', 'basic'];
    const points = { advanced: 5, intermediate: 4, basic: 3 };

    // Check all levels and return points for the highest mastered level
    for (const level of levels) {
      if (calculateMastery(objective.id, level)) {
        return points[level];
      }
    }

    // If no mastery, but has any attempts, give 1 point
    const hasAnyAttempts = progressRecords.some(r => r.objective_id === objective.id);
    if (hasAnyAttempts) {
      return 1;
    }

    return 0;
  }

  function calculateUnitStats(unitId: string) {
    const unitObjectives = objectives[unitId] || [];
    let totalScore = 0;
    let maxScore = 0;

    for (const obj of unitObjectives) {
      const levelPoints = { basic: 3, intermediate: 4, advanced: 5 };
      maxScore += levelPoints[obj.highest_level];
      totalScore += calculateObjectiveScore(obj);
    }

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    return { totalScore, maxScore, percentage };
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

  function getMarkDisplay(record: ProgressRecord | undefined) {
    if (!record) return { label: '-', className: 'bg-slate-50 text-slate-400' };
    const markConfig = MARK_TYPES.find(m => m.value === record.mark_type);
    return {
      label: markConfig?.shortLabel || record.mark_type,
      className: markConfig?.color || 'bg-slate-100'
    };
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Student</label>
            <select
              value={studentId}
              onChange={(e) => onNavigateToStudent?.(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={backfillMode}
                onChange={(e) => setBackfillMode(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Backfill Mode</span>
              <div className="relative group">
                <HelpCircle className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                <div className="absolute right-0 top-6 w-64 bg-slate-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                  When enabled, marking a higher difficulty level will automatically fill the next available box at all lower levels with the same mark (mastery marks only).
                </div>
              </div>
            </label>
          </div>
        </div>
        <p className="text-slate-600">Progress Tracking</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden mb-6">
        <button
          onClick={() => setInfoExpanded(!infoExpanded)}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-amber-100 transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-medium text-amber-800">
            Understanding Your Grades
          </span>
          {infoExpanded ? (
            <ChevronDown className="w-5 h-5 text-amber-600 ml-auto" />
          ) : (
            <ChevronRight className="w-5 h-5 text-amber-600 ml-auto" />
          )}
        </button>
        {infoExpanded && (
          <div className="px-4 pb-4 pt-0 text-sm text-amber-800 border-t border-amber-200">
            <p className="mt-3 font-medium">Mastery System</p>
            <p className="mt-1">Any 2 consecutive checkmarks (✓, ✓s, ✓c, ✓o) within the same level indicates mastery. The score is determined by the highest level mastered.</p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {units.map(unit => {
          const stats = calculateUnitStats(unit.id);
          const unitObjectives = objectives[unit.id] || [];

          return (
            <div key={unit.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
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
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900">
                    {stats.percentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-slate-600">
                    {stats.totalScore} / {stats.maxScore}
                  </div>
                </div>
              </div>

              {expandedUnits.has(unit.id) && unitObjectives.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-2 px-2 font-medium text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                          Objective
                        </th>
                        <th className="py-2 px-1 font-medium text-slate-600 text-center w-12">Level</th>
                        <th className="py-2 px-1 font-medium text-slate-600 text-center w-12">Score</th>
                        <th className="py-2 px-1 font-medium text-slate-500 text-center bg-green-50" colSpan={5}>Basic</th>
                        <th className="py-2 px-1 font-medium text-slate-500 text-center bg-green-50" colSpan={2}>After</th>
                        <th className="py-2 px-1 font-medium text-slate-500 text-center bg-yellow-50" colSpan={5}>Intermediate</th>
                        <th className="py-2 px-1 font-medium text-slate-500 text-center bg-yellow-50" colSpan={2}>After</th>
                        <th className="py-2 px-1 font-medium text-slate-500 text-center bg-red-50" colSpan={5}>Advanced</th>
                        <th className="py-2 px-1 font-medium text-slate-500 text-center bg-red-50" colSpan={2}>After</th>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th></th>
                        <th></th>
                        <th></th>
                        {ATTEMPT_NUMBERS.map(n => (
                          <th key={`basic-${n}`} className="py-1 px-1 text-slate-500 text-center bg-green-50 w-8">{n}</th>
                        ))}
                        {AFTER_UNIT_NUMBERS.map(n => (
                          <th key={`basic-after-${n}`} className="py-1 px-1 text-slate-500 text-center bg-green-50 w-8">X{n}</th>
                        ))}
                        {ATTEMPT_NUMBERS.map(n => (
                          <th key={`int-${n}`} className="py-1 px-1 text-slate-500 text-center bg-yellow-50 w-8">{n}</th>
                        ))}
                        {AFTER_UNIT_NUMBERS.map(n => (
                          <th key={`int-after-${n}`} className="py-1 px-1 text-slate-500 text-center bg-yellow-50 w-8">X{n}</th>
                        ))}
                        {ATTEMPT_NUMBERS.map(n => (
                          <th key={`adv-${n}`} className="py-1 px-1 text-slate-500 text-center bg-red-50 w-8">{n}</th>
                        ))}
                        {AFTER_UNIT_NUMBERS.map(n => (
                          <th key={`adv-after-${n}`} className="py-1 px-1 text-slate-500 text-center bg-red-50 w-8">X{n}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {unitObjectives.map(obj => {
                        const score = calculateObjectiveScore(obj);
                        const maxPoints = { basic: 3, intermediate: 4, advanced: 5 }[obj.highest_level];

                        return (
                          <tr key={obj.id} className="hover:bg-slate-50">
                            <td className="py-2 px-2 sticky left-0 bg-white z-10">
                              <div className="font-medium text-slate-900">{obj.number}</div>
                              <div className="text-slate-600 text-xs truncate max-w-[180px]" title={obj.description}>
                                {obj.description}
                              </div>
                            </td>
                            <td className="py-2 px-1 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                obj.highest_level === 'basic' ? 'bg-green-100 text-green-700' :
                                obj.highest_level === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {obj.highest_level.charAt(0).toUpperCase()}
                              </span>
                            </td>
                            <td className="py-2 px-1 text-center font-medium">
                              {score}/{maxPoints}
                            </td>

                            {ATTEMPT_NUMBERS.map(attemptNum => {
                              const record = getRecord(obj.id, 'basic', attemptNum, false);
                              const display = getMarkDisplay(record);
                              const enabled = isLevelEnabled(obj, 'basic');
                              return (
                                <td key={`basic-${attemptNum}`} className="py-1 px-0.5 bg-green-50/50">
                                  {enabled ? (
                                    <button
                                      onClick={(e) => handleCellClick(e, obj.id, 'basic', attemptNum, false)}
                                      className={`w-7 h-7 rounded text-xs font-medium ${display.className} hover:ring-2 hover:ring-blue-400 focus:ring-2 focus:ring-blue-500 transition-all`}
                                    >
                                      {display.label}
                                    </button>
                                  ) : (
                                    <div className="w-7 h-7 rounded bg-slate-100" />
                                  )}
                                </td>
                              );
                            })}
                            {AFTER_UNIT_NUMBERS.map(afterNum => {
                              const record = getRecord(obj.id, 'basic', 1, true, afterNum);
                              const display = getMarkDisplay(record);
                              const enabled = isLevelEnabled(obj, 'basic');
                              return (
                                <td key={`basic-after-${afterNum}`} className="py-1 px-0.5 bg-green-50/50">
                                  {enabled ? (
                                    <button
                                      onClick={(e) => handleCellClick(e, obj.id, 'basic', 1, true, afterNum)}
                                      className={`w-7 h-7 rounded text-xs font-medium ${display.className} hover:ring-2 hover:ring-blue-400 focus:ring-2 focus:ring-blue-500 transition-all`}
                                    >
                                      {display.label}
                                    </button>
                                  ) : (
                                    <div className="w-7 h-7 rounded bg-slate-100" />
                                  )}
                                </td>
                              );
                            })}

                            {ATTEMPT_NUMBERS.map(attemptNum => {
                              const record = getRecord(obj.id, 'intermediate', attemptNum, false);
                              const display = getMarkDisplay(record);
                              const enabled = isLevelEnabled(obj, 'intermediate');
                              return (
                                <td key={`int-${attemptNum}`} className="py-1 px-0.5 bg-yellow-50/50">
                                  {enabled ? (
                                    <button
                                      onClick={(e) => handleCellClick(e, obj.id, 'intermediate', attemptNum, false)}
                                      className={`w-7 h-7 rounded text-xs font-medium ${display.className} hover:ring-2 hover:ring-blue-400 focus:ring-2 focus:ring-blue-500 transition-all`}
                                    >
                                      {display.label}
                                    </button>
                                  ) : (
                                    <div className="w-7 h-7 rounded bg-slate-100" />
                                  )}
                                </td>
                              );
                            })}
                            {AFTER_UNIT_NUMBERS.map(afterNum => {
                              const record = getRecord(obj.id, 'intermediate', 1, true, afterNum);
                              const display = getMarkDisplay(record);
                              const enabled = isLevelEnabled(obj, 'intermediate');
                              return (
                                <td key={`int-after-${afterNum}`} className="py-1 px-0.5 bg-yellow-50/50">
                                  {enabled ? (
                                    <button
                                      onClick={(e) => handleCellClick(e, obj.id, 'intermediate', 1, true, afterNum)}
                                      className={`w-7 h-7 rounded text-xs font-medium ${display.className} hover:ring-2 hover:ring-blue-400 focus:ring-2 focus:ring-blue-500 transition-all`}
                                    >
                                      {display.label}
                                    </button>
                                  ) : (
                                    <div className="w-7 h-7 rounded bg-slate-100" />
                                  )}
                                </td>
                              );
                            })}

                            {ATTEMPT_NUMBERS.map(attemptNum => {
                              const record = getRecord(obj.id, 'advanced', attemptNum, false);
                              const display = getMarkDisplay(record);
                              const enabled = isLevelEnabled(obj, 'advanced');
                              return (
                                <td key={`adv-${attemptNum}`} className="py-1 px-0.5 bg-red-50/50">
                                  {enabled ? (
                                    <button
                                      onClick={(e) => handleCellClick(e, obj.id, 'advanced', attemptNum, false)}
                                      className={`w-7 h-7 rounded text-xs font-medium ${display.className} hover:ring-2 hover:ring-blue-400 focus:ring-2 focus:ring-blue-500 transition-all`}
                                    >
                                      {display.label}
                                    </button>
                                  ) : (
                                    <div className="w-7 h-7 rounded bg-slate-100" />
                                  )}
                                </td>
                              );
                            })}
                            {AFTER_UNIT_NUMBERS.map(afterNum => {
                              const record = getRecord(obj.id, 'advanced', 1, true, afterNum);
                              const display = getMarkDisplay(record);
                              const enabled = isLevelEnabled(obj, 'advanced');
                              return (
                                <td key={`adv-after-${afterNum}`} className="py-1 px-0.5 bg-red-50/50">
                                  {enabled ? (
                                    <button
                                      onClick={(e) => handleCellClick(e, obj.id, 'advanced', 1, true, afterNum)}
                                      className={`w-7 h-7 rounded text-xs font-medium ${display.className} hover:ring-2 hover:ring-blue-400 focus:ring-2 focus:ring-blue-500 transition-all`}
                                    >
                                      {display.label}
                                    </button>
                                  ) : (
                                    <div className="w-7 h-7 rounded bg-slate-100" />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {expandedUnits.has(unit.id) && unitObjectives.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  No objectives defined for this unit
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeCell && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div
            ref={menuRef}
            tabIndex={-1}
            className="bg-white rounded-lg shadow-2xl border border-slate-200 w-80 max-h-[600px] flex flex-col outline-none"
          >
            <div className="px-4 py-3 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Select Mark
              </h3>
            </div>
            <div className="overflow-y-auto flex-1 py-2">
              {MARK_TYPES.map((mark, index) => (
                <button
                  key={mark.value}
                  onClick={() => handleMarkSelect(mark.value)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    selectedMenuIndex === index
                      ? 'bg-blue-50 border-l-2 border-blue-600'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-medium ${mark.color}`}>
                    {mark.shortLabel}
                  </span>
                  <span className="text-sm text-slate-700 flex-1">{mark.label}</span>
                  {mark.countsMastery && (
                    <span className="text-xs text-green-600 font-medium">Mastery</span>
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-slate-200 py-2">
              <button
                onClick={() => handleMarkSelect(null)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  selectedMenuIndex === MARK_TYPES.length
                    ? 'bg-red-50 border-l-2 border-red-600 text-red-600'
                    : 'hover:bg-red-50 text-red-600'
                }`}
              >
                <span className="w-7 h-7 rounded flex items-center justify-center text-xs font-medium bg-slate-100">
                  <X className="w-4 h-4" />
                </span>
                <span className="text-sm">Clear Mark</span>
              </button>
            </div>
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              Use ↑/↓ to navigate, Enter to select, Esc to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
}