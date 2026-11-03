import { useEffect, useMemo, useState } from 'react';
import { BookText, Pencil, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, CircleDot, Code2, FileText, Presentation, Users } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import type { AttMark, Batch, Topic, TopicProgress, TopicStatus } from '../../types';
import { attendanceFor, courseName, latestProgress, lessonPlan, nolDayFor, studentsOf, syllabusOf, topicDay } from '../../store/selectors';
import { Badge, Button, Card, Confirm, Empty, Field, Input, Modal, PageHeader, Progress, Select, SimNote, Stat, Table, Textarea } from '../../components/common/ui';
import { cx, fmtDate, fmtDateTime, nowTs, pct, todayISO, uid } from '../../utils';
import { BatchPills, LockedBanner, WorkDatePicker, useBatchSel, useLocked, useWorkDate } from './common';
import { TodaysNolCard } from './NolTrainer';

const STATUS_STYLE: Record<TopicStatus, string> = {
  Completed: 'bg-emerald-600 text-white ring-emerald-600',
  'Partially Completed': 'bg-amber-500 text-white ring-amber-500',
  Pending: 'bg-red-600 text-white ring-red-600',
};

export function useProgressWriter() {
  const { mutate, raw, user } = useApp();
  return (batchId: string, topic: Topic, date: string, patch: Partial<TopicProgress>) => {
    if (user?.role !== 'trainer' || raw.batches.find((b) => b.id === batchId)?.trainerId !== user.trainerId) return; // own batches only
    const prev = raw.progress.find((p) => p.batchId === batchId && p.topicKey === topic.key && p.date === date);
    mutate((d) => {
      let r = d.progress.find((p) => p.batchId === batchId && p.topicKey === topic.key && p.date === date);
      if (!r) { r = { id: uid('tp'), batchId, topicKey: topic.key, date, status: 'Pending', minutes: 0, explanation: '', reason: '', practical: false, understanding: '', doubts: '', updatedAt: nowTs() }; d.progress.push(r); }
      const td = topicDay(raw, raw.batches.find((x) => x.id === batchId)!, topic.key);
      Object.assign(r, patch, { updatedAt: nowTs(), trainerId: user.trainerId, updatedBy: user.name, syllabusDayId: td?.syllabusDayId, dayNumber: td?.dayNumber });
    }, patch.status && patch.status !== prev?.status ? { action: 'Topic status updated', entity: `${raw.batches.find((b) => b.id === batchId)?.name} · ${topic.title}`, prev: prev?.status ?? 'Not updated', next: patch.status, reason: patch.reason ?? '' } : undefined);
  };
}

function StatusButtons({ value, onPick, disabled }: { value?: TopicStatus; onPick: (s: TopicStatus) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-inset ring-ink-200 dark:ring-ink-700">
      {(['Completed', 'Partially Completed', 'Pending'] as TopicStatus[]).map((st) => (
        <button key={st} disabled={disabled} onClick={() => onPick(st)} className={cx('px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60', value === st ? STATUS_STYLE[st] : 'bg-white text-ink-600 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800')}>
          {st === 'Partially Completed' ? 'Partial' : st === 'Pending' ? 'Not Covered' : st}
        </button>
      ))}
    </div>
  );
}

