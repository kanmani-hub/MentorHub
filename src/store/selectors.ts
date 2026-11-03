import type {
  AppState, Batch, BatchSummary, Day, DerivedReportStatus, ReportSnapshot, SyllabusVersion, Topic, TopicProgress, User,
} from '../types';
import { minutesBetween, nowHHMM, pct, todayISO } from '../utils';

export interface FlatDay { day: Day; moduleTitle: string; weekTitle: string; index: number; moduleIndex: number }

export const versionById = (s: AppState, id: string) => s.syllabi.find((v) => v.id === id);
export const syllabusOf = (s: AppState, b: Batch) => versionById(s, b.syllabusVersionId);
export const courseName = (s: AppState, id: string) => s.courses.find((c) => c.id === id)?.name ?? '—';
export const trainerName = (s: AppState, id: string) => s.trainers.find((t) => t.id === id)?.name ?? 'Unassigned';
export const batchName = (s: AppState, id: string) => s.batches.find((b) => b.id === id)?.name ?? '—';

export const flatDays = (v?: SyllabusVersion): FlatDay[] => {
  if (!v) return [];
  const out: FlatDay[] = [];
  v.modules.forEach((m, mi) => m.weeks.forEach((w) => w.days.forEach((d) => out.push({ day: d, moduleTitle: m.title, weekTitle: w.title, index: out.length, moduleIndex: mi }))));
  return out;
};
export const allTopics = (v?: SyllabusVersion): Topic[] => flatDays(v).flatMap((f) => f.day.topics);
export const versionStats = (v?: SyllabusVersion) => {
  if (!v) return { modules: 0, weeks: 0, days: 0, topics: 0 };
  return {
    modules: v.modules.length,
    weeks: v.modules.reduce((a, m) => a + m.weeks.length, 0),
    days: flatDays(v).length,
    topics: allTopics(v).length,
  };
};
export const publishedVersion = (s: AppState, courseId: string) =>
  s.syllabi.filter((v) => v.courseId === courseId && v.status === 'Published').sort((a, b) => b.version - a.version)[0];
export const latestVersion = (s: AppState, courseId: string) =>
  s.syllabi.filter((v) => v.courseId === courseId).sort((a, b) => b.version - a.version)[0];

/** most recent progress record for a topic in a batch, optionally only records dated on/before `upTo` (or strictly before when `strict`) */
export const latestProgress = (s: AppState, batchId: string, key: string, upTo?: string, strict = false): TopicProgress | undefined => {
  let best: TopicProgress | undefined;
  for (const p of s.progress) {
    if (p.batchId !== batchId || p.topicKey !== key) continue;
    if (upTo && (strict ? p.date >= upTo : p.date > upTo)) continue;
    if (!best || p.date > best.date || (p.date === best.date && p.updatedAt > best.updatedAt)) best = p;
  }
  return best;
};

export const batchProgress = (s: AppState, b: Batch) => {
  const topics = allTopics(syllabusOf(s, b));
  let completed = 0, partial = 0;
  for (const t of topics) {
    const st = latestProgress(s, b.id, t.key)?.status;
    if (st === 'Completed') completed += 1;
    else if (st === 'Partially Completed') partial += 1;
  }
  const total = topics.length;
  return { total, completed, partial, pending: total - completed - partial, pct: pct(completed, total) };
};

export const sessionDates = (s: AppState, batchId: string) => {
  const set = new Set<string>();
  s.attendance.forEach((a) => a.batchId === batchId && set.add(a.date));
  s.progress.forEach((p) => p.batchId === batchId && set.add(p.date));
  return [...set].sort();
};

