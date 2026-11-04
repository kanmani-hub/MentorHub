import { useApp } from './AppStore';
import { buildSnapshot, isAfterDeadline, reportFor, trainerName, validateReport } from './selectors';
import { activeAdmins, reviewsFor, statusAfter, versionReviewerIds } from './reviews';
import type { DailyReport, ReviewAction } from '../types';
import { fmtDate, nowTs, uid } from '../utils';

export const SUBMIT_SUCCESS = 'Consolidated Daily Report submitted successfully. Your selected Admin Reviewer(s) have been notified.';
export const NO_REVIEWER = 'Please select at least one Admin Reviewer before submitting the report.';

export function useReportActions() {
  const { raw, user, mutate, notify, toast } = useApp();
  const actor = user?.name ?? 'System';
  const trainerUserId = (tid: string) => raw.users.find((u) => u.trainerId === tid)?.id;

  const ensure = (d: typeof raw, tid: string, date: string): DailyReport => {
    let r = d.reports.find((x) => x.trainerId === tid && x.date === date);
    if (!r) {
      r = { id: uid('rep'), trainerId: tid, date, status: 'Draft', draftRemarks: '', selectedReviewerIds: [], versions: [], reviewHistory: [], events: [], adminRemarks: [] };
      d.reports.push(r);
    }
    return r;
  };
  /** keep only IDs of active admins, in a stable order */
  const cleanReviewers = (ids: string[]) => { const ok = new Set(activeAdmins(raw).map((u) => u.id)); return [...new Set(ids)].filter((id) => ok.has(id)); };

  /**
   * A decision is allowed only for an active admin who is a selected reviewer of the latest version, has not already
   * decided on that version, while the report is open. The production backend must apply the same rule.
   */
  const guardDecision = (r: DailyReport | undefined) => {
    if (!r || !r.versions.length) { toast('Report not found.', 'error'); return false; }
    if (user?.role !== 'admin' || user.active === false) { toast('Only admins can review reports.', 'error'); return false; }
    if (!versionReviewerIds(r).includes(user.id)) { toast('You are not a selected reviewer for this report.', 'error'); return false; }
    if (r.status !== 'Submitted' && r.status !== 'Under Review') { toast(`This report is ${r.status.toLowerCase()} and can no longer be reviewed.`, 'error'); return false; }
    if (reviewsFor(r).some((x) => x.reviewerId === user.id)) { toast(`You have already reviewed version ${r.versions.length} of this report.`, 'error'); return false; }
    return true;
  };

  const decide = (id: string, action: ReviewAction, remarksIn: string) => {
    const r = raw.reports.find((x) => x.id === id);
    if (!guardDecision(r)) return false;
    const remarks = remarksIn.trim();
    if (action === 'Correction Requested' && !remarks) { toast('Enter what needs to be corrected.', 'error'); return false; }
    if (action === 'Rejected' && !remarks) { toast('Enter the reason for rejecting this report.', 'error'); return false; }
    const version = r!.versions.length;
    let next = r!.status;
    let applied = false;
    mutate((d) => {
      const x = d.reports.find((y) => y.id === id)!;
      x.reviewHistory = x.reviewHistory ?? [];
      // re-check on the stored copy so a double click or a stale screen cannot record a second decision
      if (x.reviewHistory.some((h) => h.reportVersion === version && h.reviewerId === user!.id) || (x.status !== 'Submitted' && x.status !== 'Under Review')) return;
      const at = nowTs();
      x.reviewHistory.push({ reviewerId: user!.id, reviewerName: user!.name, action, remarks, reviewedAt: at, reportVersion: version });
      const approvals = new Set(x.reviewHistory.filter((h) => h.reportVersion === version && h.action === 'Approved').map((h) => h.reviewerId));
      const total = versionReviewerIds(x).length;
      next = statusAfter(x, action, approvals.size);
      x.status = next;
      if (next === 'Approved') x.approvedAt = at;
      const label = action === 'Approved' ? (next === 'Approved' ? 'Approved' : `Approved (${approvals.size} of ${total})`) : action === 'Correction Requested' ? 'Correction requested' : 'Rejected';
      x.events.push({ at, by: actor, action: label, reason: remarks || undefined });
      if (remarks) x.adminRemarks.push({ at, by: actor, text: remarks });
      applied = true;
    }, { action: action === 'Approved' ? 'Report approved by reviewer' : action === 'Rejected' ? 'Report rejected' : 'Correction requested', entity: `${trainerName(raw, r!.trainerId)} · ${fmtDate(r!.date)} · v${version}`, prev: r!.status, next: action, reason: remarks });
    if (!applied) { toast('This decision was already recorded.', 'error'); return false; }
    const tu = trainerUserId(r!.trainerId);
    if (action === 'Approved') {
      const done = next === 'Approved';
      if (tu && done) notify([tu], { type: 'approved', title: 'Report approved', body: `All selected reviewers approved your report for ${fmtDate(r!.date)}.`, link: { page: 't-history' } });
      toast(done ? 'Report approved. All selected reviewers have approved it.' : 'Your approval is recorded. Waiting for the other selected reviewers.');
    } else if (action === 'Correction Requested') {
      if (tu) notify([tu], { type: 'correction', title: 'Correction requested', body: `${actor}: ${remarks}`, link: { page: 't-report', id: r!.date } });
      toast('Correction requested. The trainer can now edit and resubmit.', 'info');
    } else {
      if (tu) notify([tu], { type: 'rejected', title: 'Report rejected', body: `${actor}: ${remarks}`, link: { page: 't-history' } });
      toast('Report rejected. History preserved.', 'warning');
    }
    return true;
  };

  return {
    /** saves remarks, exception and the chosen reviewers; reviewers can change only while Draft or Correction Requested */
    saveDraft(tid: string, date: string, remarks: string, exception?: string, reviewerIds?: string[]) {
      if (user?.role !== 'trainer' || user.trainerId !== tid) { toast('You can only edit your own report.', 'error'); return false; }
      const cur = reportFor(raw, tid, date);
      if (cur && cur.status !== 'Draft' && cur.status !== 'Correction Requested') { toast('This report is submitted. Changes go through a correction request.', 'error'); return false; }
      mutate((d) => {
        const r = ensure(d, tid, date);
        r.draftRemarks = remarks;
        if (exception !== undefined) r.exception = exception || undefined;
        if (reviewerIds) r.selectedReviewerIds = cleanReviewers(reviewerIds);
        r.events.push({ at: nowTs(), by: actor, action: r.status === 'Draft' ? 'Draft saved' : 'Correction draft saved' });
      });
      toast('Draft saved');
      return true;
    },
    submit(tid: string, date: string, remarks: string, exception: string | undefined, reviewerIdsIn: string[]) {
      const existing = reportFor(raw, tid, date);
      // one consolidated report per trainer per working day: block duplicate submissions
      if (existing && ['Submitted', 'Under Review', 'Approved', 'Rejected'].includes(existing.status)) {
        toast(`A report for ${fmtDate(date)} is already ${existing.status.toLowerCase()}. Corrections go through a correction request.`, 'error');
        return false;
      }
      if (user?.role !== 'trainer' || user.trainerId !== tid) { toast('You can only submit your own report.', 'error'); return false; }
      const reviewerIds = cleanReviewers(reviewerIdsIn);
      if (!reviewerIds.length) { toast(NO_REVIEWER, 'error'); return false; }
      // the same checks as the screen, repeated here so state actions cannot skip them
      const issues = validateReport(raw, tid, date);
      const ex = (exception ?? '').trim();
      if (issues.length && !(raw.settings.allowException && ex.length >= 10)) { toast(`${issues.length} required item(s) are missing. Complete them before submitting.`, 'error'); return false; }
      const snapBase = buildSnapshot(raw, tid, date);
      const snapshot = { ...snapBase, remarks, exception: issues.length ? ex : undefined };
      const late = isAfterDeadline(raw, date);
      const version = (existing?.versions.length ?? 0) + 1;
      const resubmit = version > 1;
      const reportId = existing?.id ?? uid('rep');
      const batchReportIds = raw.batchReports.filter((b) => b.trainerId === tid && b.date === date && snapshot.batches.some((x) => x.batchId === b.batchId)).map((b) => b.id);
      const at = nowTs();
      mutate((d) => {
        let r = d.reports.find((x) => x.trainerId === tid && x.date === date);
        if (!r) { r = { id: reportId, trainerId: tid, date, status: 'Draft', draftRemarks: '', versions: [], events: [], adminRemarks: [] }; d.reports.push(r); }
        r.draftRemarks = remarks;
        r.exception = snapshot.exception;
        r.selectedReviewerIds = reviewerIds;
        r.batchReportIds = batchReportIds;
        r.reviewHistory = r.reviewHistory ?? [];
        r.versions.push({ version, submittedAt: at, late, snapshot, reviewerIds: [...reviewerIds], batchReportIds });
        r.currentVersion = version;
        r.submittedAt = at;
        r.approvedAt = undefined;
        r.status = 'Submitted';
        r.events.push({ at, by: actor, action: `${resubmit ? 'Resubmitted' : 'Submitted'} v${version}${late ? ' (late)' : ''}`, reason: snapshot.exception ? `Exception: ${snapshot.exception}` : undefined });
      }, { action: resubmit ? 'Report resubmitted' : 'Report submitted', entity: `Daily report ${fmtDate(date)} · ${trainerName(raw, tid)}`, prev: existing?.status ?? 'Draft', next: `Submitted v${version} to ${reviewerIds.length} reviewer(s)`, reason: snapshot.exception ?? '' });
      // review task for each selected admin: shown in their "Reports Assigned to Me" and dashboard counters
      notify(reviewerIds, {
        type: 'report-submitted',
        title: resubmit ? 'Corrected report resubmitted for your review' : 'Daily report assigned to you for review',
        body: `${trainerName(raw, tid)} ${resubmit ? 'resubmitted' : 'submitted'} the report for ${fmtDate(date)} · ${snapshot.batches.length} batch${snapshot.batches.length === 1 ? '' : 'es'}${late ? ' · after the deadline' : ''}.`,
        link: { page: 'report', id: reportId },
      });
      toast(SUBMIT_SUCCESS);
      return true;
    },
    /** first open by a selected reviewer moves Submitted → Under Review */
    openForReview(id: string) {
      const r = raw.reports.find((x) => x.id === id);
      if (!r || r.status !== 'Submitted' || user?.role !== 'admin' || !versionReviewerIds(r).includes(user.id)) return;
      mutate((d) => {
        const x = d.reports.find((y) => y.id === id)!;
        if (x.status !== 'Submitted') return;
        x.status = 'Under Review';
        x.events.push({ at: nowTs(), by: actor, action: 'Opened for review' });
      });
    },
    approve: (id: string, remark: string) => decide(id, 'Approved', remark),
    requestCorrection: (id: string, reason: string) => decide(id, 'Correction Requested', reason),
    reject: (id: string, reason: string) => decide(id, 'Rejected', reason),
    /** remarks without a decision: selected reviewers only */
    addRemark(id: string, text: string) {
      text = text.trim();
      const r = raw.reports.find((x) => x.id === id);
      if (!r || !text) return false;
      if (user?.role !== 'admin' || !versionReviewerIds(r).includes(user.id)) { toast('Only the selected reviewers can add remarks to this report.', 'error'); return false; }
      mutate((d) => {
        const x = d.reports.find((y) => y.id === id)!;
        x.adminRemarks.push({ at: nowTs(), by: actor, text });
        x.events.push({ at: nowTs(), by: actor, action: 'Remark added', reason: text });
      });
      toast('Remark added');
      return true;
    },
  };
}

