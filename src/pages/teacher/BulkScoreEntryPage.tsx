import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ChevronLeft,
  Plus,
  X,
  Check,
  Save,
  Upload,
  Trash2,
  AlertCircle,
  Search
} from 'lucide-react';
import type { Unit, Objective, Profile, DifficultyLevel, MarkType } from '../../types/database';
import { getLevelsToBackfill } from '../../utils/backfillMarks';

interface BulkScoreEntryPageProps {
  classId: string;
  onBack: () => void;
}

interface StudentWithEnrollment extends Profile {
  enrollmentId: string;
}

interface ObjectiveLevel {
  objectiveId: string;
  objectiveNumber: string;
  level: DifficultyLevel;
  unitId: string;
}

interface PendingMark {
  studentId: string;
  objectiveId: string;
  level: DifficultyLevel;
  markType: MarkType;
}

interface DraftData {
  selectedObjectiveLevels: ObjectiveLevel[];
  pendingMarks: PendingMark[];
  backfillMode: boolean;
}

const MARK_TYPES: { value: MarkType; label: string; color: string; hotkey: string }[] = [
  { value: 'check', label: '✓', color: 'bg-green-100 text-green-700 border-green-300', hotkey: 'c' },
  { value: 'check_s', label: '✓s', color: 'bg-green-100 text-green-700 border-green-300', hotkey: 's' },
  { value: 'check_c', label: '✓c', color: 'bg-green-100 text-green-700 border-green-300', hotkey: 'v' },
  { value: 'check_o', label: '✓o', color: 'bg-green-100 text-green-700 border-green-300', hotkey: 'o' },
  { value: 'G', label: 'G', color: 'bg-blue-100 text-blue-700 border-blue-300', hotkey: 'g' },
  { value: 'H', label: 'H', color: 'bg-amber-100 text-amber-700 border-amber-300', hotkey: 'h' },
  { value: 'PC', label: 'PC', color: 'bg-yellow-100 text-yellow-700 border-yellow-300', hotkey: 'p' },
  { value: 'N', label: 'N', color: 'bg-orange-100 text-orange-700 border-orange-300', hotkey: 'n' },
  { value: 'X', label: 'X', color: 'bg-red-100 text-red-700 border-red-300', hotkey: 'x' },
];

const MASTERY_MARKS: MarkType[] = ['check', 'check_s', 'check_c', 'check_o'];