export interface PendingTopic { topic: Topic; dayTitle: string; dayNumber: number; status: string; note: string; lastDate: string }
export interface LessonPlan {
  /** the selected day, or (when nothing is selected) the suggested next day — display only */
  flat?: FlatDay;
  /** topics of the selected day; empty until the trainer selects a day */
  topics: Topic[];
  /** topics marked Partially Completed / Not Covered in earlier classes and not completed since */
  carryOver: PendingTopic[];
  dayNumber: number;
  totalDays: number;
  selected: boolean;
  suggestedDay: number;
}
export const lessonSelection = (s: AppState, batchId: string, date: string) => s.lessonDays.find((x) => x.batchId === batchId && x.date === date);
export const lessonPlan = (s: AppState, b: Batch, date: string): LessonPlan => {
  const days = flatDays(syllabusOf(s, b));
  const sel = lessonSelection(s, b.id, date);
  const idx = sel ? days.findIndex((f) => f.day.id === sel.syllabusDayId) : -1;
  // suggestion only: the day after the furthest day taught before this date
  let furthest = -1;
  days.forEach((fd, i) => { if (fd.day.topics.some((t) => latestProgress(s, b.id, t.key, date, true))) furthest = i; });
  const sugg = Math.min(furthest + 1, Math.max(0, days.length - 1));
  const carryOver: PendingTopic[] = [];
  days.forEach((fd, i) => {
    if (i === idx) return; // the selected day's topics are listed there, never twice
    fd.day.topics.forEach((t) => {
      const lp = latestProgress(s, b.id, t.key, date, true);
      if (lp && lp.status !== 'Completed') carryOver.push({ topic: t, dayTitle: fd.day.title, dayNumber: i + 1, status: lp.status, note: lp.reason || lp.explanation || '', lastDate: lp.date });
    });
  });
  const selected = idx >= 0;
  const flat = days[selected ? idx : sugg];
  return { flat, topics: selected ? flat.day.topics : [], carryOver, dayNumber: (selected ? idx : sugg) + 1, totalDays: days.length, selected, suggestedDay: sugg + 1 };
};
/** original syllabus day of a topic in a batch's syllabus */
export const topicDay = (s: AppState, b: Batch, key: string) => {
  const fd = flatDays(syllabusOf(s, b)).find((f) => f.day.topics.some((t) => t.key === key));
  return fd ? { syllabusDayId: fd.day.id, dayNumber: fd.index + 1, title: fd.day.title } : undefined;
};

export const attendanceFor = (s: AppState, batchId: string, date: string) => s.attendance.find((a) => a.batchId === batchId && a.date === date);
export const studentsOf = (s: AppState, batchId: string, activeOnly = true) =>
  s.students.filter((st) => st.batchId === batchId && (!activeOnly || st.status === 'Active'));
export const trainerBatches = (s: AppState, trainerId: string) => s.batches.filter((b) => b.trainerId === trainerId && b.status !== 'Completed');
export const activeTrainerBatches = (s: AppState, trainerId: string) => s.batches.filter((b) => b.trainerId === trainerId && b.status === 'Active');

/** batches a trainer has class for on a date: today → active assigned; past → batches with a recorded session */
export const classBatchesOn = (s: AppState, trainerId: string, date: string) => {
  if (date >= todayISO()) return activeTrainerBatches(s, trainerId).sort((a, b) => a.startTime.localeCompare(b.startTime));
  return s.batches
    .filter((b) => b.trainerId === trainerId && (s.attendance.some((a) => a.batchId === b.id && a.date === date) || s.progress.some((p) => p.batchId === b.id && p.date === date) || s.lessonDays.some((x) => x.batchId === b.id && x.date === date)))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
};

export const workFor = (s: AppState, trainerId: string, date: string) => s.work.filter((w) => w.trainerId === trainerId && w.date === date).sort((a, b) => a.start.localeCompare(b.start));
/**
 * Time summary for a trainer-day. There is no working-hours module: teaching time comes from the
 * scheduled timings of classes actually held (attendance or topic records exist). Older logged
 * entries, where present, are still included so historical reports stay unchanged.
 */
