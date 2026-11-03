import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, FileText, Pencil, Save, Target, BookOpen } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { useLessonDay } from '../../store/actions';
import { activeTrainerBatches, attendanceFor, courseName, flatDays, isDayLocked, latestProgress, lessonPlan, nolOfBatch, syllabusOf, taskChecksFor } from '../../store/selectors';
import type { Batch, Topic, TopicStatus } from '../../types';
import { Badge, Button, Card, Confirm, Empty, Field, Input, PageHeader, Progress, Select, Stat } from '../../components/common/ui';
import { PdfViewerModal } from '../../components/common/PdfViewer';
import { cx, fmtDate, pct, todayISO } from '../../utils';
import { useWorkDate } from './common';
import { useProgressWriter } from './Teaching';
import { TaskToggle } from './NolTrainer';

export const STATUS_LABEL: Record<TopicStatus, string> = { Completed: 'Completed', 'Partially Completed': 'Partially Completed', Pending: 'Not Covered' };
const STATUS_BADGE: Record<TopicStatus, 'green' | 'orange' | 'red'> = { Completed: 'green', 'Partially Completed': 'orange', Pending: 'red' };
type Draft = { status: TopicStatus; reason: string };

/** Bullet + saved/unsaved status + pencil. The pencil opens a small inline editor; Apply stages the change for Save Progress. */
function TopicLine({ t, saved, draft, onApply, sub, locked }: { t: Topic; saved?: Draft; draft?: Draft; onApply: (d: Draft) => void; sub?: React.ReactNode; locked: boolean }) {
  const cur = draft ?? saved;
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState<TopicStatus | ''>(cur?.status ?? '');
  const [reason, setReason] = useState(cur?.reason ?? '');
  const [err, setErr] = useState('');
  const start = () => { setSt(cur?.status ?? ''); setReason(cur?.reason ?? ''); setErr(''); setOpen(true); };
  const apply = () => {
    if (!st) { setErr('Choose a status.'); return; }
    if (st !== 'Completed' && reason.trim().length < 3) { setErr('Enter a reason.'); return; }
    onApply({ status: st, reason: st === 'Completed' ? '' : reason.trim() });
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
              className={cx('shrink-0 rounded-md p-1 text-ink-500 hover:bg-ink-100 hover:text-royal-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-ink-800', open && 'bg-royal-50 text-royal-600 dark:bg-royal-500/15')}><Pencil size={15} /></button>
            {cur ? <Badge color={STATUS_BADGE[cur.status]}>{STATUS_LABEL[cur.status]}</Badge> : <span className="text-xs text-ink-400">Not updated</span>}
            {draft && <Badge color="purple" dot={false}>Unsaved</Badge>}
          </div>
          {(sub || (cur && cur.status !== 'Completed' && cur.reason)) && <div className="text-xs text-ink-500">{sub}{sub && cur?.reason && cur.status !== 'Completed' ? ' · ' : ''}{cur && cur.status !== 'Completed' && cur.reason}</div>}
        </div>
      </div>
      {open && (
        <div className="ml-4 mt-2 rounded-lg border border-ink-200 bg-ink-50/70 p-3 dark:border-ink-700 dark:bg-ink-800/40">
          <div role="radiogroup" aria-label="Topic status" className="flex flex-wrap gap-2">
            {(['Completed', 'Partially Completed', 'Pending'] as TopicStatus[]).map((x) => (
              <label key={x} className={cx('flex cursor-pointer items-center rounded-lg px-3 py-1.5 text-sm ring-1 ring-inset', st === x ? (x === 'Completed' ? 'bg-emerald-600 text-white ring-emerald-600' : x === 'Pending' ? 'bg-red-600 text-white ring-red-600' : 'bg-amber-500 text-white ring-amber-500') : 'bg-white text-ink-700 ring-ink-200 dark:bg-ink-900 dark:text-ink-200 dark:ring-ink-700')}>
                <input type="radio" className="sr-only" name={`ls-${t.key}`} checked={st === x} onChange={() => { setSt(x); setErr(''); }} />{STATUS_LABEL[x]}
              </label>
            ))}
          </div>
          {st && st !== 'Completed' && <Input autoFocus className="mt-2 h-9" aria-label="Reason" value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && apply()} placeholder={st === 'Pending' ? 'Reason it was not covered' : 'What is left to cover'} />}
          {err && <div className="mt-1.5 text-xs text-red-600">{err}</div>}
          <div className="mt-2.5 flex gap-2"><Button size="sm" onClick={apply}>Apply</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
        </div>
      )}
    </li>
  );
}

