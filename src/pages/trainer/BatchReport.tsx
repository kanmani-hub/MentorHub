import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Eye, Lock, MessageCircle, Pencil, Plus, Save, Send, Trash2, Check, X } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { useBatchReportActions, validateBatchForm, type BatchReportForm } from '../../store/actions';
import { attendanceFor, batchReportFor, buildSnapshot, courseName, isDayLocked, lessonPlan, studentsOf } from '../../store/selectors';
import { DOUBT_TYPES, PRACTICAL_TYPES, PROJECT_STATUSES, type AttMark, type Topic, type TopicStatus } from '../../types';
import { Badge, Button, Card, Empty, Field, Input, KV, Modal, PageHeader, Progress, Select, Textarea } from '../../components/common/ui';
import { BatchBlock } from '../../components/common/ReportView';
import { cx, fmtDate, fmtDateTime, pct, todayISO, uid } from '../../utils';
import { WorkDatePicker, useBatchSel, useWorkDate } from './common';

const NOT_COVERED_LABEL: Record<TopicStatus, string> = { Completed: 'Completed', 'Partially Completed': 'Partially Completed', Pending: 'Not Covered' };

function Step({ n, title, sub, error, children, action }: { n: number; title: string; sub?: string; error?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section id={`brs-${n}`} className={cx('scroll-mt-4 rounded-xl border bg-white dark:bg-ink-900', error ? 'border-red-400 dark:border-red-500/60' : 'border-ink-200 dark:border-ink-800')}>
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-100 px-4 py-3 dark:border-ink-800">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy-700 text-xs font-bold text-white dark:bg-royal-600">{n}</span>
          <div className="min-w-0"><h3 className="font-display text-[15px] font-bold text-ink-900 dark:text-ink-50">{title}</h3>{sub && <p className="text-xs text-ink-500">{sub}</p>}</div>
        </div>
        {action}
      </header>
      {error && <div className="flex items-center gap-2 bg-red-50 px-4 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300"><AlertCircle size={14} />{error}</div>}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Bullet list with add / inline edit / delete. */
function BulletList({ items, onChange, placeholder, disabled, icon }: { items: { id: string; text: string }[]; onChange: (v: { id: string; text: string }[]) => void; placeholder: string; disabled?: boolean; icon?: ReactNode }) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const add = () => { if (!draft.trim()) return; onChange([...items, { id: uid('li'), text: draft.trim() }]); setDraft(''); };
  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-3 divide-y divide-ink-100 rounded-lg border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              {icon ?? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-400" />}
              {editing === it.id ? (
                <>
                  <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onChange(items.map((x) => (x.id === it.id ? { ...x, text: editText.trim() || x.text } : x))); setEditing(null); } if (e.key === 'Escape') setEditing(null); }}
                    className="h-8 min-w-0 flex-1 rounded-md border border-royal-500 bg-white px-2 text-sm text-ink-900 focus:outline-none dark:bg-ink-900 dark:text-ink-100" />
                  <button aria-label="Save" className="text-emerald-600" onClick={() => { onChange(items.map((x) => (x.id === it.id ? { ...x, text: editText.trim() || x.text } : x))); setEditing(null); }}><Check size={16} /></button>
                  <button aria-label="Cancel" className="text-ink-400" onClick={() => setEditing(null)}><X size={16} /></button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 text-ink-800 dark:text-ink-100">{it.text}</span>
                  {!disabled && <>
                    <button aria-label="Edit" className="rounded p-1 text-ink-400 hover:text-royal-600" onClick={() => { setEditing(it.id); setEditText(it.text); }}><Pencil size={14} /></button>
                    <button aria-label="Delete" className="rounded p-1 text-ink-400 hover:text-red-600" onClick={() => onChange(items.filter((x) => x.id !== it.id))}><Trash2 size={14} /></button>
                  </>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder={placeholder} />
          <Button variant="secondary" icon={<Plus size={15} />} onClick={add}>Add</Button>
        </div>
      )}
    </div>
  );
}

const emptyForm = (): BatchReportForm => ({ topics: {}, marks: {}, reasons: {}, lateTimes: {}, practicals: [], assignments: [], doubts: [], voiceNames: [], projects: [], remarks: '' });

