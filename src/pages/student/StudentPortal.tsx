import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import SettingsModal from '../../components/SettingsModal';
import { ChevronDown, ChevronRight, GraduationCap, BookOpen, LogOut, HelpCircle, Smile, Settings } from 'lucide-react';
import type { Class, Unit, Objective, ProgressRecord, MarkType, DifficultyLevel } from '../../types/database';

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

export default function StudentPortal() {
  const { profile, signOut } = useAuth();
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
    fetchEnrolledClasses();
  }, []);

  async function fetchEnrolledClasses() {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('class_id')
      .eq('student_id', profile?.id);

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
        await fetchClassData(classes[0].id);
      }
    }

    setLoading(false);
  }

  async function fetchClassData(classId: string) {
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

      if (allObjectiveIds.length > 0 && profile) {
        const { data: records } = await supabase
          .from('progress_records')
          .select('*')
          .eq('student_id', profile.id)
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

  function calculateOverallGrade() {
    let totalScore = 0;
    let maxScore = 0;

    for (const unit of units) {
      const stats = calculateUnitStats(unit.id);
      totalScore += stats.totalScore;
      maxScore += stats.maxScore;
    }

    return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
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
    if (!record) return { label: '-', className: 'bg-slate-100 text-slate-400' };
    const config = MARK_DISPLAY[record.mark_type];
    return {
      label: config?.label || record.mark_type,
      className: config?.color || 'bg-slate-100'
    };
  }

  if (loading && enrolledClasses.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white">My Progress</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">{profile?.full_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Settings</span>
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {enrolledClasses.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">No Classes Yet</h2>
            <p className="text-slate-600 dark:text-slate-400">You have not been enrolled in any classes yet. Please wait for your teacher to invite you.</p>
          </div>
        ) : (
          <>
            {enrolledClasses.length > 1 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Class</label>
                <select
                  value={selectedClass?.id || ''}
                  onChange={(e) => {
                    const cls = enrolledClasses.find(c => c.id === e.target.value);
                    if (cls) {
                      setSelectedClass(cls);
                      fetchClassData(cls.id);
                    }
                  }}
                  className="w-full md:w-64 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-white"
                >
                  {enrolledClasses.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedClass && (
              <>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 mb-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedClass.name}</h2>
                      {selectedClass.school_year && (
                        <p className="text-slate-600 dark:text-slate-400">{selectedClass.school_year}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-slate-900 dark:text-white">
                        {calculateOverallGrade().toFixed(1)}%
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">Overall Grade</p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden mb-6">
                  <button
                    onClick={() => setInfoExpanded(!infoExpanded)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                      Understanding Your Grades
                    </span>
                    {infoExpanded ? (
                      <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-auto" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-auto" />
                    )}
                  </button>
                  {infoExpanded && (
                    <div className="px-4 pb-4 pt-0 text-sm text-blue-800 dark:text-blue-300 border-t border-blue-200 dark:border-blue-800">
                      <p className="mt-3">2 consecutive checkmarks (✓, ✓s, ✓c, ✓o) at any level shows mastery. Your score is based on the highest level you have mastered for each objective.</p>
                      <p className="mt-2">
                        <span className="font-medium">Points:</span> Basic = 3 pts | Intermediate = 4 pts | Advanced = 5 pts
                      </p>
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {units.map(unit => {
                      const stats = calculateUnitStats(unit.id);
                      const unitObjectives = objectives[unit.id] || [];

                      return (
                        <div key={unit.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <div
                            className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => toggleUnit(unit.id)}
                          >
                            {expandedUnits.has(unit.id) ? (
                              <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                            )}
                            <div className="flex-1">
                              <span className="font-semibold text-blue-600 dark:text-blue-400">Unit {unit.number}</span>
                              <span className="mx-2 text-slate-400 dark:text-slate-500">|</span>
                              <span className="font-medium text-slate-900 dark:text-white">{unit.title}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {stats.percentage.toFixed(1)}%
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {stats.totalScore} / {stats.maxScore}
                              </div>
                            </div>
                          </div>

                          {expandedUnits.has(unit.id) && unitObjectives.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                                    <th className="text-left py-2 px-2 font-medium text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-700/50 z-10 min-w-[200px]">
                                      Objective
                                    </th>
                                    <th className="py-2 px-1 font-medium text-slate-600 dark:text-slate-300 text-center w-10">Lvl</th>
                                    <th className="py-2 px-1 font-medium text-slate-600 dark:text-slate-300 text-center w-12">Score</th>
                                    <th className="py-2 px-1 font-medium text-center w-8 bg-green-50 dark:bg-green-900/20">B</th>
                                    <th className="py-2 px-1 font-medium text-center w-8 bg-yellow-50 dark:bg-yellow-900/20">I</th>
                                    <th className="py-2 px-1 font-medium text-center w-8 bg-red-50 dark:bg-red-900/20">A</th>
                                    <th className="py-2 px-1 font-medium text-slate-500 dark:text-slate-400 text-center bg-green-50 dark:bg-green-900/20" colSpan={5}>Basic</th>
                                    <th className="py-2 px-1 font-medium text-slate-500 dark:text-slate-400 text-center bg-green-50 dark:bg-green-900/20" colSpan={2}>After</th>
                                    <th className="py-2 px-1 font-medium text-slate-500 dark:text-slate-400 text-center bg-yellow-50 dark:bg-yellow-900/20" colSpan={5}>Int</th>
                                    <th className="py-2 px-1 font-medium text-slate-500 dark:text-slate-400 text-center bg-yellow-50 dark:bg-yellow-900/20" colSpan={2}>After</th>
                                    <th className="py-2 px-1 font-medium text-slate-500 dark:text-slate-400 text-center bg-red-50 dark:bg-red-900/20" colSpan={5}>Adv</th>
                                    <th className="py-2 px-1 font-medium text-slate-500 dark:text-slate-400 text-center bg-red-50 dark:bg-red-900/20" colSpan={2}>After</th>
                                  </tr>
                                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                                    <th></th>
                                    <th></th>
                                    <th></th>
                                    <th></th>
                                    <th></th>
                                    <th></th>
                                    {ATTEMPT_NUMBERS.map(n => (
                                      <th key={`basic-${n}`} className="py-1 px-1 text-slate-500 dark:text-slate-400 text-center bg-green-50 dark:bg-green-900/20 w-7">{n}</th>
                                    ))}
                                    {AFTER_UNIT_NUMBERS.map(n => (
                                      <th key={`basic-after-${n}`} className="py-1 px-1 text-slate-500 dark:text-slate-400 text-center bg-green-50 dark:bg-green-900/20 w-7">X{n}</th>
                                    ))}
                                    {ATTEMPT_NUMBERS.map(n => (
                                      <th key={`int-${n}`} className="py-1 px-1 text-slate-500 dark:text-slate-400 text-center bg-yellow-50 dark:bg-yellow-900/20 w-7">{n}</th>
                                    ))}
                                    {AFTER_UNIT_NUMBERS.map(n => (
                                      <th key={`int-after-${n}`} className="py-1 px-1 text-slate-500 dark:text-slate-400 text-center bg-yellow-50 dark:bg-yellow-900/20 w-7">X{n}</th>
                                    ))}
                                    {ATTEMPT_NUMBERS.map(n => (
                                      <th key={`adv-${n}`} className="py-1 px-1 text-slate-500 dark:text-slate-400 text-center bg-red-50 dark:bg-red-900/20 w-7">{n}</th>
                                    ))}
                                    {AFTER_UNIT_NUMBERS.map(n => (
                                      <th key={`adv-after-${n}`} className="py-1 px-1 text-slate-500 dark:text-slate-400 text-center bg-red-50 dark:bg-red-900/20 w-7">X{n}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                  {unitObjectives.map(obj => {
                                    const score = calculateObjectiveScore(obj);
                                    const maxPoints = { basic: 3, intermediate: 4, advanced: 5 }[obj.highest_level];
                                    const basicMastery = calculateMastery(obj.id, 'basic');
                                    const intMastery = calculateMastery(obj.id, 'intermediate');
                                    const advMastery = calculateMastery(obj.id, 'advanced');

                                    return (
                                      <tr key={obj.id}>
                                        <td className="py-2 px-2 sticky left-0 bg-white dark:bg-slate-800 z-10">
                                          <div className="font-medium text-slate-900 dark:text-white">{obj.number}</div>
                                          <div className="text-slate-600 dark:text-slate-400 text-xs truncate max-w-[180px]" title={obj.description}>
                                            {obj.description}
                                          </div>
                                        </td>
                                        <td className="py-2 px-1 text-center">
                                          <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${
                                            obj.highest_level === 'basic' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                            obj.highest_level === 'intermediate' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                          }`}>
                                            {obj.highest_level.charAt(0).toUpperCase()}
                                          </span>
                                        </td>
                                        <td className="py-2 px-1 text-center font-medium dark:text-slate-300">
                                          {score}/{maxPoints}
                                        </td>
                                        <td className="py-2 px-1 text-center bg-green-50/50 dark:bg-green-900/10">
                                          {basicMastery && <Smile className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto" />}
                                        </td>
                                        <td className="py-2 px-1 text-center bg-yellow-50/50 dark:bg-yellow-900/10">
                                          {intMastery && <Smile className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mx-auto" />}
                                        </td>
                                        <td className="py-2 px-1 text-center bg-red-50/50 dark:bg-red-900/10">
                                          {advMastery && <Smile className="w-4 h-4 text-red-600 dark:text-red-400 mx-auto" />}
                                        </td>

                                        {ATTEMPT_NUMBERS.map(attemptNum => {
                                          const record = getRecord(obj.id, 'basic', attemptNum, false);
                                          const display = getMarkDisplay(record);
                                          return (
                                            <td key={`basic-${attemptNum}`} className="py-1 px-0.5 bg-green-50/50 dark:bg-green-900/10 text-center">
                                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${display.className}`}>
                                                {display.label}
                                              </span>
                                            </td>
                                          );
                                        })}
                                        {AFTER_UNIT_NUMBERS.map(afterNum => {
                                          const record = getRecord(obj.id, 'basic', 1, true, afterNum);
                                          const display = getMarkDisplay(record);
                                          return (
                                            <td key={`basic-after-${afterNum}`} className="py-1 px-0.5 bg-green-50/50 dark:bg-green-900/10 text-center">
                                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${display.className}`}>
                                                {display.label}
                                              </span>
                                            </td>
                                          );
                                        })}

                                        {ATTEMPT_NUMBERS.map(attemptNum => {
                                          const record = getRecord(obj.id, 'intermediate', attemptNum, false);
                                          const display = getMarkDisplay(record);
                                          return (
                                            <td key={`int-${attemptNum}`} className="py-1 px-0.5 bg-yellow-50/50 dark:bg-yellow-900/10 text-center">
                                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${display.className}`}>
                                                {display.label}
                                              </span>
                                            </td>
                                          );
                                        })}
                                        {AFTER_UNIT_NUMBERS.map(afterNum => {
                                          const record = getRecord(obj.id, 'intermediate', 1, true, afterNum);
                                          const display = getMarkDisplay(record);
                                          return (
                                            <td key={`int-after-${afterNum}`} className="py-1 px-0.5 bg-yellow-50/50 dark:bg-yellow-900/10 text-center">
                                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${display.className}`}>
                                                {display.label}
                                              </span>
                                            </td>
                                          );
                                        })}

                                        {ATTEMPT_NUMBERS.map(attemptNum => {
                                          const record = getRecord(obj.id, 'advanced', attemptNum, false);
                                          const display = getMarkDisplay(record);
                                          return (
                                            <td key={`adv-${attemptNum}`} className="py-1 px-0.5 bg-red-50/50 dark:bg-red-900/10 text-center">
                                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${display.className}`}>
                                                {display.label}
                                              </span>
                                            </td>
                                          );
                                        })}
                                        {AFTER_UNIT_NUMBERS.map(afterNum => {
                                          const record = getRecord(obj.id, 'advanced', 1, true, afterNum);
                                          const display = getMarkDisplay(record);
                                          return (
                                            <td key={`adv-after-${afterNum}`} className="py-1 px-0.5 bg-red-50/50 dark:bg-red-900/10 text-center">
                                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${display.className}`}>
                                                {display.label}
                                              </span>
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
                            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                              No objectives defined for this unit yet
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-12 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </footer>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}