export const workMinutes = (s: AppState, trainerId: string, date: string) => {
  const logs = workFor(s, trainerId, date);
  const byCat: Record<string, number> = {};
  for (const l of logs) byCat[l.activity] = (byCat[l.activity] ?? 0) + minutesBetween(l.start, l.end);
  if (!byCat['Teaching']) {
    const held = s.batches.filter((b) => b.trainerId === trainerId && (s.attendance.some((a) => a.batchId === b.id && a.date === date) || s.progress.some((p) => p.batchId === b.id && p.date === date)));
    const t = held.reduce((a, b) => a + minutesBetween(b.startTime, b.endTime), 0);
    if (t) byCat['Teaching'] = t;
  }
  const total = Object.values(byCat).reduce((a, b) => a + b, 0);
  return { total, teaching: byCat['Teaching'] ?? 0, byCat };
};
export const activityFor = (s: AppState, trainerId: string, batchId: string, date: string) =>
  s.activities.find((a) => a.trainerId === trainerId && a.batchId === batchId && a.date === date);
/* ---------- Notes of Lesson ---------- */
export const nolOfBatch = (s: AppState, b: Batch) => (b.nolId ? s.nols.find((n) => n.id === b.nolId) : undefined);
/** the Notes of Lesson day matching the batch's planned syllabus day for a date */
export const nolDayFor = (s: AppState, b: Batch, date: string) => {
  const nol = nolOfBatch(s, b);
  if (!nol) return undefined;
  const plan = lessonPlan(s, b, date);
  if (!plan.selected) return undefined;
  const day = nol.days.find((d) => d.syllabusDayId === plan.flat?.day.id) ?? nol.days[plan.dayNumber - 1];
  return day ? { nol, day } : undefined;
};
export const taskChecksFor = (s: AppState, batchId: string, date: string) => s.taskChecks.filter((t) => t.batchId === batchId && t.date === date);
/** STUDENT TASK COMPLETION (kept separate from syllabus progress): tasks marked Completed ÷ tasks scheduled */
export const taskCompletion = (s: AppState, b: Batch, dates: string[]) => {
  let done = 0, total = 0;
  dates.forEach((d) => {
    const nd = nolDayFor(s, b, d);
    if (!nd) return;
    total += nd.day.tasks.length;
    done += taskChecksFor(s, b.id, d).filter((t) => t.status === 'Completed' && t.dayNumber === nd.day.dayNumber).length;
  });
  return { done, total, pending: total - done, pct: pct(done, total) };
};
/** a lesson day is complete for a batch when every topic of the generated syllabus day is Completed */
export const nolDayCompletion = (s: AppState, b: Batch, dayNumber: number) => {
  const nol = nolOfBatch(s, b);
  const nd = nol?.days.find((d) => d.dayNumber === dayNumber);
  const sday = flatDays(syllabusOf(s, b)).find((f) => f.day.id === nd?.syllabusDayId)?.day;
  if (!sday) return { done: 0, total: 0, complete: false };
  const done = sday.topics.filter((t) => latestProgress(s, b.id, t.key)?.status === 'Completed').length;
  return { done, total: sday.topics.length, complete: done === sday.topics.length && done > 0 };
};

export const batchReportFor = (s: AppState, trainerId: string, batchId: string, date: string) =>
  s.batchReports.find((r) => r.trainerId === trainerId && r.batchId === batchId && r.date === date);
export const reportFor = (s: AppState, trainerId: string, date: string) => s.reports.find((r) => r.trainerId === trainerId && r.date === date);

export const isAfterDeadline = (s: AppState, date: string) => date < todayISO() || (date === todayISO() && nowHHMM() > s.settings.reportDeadline);

export const derivedStatus = (s: AppState, trainerId: string, date: string): DerivedReportStatus => {
  const r = reportFor(s, trainerId, date);
  if (r && r.status !== 'Draft') return r.status;
  if (isAfterDeadline(s, date)) return 'Overdue';
  return r ? 'Draft' : 'Pending';
};

/** a day's report is locked when submitted and not returned for correction */
export const isDayLocked = (s: AppState, trainerId: string, date: string) => {
  const r = reportFor(s, trainerId, date);
  return !!r && ['Submitted', 'Under Review', 'Approved', 'Rejected'].includes(r.status);
};