export function BatchReportPage({ batchId }: { batchId?: string }) {
  const { state: s, user, go } = useApp();
  const { date } = useWorkDate();
  const tid = user!.trainerId!;
  const [sel, setSel, list] = useBatchSel(batchId);
  const act = useBatchReportActions();
  const b = list.find((x) => x.id === sel);
  const plan = b ? lessonPlan(s, b, date) : null;
  const topics: (Topic & { carried?: string })[] = useMemo(() => (plan ? [...plan.carryOver.map((c) => ({ ...c.topic, carried: `Day ${c.dayNumber} – ${c.dayTitle}` })), ...plan.topics] : []), [plan?.flat?.day.id, plan?.selected, plan?.carryOver.length, b?.id]);
  const studs = b ? studentsOf(s, b.id) : [];
  const att = b ? attendanceFor(s, b.id, date) : undefined;
  const br = b ? batchReportFor(s, tid, b.id, date) : undefined;
  const dayLocked = isDayLocked(s, tid, date);
  const submitted = br?.status === 'Submitted';
  const readOnly = dayLocked || submitted;
  const attFrozen = att?.status === 'Submitted';

  const load = (): BatchReportForm => {
    if (!b) return emptyForm();
    return {
      topics: Object.fromEntries(topics.map((t) => { const r = s.progress.find((p) => p.batchId === b.id && p.topicKey === t.key && p.date === date); return [t.key, { status: r?.status ?? '', reason: r?.reason ?? '' }]; })),
      marks: Object.fromEntries(studs.map((st) => [st.id, att?.marks[st.id] ?? ''])),
      reasons: { ...(att?.reasons ?? {}) },
      lateTimes: { ...(att?.lateTimes ?? {}) },
      practicals: br?.practicals ?? [],
      assignments: br?.assignments ?? [],
      doubts: br?.doubts ?? [],
      voiceNames: br?.voiceNames ?? [],
      projects: br?.projects ?? [],
      remarks: br?.remarks ?? '',
    };
  };
  const [f, setF] = useState<BatchReportForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setF(load()); setErrors({}); /* eslint-disable-next-line */ }, [b?.id, date, br?.updatedAt, br?.status, att?.status, topics.length]);

  if (!b || !plan) return <div><PageHeader title="Batch Reports" actions={<WorkDatePicker />} /><Card><Empty title="No classes on this date" body="Batch reports are created for each batch that has a class." /></Card></div>;

  const set = <K extends keyof BatchReportForm>(k: K, v: BatchReportForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const setTopic = (key: string, patch: Partial<{ status: TopicStatus | ''; reason: string }>) => setF((p) => ({ ...p, topics: { ...p.topics, [key]: { ...p.topics[key], ...patch } } }));
  const setMark = (sid: string, m: AttMark | '') => setF((p) => ({ ...p, marks: { ...p.marks, [sid]: m } }));

  const tvals = Object.entries(f.topics);
  const covered = topics.filter((t) => f.topics[t.key]?.status === 'Completed');
  const partial = topics.filter((t) => f.topics[t.key]?.status === 'Partially Completed');
  const notCovered = topics.filter((t) => f.topics[t.key]?.status === 'Pending');
  const unmarkedTopics = topics.filter((t) => !f.topics[t.key]?.status);
  const count = (m: AttMark) => studs.filter((st) => f.marks[st.id] === m).length;

  // live preview uses the same snapshot builder as the consolidated report, overlaid with unsaved form values
  const snap = buildSnapshot(s, tid, date).batches.find((x) => x.batchId === b.id)!;
  const nameOf = (id: string) => studs.find((x) => x.id === id)?.name ?? id;
  const previewBatch = {
    ...snap,
    batchReportStatus: br?.status ?? 'Draft' as const,
    completed: covered.map((t) => t.title),
    partial: partial.map((t) => ({ title: t.title, note: f.topics[t.key].reason })),
    pending: [...notCovered, ...unmarkedTopics.filter((t) => !t.carried)].map((t) => ({ title: t.title, note: f.topics[t.key]?.status ? f.topics[t.key].reason : 'Not marked' })),
    present: count('Present'), late: count('Late'), absent: count('Absent'), leave: count('Leave'), total: studs.length,
    attendanceSubmitted: attFrozen || submitted,
    absentees: studs.filter((st) => f.marks[st.id] === 'Absent').map((st) => ({ name: st.name, reason: f.reasons[st.id] ?? '' })),
    onLeave: studs.filter((st) => f.marks[st.id] === 'Leave').map((st) => ({ name: st.name, reason: f.reasons[st.id] ?? '' })),
    lateList: studs.filter((st) => f.marks[st.id] === 'Late').map((st) => ({ name: nameOf(st.id), time: f.lateTimes[st.id] ?? '' })),
    practicalList: f.practicals.filter((x) => x.text.trim()),
    assignmentList: f.assignments.filter((x) => x.name.trim()),
    doubtList: f.doubts.filter((x) => x.text.trim()),
    voiceNames: f.voiceNames.filter((x) => x.text.trim()).map((x) => x.text),
    projects: f.projects.filter((x) => x.name.trim()),
    batchRemarks: f.remarks,
    nextPlan: [...partial, ...notCovered].length ? `Carry forward: ${[...partial, ...notCovered].map((t) => t.title).join(', ')}; then continue syllabus` : 'Continue with the next day of the syllabus',
  };

  const trySubmit = () => {
    const e = validateBatchForm(s, b.id, f);
    setErrors(e);
    if (Object.keys(e).length) {
      const first = ['topics', 'attendance', 'practicals', 'assignments', 'doubts', 'voiceNames', 'projects'].indexOf(Object.keys(e)[0]);
      document.getElementById(`brs-${first + 1}`)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setConfirm(true);
  };
  const allStatuses = list.map((x) => ({ b: x, r: batchReportFor(s, tid, x.id, date) }));
  const doneCount = allStatuses.filter((x) => x.r?.status === 'Submitted').length;

  return (
    <div className="pb-20">
      <PageHeader title="Batch Reports" sub="Complete one report per batch. When all are submitted, send the consolidated daily report to admin." actions={<WorkDatePicker />} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {allStatuses.map(({ b: x, r }) => (
          <button key={x.id} onClick={() => setSel(x.id)} className={cx('flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition', sel === x.id ? 'bg-navy-700 text-white ring-navy-700 dark:bg-royal-600 dark:ring-royal-600' : 'bg-white text-ink-700 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-200 dark:ring-ink-700')}>
            {r?.status === 'Submitted' ? <CheckCircle2 size={15} className={sel === x.id ? 'text-white' : 'text-emerald-500'} /> : <span className={cx('h-2 w-2 rounded-full', r ? 'bg-amber-400' : 'bg-ink-300')} />}
            {x.name}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-500">{doneCount} of {list.length} batch reports submitted</span>
        <Button size="sm" variant={doneCount === list.length ? 'primary' : 'secondary'} onClick={() => go('t-report')}>Consolidated report →</Button>
      </div>

      {dayLocked && <div className="mb-4 flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800/50 dark:text-ink-200"><Lock size={15} className="mt-0.5 shrink-0" />The consolidated report for {fmtDate(date)} has been sent to admin, so these batch reports are locked. They reopen only if admin requests a correction.</div>}
      {!dayLocked && submitted && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={16} /> <span className="flex-1">Submitted {fmtDateTime(br?.submittedAt)}. It will be included in your consolidated report.</span>
          <Button size="sm" variant="secondary" onClick={() => act.reopen(b.id, date)}>Edit report</Button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KV k="Batch" v={b.name} /><KV k="Course" v={courseName(s, b.courseId)} /><KV k="Report date" v={fmtDate(date)} /><KV k="Trainer" v={user!.name} />
            </dl>
          </Card>

          <Step n={1} title="Topic progress" sub={`${plan.selected ? `Day ${plan.dayNumber}: ${plan.flat?.day.title}` : 'Lesson day not selected'}${plan.carryOver.length ? ` · ${plan.carryOver.length} carried over` : ''}. Tick a topic when it is completed.`} error={errors.topics}>
            {!plan.selected && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"><span className="flex-1">Select the lesson day taught on {fmtDate(date)} in Today's Lesson. Only pending topics are listed until then.</span><Button size="sm" variant="secondary" onClick={() => go({ page: 't-lesson', id: b.id })}>Select lesson day</Button></div>}
            <div className="mb-3"><Progress value={pct(covered.length, topics.length)} tone="green" label /><div className="mt-1 text-xs text-ink-500">{covered.length} covered · {partial.length} partially covered · {notCovered.length} not covered · {unmarkedTopics.length} not marked</div></div>
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {topics.map((t) => {
                const v = f.topics[t.key] ?? { status: '', reason: '' };
                const needsReason = v.status && v.status !== 'Completed';
                return (
                  <li key={t.key} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                        <input type="checkbox" className="h-4 w-4 shrink-0 accent-emerald-600" checked={v.status === 'Completed'} disabled={readOnly}
                          onChange={(e) => setTopic(t.key, { status: e.target.checked ? 'Completed' : '' })} id={`tp-${t.key}`} />
                        <span className="min-w-0"><span className={cx('block text-sm text-ink-900 dark:text-ink-50', v.status === 'Completed' && 'text-ink-500 line-through decoration-emerald-500/60')}>{t.title}</span>{t.carried && <span className="text-xs text-amber-700 dark:text-amber-300">Carried over from {t.carried}</span>}</span>
                      </label>
                      <Select aria-label={`Status for ${t.title}`} value={v.status} disabled={readOnly} onChange={(e) => setTopic(t.key, { status: e.target.value as TopicStatus | '' })} className={cx('h-8 w-48 py-0 text-xs', !v.status && 'text-ink-400')}>
                        <option value="">Select status</option>
                        {(['Completed', 'Partially Completed', 'Pending'] as TopicStatus[]).map((x) => <option key={x} value={x}>{NOT_COVERED_LABEL[x]}</option>)}
                      </Select>
                    </div>
                    {needsReason && <Input className="mt-2 h-8 text-xs" style={{ marginLeft: 26, width: 'calc(100% - 26px)' }} value={v.reason} disabled={readOnly} onChange={(e) => setTopic(t.key, { reason: e.target.value })} placeholder={v.status === 'Pending' ? 'Why was this not covered?' : 'What was covered, what remains?'} />}
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[{ k: 'Topics covered', items: covered, c: 'text-emerald-600', empty: 'None yet' }, { k: 'Topics partially covered', items: partial, c: 'text-amber-600', empty: 'None' }, { k: 'Topics pending (not covered)', items: notCovered, c: 'text-red-600', empty: 'None' }].map((g) => (
                <div key={g.k} className="rounded-lg bg-ink-50 p-3 dark:bg-ink-800/50">
                  <div className={cx('text-xs font-semibold', g.c)}>{g.k} ({g.items.length})</div>
                  <ul className="mt-1 space-y-0.5 text-xs text-ink-700 dark:text-ink-200">{g.items.length ? g.items.map((t) => <li key={t.key}>{t.title}</li>) : <li className="text-ink-400">{g.empty}</li>}</ul>
                </div>
              ))}
            </div>
            {(partial.length + notCovered.length) > 0 && <p className="mt-2 text-xs text-ink-500">Partially covered and pending topics carry forward to the next lesson automatically. The syllabus itself does not change.</p>}
          </Step>

          <Step n={2} title="Student attendance" sub={attFrozen ? 'Attendance was already submitted. Marks are locked; reasons and arrival times can still be added.' : `${studs.length} students in ${b.name}`} error={errors.attendance}
            action={!attFrozen && !readOnly && <Button size="sm" variant="secondary" onClick={() => setF((p) => ({ ...p, marks: Object.fromEntries(studs.map((st) => [st.id, (p.marks[st.id] || 'Present') as AttMark])) }))}>Mark rest present</Button>}>
            <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[['Total', studs.length], ['Present', count('Present')], ['Late', count('Late')], ['Absent', count('Absent')], ['Leave', count('Leave')], ['Attended', count('Present') + count('Late')]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-ink-50 px-2.5 py-1.5 dark:bg-ink-800/50"><div className="text-[11px] text-ink-500">{k}</div><div className="font-display text-lg font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{v}</div></div>
              ))}
            </div>
            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200 dark:divide-ink-800 dark:border-ink-800">
              {studs.map((st) => {
                const m = f.marks[st.id] ?? '';
                return (
                  <li key={st.id} className={cx('grid items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_140px_1fr]', !m && 'bg-amber-50/40 dark:bg-amber-500/5')}>
                    <div className="min-w-0 text-sm"><span className="font-medium text-ink-900 dark:text-ink-50">{st.name}</span> <span className="font-mono text-xs text-ink-400">{st.id}</span></div>
                    <Select aria-label={`Attendance for ${st.name}`} value={m} disabled={readOnly || attFrozen} onChange={(e) => setMark(st.id, e.target.value as AttMark | '')} className={cx('h-8 py-0 text-xs', m === 'Absent' && 'text-red-600', m === 'Late' && 'text-amber-600', m === 'Present' && 'text-emerald-700')}>
                      <option value="">Not marked</option>{(['Present', 'Absent', 'Leave', 'Late'] as AttMark[]).map((x) => <option key={x}>{x}</option>)}
                    </Select>
                    <div className="min-w-0">
                      {(m === 'Absent' || m === 'Leave') && <Input className="h-8 text-xs" value={f.reasons[st.id] ?? ''} disabled={readOnly} onChange={(e) => set('reasons', { ...f.reasons, [st.id]: e.target.value })} placeholder={m === 'Absent' ? 'Reason for absence' : 'Leave reason'} />}
                      {m === 'Late' && <div className="flex items-center gap-2 text-xs text-ink-500">Arrived at <Input type="time" className="h-8 w-28 text-xs" value={f.lateTimes[st.id] ?? ''} disabled={readOnly} onChange={(e) => set('lateTimes', { ...f.lateTimes, [st.id]: e.target.value })} /></div>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-ink-500">Only students assigned to {b.name} are listed. Attendance is submitted together with this batch report.</p>
          </Step>

          <Step n={3} title="Practical activities conducted" error={errors.practicals}>
            {f.practicals.length > 0 && <ul className="mb-3 space-y-2">{f.practicals.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 sm:flex-row">
                <Select value={p.type} disabled={readOnly} onChange={(e) => set('practicals', f.practicals.map((x) => (x.id === p.id ? { ...x, type: e.target.value as typeof p.type } : x)))} className="sm:w-48">{PRACTICAL_TYPES.map((x) => <option key={x}>{x}</option>)}</Select>
                <Input value={p.text} disabled={readOnly} onChange={(e) => set('practicals', f.practicals.map((x) => (x.id === p.id ? { ...x, text: e.target.value } : x)))} placeholder="What was done" />
                {!readOnly && <Button variant="ghost" aria-label="Delete activity" onClick={() => set('practicals', f.practicals.filter((x) => x.id !== p.id))}><Trash2 size={15} /></Button>}
              </li>
            ))}</ul>}
            {!readOnly && <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => set('practicals', [...f.practicals, { id: uid('pi'), type: 'Practical exercise', text: '' }])}>Add activity</Button>}
          </Step>

          <Step n={4} title="Homework / assignments given" sub="Optional" error={errors.assignments}>
            {f.assignments.length > 0 && <div className="mb-3 space-y-3">{f.assignments.map((a) => (
              <div key={a.id} className="grid gap-2 rounded-lg border border-ink-200 p-3 sm:grid-cols-[1fr_160px_auto] dark:border-ink-800">
                <Input value={a.name} disabled={readOnly} onChange={(e) => set('assignments', f.assignments.map((x) => (x.id === a.id ? { ...x, name: e.target.value } : x)))} placeholder="Assignment name" />
                <Input type="date" value={a.deadline} disabled={readOnly} onChange={(e) => set('assignments', f.assignments.map((x) => (x.id === a.id ? { ...x, deadline: e.target.value } : x)))} aria-label="Submission deadline" />
                {!readOnly ? <Button variant="ghost" aria-label="Delete assignment" onClick={() => set('assignments', f.assignments.filter((x) => x.id !== a.id))}><Trash2 size={15} /></Button> : <span />}
                <Textarea rows={2} className="sm:col-span-3" value={a.description} disabled={readOnly} onChange={(e) => set('assignments', f.assignments.map((x) => (x.id === a.id ? { ...x, description: e.target.value } : x)))} placeholder="Description" />
              </div>
            ))}</div>}
            {!readOnly && <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => set('assignments', [...f.assignments, { id: uid('ai'), name: '', description: '', deadline: '' }])}>Add assignment</Button>}
          </Step>

          <Step n={5} title="Student doubts or difficulties" sub="Optional">
            {f.doubts.length > 0 && <ul className="mb-3 space-y-2">{f.doubts.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 sm:flex-row">
                <Select value={d.type} disabled={readOnly} onChange={(e) => set('doubts', f.doubts.map((x) => (x.id === d.id ? { ...x, type: e.target.value as typeof d.type } : x)))} className="sm:w-52">{DOUBT_TYPES.map((x) => <option key={x}>{x}</option>)}</Select>
                <Input value={d.text} disabled={readOnly} onChange={(e) => set('doubts', f.doubts.map((x) => (x.id === d.id ? { ...x, text: e.target.value } : x)))} placeholder="Describe the doubt or difficulty" />
                {!readOnly && <Button variant="ghost" aria-label="Delete doubt" onClick={() => set('doubts', f.doubts.filter((x) => x.id !== d.id))}><Trash2 size={15} /></Button>}
              </li>
            ))}</ul>}
            {!readOnly && <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => set('doubts', [...f.doubts, { id: uid('di'), type: 'Question asked', text: '' }])}>Add entry</Button>}
          </Step>

          <Step n={6} title="WhatsApp voice note names" sub="Titles of the voice notes and updates you shared on WhatsApp for this batch today" error={errors.voiceNames}>
            <BulletList items={f.voiceNames} onChange={(v) => set('voiceNames', v)} disabled={readOnly} placeholder="e.g. HTML Day 1 – Class Explanation" icon={<MessageCircle size={14} className="shrink-0 text-emerald-600" />} />
          </Step>

          <Step n={7} title="Project work / assignment" sub="Optional · one entry per project" error={errors.projects}>
            {f.projects.length > 0 && <div className="mb-3 space-y-3">{f.projects.map((p) => {
              const up = (patch: Partial<typeof p>) => set('projects', f.projects.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
              return (
                <div key={p.id} className="grid gap-2 rounded-lg border border-ink-200 p-3 sm:grid-cols-2 dark:border-ink-800">
                  <Field label="Project name" required><Input value={p.name} disabled={readOnly} onChange={(e) => up({ name: e.target.value })} /></Field>
                  <Field label="Project status"><Select value={p.status} disabled={readOnly} onChange={(e) => up({ status: e.target.value as typeof p.status })}>{PROJECT_STATUSES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
                  <Field label="Work completed today"><Input value={p.workDone} disabled={readOnly} onChange={(e) => up({ workDone: e.target.value })} placeholder="What you worked on or explained" /></Field>
                  <Field label="Project assigned"><Input value={p.assigned} disabled={readOnly} onChange={(e) => up({ assigned: e.target.value })} placeholder="Task given to students" /></Field>
                  <Field label="Students assigned"><Input value={p.students} disabled={readOnly} onChange={(e) => up({ students: e.target.value })} placeholder="Names or team names" /></Field>
                  <Field label="Remarks"><Input value={p.remarks} disabled={readOnly} onChange={(e) => up({ remarks: e.target.value })} /></Field>
                  {!readOnly && <div className="sm:col-span-2 text-right"><Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => set('projects', f.projects.filter((x) => x.id !== p.id))}>Remove project</Button></div>}
                </div>
              );
            })}</div>}
            {!readOnly && <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => set('projects', [...f.projects, { id: uid('pj'), name: '', workDone: '', assigned: '', students: '', status: 'In Progress', remarks: '' }])}>Add project entry</Button>}
          </Step>

          <Step n={8} title="Additional remarks" sub="Optional">
            <Textarea rows={3} value={f.remarks} disabled={readOnly} onChange={(e) => set('remarks', e.target.value)} placeholder="Anything else admin should know about this batch or class" />
          </Step>
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-4 space-y-3">
            <Card title="Report checklist">
              <ul className="space-y-1.5 text-sm">
                {[['Topic progress', !unmarkedTopics.length && !tvals.some(([, v]) => v.status && v.status !== 'Completed' && v.reason.trim().length < 5), 1],
                  ['Attendance', studs.every((st) => f.marks[st.id]) && !studs.some((st) => ((f.marks[st.id] === 'Absent' || f.marks[st.id] === 'Leave') && !(f.reasons[st.id] ?? '').trim()) || (f.marks[st.id] === 'Late' && !f.lateTimes[st.id])), 2],
                  ['Practical activities', f.practicals.some((p) => p.text.trim()), 3],
                  ['Assignments', !f.assignments.some((a) => !a.name.trim() || !a.deadline), 4],
                  ['Doubts', true, 5], ['WhatsApp voice notes', !s.settings.requireVoiceNote || f.voiceNames.length > 0, 6], ['Project work', !f.projects.some((p) => !p.name.trim()), 7], ['Remarks', true, 8]].map(([k, ok, n]) => (
                  <li key={k as string}><button onClick={() => document.getElementById(`brs-${n}`)?.scrollIntoView({ behavior: 'smooth' })} className="flex w-full items-center gap-2 text-left hover:text-royal-600">{ok ? <CheckCircle2 size={15} className="text-emerald-500" /> : <AlertCircle size={15} className="text-amber-500" />}<span className="text-ink-700 dark:text-ink-200">{k as string}</span></button></li>
                ))}
              </ul>
            </Card>
            {br && <Card title="History"><ul className="space-y-1.5 text-xs">{[...br.history].reverse().slice(0, 5).map((h, i) => <li key={i}><div className="text-ink-800 dark:text-ink-100">{h.action}</div><div className="text-ink-500">{fmtDateTime(h.at)}</div></li>)}</ul></Card>}
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 py-3 backdrop-blur lg:left-64 dark:border-ink-800 dark:bg-ink-900/95" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-end gap-2">
            {Object.keys(errors).length > 0 && <span className="mr-auto text-xs text-red-600">{Object.keys(errors).length} section(s) need attention</span>}
            <Button variant="secondary" icon={<Save size={15} />} onClick={() => act.saveDraft(b.id, date, f)}>Save as draft</Button>
            <Button variant="secondary" icon={<Eye size={15} />} onClick={() => setPreview(true)}>Preview report</Button>
            <Button icon={<Send size={15} />} onClick={trySubmit}>Submit batch report</Button>
          </div>
        </div>
      )}

      {preview && (
        <Modal open onClose={() => setPreview(false)} size="xl" title={`Preview · ${b.name}`} sub={`${courseName(s, b.courseId)} · ${fmtDate(date)} · ${user!.name}`}
          footer={<><Button variant="secondary" onClick={() => setPreview(false)}>Keep editing</Button>{!readOnly && <Button onClick={() => { setPreview(false); trySubmit(); }}>Submit batch report</Button>}</>}>
          <BatchBlock b={previewBatch} />
        </Modal>
      )}
      {confirm && (
        <Modal open onClose={() => setConfirm(false)} size="sm" title="Submit batch report?" footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button onClick={() => { if (act.submit(b.id, date, f)) { setConfirm(false); const next = allStatuses.find((x) => x.b.id !== b.id && x.r?.status !== 'Submitted'); if (next) setSel(next.b.id); } }}>Submit</Button></>}>
          <p className="text-sm text-ink-600 dark:text-ink-300">Attendance for {b.name} ({count('Present') + count('Late')}/{studs.length} attended) and topic progress ({covered.length}/{topics.length} covered) are saved and attendance is locked. You can still edit this batch report until you send the consolidated report.</p>
        </Modal>
      )}
    </div>
  );
}
