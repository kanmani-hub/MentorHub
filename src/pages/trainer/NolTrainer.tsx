import { useState } from 'react';
import { CheckCircle2, Circle, FileText, Target, XCircle } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { useTaskChecklist } from '../../store/actions';
import { courseName, isDayLocked, nolDayCompletion, nolDayFor, nolOfBatch, taskChecksFor } from '../../store/selectors';
import type { Batch } from '../../types';
import { Badge, Button, Card, Empty, Progress, Select, Tabs } from '../../components/common/ui';
import { NolDayView } from '../../components/common/NolDay';
import { PdfViewerModal } from '../../components/common/PdfViewer';
import { NotesIndex } from '../shared/Notes';
import { cx, pct, todayISO } from '../../utils';

/** Completed / Not Completed control for one student task, saved per trainer + batch + lesson day + class date. */
export function TaskToggle({ b, date, nolId, dayNumber, index }: { b: Batch; date: string; nolId: string; dayNumber: number; index: number }) {
  const { state: s, user } = useApp();
  const set = useTaskChecklist();
  const c = s.taskChecks.find((x) => x.batchId === b.id && x.date === date && x.dayNumber === dayNumber && x.taskIndex === index);
  const locked = isDayLocked(s, user!.trainerId!, date);
  return (
    <div className="inline-flex overflow-hidden rounded-md ring-1 ring-inset ring-ink-200 dark:ring-ink-700">
      {(['Completed', 'Not Completed'] as const).map((st) => (
        <button key={st} disabled={locked} onClick={() => set(b.id, date, nolId, dayNumber, index, st)} aria-pressed={c?.status === st}
          className={cx('px-2 py-0.5 text-xs font-medium disabled:opacity-60', c?.status === st ? (st === 'Completed' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'bg-white text-ink-600 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-300')}>
          {st}
        </button>
      ))}
    </div>
  );
}

/** Notes of Lesson block for Today's Lesson: objectives + five-task checklist for the planned day. */
export function TodaysNolCard({ b, date }: { b: Batch; date: string }) {
  const { state: s } = useApp();
  const [pdf, setPdf] = useState(false);
  const nd = nolDayFor(s, b, date);
  if (!b.nolId) return null;
  if (!nd) return <Card title="Notes of Lesson"><Empty title="No lesson day matches today's plan" /></Card>;
  const checks = taskChecksFor(s, b.id, date).filter((c) => c.dayNumber === nd.day.dayNumber);
  const done = checks.filter((c) => c.status === 'Completed').length;
  const file = s.files.find((f) => f.id === nd.nol.sourceFileId);
  return (
    <Card title={`Notes of Lesson · Day ${nd.day.dayNumber} – ${nd.day.title}`} subtitle={`${nd.nol.title} v${nd.nol.version} · student tasks: ${done} of ${nd.day.tasks.length} completed`}
      action={file && <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={() => setPdf(true)}>Original PDF</Button>}>
      <div className="mb-3"><Progress value={pct(done, nd.day.tasks.length)} tone="green" label /></div>
      <NolDayView day={nd.day} taskSlot={(i) => <TaskToggle b={b} date={date} nolId={nd.nol.id} dayNumber={nd.day.dayNumber} index={i} />} />
      <p className="mt-3 text-xs text-ink-500">Topic status is recorded above. Student task completion is a separate measure and does not change syllabus progress.</p>
      {pdf && file && <PdfViewerModal fileId={file.id} name={file.name} page={nd.day.page} onClose={() => setPdf(false)} />}
    </Card>
  );
}

function AssignedNotes() {
  const { state: s } = useApp();
  const withNotes = s.batches.filter((b) => nolOfBatch(s, b));
  const [bid, setBid] = useState(withNotes[0]?.id ?? '');
  const b = withNotes.find((x) => x.id === bid) ?? withNotes[0];
  const nol = b ? nolOfBatch(s, b) : undefined;
  const today = nol && b ? nolDayFor(s, b, todayISO())?.day : undefined;
  const [dayNo, setDayNo] = useState<number | null>(null);
  const [pdf, setPdf] = useState(false);
  if (!b || !nol) return <Card><Empty title="No Notes of Lesson assigned" body="Your admin assigns Notes of Lesson to batches. Only notes for your own batches are shown here." /></Card>;
  const day = nol.days.find((d) => d.dayNumber === (dayNo ?? today?.dayNumber ?? 1)) ?? nol.days[0];
  const file = s.files.find((f) => f.id === nol.sourceFileId);
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Select id="nol-batch" value={b.id} onChange={(e) => { setBid(e.target.value); setDayNo(null); }} className="!w-auto">{withNotes.map((x) => <option key={x.id} value={x.id}>{x.name} · {courseName(s, x.courseId)}</option>)}</Select>
          <div className="min-w-0 flex-1 text-sm"><div className="font-medium text-ink-900 dark:text-ink-50">{nol.title}</div><div className="text-xs text-ink-500">Version {nol.version} · {nol.days.length} lesson days{nol.duration ? ` · ${nol.duration}` : ''} · read-only</div></div>
          {file && <Button variant="secondary" icon={<FileText size={15} />} onClick={() => setPdf(true)}>Open original PDF</Button>}
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1.5 sm:grid-cols-10 lg:grid-cols-[repeat(25,minmax(0,1fr))]">
          {nol.days.map((d) => {
            const c = nolDayCompletion(s, b, d.dayNumber);
            const isToday = today?.dayNumber === d.dayNumber;
            return (
              <button key={d.id} onClick={() => setDayNo(d.dayNumber)} title={`Day ${d.dayNumber} – ${d.title}`}
                className={cx('rounded-md py-1.5 text-xs font-semibold tabular-nums ring-1 ring-inset', d.id === day.id ? 'bg-navy-700 text-white ring-navy-700 dark:bg-royal-600' : c.complete ? 'bg-emerald-50 text-emerald-700 ring-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-300' : c.done ? 'bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-white text-ink-600 ring-ink-200 dark:bg-ink-900 dark:text-ink-300 dark:ring-ink-700', isToday && d.id !== day.id && 'ring-2 ring-royal-500')}>
                {d.dayNumber}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-500"><span>Green: all topics completed</span><span>Amber: in progress</span><span>Blue ring: today's lesson</span></div>
      </Card>
      <Card title={`Day ${day.dayNumber} – ${day.title}`} subtitle={today?.dayNumber === day.dayNumber ? "Today's scheduled lesson" : undefined}
        action={<Badge color="grey" dot={false}>{nolDayCompletion(s, b, day.dayNumber).done}/{day.topics.length} topics completed</Badge>}>
        <NolDayView day={day} />
      </Card>
      {pdf && file && <PdfViewerModal fileId={file.id} name={file.name} page={day.page} onClose={() => setPdf(false)} />}
    </div>
  );
}

export function TrainerLessonNotes() {
  const { state: s } = useApp();
  const [tab, setTab] = useState<'nol' | 'topics'>(s.batches.some((b) => b.nolId) ? 'nol' : 'topics');
  return (
    <div>
      <div className="mb-1"><h1 className="font-display text-[22px] font-extrabold tracking-tight text-ink-900 dark:text-ink-50 sm:text-2xl">Lesson Notes</h1><p className="mt-1 text-sm text-ink-500">Notes for the batches assigned to you</p></div>
      <div className="mt-4"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'nol', label: 'Notes of Lesson (day-wise)' }, { id: 'topics', label: 'Topic notes' }]} /></div>
      {tab === 'nol' ? <AssignedNotes /> : <div className="[&>div>div:first-child]:hidden"><NotesIndex detailPage="t-topic" /></div>}
    </div>
  );
}

/** Dashboard card: assigned notes, today's lesson, tasks done / pending, topic completion. */
export function TrainerNolSummary({ batches, date }: { batches: Batch[]; date: string }) {
  const { state: s, go } = useApp();
  const rows = batches.map((b) => {
    const nd = nolDayFor(s, b, date);
    if (!nd) return null;
    const checks = taskChecksFor(s, b.id, date).filter((c) => c.dayNumber === nd.day.dayNumber);
    const recs = s.progress.filter((p) => p.batchId === b.id && p.date === date);
    const comp = nolDayCompletion(s, b, nd.day.dayNumber);
    return { b, nd, done: checks.filter((c) => c.status === 'Completed').length, notDone: checks.filter((c) => c.status === 'Not Completed').length, total: nd.day.tasks.length, topicsDone: comp.done, topics: comp.total, updated: recs.length };
  }).filter(Boolean) as { b: Batch; nd: NonNullable<ReturnType<typeof nolDayFor>>; done: number; notDone: number; total: number; topicsDone: number; topics: number; updated: number }[];
  if (!rows.length) return null;
  const done = rows.reduce((a, r) => a + r.done, 0), total = rows.reduce((a, r) => a + r.total, 0);
  return (
    <Card title="Notes of Lesson · today" subtitle={`${rows.length} batch(es) with assigned notes · student tasks ${done} of ${total} completed`} action={<Button size="sm" variant="secondary" onClick={() => go('t-notes')}>Open notes</Button>}>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <button key={r.b.id} onClick={() => go({ page: 't-lesson', id: r.b.id })} className="rounded-xl border border-ink-200 p-3 text-left hover:border-royal-500/50 dark:border-ink-800">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-xs text-ink-500">{r.b.name} · {r.nd.nol.title.replace(/ – Notes of Lesson$/i, '')} v{r.nd.nol.version}</div><div className="font-medium text-ink-900 dark:text-ink-50">Day {r.nd.day.dayNumber} – {r.nd.day.title}</div></div><Target size={16} className="shrink-0 text-violet2-500" /></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 py-1.5 dark:bg-emerald-500/10"><div className="flex items-center justify-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={12} />Tasks done</div><div className="font-display text-lg font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{r.done}</div></div>
              <div className="rounded-lg bg-amber-50 py-1.5 dark:bg-amber-500/10"><div className="flex items-center justify-center gap-1 text-xs text-amber-700 dark:text-amber-300"><Circle size={12} />Tasks pending</div><div className="font-display text-lg font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{r.total - r.done}</div></div>
              <div className="rounded-lg bg-royal-50 py-1.5 dark:bg-royal-500/10"><div className="flex items-center justify-center gap-1 text-xs text-royal-700 dark:text-blue-300"><XCircle size={12} className="hidden" />Topics done</div><div className="font-display text-lg font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{r.topicsDone}/{r.topics}</div></div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