export const buildSnapshot = (s: AppState, trainerId: string, date: string): ReportSnapshot => {
  const trainer = s.trainers.find((t) => t.id === trainerId)!;
  const batches = classBatchesOn(s, trainerId, date);
  const wm = workMinutes(s, trainerId, date);
  const summaries: BatchSummary[] = batches.map((b) => {
    const att = attendanceFor(s, b.id, date);
    const studs = studentsOf(s, b.id);
    const marks = att ? Object.values(att.marks) : [];
    const plan = lessonPlan(s, b, date);
    const keys = [...plan.carryOver.map((c) => c.topic), ...plan.topics];
    const completed: string[] = [];
    const partial: BatchSummary['partial'] = [];
    const pending: BatchSummary['pending'] = [];
    for (const t of keys) {
      const rec = s.progress.find((p) => p.batchId === b.id && p.topicKey === t.key && p.date === date);
      if (!rec) {
        if (plan.topics.includes(t)) pending.push({ title: t.title, note: 'Not updated' });
        continue;
      }
      if (rec.status === 'Completed') completed.push(t.title);
      else if (rec.status === 'Partially Completed') partial.push({ title: t.title, note: rec.reason });
      else pending.push({ title: t.title, note: rec.reason });
    }
    const act = activityFor(s, trainerId, b.id, date);
    const br = batchReportFor(s, trainerId, b.id, date);
    const nameOf = (id: string) => s.students.find((x) => x.id === id)?.name ?? id;
    const ids = att ? Object.keys(att.marks) : [];
    const carryNext = [...partial, ...pending].map((p) => p.title);
    const nd = nolDayFor(s, b, date);
    const checks = taskChecksFor(s, b.id, date);
    const studentTasks = nd ? nd.day.tasks.map((text, i) => ({ text, status: (checks.find((c) => c.taskIndex === i && c.dayNumber === nd.day.dayNumber)?.status ?? 'Not marked') as 'Completed' | 'Not Completed' | 'Not marked' })) : undefined;
    return {
      batchId: b.id,
      batchName: b.name,
      course: courseName(s, b.courseId),
      timing: `${b.startTime}–${b.endTime}`,
      present: marks.filter((m) => m === 'Present').length,
      late: marks.filter((m) => m === 'Late').length,
      absent: marks.filter((m) => m === 'Absent').length,
      leave: marks.filter((m) => m === 'Leave').length,
      total: studs.length,
      attendanceSubmitted: att?.status === 'Submitted',
      completed, partial, pending,
      absentees: ids.filter((id) => att!.marks[id] === 'Absent').map((id) => ({ name: nameOf(id), reason: att!.reasons?.[id] ?? '' })),
      onLeave: ids.filter((id) => att!.marks[id] === 'Leave').map((id) => ({ name: nameOf(id), reason: att!.reasons?.[id] ?? '' })),
      lateList: ids.filter((id) => att!.marks[id] === 'Late').map((id) => ({ name: nameOf(id), time: att!.lateTimes?.[id] ?? '' })),
      batchReportStatus: br?.status ?? 'Not started',
      whatsappStudents: (s.waUpdates.find((w) => w.batchId === b.id && w.date === date)?.studentIds ?? []).map(nameOf),
      studentTasks,
      practicalList: br?.practicals ?? [],
      assignmentList: br?.assignments ?? [],
      doubtList: br?.doubts ?? [],
      voiceNames: br?.voiceNames.map((v) => v.text) ?? [],
      projects: br?.projects ?? [],
      batchRemarks: br?.remarks ?? '',
      practicals: br ? br.practicals.map((p) => p.text).join('; ') : act?.practicals ?? '',
      homework: br ? br.assignments.map((a) => `${a.name}${a.deadline ? ` (due ${a.deadline})` : ''}`).join('; ') : act?.homework ?? '',
      assignments: act?.assignments ?? '',
      doubts: br ? br.doubts.map((d) => d.text).join('; ') : act?.doubts ?? '',
      supportStudents: act?.supportStudents ?? '',
      nextPlan: br ? (carryNext.length ? `Carry forward: ${carryNext.join(', ')}; then continue syllabus` : 'Continue with the next day of the syllabus') : act?.nextPlan ?? '',
      voice: s.voice.filter((v) => v.trainerId === trainerId && v.batchId === b.id && v.date === date).map((v) => ({ category: v.category, description: v.description, seconds: v.seconds })),
    };
  });
  const r = reportFor(s, trainerId, date);
  return {
    trainerName: trainer?.name ?? '—',
    date,
    totalBatches: new Set(trainerBatches(s, trainerId).map((b) => b.id)).size,
    totalClasses: batches.length,
    teachingMinutes: wm.teaching,
    workingMinutes: wm.total,
    work: wm.byCat,
    batches: summaries,
    remarks: r?.draftRemarks ?? '',
    exception: r?.exception,
  };
};

