import { useApp } from './AppStore';
import type { AppState, Interview, InterviewResult, InterviewScores, InterviewType, User } from '../types';
import { fmtDate, nowTs, todayISO, uid } from '../utils';

export const INTERVIEW_TYPES: InterviewType[] = ['Technical', 'Mock', 'Communication', 'HR'];
export const INTERVIEW_RESULTS: InterviewResult[] = ['Selected', 'Needs Improvement', 'Not Selected'];
export const SCORE_LABELS: { key: keyof InterviewScores; label: string }[] = [
  { key: 'technical', label: 'Technical knowledge' },
  { key: 'communication', label: 'Communication' },
  { key: 'problemSolving', label: 'Problem solving' },
];

export const avgScore = (sc?: InterviewScores) => (sc ? Math.round(((sc.technical + sc.communication + sc.problemSolving) / 3) * 10) / 10 : undefined);

/** users who can sit on a panel: active trainers and admins (trainers only see themselves and admins in their scoped state) */
export const panelCandidates = (s: Pick<AppState, 'users'>): User[] =>
  s.users.filter((u) => u.active && (u.role === 'admin' || u.role === 'trainer')).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'trainer' ? -1 : 1));

export interface InterviewForm { studentId: string; type: InterviewType | ''; date: string; time: string; mode: Interview['mode']; focus: string; panelIds: string[] }
export interface ResultForm { scores: Partial<InterviewScores>; result: InterviewResult | ''; feedback: string }

export function validateInterview(f: InterviewForm) {
  const e: Record<string, string> = {};
  if (!f.studentId) e.studentId = 'Select a student.';
  if (!f.type) e.type = 'Select the interview type.';
  if (!f.date) e.date = 'Choose a date.';
  if (!f.time) e.time = 'Choose a time.';
  if (!f.panelIds.length) e.panel = 'Add at least one panel member.';
  return e;
}
export function validateResult(f: ResultForm) {
  const e: Record<string, string> = {};
  if (SCORE_LABELS.some(({ key }) => !f.scores[key])) e.scores = 'Rate all three areas (1–5).';
  if (!f.result) e.result = 'Choose a result.';
  if (f.feedback.trim().length < 5) e.feedback = 'Write a short feedback note for the student (at least 5 characters).';
  return e;
}

/**
 * Interview Panel actions. Admins can manage every interview. Trainers can schedule for students of their own active
 * batches and record results for interviews in their batches or where they are on the panel. The backend must repeat these checks.
 */