export function TodaysLesson({ batchId }: { batchId?: string }) {
  const { state: s, user, go, toast } = useApp();
  const { date, setDate } = useWorkDate();
  const selectDay = useLessonDay();
  const write = useProgressWriter();
  const tid = user!.trainerId!;
  const batches = activeTrainerBatches(s, tid).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const [bid, setBid] = useState(batchId && batches.some((b) => b.id === batchId) ? batchId : batches[0]?.id ?? '');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pendingDay, setPendingDay] = useState<string | null>(null);
  const [pdf, setPdf] = useState(false);
  useEffect(() => setDrafts({}), [bid, date]);
  const b = batches.find((x) => x.id === bid);
  const days = useMemo(() => (b ? flatDays(syllabusOf(s, b)) : []), [s, b]);
  if (!b) return <div><PageHeader title="Today's Lesson" /><Card><Empty title="No active batches assigned" /></Card></div>;

  const plan = lessonPlan(s, b, date);
  const locked = isDayLocked(s, tid, date);
  const nol = nolOfBatch(s, b);
  const nd = plan.selected ? nol?.days.find((d) => d.syllabusDayId === plan.flat?.day.id) : undefined;
  const byTitle = new Map(plan.topics.map((t) => [t.title, t]));
  // the selected day's topics in the published Notes of Lesson wording/order
  const dayTopics: Topic[] = nd ? nd.topics.map((x) => byTitle.get(x)).filter((x): x is Topic => !!x) : plan.topics;
  const pending = plan.carryOver;
  const all = [...pending.map((p) => p.topic), ...dayTopics];
  const savedOf = (t: Topic): Draft | undefined => { const r = s.progress.find((p) => p.batchId === b.id && p.topicKey === t.key && p.date === date); return r ? { status: r.status, reason: r.reason } : undefined; };
  const eff = all.map((t) => drafts[t.key] ?? savedOf(t));
  const completed = eff.filter((x) => x?.status === 'Completed').length;
  const partial = eff.filter((x) => x?.status === 'Partially Completed').length;
  const unsaved = Object.keys(drafts).length;
  const dayState = (i: number) => {
    const ts = days[i].day.topics;
    const done = ts.filter((t) => latestProgress(s, b.id, t.key)?.status === 'Completed').length;
    return done === ts.length && ts.length ? 'completed' : ts.some((t) => latestProgress(s, b.id, t.key)) ? 'in progress' : '';
  };
  const savedToday = s.progress.filter((p) => p.batchId === b.id && p.date === date);
  const changeDay = (dayId: string) => {
    const leaving = plan.selected ? savedToday.filter((p) => plan.topics.some((t) => t.key === p.topicKey)).length : 0;
    if (leaving && dayId !== plan.flat?.day.id) { setPendingDay(dayId); return; }
    if (selectDay(b.id, date, dayId)) { setDrafts({}); toast(`Day ${days.findIndex((d) => d.day.id === dayId) + 1} selected for ${fmtDate(date)}`); }
  };
  const saveAll = () => {
    const keys = Object.keys(drafts);
    if (!keys.length) { toast('No changes to save', 'info'); return; }
    if (all.length && !plan.selected && keys.some((k) => !pending.some((p) => p.topic.key === k))) { toast('Select the lesson day first.', 'error'); return; }
    keys.forEach((k) => { const t = all.find((x) => x.key === k); if (t) write(b.id, t, date, drafts[k]); });
    setDrafts({});
    toast(`Progress saved for ${keys.length} topic${keys.length === 1 ? '' : 's'} on ${fmtDate(date)}`);
  };
  const att = attendanceFor(s, b.id, date);
  const file = nol ? s.files.find((f) => f.id === nol.sourceFileId) : undefined;
  const checks = nd ? taskChecksFor(s, b.id, date).filter((c) => c.dayNumber === nd.dayNumber) : [];

  return (
    <div className="pb-20">
      <PageHeader title="Today's Lesson" sub="Choose the batch, class date and the syllabus day you are teaching" />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_1.4fr]">
          <Field label="Batch"><Select id="tl-batch" value={b.id} onChange={(e) => setBid(e.target.value)}>{batches.map((x) => <option key={x.id} value={x.id}>{x.name} · {courseName(s, x.courseId)} · {x.startTime}</option>)}</Select></Field>
          <Field label="Class date"><Input id="tl-date" type="date" value={date} max={todayISO()} min={b.startDate} onChange={(e) => e.target.value && e.target.value <= todayISO() && setDate(e.target.value)} /></Field>
          <Field label="Select Lesson Day" hint={!plan.selected ? `Not selected yet. The next day in sequence would be Day ${plan.suggestedDay}.` : nol ? `From ${nol.title.replace(/\s*[–-]\s*notes of lesson$/i, '')} Notes of Lesson v${nol.version}` : `From syllabus v${syllabusOf(s, b)?.version}`}>
            <Select id="tl-day" value={plan.selected ? plan.flat!.day.id : ''} disabled={locked} onChange={(e) => e.target.value && changeDay(e.target.value)} className={!plan.selected ? 'border-amber-400' : ''}>
              <option value="">Select lesson day…</option>
              {days.map((d, i) => { const st = dayState(i); return <option key={d.day.id} value={d.day.id}>Day {i + 1} – {d.day.title}{st ? ` (${st})` : ''}</option>; })}
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span>Attendance: {att ? <Badge>{att.status}</Badge> : <Badge color="grey">Not started</Badge>}</span>
          <Button size="sm" variant="ghost" onClick={() => go({ page: 't-attendance', id: b.id })}>Mark attendance</Button>
          <Button size="sm" variant="ghost" onClick={() => go({ page: 't-batch-report', id: b.id })}>Open batch report</Button>
          {!plan.selected && <Button size="sm" variant="secondary" onClick={() => changeDay(days[plan.suggestedDay - 1].day.id)} disabled={locked}>Teach Day {plan.suggestedDay}</Button>}
        </div>
      </Card>
      {locked && <div className="mt-3 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-600 dark:bg-ink-800 dark:text-ink-300">The report for {fmtDate(date)} has been submitted, so this class is locked.</div>}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total topics" value={all.length} sub={`${pending.length} pending + ${dayTopics.length} selected day`} />
        <Stat label="Completed" value={completed} tone="green" />
        <Stat label="Partially completed" value={partial} tone="orange" />
        <Stat label="Not covered / pending" value={all.length - completed - partial} tone="red" />
        <Stat label="Completion" value={`${pct(completed, all.length)}%`} tone="blue" />
      </div>

      <div className="mt-4 space-y-4">
        <Card title={<span className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500" />Pending Topics from Previous Classes</span>} subtitle={pending.length ? 'Marked Partially Completed or Not Covered in an earlier class. Teach them before or along with the selected day.' : undefined}>
          {pending.length === 0 ? <div className="text-sm text-ink-500">No pending topics. Everything taught so far is completed.</div> : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {pending.map((p) => (
                <TopicLine key={`${p.topic.key}-${date}`} t={p.topic} saved={savedOf(p.topic)} draft={drafts[p.topic.key]} locked={locked}
                  onApply={(d) => setDrafts((x) => ({ ...x, [p.topic.key]: d }))}
                  sub={<span><span className="font-medium text-amber-700 dark:text-amber-300">Day {p.dayNumber} – {p.dayTitle}</span> · last class {fmtDate(p.lastDate)}: {STATUS_LABEL[p.status as TopicStatus] ?? p.status}{p.note && !savedOf(p.topic) ? ` (${p.note})` : ''}</span>} />
              ))}
            </ul>
          )}
        </Card>

        {!plan.selected ? (
          <Card><Empty icon={<BookOpen size={20} />} title="Select the lesson day you are teaching" body="The selected day's topics, learning objectives and student tasks appear here. Nothing is chosen automatically." /></Card>
        ) : (
          <Card title={`Day ${plan.dayNumber} – ${nd?.title ?? plan.flat?.day.title}`} subtitle={`${b.name} · ${courseName(s, b.courseId)} · class date ${fmtDate(date)}`}
            action={file && nd && <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={() => setPdf(true)}>Original PDF{nd.page ? ` · p.${nd.page}` : ''}</Button>}>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="min-w-0 lg:col-span-1">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-royal-600 dark:text-blue-300"><BookOpen size={15} />1. Topics to Cover</div>
                <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                  {dayTopics.map((t) => <TopicLine key={`${t.key}-${date}`} t={t} saved={savedOf(t)} draft={drafts[t.key]} locked={locked} onApply={(d) => setDrafts((x) => ({ ...x, [t.key]: d }))} />)}
                </ul>
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet2-600 dark:text-violet-300"><Target size={15} />2. Learning Objectives</div>
                {nd ? <ul className="space-y-1.5">{nd.objectives.map((o, i) => <li key={i} className="flex gap-2 text-sm text-ink-800 dark:text-ink-100"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" />{o}</li>)}</ul> : <div className="text-sm text-ink-500">No Notes of Lesson assigned to this batch.</div>}
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300"><ClipboardList size={15} />3. Student Tasks {nd && <span className="font-normal normal-case tracking-normal text-ink-500">· {checks.filter((c) => c.status === 'Completed').length}/{nd.tasks.length} completed</span>}</div>
                {nd ? <ol className="space-y-2">{nd.tasks.map((t, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-800 dark:text-ink-100"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{i + 1}</span>
                    <span className="min-w-0 flex-1">{t}<div className="mt-1"><TaskToggle b={b} date={date} nolId={nol!.id} dayNumber={nd.dayNumber} index={i} /></div></span></li>
                ))}</ol> : <div className="text-sm text-ink-500">No Notes of Lesson assigned to this batch.</div>}
              </div>
            </div>
            {nd && <div className="mt-3"><Progress value={pct(dayTopics.filter((t) => (drafts[t.key] ?? savedOf(t))?.status === 'Completed').length, dayTopics.length)} tone="green" size="sm" /></div>}
          </Card>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 py-3 backdrop-blur lg:left-64 dark:border-ink-800 dark:bg-ink-900/95" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-sm text-ink-600 dark:text-ink-300">{unsaved ? `${unsaved} unsaved change${unsaved === 1 ? '' : 's'}` : 'All changes saved'} · saved against {fmtDate(date)}</span>
          {unsaved > 0 && <Button variant="ghost" onClick={() => setDrafts({})}>Discard</Button>}
          <Button icon={<Save size={15} />} disabled={locked || !unsaved} onClick={saveAll}>Save Progress</Button>
        </div>
      </div>
      <Confirm open={!!pendingDay} onClose={() => setPendingDay(null)} tone="primary" confirmLabel="Change day" title="Change the lesson day?"
        body={`Topic statuses already saved for Day ${plan.dayNumber} on ${fmtDate(date)} stay in the records. Day ${days.findIndex((d) => d.day.id === pendingDay) + 1} becomes the lesson for this class.`}
        onConfirm={() => { if (pendingDay && selectDay(b.id, date, pendingDay)) { setDrafts({}); toast('Lesson day changed'); } }} />
      {pdf && file && nd && <PdfViewerModal fileId={file.id} name={file.name} page={nd.page} onClose={() => setPdf(false)} />}
    </div>
  );
}