import type { AppState, AttMark, BatchReport, TopicStatus } from '../types';
import { classBatchesOn, isDayLocked, lessonPlan, topicDay } from './selectors';

export interface BatchReportForm {
  topics: Record<string, { status: TopicStatus | ''; reason: string }>;
  marks: Record<string, AttMark | ''>;
  reasons: Record<string, string>;
  lateTimes: Record<string, string>;
  practicals: BatchReport['practicals'];
  assignments: BatchReport['assignments'];
  doubts: BatchReport['doubts'];
  voiceNames: BatchReport['voiceNames'];
  projects: BatchReport['projects'];
  remarks: string;
}

/** shared validation — used by the form and re-run inside the submit action */
export const validateBatchForm = (s: AppState, batchId: string, f: BatchReportForm, date?: string) => {
  const e: Record<string, string> = {};
  const studs = s.students.filter((x) => x.batchId === batchId && x.status === 'Active');
  const topicMissing = Object.values(f.topics).filter((t) => !t.status).length;
  const reasonMissing = Object.values(f.topics).filter((t) => t.status && t.status !== 'Completed' && t.reason.trim().length < 5).length;
  if (topicMissing) e.topics = `${topicMissing} topic(s) have no status.`;
  else if (reasonMissing) e.topics = `${reasonMissing} partially completed / not covered topic(s) need a reason.`;
  const unmarked = studs.filter((st) => !f.marks[st.id]).length;
  const noReason = studs.filter((st) => (f.marks[st.id] === 'Absent' || f.marks[st.id] === 'Leave') && !(f.reasons[st.id] ?? '').trim()).length;
  const noTime = studs.filter((st) => f.marks[st.id] === 'Late' && !f.lateTimes[st.id]).length;
  if (unmarked) e.attendance = `${unmarked} student(s) not marked.`;
  else if (noReason) e.attendance = `${noReason} absent / leave student(s) need a reason.`;
  else if (noTime) e.attendance = `${noTime} late student(s) need an arrival time.`;
  if (!f.practicals.some((p) => p.text.trim())) e.practicals = 'Add at least one practical activity.';
  if (f.assignments.some((a) => !a.name.trim() || !a.deadline)) e.assignments = 'Each assignment needs a name and a deadline.';
  if (f.projects.some((p) => !p.name.trim())) e.projects = 'Each project entry needs a project name.';
  if (s.settings.requireVoiceNote && date && !(s.waUpdates.find((w) => w.batchId === batchId && w.date === date)?.studentIds.length)) e.voiceNames = 'Add at least one student voice note (Student Voice Notes page).';
  return e;
};