export function useInterviewActions() {
  const { raw, user, mutate, toast } = useApp();
  const actor = user?.name ?? 'System';
  const canManage = (iv: Interview) => user?.role === 'admin' || (user?.role === 'trainer' && (iv.trainerId === user.trainerId || iv.panel.some((p) => p.id === user.id)));

  const resolvePanel = (ids: string[]) => {
    const ok = new Map(panelCandidates(raw).map((u) => [u.id, u]));
    return [...new Set(ids)].filter((id) => ok.has(id)).map((id) => ({ id, name: ok.get(id)!.name }));
  };

  return {
    schedule(f: InterviewForm) {
      if (Object.keys(validateInterview(f)).length) { toast('Complete the highlighted fields.', 'error'); return false; }
      const st = raw.students.find((x) => x.id === f.studentId);
      const b = raw.batches.find((x) => x.id === st?.batchId);
      if (!st || !b) { toast('Student not found.', 'error'); return false; }
      if (user?.role === 'trainer' && b.trainerId !== user.trainerId) { toast('You can only schedule interviews for students in your own batches.', 'error'); return false; }
      if (user?.role !== 'admin' && user?.role !== 'trainer') return false;
      if (f.date < todayISO()) { toast('Choose today or a future date.', 'error'); return false; }
      const panel = resolvePanel(f.panelIds);
      if (!panel.length) { toast('Add at least one active trainer or admin to the panel.', 'error'); return false; }
      const clash = raw.interviews.find((i) => i.studentId === st.id && i.date === f.date && i.time === f.time && i.status === 'Scheduled');
      if (clash) { toast(`${st.name} already has an interview at ${f.time} on ${fmtDate(f.date)}.`, 'error'); return false; }
      const at = nowTs();
      mutate((d) => {
        d.interviews.push({
          id: uid('iv'), studentId: st.id, studentName: st.name, batchId: b.id, batchName: b.name, trainerId: b.trainerId, type: f.type as InterviewType,
          date: f.date, time: f.time, mode: f.mode, focus: f.focus.trim(), panel, status: 'Scheduled', createdBy: actor, createdAt: at, updatedAt: at,
          history: [{ at, by: actor, action: 'Scheduled' }],
        });
      }, { action: 'Interview scheduled', entity: `${st.name} · ${b.name}`, prev: '—', next: `${f.type} ${fmtDate(f.date)} ${f.time}`, reason: '' });
      toast(`Interview scheduled for ${st.name} on ${fmtDate(f.date)} at ${f.time}`);
      return true;
    },
    reschedule(id: string, date: string, time: string, panelIds: string[]) {
      const iv = raw.interviews.find((x) => x.id === id);
      if (!iv || !canManage(iv) || iv.status !== 'Scheduled') { toast('This interview cannot be changed.', 'error'); return false; }
      if (!date || !time) { toast('Choose a date and time.', 'error'); return false; }
      if (date < todayISO()) { toast('Choose today or a future date.', 'error'); return false; }
      const panel = resolvePanel(panelIds);
      if (!panel.length) { toast('Add at least one panel member.', 'error'); return false; }
      mutate((d) => {
        const x = d.interviews.find((y) => y.id === id)!;
        const note = `${fmtDate(x.date)} ${x.time} → ${fmtDate(date)} ${time}`;
        x.date = date; x.time = time; x.panel = panel; x.updatedAt = nowTs();
        x.history.push({ at: nowTs(), by: actor, action: 'Rescheduled', note });
      }, { action: 'Interview rescheduled', entity: `${iv.studentName} · ${iv.batchName}`, prev: `${iv.date} ${iv.time}`, next: `${date} ${time}`, reason: '' });
      toast('Interview updated');
      return true;
    },
    cancel(id: string, reason: string) {
      const iv = raw.interviews.find((x) => x.id === id);
      if (!iv || !canManage(iv) || iv.status !== 'Scheduled') { toast('This interview cannot be cancelled.', 'error'); return false; }
      mutate((d) => {
        const x = d.interviews.find((y) => y.id === id)!;
        x.status = 'Cancelled'; x.updatedAt = nowTs();
        x.history.push({ at: nowTs(), by: actor, action: 'Cancelled', note: reason });
      }, { action: 'Interview cancelled', entity: `${iv.studentName} · ${iv.batchName}`, prev: 'Scheduled', next: 'Cancelled', reason });
      toast('Interview cancelled', 'warning');
      return true;
    },
    recordResult(id: string, f: ResultForm) {
      const iv = raw.interviews.find((x) => x.id === id);
      if (!iv || !canManage(iv)) { toast('Only the batch trainer, a panel member or an admin can record this result.', 'error'); return false; }
      if (iv.status === 'Cancelled') { toast('This interview was cancelled.', 'error'); return false; }
      if (iv.date > todayISO()) { toast('Results can be recorded on or after the interview date.', 'error'); return false; }
      if (Object.keys(validateResult(f)).length) { toast('Complete the ratings, result and feedback.', 'error'); return false; }
      const scores = f.scores as InterviewScores;
      const edit = iv.status === 'Completed';
      mutate((d) => {
        const x = d.interviews.find((y) => y.id === id)!;
        x.scores = { ...scores }; x.result = f.result as InterviewResult; x.feedback = f.feedback.trim(); x.status = 'Completed'; x.updatedAt = nowTs();
        x.history.push({ at: nowTs(), by: actor, action: `${edit ? 'Result updated' : 'Result recorded'}: ${f.result}` });
      }, { action: edit ? 'Interview result updated' : 'Interview result recorded', entity: `${iv.studentName} · ${iv.batchName}`, prev: iv.result ?? 'Scheduled', next: String(f.result), reason: '' });
      toast(`Result saved for ${iv.studentName}`);
      return true;
    },
  };
}