export default function BulkScoreEntryPage({ classId, onBack }: BulkScoreEntryPageProps) {
  const [step, setStep] = useState<'select' | 'grid'>('select');
  const [units, setUnits] = useState<Unit[]>([]);
  const [objectives, setObjectives] = useState<Record<string, Objective[]>>({});
  const [students, setStudents] = useState<StudentWithEnrollment[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedObjectiveLevels, setSelectedObjectiveLevels] = useState<ObjectiveLevel[]>([]);
  const [pendingMarks, setPendingMarks] = useState<PendingMark[]>([]);
  const [backfillMode, setBackfillMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<{ studentId: string; objectiveId: string; level: DifficultyLevel } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [existingDraft, setExistingDraft] = useState<DraftData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    fetchData();
  }, [classId]);

  useEffect(() => {
    if (hasUnsavedChanges) {
      const interval = setInterval(() => {
        handleSaveDraft(true);
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [hasUnsavedChanges, selectedObjectiveLevels, pendingMarks, backfillMode]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!activeCell) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      const markType = MARK_TYPES.find(mt => mt.hotkey === key);

      if (markType) {
        e.preventDefault();
        handleSetMark(activeCell.studentId, activeCell.objectiveId, activeCell.level, markType.value);
      } else if (key === 'escape') {
        e.preventDefault();
        setActiveCell(null);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeCell]);

  async function fetchData() {
    setLoading(true);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

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
      (objectivesData || []).forEach(obj => {
        if (!objectivesByUnit[obj.unit_id]) {
          objectivesByUnit[obj.unit_id] = [];
        }
        objectivesByUnit[obj.unit_id].push(obj);
      });
      setObjectives(objectivesByUnit);
    }

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

    const { data: draft } = await supabase
      .from('bulk_entry_drafts')
      .select('*')
      .eq('class_id', classId)
      .eq('teacher_id', user.user.id)
      .maybeSingle();

    if (draft) {
      setExistingDraft(draft.draft_data as DraftData);
      setDraftId(draft.id);
      setLastSaved(new Date(draft.updated_at));
      setShowDraftPrompt(true);
    }

    setLoading(false);
  }

  function handleResumeDraft() {
    if (existingDraft) {
      setSelectedObjectiveLevels(existingDraft.selectedObjectiveLevels);
      setPendingMarks(existingDraft.pendingMarks);
      setBackfillMode(existingDraft.backfillMode);
      if (existingDraft.selectedObjectiveLevels.length > 0) {
        setStep('grid');
      }
    }
    setShowDraftPrompt(false);
  }

  function handleStartFresh() {
    setShowDraftPrompt(false);
    handleDeleteDraft();
  }

  async function handleSaveDraft(isAutoSave = false) {
    if (!isAutoSave) setSaving(true);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const draftData: DraftData = {
      selectedObjectiveLevels,
      pendingMarks,
      backfillMode
    };

    if (draftId) {
      await supabase
        .from('bulk_entry_drafts')
        .update({ draft_data: draftData, updated_at: new Date().toISOString() })
        .eq('id', draftId);
    } else {
      const { data } = await supabase
        .from('bulk_entry_drafts')
        .insert({
          class_id: classId,
          teacher_id: user.user.id,
          draft_data: draftData
        })
        .select()
        .single();

      if (data) {
        setDraftId(data.id);
      }
    }

    setLastSaved(new Date());
    setHasUnsavedChanges(false);
    if (!isAutoSave) setSaving(false);
  }

  async function handleDeleteDraft() {
    if (draftId) {
      await supabase
        .from('bulk_entry_drafts')
        .delete()
        .eq('id', draftId);

      setDraftId(null);
      setLastSaved(null);
    }
  }

  function handleToggleObjectiveLevel(objectiveId: string, level: DifficultyLevel, unitId: string, objectiveNumber: string) {
    const exists = selectedObjectiveLevels.some(
      ol => ol.objectiveId === objectiveId && ol.level === level
    );

    if (exists) {
      setSelectedObjectiveLevels(selectedObjectiveLevels.filter(
        ol => !(ol.objectiveId === objectiveId && ol.level === level)
      ));
      setPendingMarks(pendingMarks.filter(
        pm => !(pm.objectiveId === objectiveId && pm.level === level)
      ));
    } else {
      setSelectedObjectiveLevels([
        ...selectedObjectiveLevels,
        { objectiveId, level, unitId, objectiveNumber }
      ]);
    }
    setHasUnsavedChanges(true);
  }

  function handleSetMark(studentId: string, objectiveId: string, level: DifficultyLevel, markType: MarkType | null) {
    if (markType === null) {
      setPendingMarks(pendingMarks.filter(
        pm => !(pm.studentId === studentId && pm.objectiveId === objectiveId && pm.level === level)
      ));
      setActiveCell(null);
      setHasUnsavedChanges(true);
      return;
    }

    let newMarks = pendingMarks.filter(
      pm => !(pm.studentId === studentId && pm.objectiveId === objectiveId && pm.level === level)
    );

    newMarks.push({ studentId, objectiveId, level, markType });

    // Grid only shows what teacher enters - backfill happens during database submission
    setPendingMarks(newMarks);
    setActiveCell(null);
    setHasUnsavedChanges(true);
  }

  function getPendingMark(studentId: string, objectiveId: string, level: DifficultyLevel): MarkType | null {
    const mark = pendingMarks.find(
      pm => pm.studentId === studentId && pm.objectiveId === objectiveId && pm.level === level
    );
    return mark ? mark.markType : null;
  }

  async function handleSubmit() {
    if (pendingMarks.length === 0) return;

    setSubmitting(true);

    try {
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) {
        throw new Error('User not authenticated');
      }

      const recordsToInsert = [];
      const levels: DifficultyLevel[] = ['basic', 'intermediate', 'advanced'];

      console.log('Starting submission with pending marks:', pendingMarks);
      console.log('Selected objective levels:', selectedObjectiveLevels);

      // Get student enrollments for validation
      const studentIds = [...new Set(pendingMarks.map(m => m.studentId))];
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('id, student_id')
        .eq('class_id', classId)
        .in('student_id', studentIds);

      if (!enrollments || enrollments.length === 0) {
        throw new Error('No enrollments found for students');
      }

      console.log('Found enrollments:', enrollments);

      // Track what we're adding in this batch to avoid conflicts
      const attemptTracker = new Map<string, number>();

      function getNextAttemptForLevel(studentId: string, objectiveId: string, level: DifficultyLevel, existingMax: number): number {
        const key = `${studentId}-${objectiveId}-${level}`;
        const trackedAttempt = attemptTracker.get(key);

        if (trackedAttempt !== undefined) {
          // We've already added a record for this combination in this batch
          const nextAttempt = Math.min(trackedAttempt + 1, 5);
          attemptTracker.set(key, nextAttempt);
          return nextAttempt;
        } else {
          // First time we're adding for this combination
          const nextAttempt = Math.min(existingMax + 1, 5);
          attemptTracker.set(key, nextAttempt);
          return nextAttempt;
        }
      }

      // Process each pending mark
      for (const mark of pendingMarks) {
        console.log(`Processing mark:`, mark);

        // Find the objective
        const objective = Object.values(objectives).flat().find(obj => obj.id === mark.objectiveId);
        if (!objective) {
          console.log('Objective not found:', mark.objectiveId);
          continue;
        }

        // Find the enrollment
        const enrollment = enrollments.find(e => e.student_id === mark.studentId);
        if (!enrollment) {
          console.log('Enrollment not found for student:', mark.studentId);
          continue;
        }

        console.log(`Processing: Student ${mark.studentId}, Objective ${objective.number}, Level ${mark.level}`);

        // Get existing attempts for this level from database
        const { data: existingRecords, error: fetchError } = await supabase
          .from('progress_records')
          .select('attempt_number')
          .eq('student_id', mark.studentId)
          .eq('objective_id', mark.objectiveId)
          .eq('level', mark.level)
          .eq('is_after_unit', false)
          .order('attempt_number', { ascending: false })
          .limit(1);

        if (fetchError) {
          console.error('Error fetching existing records:', fetchError);
          throw new Error(`Failed to fetch existing records: ${fetchError.message}`);
        }

        const maxAttempt = existingRecords && existingRecords.length > 0
          ? existingRecords[0].attempt_number
          : 0;

        const nextAttempt = getNextAttemptForLevel(mark.studentId, mark.objectiveId, mark.level, maxAttempt);

        console.log(`Level ${mark.level}: maxAttempt from DB = ${maxAttempt}, nextAttempt = ${nextAttempt}`);

        if (nextAttempt <= 5) {
          recordsToInsert.push({
            student_id: mark.studentId,
            objective_id: mark.objectiveId,
            level: mark.level,
            mark_type: mark.markType,
            attempt_number: nextAttempt,
            is_after_unit: false,
            after_unit_number: null,
            recorded_by: currentUser.id
          });

          // Backfill mode: if this is a mastery mark at a higher level, fill lower levels
          if (backfillMode && MASTERY_MARKS.includes(mark.markType)) {
            const levelsToBackfill = getLevelsToBackfill(mark.level);

            for (const backfillLevel of levelsToBackfill) {
              console.log(`Backfilling ${backfillLevel} for objective ${mark.objectiveId}, student ${mark.studentId}`);

              // Get existing attempts for this backfill level from database
              const { data: backfillExistingRecords } = await supabase
                .from('progress_records')
                .select('attempt_number')
                .eq('student_id', mark.studentId)
                .eq('objective_id', mark.objectiveId)
                .eq('level', backfillLevel)
                .eq('is_after_unit', false)
                .order('attempt_number', { ascending: false })
                .limit(1);

              const backfillMaxAttempt = backfillExistingRecords && backfillExistingRecords.length > 0
                ? backfillExistingRecords[0].attempt_number
                : 0;

              const backfillNextAttempt = getNextAttemptForLevel(mark.studentId, mark.objectiveId, backfillLevel, backfillMaxAttempt);

              console.log(`Backfill level ${backfillLevel}: maxAttempt from DB = ${backfillMaxAttempt}, nextAttempt = ${backfillNextAttempt}`);

              // Only backfill if we found an empty slot
              if (backfillNextAttempt <= 5) {
                recordsToInsert.push({
                  student_id: mark.studentId,
                  objective_id: mark.objectiveId,
                  level: backfillLevel,
                  mark_type: mark.markType,
                  attempt_number: backfillNextAttempt,
                  is_after_unit: false,
                  after_unit_number: null,
                  recorded_by: currentUser.id
                });
                console.log(`Added backfill record for ${backfillLevel} at attempt ${backfillNextAttempt}`);
              } else {
                console.log(`Skipping backfill for ${backfillLevel} - already at max attempts (5)`);
              }
            }
          }
        } else {
          console.log(`Skipping - already at max attempts (5)`);
        }
      }

      console.log('Attempting to insert records:', recordsToInsert);

      if (recordsToInsert.length === 0) {
        throw new Error('No records were generated to insert. Please check the marks and try again.');
      }

      const { data: insertedData, error: insertError } = await supabase
        .from('progress_records')
        .insert(recordsToInsert)
        .select();

      if (insertError) {
        console.error('Error submitting marks:', insertError);
        throw new Error(`Failed to insert marks: ${insertError.message} (${insertError.code || 'no code'})`);
      }

      console.log('Successfully inserted records:', insertedData);

      await handleDeleteDraft();
      setSubmitting(false);
      setHasUnsavedChanges(false);

      alert(`✓ Success! ${recordsToInsert.length} marks have been saved to student records.`);
      onBack();
    } catch (error) {
      console.error('Full error during submission:', error);
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`Failed to submit marks. Error: ${errorMessage}. Please try again.`);
      setSubmitting(false);
    }
  }

  function handleClearAll() {
    if (confirm('Clear all pending marks? This cannot be undone.')) {
      setPendingMarks([]);
      setHasUnsavedChanges(true);
    }
  }

  function handleClearSelection() {
    if (confirm('Clear objective selection? This will also clear all pending marks.')) {
      setSelectedObjectiveLevels([]);
      setPendingMarks([]);
      setStep('select');
      setHasUnsavedChanges(true);
    }
  }

  function getLevelColor(level: DifficultyLevel): string {
    switch (level) {
      case 'basic': return 'bg-green-50 border-green-200';
      case 'intermediate': return 'bg-yellow-50 border-yellow-200';
      case 'advanced': return 'bg-red-50 border-red-200';
    }
  }

  function getLevelAbbr(level: DifficultyLevel): string {
    switch (level) {
      case 'basic': return 'B';
      case 'intermediate': return 'I';
      case 'advanced': return 'A';
    }
  }

  function getAvailableLevels(objective: Objective): DifficultyLevel[] {
    const levels: DifficultyLevel[] = ['basic'];
    if (objective.highest_level === 'intermediate' || objective.highest_level === 'advanced') {
      levels.push('intermediate');
    }
    if (objective.highest_level === 'advanced') {
      levels.push('advanced');
    }
    return levels;
  }

  const filteredStudents = students.filter(student =>
    student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showDraftPrompt) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Save className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Resume Draft?</h2>
          <p className="text-slate-600 mb-6">
            You have a saved draft from {lastSaved?.toLocaleString()}. Would you like to continue where you left off?
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleStartFresh}
              className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Start Fresh
            </button>
            <button
              onClick={handleResumeDraft}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              Resume Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                if (confirm('You have unsaved changes. Are you sure you want to go back?')) {
                  onBack();
                }
              } else {
                onBack();
              }
            }}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bulk Score Entry</h1>
            {lastSaved && (
              <p className="text-sm text-slate-500">
                Last saved: {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step === 'grid' && (
            <>
              <button
                onClick={() => handleSaveDraft(false)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              {draftId && (
                <button
                  onClick={() => {
                    if (confirm('Delete saved draft?')) {
                      handleDeleteDraft();
                    }
                  }}
                  className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                  title="Delete Draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {step === 'select' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Select Objectives to Grade</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Unit
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a unit...</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>
                  Unit {unit.number}: {unit.title}
                </option>
              ))}
            </select>
          </div>

          {selectedUnit && objectives[selectedUnit] && (
            <div className="space-y-4 mb-6">
              <h3 className="text-sm font-medium text-slate-700">Objectives & Levels</h3>
              {objectives[selectedUnit].map(objective => {
                const availableLevels = getAvailableLevels(objective);
                return (
                  <div key={objective.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="font-medium text-slate-900 mb-2">
                      Objective {objective.number}: {objective.description}
                    </div>
                    <div className="flex gap-2">
                      {availableLevels.map(level => {
                        const isSelected = selectedObjectiveLevels.some(
                          ol => ol.objectiveId === objective.id && ol.level === level
                        );
                        return (
                          <button
                            key={level}
                            onClick={() => handleToggleObjectiveLevel(objective.id, level, selectedUnit, objective.number)}
                            className={`px-4 py-2 rounded-lg border-2 font-medium text-sm transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedObjectiveLevels.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Selected ({selectedObjectiveLevels.length})</h3>
              <div className="flex flex-wrap gap-2">
                {selectedObjectiveLevels.map((ol, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                  >
                    Obj {ol.objectiveNumber} {getLevelAbbr(ol.level)}
                    <button
                      onClick={() => handleToggleObjectiveLevel(ol.objectiveId, ol.level, ol.unitId, ol.objectiveNumber)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleClearSelection}
              disabled={selectedObjectiveLevels.length === 0}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
            >
              Clear Selection
            </button>
            <button
              onClick={() => setStep('grid')}
              disabled={selectedObjectiveLevels.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              Continue to Grid
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
        </div>
      )}

      {step === 'grid' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Grade Entry Grid</h2>
                <p className="text-sm text-slate-600">
                  {selectedObjectiveLevels.length} objectives • {filteredStudents.length} students
                </p>
              </div>
              <button
                onClick={handleClearSelection}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Change Objectives
              </button>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={backfillMode}
                  onChange={(e) => {
                    setBackfillMode(e.target.checked);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-slate-700">Backfill Mode</span>
                <div className="group relative">
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  <div className="absolute left-0 top-6 w-64 bg-slate-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none z-10">
                    When enabled, marking a higher level automatically fills lower levels with the same mark
                  </div>
                </div>
              </label>

              <div className="flex-1 max-w-xs">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search students..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="sticky left-0 z-20 bg-white text-left py-3 px-4 font-medium text-slate-900 border-r border-slate-200 min-w-[200px]">
                    Student
                  </th>
                  {selectedObjectiveLevels.map((ol, idx) => (
                    <th
                      key={idx}
                      className={`text-center py-3 px-2 font-medium text-slate-900 border-r border-slate-200 ${getLevelColor(ol.level)}`}
                    >
                      <div>{ol.objectiveNumber}</div>
                      <div className="text-xs">{getLevelAbbr(ol.level)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(student => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 z-10 bg-white py-3 px-4 font-medium text-slate-900 border-r border-slate-200">
                      {student.full_name || 'Unnamed Student'}
                    </td>
                    {selectedObjectiveLevels.map((ol, idx) => {
                      const mark = getPendingMark(student.id, ol.objectiveId, ol.level);

                      return (
                        <td key={idx} className="py-2 px-2 text-center border-r border-slate-100">
                          <button
                            onClick={() => setActiveCell({ studentId: student.id, objectiveId: ol.objectiveId, level: ol.level })}
                            className={`w-full px-2 py-1.5 rounded border-2 font-medium transition-colors ${
                              mark
                                ? MARK_TYPES.find(mt => mt.value === mark)?.color || 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-white text-slate-400 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                            }`}
                          >
                            {mark ? MARK_TYPES.find(mt => mt.value === mark)?.label : '-'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleClearAll}
                  disabled={pendingMarks.length === 0}
                  className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-white font-medium disabled:opacity-50"
                >
                  Clear All Pending
                </button>
                <span className="text-sm text-slate-600">
                  {pendingMarks.length} pending marks
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={pendingMarks.length === 0 || submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Submit All Marks ({pendingMarks.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCell && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setActiveCell(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg shadow-2xl border border-slate-200 w-80 max-h-[600px] flex flex-col"
          >
            <div className="px-4 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Select Mark
                </h3>
                <button
                  onClick={() => setActiveCell(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-500">Press a key or click to select</p>
            </div>
            <div className="overflow-y-auto flex-1 py-2">
              {MARK_TYPES.map((mark) => (
                <button
                  key={mark.value}
                  onClick={() => handleSetMark(activeCell.studentId, activeCell.objectiveId, activeCell.level, mark.value)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded text-sm font-medium ${mark.color}`}>
                      {mark.label}
                    </span>
                    <span className="text-sm text-slate-600">{mark.value}</span>
                  </div>
                  <kbd className="px-2 py-1 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-300 rounded">
                    {mark.hotkey.toUpperCase()}
                  </kbd>
                </button>
              ))}
              {getPendingMark(activeCell.studentId, activeCell.objectiveId, activeCell.level) && (
                <>
                  <div className="border-t border-slate-200 my-2" />
                  <button
                    onClick={() => handleSetMark(activeCell.studentId, activeCell.objectiveId, activeCell.level, null)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-100"
                  >
                    <span className="px-3 py-1.5 rounded text-sm font-medium bg-slate-100 text-slate-700">
                      Clear
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