export interface Issue { section: string; page: string; batchId?: string; message: string }
export const validateReport = (s: AppState, trainerId: string, date: string): Issue[] => {
  const issues: Issue[] = [];
  for (const b of classBatchesOn(s, trainerId, date)) {
    const br = batchReportFor(s, trainerId, b.id, date);
    if (!lessonSelection(s, b.id, date)) issues.push({ section: "Today's Lesson", page: 'lesson', batchId: b.id, message: `Select the lesson day taught in ${b.name}` });
    if (!br) issues.push({ section: 'Batch Report', page: 'batch-report', batchId: b.id, message: `Batch report not started for ${b.name}` });
    else if (br.status !== 'Submitted') issues.push({ section: 'Batch Report', page: 'batch-report', batchId: b.id, message: `Batch report for ${b.name} is still a draft` });
    else if (attendanceFor(s, b.id, date)?.status !== 'Submitted') issues.push({ section: 'Attendance', page: 'attendance', batchId: b.id, message: `Attendance not submitted for ${b.name}` });
    if (s.settings.requireVoiceNote && br && !br.voiceNames.length)
      issues.push({ section: 'Batch Report', page: 'batch-report', batchId: b.id, message: `Add at least one WhatsApp voice note name for ${b.name}` });
  }
  return issues;
};

/** METRIC 2 — daily work completion: required activities done / required */
export const dailyWork = (s: AppState, trainerId: string, date: string) => {
  const items: { label: string; done: boolean }[] = [];
  for (const b of classBatchesOn(s, trainerId, date)) {
    items.push({ label: `Attendance submitted · ${b.name}`, done: attendanceFor(s, b.id, date)?.status === 'Submitted' });
    const plan = lessonPlan(s, b, date);
    const updated = plan.topics.length > 0 && plan.topics.every((t) => s.progress.some((p) => p.batchId === b.id && p.topicKey === t.key && p.date === date));
    items.push({ label: `Topic progress updated · ${b.name}`, done: updated });
    items.push({ label: `Batch report submitted · ${b.name}`, done: batchReportFor(s, trainerId, b.id, date)?.status === 'Submitted' });
  }
  const done = items.filter((i) => i.done).length;
  return { items, done, required: items.length, pct: pct(done, items.length) };
};

/** METRIC 3 — report submission & approval over a set of dates */
export const reportMetric = (s: AppState, trainerId: string, dates: string[]) => {
  let due = 0, submitted = 0, approved = 0, returned = 0, onTime = 0;
  for (const d of dates) {
    if (!classBatchesOn(s, trainerId, d).length) continue;
    const st = derivedStatus(s, trainerId, d);
    if (d === todayISO() && st === 'Pending') continue; // not yet due
    due += 1;
    if (['Submitted', 'Under Review', 'Approved', 'Correction Requested', 'Rejected'].includes(st)) submitted += 1;
    if (st === 'Approved') approved += 1;
    if (st === 'Correction Requested' || st === 'Rejected') returned += 1;
    const r = reportFor(s, trainerId, d);
    if (r?.versions[0] && !r.versions[0].late) onTime += 1;
  }
  return { due, submitted, approved, returned, onTime, submissionPct: pct(submitted, due), approvalPct: pct(approved, submitted) };
};

/** trainer-level syllabus progress = completed topics across assigned batches / total topics across assigned batches */
export const trainerSyllabus = (s: AppState, trainerId: string) => {
  let c = 0, t = 0;
  for (const b of trainerBatches(s, trainerId)) {
    const p = batchProgress(s, b);
    c += p.completed;
    t += p.total;
  }
  return { completed: c, total: t, pct: pct(c, t) };
};