function ReasonModal({ topic, status, onClose, onSave, initial }: { topic: Topic; status: TopicStatus; onClose: () => void; onSave: (reason: string) => void; initial: string }) {
  const [r, setR] = useState(initial);
  const [err, setErr] = useState('');
  return (
    <Modal open onClose={onClose} size="sm" title={`Mark "${topic.title}" as ${status === 'Pending' ? 'pending' : 'partially completed'}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { if (r.trim().length < 5) { setErr('Describe what is left or why (at least 5 characters).'); return; } onSave(r.trim()); }}>Save status</Button></>}>
      <Field label={status === 'Pending' ? 'Reason for pending' : 'Progress note: what was covered and what remains'} required error={err}><Textarea id="reason-text" value={r} onChange={(e) => setR(e.target.value)} autoFocus /></Field>
      <p className="mt-2 text-xs text-ink-500">This topic will appear in the next class plan until it is marked Completed.</p>
    </Modal>
  );
}

function TopicRow({ b, t, date, origin, locked }: { b: Batch; t: Topic; date: string; origin?: string; locked: boolean }) {
  const { state: s, go, toast } = useApp();
  const write = useProgressWriter();
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState<TopicStatus | null>(null);
  const rec = s.progress.find((p) => p.batchId === b.id && p.topicKey === t.key && p.date === date);
  const note = s.notes[t.key];
  const pick = (st: TopicStatus) => {
    if (st === 'Completed') { write(b.id, t, date, { status: st, reason: '' }); toast(`"${t.title}" marked completed`); }
    else setAsk(st);
  };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
          {open ? <ChevronDown size={16} className="shrink-0 text-ink-400" /> : <ChevronRight size={16} className="shrink-0 text-ink-400" />}
          {rec?.status === 'Completed' ? <CheckCircle2 size={17} className="shrink-0 text-emerald-500" /> : rec?.status === 'Partially Completed' ? <CircleDot size={17} className="shrink-0 text-amber-500" /> : <CircleDashed size={17} className={cx('shrink-0', rec ? 'text-red-500' : 'text-ink-300')} />}
          <span className="min-w-0"><span className="block truncate font-medium text-ink-900 dark:text-ink-50">{t.title}</span>
            <span className="block truncate text-xs text-ink-500">{origin ? `Carried over from ${origin}` : note ? 'Lesson notes available' : 'No master notes yet'}{rec?.reason ? ` · ${rec.reason}` : ''}</span></span>
        </button>
        <StatusButtons value={rec?.status} onPick={pick} disabled={locked} />
      </div>
      {open && (
        <div className="ml-7 mt-3 rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-sm dark:border-ink-800 dark:bg-ink-800/30">
          {note ? (
            <div className="space-y-3">
              <p className="text-ink-800 dark:text-ink-100"><b>Definition:</b> {note.definition}</p>
              {note.code && <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Code example</div><pre className="overflow-x-auto rounded-lg bg-navy-950 p-3 font-mono text-xs text-blue-50">{note.code}</pre></div>}
              {note.practical.length > 0 && <div><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Practical questions</div><ul className="mt-1 list-disc pl-5 text-ink-700 dark:text-ink-200">{note.practical.map((p) => <li key={p}>{p}</li>)}</ul></div>}
              {note.homework && <p className="text-ink-700 dark:text-ink-200"><b>Homework:</b> {note.homework}</p>}
              <div className="flex flex-wrap gap-2">
                {note.attachments.map((a) => { const I = a.kind === 'PPT' ? Presentation : a.kind === 'PDF' ? FileText : Code2; return <button key={a.name} onClick={() => toast('Attachments open from the backend file store. Only the file name is kept in this prototype.', 'info')} className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs ring-1 ring-ink-200 dark:bg-ink-900 dark:ring-ink-700"><I size={13} />{a.name}</button>; })}
                <Button size="sm" variant="secondary" icon={<BookText size={13} />} onClick={() => go({ page: 't-topic', id: t.key })}>Full notes</Button>
              </div>
            </div>
          ) : <div className="text-ink-500">No master notes for this topic yet. <button className="text-royal-600 hover:underline" onClick={() => go({ page: 't-topic', id: t.key })}>Open topic</button></div>}
          <p className="mt-3 text-xs text-ink-400">Opening a topic does not change its status. Use the buttons to record progress.</p>
        </div>
      )}
      {ask && <ReasonModal topic={t} status={ask} initial={rec?.reason ?? ''} onClose={() => setAsk(null)} onSave={(reason) => { write(b.id, t, date, { status: ask, reason }); setAsk(null); toast(`"${t.title}" marked ${ask.toLowerCase()}`, 'info'); }} />}
    </li>
  );
}

export function TodaysLesson({ batchId }: { batchId?: string }) {
  const { state: s, go } = useApp();
  const { date } = useWorkDate();
  const [sel, setSel, list] = useBatchSel(batchId);
  const locked = useLocked(date);
  const b = list.find((x) => x.id === sel);
  if (!b) return <div><PageHeader title="Today's Lesson" actions={<WorkDatePicker />} /><Card><Empty title="No classes for this date" /></Card></div>;
  const plan = lessonPlan(s, b, date);
  const v = syllabusOf(s, b);
  const recs = s.progress.filter((p) => p.batchId === b.id && p.date === date);
  const dayDone = plan.topics.length > 0 && plan.topics.every((t) => {
    const lp = latestProgress(s, b.id, t.key);
    return s.settings.dayCompleteRule === 'all-completed' ? lp?.status === 'Completed' : !!lp && (lp.status === 'Completed' || !!lp.reason);
  });
  const att = attendanceFor(s, b.id, date);
  return (
    <div>
      <PageHeader title="Today's Lesson" sub="Lesson plan generated from the batch's assigned syllabus version" actions={<WorkDatePicker />} />
      <BatchPills value={b.id} onChange={setSel} date={date} />
      <LockedBanner date={date} />
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-violet2-600 dark:text-violet-300">Day {plan.dayNumber} of {plan.totalDays}</div>
                <h2 className="font-display text-xl font-extrabold text-ink-900 dark:text-ink-50">{plan.flat?.day.title}</h2>
                <div className="mt-1 text-sm text-ink-500">{courseName(s, b.courseId)} · {b.name} · {plan.flat?.moduleTitle} · {plan.flat?.weekTitle} · syllabus v{v?.version}</div>
              </div>
              {dayDone ? <Badge color="green">Lesson day complete</Badge> : <Badge color="orange">Lesson day open</Badge>}
            </div>
          </Card>
          {plan.carryOver.length > 0 && (
            <Card title="Carried over from previous classes" subtitle="Not completed earlier. Cover these first." className="border-amber-300 dark:border-amber-500/40">
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">{plan.carryOver.map((c) => <TopicRow key={c.topic.key} b={b} t={c.topic} date={date} origin={`${c.dayTitle} (${c.status}${c.note ? `: ${c.note}` : ''})`} locked={locked} />)}</ul>
            </Card>
          )}
          <Card title={`Today's topics (${plan.topics.length})`} subtitle="Expand a topic for notes, code, practicals and homework">
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">{plan.topics.map((t) => <TopicRow key={t.key} b={b} t={t} date={date} locked={locked} />)}</ul>
          </Card>
          <TodaysNolCard b={b} date={date} />
        </div>
        <div className="space-y-4">
          <Card title="Class status">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-ink-600 dark:text-ink-300">Attendance</span>{att?.status === 'Submitted' ? <Badge>Submitted</Badge> : <Button size="sm" variant="secondary" icon={<Users size={13} />} onClick={() => go({ page: 't-attendance', id: b.id })}>Mark</Button>}</div>
              <div className="flex items-center justify-between"><span className="text-ink-600 dark:text-ink-300">Topics updated</span><span className="tabular-nums text-ink-900 dark:text-ink-100">{recs.length}/{plan.topics.length + plan.carryOver.length}</span></div>
              <div><div className="mb-1 flex justify-between text-xs text-ink-500"><span>Completed today</span><span>{recs.filter((r) => r.status === 'Completed').length}</span></div><Progress value={pct(recs.filter((r) => r.status === 'Completed').length, plan.topics.length + plan.carryOver.length)} tone="green" label /></div>
              <Button className="w-full" variant="secondary" onClick={() => go({ page: 't-progress', id: b.id })}>Update topic progress</Button>
              <Button className="w-full" onClick={() => go({ page: 't-batch-report', id: b.id })}>Open batch report</Button>
            </div>
          </Card>
          <SimNote>A topic is never marked complete just because you opened it. Partial and pending topics need a reason and roll into the next class.</SimNote>
        </div>
      </div>
    </div>
  );
}

/* ---------- Topic Progress (simplified: status + reason only) ---------- */
const TP_OPTIONS: { v: TopicStatus; label: string; on: string }[] = [
  { v: 'Completed', label: 'Completed', on: 'bg-emerald-600 text-white ring-emerald-600' },
  { v: 'Partially Completed', label: 'Partially Completed', on: 'bg-amber-500 text-white ring-amber-500' },
  { v: 'Pending', label: 'Not Covered', on: 'bg-red-600 text-white ring-red-600' },
];

const STATUS_LABEL: Record<TopicStatus, string> = { Completed: 'Completed', 'Partially Completed': 'Partially Completed', Pending: 'Not Covered' };
const STATUS_BADGE: Record<TopicStatus, 'green' | 'orange' | 'red'> = { Completed: 'green', 'Partially Completed': 'orange', Pending: 'red' };

/** One bullet: title, saved status, pencil. The pencil opens a small inline editor for that topic only. */
function TopicBullet({ b, t, date, carried, locked }: { b: Batch; t: Topic; date: string; carried?: string; locked: boolean }) {
  const { state: s, toast } = useApp();
  const write = useProgressWriter();
  const rec = s.progress.find((p) => p.batchId === b.id && p.topicKey === t.key && p.date === date);
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState<TopicStatus | ''>(rec?.status ?? '');
  const [reason, setReason] = useState(rec?.reason ?? '');
  const [err, setErr] = useState('');
  const start = () => { setSt(rec?.status ?? ''); setReason(rec?.reason ?? ''); setErr(''); setOpen(true); };
  const save = () => {
    if (!st) { setErr('Choose a status.'); return; }
    if (st !== 'Completed' && reason.trim().length < 3) { setErr('Enter a reason.'); return; }
    write(b.id, t, date, { status: st, reason: st === 'Completed' ? '' : reason.trim() });
    toast(`"${t.title}" saved as ${STATUS_LABEL[st].toLowerCase()}`);
    setOpen(false);
  };
  return (
    <li className="py-2">
      <div className="flex items-start gap-2.5">
        <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-500 dark:bg-ink-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] text-ink-900 dark:text-ink-50">{t.title}</span>
            <button onClick={() => (open ? setOpen(false) : start())} disabled={locked} aria-label={`Edit progress for ${t.title}`} aria-expanded={open}
          className={cx('shrink-0 rounded-md p-1 text-ink-500 hover:bg-ink-100 hover:text-royal-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-ink-800', open && 'bg-royal-50 text-royal-600 dark:bg-royal-500/15')}> <Pencil size={15} /></button>
            {rec ? <Badge color={STATUS_BADGE[rec.status]}>{STATUS_LABEL[rec.status]}</Badge> : <span className="text-xs text-ink-400">Not updated</span>}
          </div>
          {(carried || (rec && rec.status !== 'Completed' && rec.reason)) && (
            <div className="text-xs text-ink-500">{carried && <span className="text-amber-700 dark:text-amber-300">Carried over from {carried}</span>}{carried && rec?.reason && rec.status !== 'Completed' ? ' · ' : ''}{rec && rec.status !== 'Completed' && rec.reason}</div>
          )}
        </div>
      </div>
      {open && (
        <div className="ml-4 mt-2 rounded-lg border border-ink-200 bg-ink-50/70 p-3 dark:border-ink-700 dark:bg-ink-800/40">
          <div role="radiogroup" aria-label="Topic status" className="flex flex-wrap gap-2">
            {(['Completed', 'Partially Completed', 'Pending'] as TopicStatus[]).map((x) => (
              <label key={x} className={cx('flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ring-1 ring-inset', st === x ? (x === 'Completed' ? 'bg-emerald-600 text-white ring-emerald-600' : x === 'Pending' ? 'bg-red-600 text-white ring-red-600' : 'bg-amber-500 text-white ring-amber-500') : 'bg-white text-ink-700 ring-ink-200 dark:bg-ink-900 dark:text-ink-200 dark:ring-ink-700')}>
                <input type="radio" className="sr-only" name={`st-${t.key}`} checked={st === x} onChange={() => { setSt(x); setErr(''); }} />{STATUS_LABEL[x]}
              </label>
            ))}
          </div>
          {st && st !== 'Completed' && (
            <Input autoFocus className="mt-2 h-9" value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder={st === 'Pending' ? 'Reason it was not covered' : 'What is left to cover'} aria-label="Reason" />
          )}
          {err && <div className="mt-1.5 text-xs text-red-600">{err}</div>}
          <div className="mt-2.5 flex gap-2"><Button size="sm" onClick={save}>Save</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
        </div>
      )}
    </li>
  );
}