export function useBatchReportActions() {
  const { raw, user, mutate, toast } = useApp();
  const actor = user?.name ?? 'System';
  const persist = (batchId: string, date: string, f: BatchReportForm, submit: boolean) => {
    const tid = user?.trainerId;
    const b = raw.batches.find((x) => x.id === batchId);
    // authorization: only the assigned trainer, only for a batch with class that day, only while the day is open
    if (!tid || !b || b.trainerId !== tid) { toast('You can only report on batches assigned to you.', 'error'); return false; }
    if (!classBatchesOn(raw, tid, date).some((x) => x.id === batchId)) { toast('This batch has no class on that date.', 'error'); return false; }
    if (isDayLocked(raw, tid, date)) { toast('This day\'s consolidated report is locked.', 'error'); return false; }
    if (submit && !lessonPlan(raw, b, date).selected) { toast(`Select the lesson day taught in ${b.name} (Today's Lesson) before submitting.`, 'error'); return false; }
    if (submit && Object.keys(validateBatchForm(raw, batchId, f, date)).length) { toast('Complete the highlighted sections first.', 'error'); return false; }
    const plan = lessonPlan(raw, b, date);
    const topicByKey = new Map([...plan.carryOver.map((c) => c.topic), ...plan.topics].map((t) => [t.key, t]));
    const prev = raw.batchReports.find((r) => r.trainerId === tid && r.batchId === batchId && r.date === date);
    const att = raw.attendance.find((a) => a.batchId === batchId && a.date === date);
    const ts = nowTs();
    mutate((d) => {
      // 1. topic progress (shared with Today's Lesson / Topic Progress pages)
      Object.entries(f.topics).forEach(([key, t]) => {
        if (!t.status || !topicByKey.has(key)) return;
        let r = d.progress.find((p) => p.batchId === batchId && p.topicKey === key && p.date === date);
        if (!r) { r = { id: uid('tp'), batchId, topicKey: key, date, status: t.status, minutes: 0, explanation: '', reason: '', practical: false, understanding: '', doubts: '', updatedAt: ts }; d.progress.push(r); }
        if (r.status !== t.status || r.reason !== t.reason) { r.status = t.status; r.reason = t.status === 'Completed' ? '' : t.reason.trim(); r.updatedAt = ts; r.trainerId = tid; r.updatedBy = actor; const td = topicDay(raw, b, key); r.syllabusDayId = td?.syllabusDayId; r.dayNumber = td?.dayNumber; }
      });
      // 2. attendance (one session per batch per date; marks are frozen once submitted)
      let a = d.attendance.find((x) => x.batchId === batchId && x.date === date);
      if (!a) { a = { id: uid('att'), batchId, date, status: 'Draft', marks: {}, corrections: [] }; d.attendance.push(a); }
      if (a.status !== 'Submitted') a.marks = Object.fromEntries(Object.entries(f.marks).filter(([, m]) => m)) as Record<string, AttMark>;
      a.reasons = { ...f.reasons };
      a.lateTimes = { ...f.lateTimes };
      if (submit && a.status !== 'Submitted') { a.status = 'Submitted'; a.submittedAt = ts; a.submittedBy = actor; }
      // 3. the batch report itself
      let r = d.batchReports.find((x) => x.trainerId === tid && x.batchId === batchId && x.date === date);
      if (!r) { r = { id: uid('br'), trainerId: tid, batchId, date, status: 'Draft', practicals: [], assignments: [], doubts: [], voiceNames: [], projects: [], remarks: '', createdAt: ts, updatedAt: ts, history: [] }; d.batchReports.push(r); }
      const clean = <T extends { id: string }>(xs: T[], keep: (x: T) => boolean) => xs.filter(keep);
      r.practicals = clean(f.practicals, (x) => !!x.text.trim());
      r.assignments = clean(f.assignments, (x) => !!x.name.trim());
      r.doubts = clean(f.doubts, (x) => !!x.text.trim());
      r.voiceNames = clean(f.voiceNames, (x) => !!x.text.trim());
      r.projects = clean(f.projects, (x) => !!x.name.trim());
      r.remarks = f.remarks;
      r.updatedAt = ts;
      if (submit) { r.status = 'Submitted'; r.submittedAt = ts; }
      r.history.push({ at: ts, by: actor, action: submit ? (prev?.status === 'Submitted' ? 'Batch report resubmitted' : 'Batch report submitted') : 'Draft saved' });
      // 4. keep the daily activity log in sync so existing admin views keep working
      if (submit) {
        const pending = Object.entries(f.topics).filter(([, t]) => t.status && t.status !== 'Completed').map(([k]) => topicByKey.get(k)?.title).filter(Boolean);
        const act = d.activities.find((x) => x.trainerId === tid && x.batchId === batchId && x.date === date);
        const rec = {
          practicals: r.practicals.map((p) => p.text).join('; '),
          assignments: r.assignments.map((x) => x.name).join('; '),
          homework: r.assignments.map((x) => `${x.name}: ${x.description} (due ${x.deadline})`).join('; '),
          doubts: r.doubts.map((x) => x.text).join('; '),
          supportStudents: act?.supportStudents ?? '',
          feedback: r.remarks,
          nextPlan: pending.length ? `Carry forward: ${pending.join(', ')}; then continue syllabus` : 'Continue with the next day of the syllabus',
        };
        if (act) Object.assign(act, rec); else d.activities.push({ id: uid('act'), trainerId: tid, batchId, date, ...rec });
      }
    }, submit ? { action: prev?.status === 'Submitted' ? 'Batch report resubmitted' : 'Batch report submitted', entity: `${b.name} · ${fmtDate(date)}`, prev: prev?.status ?? 'Not started', next: 'Submitted', reason: att?.status === 'Submitted' ? '' : 'Attendance submitted with batch report' } : undefined);
    toast(submit ? `Batch report for ${b.name} submitted` : `Draft saved for ${b.name}`);
    return true;
  };
  return {
    saveDraft: (batchId: string, date: string, f: BatchReportForm) => persist(batchId, date, f, false),
    submit: (batchId: string, date: string, f: BatchReportForm) => persist(batchId, date, f, true),
    reopen(batchId: string, date: string) {
      const tid = user?.trainerId;
      if (!tid || isDayLocked(raw, tid, date)) return;
      const b = raw.batches.find((x) => x.id === batchId);
      mutate((d) => {
        const r = d.batchReports.find((x) => x.trainerId === tid && x.batchId === batchId && x.date === date);
        if (r) { r.status = 'Draft'; r.history.push({ at: nowTs(), by: actor, action: 'Reopened for editing' }); }
      }, { action: 'Batch report reopened', entity: `${b?.name} · ${fmtDate(date)}`, prev: 'Submitted', next: 'Draft', reason: '' });
      toast('Batch report reopened. Submit it again when you are done.', 'info');
    },
  };
}