export const attendanceRate = (s: AppState, batchId: string) => {
  let present = 0, total = 0;
  s.attendance.filter((a) => a.batchId === batchId && a.status === 'Submitted').forEach((a) => {
    Object.values(a.marks).forEach((m) => { total += 1; if (m === 'Present' || m === 'Late') present += 1; });
  });
  return { present, total, pct: pct(present, total) };
};

/**
 * Role-scoped view of state. Trainer pages read ONLY from this — it is the prototype's
 * data-selector enforcement. Production must enforce the same rule in APIs and queries.
 */
export const scopeFor = (s: AppState, user: User): AppState => {
  if (user.role === 'admin') return s;
  if (user.role === 'trainer') {
    const tid = user.trainerId!;
    const batches = s.batches.filter((b) => b.trainerId === tid);
    const bids = new Set(batches.map((b) => b.id));
    const cids = new Set(batches.map((b) => b.courseId));
    return {
      ...s,
      users: s.users.filter((u) => u.id === user.id),
      trainers: s.trainers.filter((t) => t.id === tid),
      courses: s.courses.filter((c) => cids.has(c.id)),
      syllabi: s.syllabi.filter((v) => batches.some((b) => b.syllabusVersionId === v.id)),
      batches,
      students: s.students.filter((st) => bids.has(st.batchId)),
      attendance: s.attendance.filter((a) => bids.has(a.batchId)),
      progress: s.progress.filter((p) => bids.has(p.batchId)),
      voice: s.voice.filter((v) => v.trainerId === tid),
      work: s.work.filter((w) => w.trainerId === tid),
      checkins: s.checkins.filter((c) => c.trainerId === tid),
      activities: s.activities.filter((a) => a.trainerId === tid),
      batchReports: s.batchReports.filter((r) => r.trainerId === tid && bids.has(r.batchId)),
      // only the Notes of Lesson versions assigned to this trainer's batches, and their source files
      nols: s.nols.filter((n) => batches.some((b) => b.nolId === n.id)),
      files: s.files.filter((f) => batches.some((b) => s.nols.find((n) => n.id === b.nolId)?.sourceFileId === f.id)),
      taskChecks: s.taskChecks.filter((t) => t.trainerId === tid && bids.has(t.batchId)),
      lessonDays: s.lessonDays.filter((x) => bids.has(x.batchId)),
      waUpdates: s.waUpdates.filter((w) => w.trainerId === tid && bids.has(w.batchId)),
      reports: s.reports.filter((r) => r.trainerId === tid),
      supplemental: s.supplemental.filter((n) => n.trainerId === tid),
      notifications: s.notifications.filter((n) => n.userId === user.id),
      assignments: s.assignments.filter((a) => a.trainerId === tid),
      audit: [],
      doubts: [],
    };
  }
  const st = s.students.find((x) => x.id === user.studentId);
  const b = s.batches.find((x) => x.id === st?.batchId);
  return {
    ...s,
    users: s.users.filter((u) => u.id === user.id),
    trainers: [], audit: [], reports: [], work: [], voice: [], checkins: [], assignments: [], supplemental: [], batchReports: [], files: [], taskChecks: [],
    lessonDays: s.lessonDays.filter((x) => x.batchId === b?.id),
    waUpdates: [],
    nols: s.nols.filter((n) => n.id === b?.nolId),
    students: st ? [st] : [],
    batches: b ? [b] : [],
    courses: s.courses.filter((c) => c.id === b?.courseId),
    syllabi: s.syllabi.filter((v) => v.id === b?.syllabusVersionId),
    attendance: s.attendance.filter((a) => a.batchId === b?.id && a.status === 'Submitted').map((a) => ({ ...a, marks: st ? { [st.id]: a.marks[st.id] } : {} })),
    progress: s.progress.filter((p) => p.batchId === b?.id),
    activities: s.activities.filter((a) => a.batchId === b?.id),
    doubts: s.doubts.filter((d) => d.studentId === st?.id),
    notifications: s.notifications.filter((n) => n.userId === user.id),
  };
};