export function TopicProgressPage({ batchId }: { batchId?: string }) {
  const { state: s, go } = useApp();
  const { date } = useWorkDate();
  const [sel, setSel, list] = useBatchSel(batchId);
  const locked = useLocked(date);
  const b = list.find((x) => x.id === sel);
  if (!b) return <div><PageHeader title="Topic Progress" actions={<WorkDatePicker />} /><Card><Empty title="No classes for this date" /></Card></div>;
  const plan = lessonPlan(s, b, date);
  const nd = nolDayFor(s, b, date);
  // today's topics come from the published Notes of Lesson day when the batch has one, otherwise from its syllabus day
  const byTitle = new Map(plan.topics.map((t) => [t.title, t]));
  const today: Topic[] = nd ? nd.day.topics.map((title) => byTitle.get(title)).filter((x): x is Topic => !!x) : plan.topics;
  const seen = new Set(today.map((t) => t.key));
  const carried = plan.carryOver.filter((c) => !seen.has(c.topic.key));
  const all = [...carried.map((c) => c.topic), ...today];
  const recs = all.map((t) => s.progress.find((p) => p.batchId === b.id && p.topicKey === t.key && p.date === date));
  const completed = recs.filter((r) => r?.status === 'Completed').length;
  const total = all.length;
  return (
    <div>
      <PageHeader title="Topic Progress" sub="Tap the pencil beside a topic to record its status" actions={<WorkDatePicker />} />
      <BatchPills value={b.id} onChange={setSel} date={date} />
      <LockedBanner date={date} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total topics" value={total} />
        <Stat label="Completed" value={completed} tone="green" />
        <Stat label="Pending" value={total - completed} tone="orange" />
        <Stat label="Completion" value={`${pct(completed, total)}%`} tone="blue" />
      </div>
      {!plan.selected && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"><span className="flex-1">The lesson day for {fmtDate(date)} has not been selected, so only pending topics are listed.</span><Button size="sm" variant="secondary" onClick={() => go({ page: 't-lesson', id: b.id })}>Select lesson day</Button></div>}
      <Card className="mt-4" title={`${b.name} – Today's Topics`} subtitle={`${plan.selected ? `Day ${plan.dayNumber}: ${plan.flat?.day.title}` : 'Lesson day not selected'}${nd ? ` · from ${nd.nol.title.replace(/\s*[–-]\s*notes of lesson$/i, '')} Notes of Lesson v${nd.nol.version}` : ''}`}>
        <div className="mb-3"><Progress value={pct(completed, total)} tone="green" size="sm" /></div>
        {carried.length > 0 && (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Carried over ({carried.length})</div>
            <ul className="mb-3 divide-y divide-ink-100 dark:divide-ink-800">{carried.map((c) => <TopicBullet key={`${c.topic.key}-${date}`} b={b} t={c.topic} date={date} carried={`Day ${c.dayNumber} – ${c.dayTitle}`} locked={locked} />)}</ul>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Today ({today.length})</div>
          </>
        )}
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">{today.map((t) => <TopicBullet key={`${t.key}-${date}`} b={b} t={t} date={date} locked={locked} />)}</ul>
        {!total && <Empty title="No topics scheduled" />}
      </Card>
      <p className="mt-3 text-xs text-ink-500">Topics not marked Completed carry over to the next class automatically. The published syllabus and Notes of Lesson are not changed.</p>
    </div>
  );
}

export function AttendancePage({ batchId }: { batchId?: string }) {
  const { state: s, mutate, toast, user } = useApp();
  const { date } = useWorkDate();
  const [sel, setSel, list] = useBatchSel(batchId);
  const locked = useLocked(date);
  const b = list.find((x) => x.id === sel);
  const session = b ? attendanceFor(s, b.id, date) : undefined;
  const [marks, setMarks] = useState<Record<string, AttMark>>({});
  const [confirm, setConfirm] = useState(false);
  const [corr, setCorr] = useState<{ sid: string; to: AttMark } | null>(null);
  const [corrReason, setCorrReason] = useState('');
  useEffect(() => { setMarks(session?.marks ?? {}); /* eslint-disable-next-line */ }, [b?.id, date, session?.id, session?.status]);
  if (!b) return <div><PageHeader title="Attendance" actions={<WorkDatePicker />} /><Card><Empty title="No classes for this date" /></Card></div>;
  const studs = studentsOf(s, b.id);
  const submitted = session?.status === 'Submitted';
  const count = (m: AttMark) => Object.values(marks).filter((x) => x === m).length;
  const unmarked = studs.filter((st) => !marks[st.id]).length;
  const write = (status: 'Draft' | 'Submitted') => {
    mutate((d) => {
      let a = d.attendance.find((x) => x.batchId === b.id && x.date === date);
      if (a && a.status === 'Submitted') return; // duplicate submission guard
      if (!a) { a = { id: uid('att'), batchId: b.id, date, status: 'Draft', marks: {}, corrections: [] }; d.attendance.push(a); }
      a.marks = { ...marks };
      a.status = status;
      if (status === 'Submitted') { a.submittedAt = nowTs(); a.submittedBy = user!.name; }
    }, status === 'Submitted' ? { action: 'Attendance submitted', entity: `${b.name} · ${fmtDate(date)}`, prev: session ? `Draft ${Object.keys(session.marks).length} marked` : '—', next: `P${count('Present')} L${count('Late')} A${count('Absent')} LV${count('Leave')}`, reason: '' } : undefined);
    toast(status === 'Submitted' ? `Attendance submitted for ${b.name}` : 'Attendance draft saved');
  };
  const history = s.attendance.filter((a) => a.batchId === b.id).sort((x, y) => y.date.localeCompare(x.date));
  return (
    <div>
      <PageHeader title="Attendance" sub="One attendance record per batch per class session" actions={<WorkDatePicker />} />
      <BatchPills value={b.id} onChange={setSel} date={date} />
      <LockedBanner date={date} />
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Card pad={false} title={`${b.name} · ${fmtDate(date)}`} subtitle={submitted ? `Submitted by ${session?.submittedBy} at ${fmtDateTime(session?.submittedAt)}. Changes now need a correction with a reason.` : `${studs.length} students · ${unmarked} not marked`}
          action={!submitted && <>
            <Button size="sm" variant="secondary" disabled={locked} onClick={() => setMarks(Object.fromEntries(studs.map((st) => [st.id, 'Present' as AttMark])))}>Mark all present</Button>
            <Button size="sm" variant="secondary" disabled={locked} onClick={() => write('Draft')}>Save draft</Button>
            <Button size="sm" disabled={locked} onClick={() => unmarked ? toast(`${unmarked} student(s) are not marked yet.`, 'error') : setConfirm(true)}>Submit attendance</Button>
          </>}>
          <Table head={['Student ID', 'Student name', 'Present', 'Absent', 'Late', 'Leave', submitted ? 'Correction' : '']} minW={640}>
            {studs.map((st) => (
              <tr key={st.id} className={!marks[st.id] ? 'bg-amber-50/40 dark:bg-amber-500/5' : ''}>
                <td className="font-mono text-xs">{st.id}</td><td className="font-medium text-ink-900 dark:text-ink-50">{st.name}</td>
                {(['Present', 'Absent', 'Late', 'Leave'] as AttMark[]).map((m) => (
                  <td key={m}><label className="inline-flex cursor-pointer items-center"><input type="radio" name={`att-${st.id}`} id={`att-${st.id}-${m}`} className={cx('h-4 w-4', m === 'Present' ? 'accent-emerald-600' : m === 'Absent' ? 'accent-red-600' : m === 'Late' ? 'accent-amber-500' : 'accent-royal-600')} checked={marks[st.id] === m} disabled={submitted || locked} onChange={() => setMarks((p) => ({ ...p, [st.id]: m }))} /><span className="sr-only">{m}</span></label></td>
                ))}
                <td>{submitted && !locked && <Select id={`corr-${st.id}`} value="" onChange={(e) => { setCorr({ sid: st.id, to: e.target.value as AttMark }); setCorrReason(''); }} className="h-8 w-28 py-0 text-xs"><option value="">Correct…</option>{(['Present', 'Absent', 'Late', 'Leave'] as AttMark[]).filter((m) => m !== marks[st.id]).map((m) => <option key={m}>{m}</option>)}</Select>}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <div className="space-y-4">
          <Card title="Summary">
            <div className="grid grid-cols-2 gap-2">
              {(['Present', 'Late', 'Absent', 'Leave'] as AttMark[]).map((m) => <div key={m} className="rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800/50"><div className="text-xs text-ink-500">{m}</div><div className="font-display text-xl font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{count(m)}</div></div>)}
            </div>
            <div className="mt-3"><Progress value={pct(count('Present') + count('Late'), studs.length)} tone="green" label /></div>
            <div className="mt-1 text-xs text-ink-500">Status: {session ? session.status : 'Not started'}</div>
          </Card>
          <Card title="History" pad={false}>
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {history.map((a) => { const m = Object.values(a.marks); return <li key={a.id} className="flex items-center justify-between px-4 py-2 text-sm"><span className="text-ink-700 dark:text-ink-200">{fmtDate(a.date)}</span><span className="flex items-center gap-2"><span className="text-xs tabular-nums text-ink-500">{m.filter((x) => x === 'Present' || x === 'Late').length}/{studentsOf(s, b.id).length}</span><Badge>{a.status}</Badge>{a.corrections.length > 0 && <Badge color="purple" dot={false}>{a.corrections.length} corr.</Badge>}</span></li>; })}
            </ul>
          </Card>
          {session && session.corrections.length > 0 && <Card title="Corrections"><ul className="space-y-2 text-xs">{session.corrections.map((c, i) => <li key={i}><b>{s.students.find((x) => x.id === c.studentId)?.name}</b>: {c.from} → {c.to}<div className="text-ink-500">{c.reason} · {c.by} · {fmtDateTime(c.at)}</div></li>)}</ul></Card>}
        </div>
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Submit attendance?" tone="primary" confirmLabel="Submit" body={`Present ${count('Present')}, Late ${count('Late')}, Absent ${count('Absent')}, Leave ${count('Leave')}. After submitting, changes need a correction with a reason.`} onConfirm={() => write('Submitted')} />
      {corr && (
        <Modal open onClose={() => setCorr(null)} size="sm" title="Correct attendance" footer={<><Button variant="secondary" onClick={() => setCorr(null)}>Cancel</Button><Button disabled={corrReason.trim().length < 5} onClick={() => {
          const from = marks[corr.sid] ?? '—';
          mutate((d) => { const a = d.attendance.find((x) => x.id === session!.id)!; a.marks[corr.sid] = corr.to; a.corrections.push({ at: nowTs(), by: user!.name, reason: corrReason.trim(), studentId: corr.sid, from, to: corr.to }); },
            { action: 'Attendance corrected', entity: `${b.name} · ${s.students.find((x) => x.id === corr.sid)?.name} · ${fmtDate(date)}`, prev: String(from), next: corr.to, reason: corrReason.trim() });
          toast('Correction saved with history'); setCorr(null);
        }}>Save correction</Button></>}>
          <p className="text-sm text-ink-600 dark:text-ink-300">{s.students.find((x) => x.id === corr.sid)?.name}: <b>{marks[corr.sid]}</b> → <b>{corr.to}</b></p>
          <Field label="Reason for correction" required className="mt-3"><Textarea id="corr-reason" value={corrReason} onChange={(e) => setCorrReason(e.target.value)} autoFocus /></Field>
          <p className="mt-2 text-xs text-ink-500">The original mark, new mark, reason and your name are kept in the audit log.</p>
        </Modal>
      )}
    </div>
  );
}