/* ---------- Notes of Lesson ---------- */
import type { NolDay, NolDayContent, NotesOfLesson, SyllabusVersion } from '../types';
import type { ParsedNotes } from '../utils/nolParser';
import { putFile } from '../utils/fileStore';

export const nolIssues = (n: NotesOfLesson) => {
  const out: string[] = [];
  if (!n.days.length) out.push('There are no lesson days.');
  n.days.forEach((d) => {
    if (!d.title.trim()) out.push(`Day ${d.dayNumber}: title is empty.`);
    if (!d.topics.filter((x) => x.trim()).length) out.push(`Day ${d.dayNumber}: no Topics to Cover.`);
    if (!d.objectives.filter((x) => x.trim()).length) out.push(`Day ${d.dayNumber}: no Learning Objectives.`);
    if (d.tasks.filter((x) => x.trim()).length !== 5) out.push(`Day ${d.dayNumber}: has ${d.tasks.filter((x) => x.trim()).length} student tasks; 5 are required.`);
  });
  const nums = n.days.map((d) => d.dayNumber);
  nums.forEach((x, i) => nums.indexOf(x) !== i && out.push(`Day ${x} appears more than once.`));
  return [...new Set(out)];
};

export function useNolActions() {
  const { raw, user, mutate, notify, toast } = useApp();
  const actor = user?.name ?? 'System';
  const isAdmin = user?.role === 'admin';
  const deny = () => { toast('Only admins can change Notes of Lesson.', 'error'); return false; };
  const nextVersion = (courseId: string) => Math.max(0, ...raw.nols.filter((n) => n.courseId === courseId).map((n) => n.version)) + 1;
  const editDraft = (nolId: string, fn: (n: NotesOfLesson) => void, audit?: { action: string; prev: string; next: string }) => {
    if (!isAdmin) return deny();
    const n0 = raw.nols.find((x) => x.id === nolId);
    if (!n0 || n0.status !== 'Draft') { toast('Published notes are read-only. Create a revision to edit.', 'error'); return false; }
    mutate((d) => { const n = d.nols.find((x) => x.id === nolId)!; fn(n); }, audit ? { ...audit, entity: `${raw.courses.find((c) => c.id === n0.courseId)?.name} NoL v${n0.version}`, reason: '' } : undefined);
    return true;
  };

  return {
    importParsed(courseId: string, parsed: ParsedNotes, kind: 'pdf' | 'excel', file: { name: string; size: number; mime: string; bytes: Uint8Array; pages?: number }) {
      if (!isAdmin) return deny() && '';
      const id = uid('NOL');
      const fid = uid('F');
      const stored = putFile(fid, file.bytes);
      const version = nextVersion(courseId);
      const days: NolDay[] = parsed.days.map((d) => {
        const content: NolDayContent = { title: d.title, topics: [...d.topics], objectives: [...d.objectives], tasks: [...d.tasks] };
        return { id: uid('nd'), dayNumber: d.dayNumber, ...content, original: content, warnings: d.warnings, page: d.page };
      });
      mutate((dr) => {
        dr.files.push({ id: fid, name: file.name, size: file.size, mime: file.mime, courseId, nolId: id, pages: file.pages, uploadedAt: nowTs(), uploadedBy: actor });
        dr.nols.push({ id, courseId, version, title: parsed.title || file.name.replace(/\.[^.]+$/, ''), duration: parsed.duration, status: 'Draft', sourceKind: kind, sourceFileId: fid, days, warnings: [...parsed.warnings, ...parsed.unrecognised.slice(0, 20)], createdAt: nowTs(), createdBy: actor, history: [{ at: nowTs(), by: actor, action: `Uploaded ${file.name} and extracted ${days.length} day(s)` }] });
      }, { action: `Notes of Lesson uploaded (${kind.toUpperCase()})`, entity: raw.courses.find((c) => c.id === courseId)?.name ?? courseId, prev: '—', next: `Draft v${version} · ${days.length} days`, reason: file.name });
      if (!stored) toast('The original file is larger than browser storage allows; it stays available until you reload.', 'warning');
      return id;
    },
    createDraft(courseId: string, fromId?: string) {
      if (!isAdmin) return deny() && '';
      const src = fromId ? raw.nols.find((n) => n.id === fromId) : undefined;
      const id = uid('NOL');
      const version = nextVersion(courseId);
      mutate((d) => {
        d.nols.push({
          id, courseId, version, title: src?.title ?? `${raw.courses.find((c) => c.id === courseId)?.name} – Notes of Lesson`, duration: src?.duration ?? '', status: 'Draft', sourceKind: src?.sourceKind ?? 'manual', sourceFileId: src?.sourceFileId,
          days: (src?.days ?? []).map((x) => ({ ...JSON.parse(JSON.stringify(x)), id: uid('nd'), syllabusDayId: undefined })), warnings: [], createdAt: nowTs(), createdBy: actor,
          history: [{ at: nowTs(), by: actor, action: src ? `Revision created from v${src.version}` : 'Created for manual entry' }],
        });
      }, { action: 'Notes of Lesson draft created', entity: raw.courses.find((c) => c.id === courseId)?.name ?? courseId, prev: src ? `v${src.version}` : '—', next: `Draft v${version}`, reason: '' });
      return id;
    },
    updateDay: (nolId: string, dayId: string, patch: Partial<NolDayContent>) => editDraft(nolId, (n) => { Object.assign(n.days.find((x) => x.id === dayId)!, patch); }),
    restoreDay: (nolId: string, dayId: string) => editDraft(nolId, (n) => { const d = n.days.find((x) => x.id === dayId)!; if (d.original) Object.assign(d, JSON.parse(JSON.stringify(d.original))); }),
    addDay(nolId: string) {
      return editDraft(nolId, (n) => { const num = Math.max(0, ...n.days.map((x) => x.dayNumber)) + 1; n.days.push({ id: uid('nd'), dayNumber: num, title: '', topics: [''], objectives: [''], tasks: ['', '', '', '', ''], warnings: [] }); });
    },
    deleteDay: (nolId: string, dayId: string) => editDraft(nolId, (n) => { n.days = n.days.filter((x) => x.id !== dayId); }, { action: 'Lesson day removed from draft', prev: 'Day', next: 'Removed' }),
    saveDraft(nolId: string) {
      if (editDraft(nolId, (n) => { n.history.push({ at: nowTs(), by: actor, action: 'Draft saved' }); })) toast('Draft saved');
    },
    discardDraft(nolId: string) {
      if (!isAdmin) return deny();
      mutate((d) => { d.nols = d.nols.filter((n) => n.id !== nolId); d.files.forEach((f) => { if (f.nolId === nolId) f.nolId = undefined; }); }, { action: 'Notes of Lesson draft discarded', entity: nolId, prev: 'Draft', next: 'Deleted', reason: '' });
      toast('Draft discarded. The uploaded file is kept in Source files.', 'info');
    },
    publish(nolId: string, opts: { generateSyllabus: boolean }) {
      if (!isAdmin) return deny();
      const n = raw.nols.find((x) => x.id === nolId);
      if (!n || n.status !== 'Draft') return false;
      const issues = nolIssues(n);
      if (issues.length) { toast(`Fix ${issues.length} issue(s) before publishing.`, 'error'); return false; }
      const course = raw.courses.find((c) => c.id === n.courseId);
      const prevSyl = raw.syllabi.filter((v) => v.courseId === n.courseId && v.status === 'Published').sort((a, b) => b.version - a.version)[0];
      const prevTopics = new Map<string, string>();
      prevSyl?.modules.forEach((m) => m.weeks.forEach((w) => w.days.forEach((d, di) => d.topics.forEach((t) => prevTopics.set(`${d.title}|${t.title}`.toLowerCase(), t.key)))));
      void prevTopics;
      const newVid = uid(`${n.courseId}-v`);
      const sylVersion = Math.max(0, ...raw.syllabi.filter((v) => v.courseId === n.courseId).map((v) => v.version)) + 1;
      const sorted = [...n.days].sort((a, b) => a.dayNumber - b.dayNumber);
      const dayMap: Record<string, string> = {};
      let syl: SyllabusVersion | undefined;
      if (opts.generateSyllabus) {
        // keep topic keys for topics that already existed (same day title + topic title) so recorded progress carries over
        const weeks: SyllabusVersion['modules'][number]['weeks'] = [];
        sorted.forEach((d, i) => {
          const w = Math.floor(i / 5);
          if (!weeks[w]) weeks[w] = { id: uid('w'), title: `Week ${w + 1}`, days: [] };
          const dayId = uid('d');
          dayMap[d.id] = dayId;
          weeks[w].days.push({ id: dayId, title: d.title, topics: d.topics.filter((x) => x.trim()).map((title) => { const k = prevTopics.get(`${d.title}|${title}`.toLowerCase()) ?? uid(`${n.courseId}-t`); return { id: k, key: k, title, source: n.sourceKind === 'manual' ? 'manual' : n.sourceKind }; }) });
        });
        syl = { id: newVid, courseId: n.courseId, version: sylVersion, status: 'Published', createdAt: nowTs(), publishedAt: nowTs(), changeNote: `Generated from Notes of Lesson v${n.version}`, modules: [{ id: uid('m'), title: course?.name ?? 'Course', weeks }] };
      }
      mutate((d) => {
        d.nols.forEach((x) => { if (x.courseId === n.courseId && x.status === 'Published') { x.status = 'Superseded'; x.history.push({ at: nowTs(), by: actor, action: `Superseded by v${n.version}` }); } });
        const x = d.nols.find((y) => y.id === nolId)!;
        x.status = 'Published'; x.publishedAt = nowTs(); x.publishedBy = actor;
        x.days.sort((a, b) => a.dayNumber - b.dayNumber);
        if (syl) {
          d.syllabi.forEach((v) => { if (v.courseId === n.courseId && v.status === 'Published') v.status = 'Superseded'; });
          d.syllabi.push(syl);
          x.syllabusVersionId = syl.id;
          x.days.forEach((dd) => { dd.syllabusDayId = dayMap[dd.id]; });
        }
        x.history.push({ at: nowTs(), by: actor, action: `Published v${n.version}${syl ? ` and generated syllabus v${sylVersion}` : ''}` });
        const c = d.courses.find((y) => y.id === n.courseId); if (c && c.status === 'Draft') c.status = 'Published';
      }, { action: 'Notes of Lesson published', entity: `${course?.name} v${n.version}`, prev: 'Draft', next: `Published${syl ? ` · syllabus v${sylVersion}` : ''}`, reason: 'Batches keep their current notes until assigned' });
      toast(`Notes of Lesson v${n.version} published${syl ? ` with syllabus v${sylVersion}` : ''}. Assign it to batches next.`);
      return true;
    },
    assign(nolId: string, batchIds: string[]) {
      if (!isAdmin) return deny();
      const n = raw.nols.find((x) => x.id === nolId);
      if (!n || n.status !== 'Published') { toast('Only published notes can be assigned.', 'error'); return false; }
      const valid = batchIds.filter((id) => raw.batches.find((b) => b.id === id)?.courseId === n.courseId);
      mutate((d) => d.batches.forEach((b) => {
        if (!valid.includes(b.id)) return;
        b.nolId = n.id;
        if (n.syllabusVersionId) b.syllabusVersionId = n.syllabusVersionId;
      }), { action: 'Notes of Lesson assigned', entity: `${raw.courses.find((c) => c.id === n.courseId)?.name} v${n.version}`, prev: '—', next: valid.map((id) => raw.batches.find((b) => b.id === id)?.name).join(', '), reason: n.syllabusVersionId ? 'Batch syllabus version updated to match the notes' : '' });
      const tus = [...new Set(valid.map((id) => raw.batches.find((b) => b.id === id)!.trainerId))].map((tid) => raw.users.find((u) => u.trainerId === tid)?.id).filter(Boolean) as string[];
      notify(tus, { type: 'assignment', title: 'Notes of Lesson assigned', body: `${n.title} (v${n.version}) is now available for your ${raw.courses.find((c) => c.id === n.courseId)?.name} batch.`, link: { page: 't-notes' } });
      toast(`Assigned to ${valid.length} batch(es); trainers notified`);
      return true;
    },
    unassign(batchId: string) {
      if (!isAdmin) return deny();
      const b = raw.batches.find((x) => x.id === batchId);
      mutate((d) => { const x = d.batches.find((y) => y.id === batchId)!; x.nolId = undefined; }, { action: 'Notes of Lesson unassigned', entity: b?.name ?? batchId, prev: b?.nolId ?? '—', next: '—', reason: '' });
      toast(`Notes removed from ${b?.name}`, 'info');
    },
  };
}

/** trainer-side student task checklist */
export function useTaskChecklist() {
  const { raw, user, mutate, toast } = useApp();
  return (batchId: string, date: string, nolId: string, dayNumber: number, taskIndex: number, status: 'Completed' | 'Not Completed') => {
    const b = raw.batches.find((x) => x.id === batchId);
    if (user?.role !== 'trainer' || !b || b.trainerId !== user.trainerId || b.nolId !== nolId) { toast('You can only update tasks for your own batches.', 'error'); return; }
    if (isDayLocked(raw, user.trainerId!, date)) { toast('This day is locked because the report was submitted.', 'error'); return; }
    mutate((d) => {
      let c = d.taskChecks.find((x) => x.batchId === batchId && x.date === date && x.dayNumber === dayNumber && x.taskIndex === taskIndex);
      if (!c) { c = { id: uid('tc'), trainerId: user.trainerId!, batchId, nolId, dayNumber, date, taskIndex, status, updatedAt: nowTs() }; d.taskChecks.push(c); }
      c.status = status; c.updatedAt = nowTs();
    });
  };
}

/** Trainer chooses which syllabus day was taught for a batch on a class date. Saved, never inferred. */
export function useLessonDay() {
  const { raw, user, mutate, toast } = useApp();
  return (batchId: string, date: string, syllabusDayId: string) => {
    const b = raw.batches.find((x) => x.id === batchId);
    if (user?.role !== 'trainer' || !b || b.trainerId !== user.trainerId) { toast('You can only plan lessons for your own batches.', 'error'); return false; }
    if (date > new Date().toISOString().slice(0, 10) && date > todayLocal()) { toast('Choose today or an earlier class date.', 'error'); return false; }
    if (isDayLocked(raw, user.trainerId!, date)) { toast('This day is locked because the report was submitted.', 'error'); return false; }
    const prev = raw.lessonDays.find((x) => x.batchId === batchId && x.date === date);
    if (prev?.syllabusDayId === syllabusDayId) return true;
    const label = (id?: string) => { const td = id ? raw.syllabi.find((v) => v.id === b.syllabusVersionId)?.modules.flatMap((m) => m.weeks.flatMap((w) => w.days)).findIndex((d) => d.id === id) : -1; return td !== undefined && td >= 0 ? `Day ${td + 1}` : '—'; };
    mutate((d) => {
      const x = d.lessonDays.find((y) => y.batchId === batchId && y.date === date);
      if (x) { x.syllabusDayId = syllabusDayId; x.at = nowTs(); x.trainerId = user.trainerId!; }
      else d.lessonDays.push({ id: uid('ld'), batchId, date, syllabusDayId, trainerId: user.trainerId!, at: nowTs() });
    }, { action: 'Lesson day selected', entity: `${b.name} · ${fmtDate(date)}`, prev: label(prev?.syllabusDayId), next: label(syllabusDayId), reason: '' });
    return true;
  };
}
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Save student voice notes for a batch + class date (replaces that day's list until the report is submitted). */
export function useWhatsAppUpdates() {
  const { raw, user, mutate, toast } = useApp();
  return (batchId: string, date: string, studentIds: string[], unmatched: string[], source: 'paste' | 'excel' | 'csv' | 'txt' | 'manual', fileName?: string, notes: Record<string, { title: string; submittedAt?: string }> = {}) => {
    const b = raw.batches.find((x) => x.id === batchId);
    if (user?.role !== 'trainer' || !b || b.trainerId !== user.trainerId) { toast('You can only save voice notes for your own batches.', 'error'); return false; }
    if (date > todayLocal()) { toast('Choose today or an earlier class date.', 'error'); return false; }
    if (isDayLocked(raw, user.trainerId!, date)) { toast('The daily report for this date is submitted, so the selection is locked.', 'error'); return false; }
    const allowed = new Set(raw.students.filter((st) => st.batchId === batchId).map((st) => st.id));
    const ids = [...new Set(studentIds)].filter((id) => allowed.has(id));
    if (ids.length !== new Set(studentIds).size) { toast('Some selected students are not in this batch and were left out.', 'warning'); }
    const prev = raw.waUpdates.find((w) => w.batchId === batchId && w.date === date);
    mutate((d) => {
      let w = d.waUpdates.find((x) => x.batchId === batchId && x.date === date);
      if (!w) { w = { id: uid('wa'), trainerId: user.trainerId!, batchId, date, studentIds: [], unmatched: [], source, savedAt: nowTs(), savedBy: user.name, history: [] }; d.waUpdates.push(w); }
      w.voiceNotes = ids.map((id) => {
        const existing = prev?.voiceNotes?.find((v) => v.studentId === id);
        const n = notes[id];
        return { studentId: id, title: (n?.title ?? existing?.title ?? '').trim(), submittedAt: n?.submittedAt || existing?.submittedAt || date };
      });
      w.studentIds = ids; w.unmatched = [...new Set(unmatched)]; w.source = source; w.fileName = fileName; w.savedAt = nowTs(); w.savedBy = user.name; w.trainerId = user.trainerId!;
      w.history.push({ at: nowTs(), by: user.name, count: ids.length });
    }, { action: prev ? 'Student voice notes edited' : 'Student voice notes saved', entity: `${b.name} · ${fmtDate(date)}`, prev: prev ? `${prev.studentIds.length} students` : '—', next: `${ids.length} students`, reason: fileName ?? source });
    toast(`${ids.length} student voice note${ids.length === 1 ? '' : 's'} saved for ${b.name} on ${fmtDate(date)}`);
    return true;
  };
}
