import { useMemo, useState } from 'react';
import { CalendarClock, MessagesSquare, Plus } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import {
  INTERVIEW_RESULTS, INTERVIEW_TYPES, SCORE_LABELS, avgScore, panelCandidates, useInterviewActions, validateInterview, validateResult,
  type InterviewForm, type ResultForm,
} from '../../store/interviews';
import type { Interview, InterviewScores } from '../../types';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Input, Modal, PageHeader, SearchBox, Segmented, Select, Table, Textarea } from '../../components/common/ui';
import { addDays, cx, fmtDate, fmtDateTime, fmtTime12, todayISO } from '../../utils';

type View = 'upcoming' | 'completed' | 'all';

/** Interview Panel: schedule mock interviews for students, record scores, result and feedback. */
export function InterviewPanel() {
  const { state: s, user } = useApp();
  const isAdmin = user?.role === 'admin';
  const today = todayISO();
  const [view, setView] = useState<View>('upcoming');
  const [q, setQ] = useState('');
  const [batch, setBatch] = useState('All');
  const [type, setType] = useState('All');
  const [scheduling, setScheduling] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [resultFor, setResultFor] = useState<string | null>(null);
  const [rescheduleFor, setRescheduleFor] = useState<string | null>(null);
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const act = useInterviewActions();

  const all = s.interviews;
  const list = all
    .filter((i) => (view === 'upcoming' ? i.status === 'Scheduled' : view === 'completed' ? i.status === 'Completed' : true))
    .filter((i) => (batch === 'All' || i.batchId === batch) && (type === 'All' || i.type === type))
    .filter((i) => `${i.studentName} ${i.batchName} ${i.panel.map((p) => p.name).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (view === 'upcoming' ? `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) : `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)));
  const upcoming = all.filter((i) => i.status === 'Scheduled').length;
  const done = all.filter((i) => i.status === 'Completed');
  const selected = done.filter((i) => i.result === 'Selected').length;
  const avg = done.length ? Math.round((done.reduce((a, i) => a + (avgScore(i.scores) ?? 0), 0) / done.length) * 10) / 10 : undefined;
  const batchesWithInterviews = [...new Map(all.map((i) => [i.batchId, i.batchName])).entries()];
  const open = all.find((i) => i.id === openId);
  const canManage = (iv: Interview) => isAdmin || iv.trainerId === user?.trainerId || iv.panel.some((p) => p.id === user?.id);
  const canRecord = (iv: Interview) => canManage(iv) && iv.status !== 'Cancelled' && iv.date <= today;

  return (
    <div>
      <PageHeader title="Interview Panel" sub={isAdmin ? 'Mock interviews for students across all batches' : 'Mock interviews for students in your batches'}
        actions={<Button icon={<Plus size={15} />} onClick={() => setScheduling(true)}>Schedule interview</Button>} />

      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-ink-200/80 bg-white px-4 py-3 text-sm shadow-sm dark:border-ink-800 dark:bg-ink-900 dark:shadow-none sm:px-5">
        {([['upcoming', upcoming], ['completed', done.length], ['selected', selected]] as const).map(([k, v]) => (
          <span key={k} className="text-ink-500 dark:text-ink-400"><b className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">{v}</b> {k}</span>
        ))}
        <span className="text-ink-500 dark:text-ink-400">average score <b className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">{avg ?? '—'}</b>{avg !== undefined && ' / 5'}</span>
      </div>

      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3 dark:border-ink-800 sm:px-5">
          <Segmented value={view} onChange={setView} options={[{ id: 'upcoming', label: 'Upcoming' }, { id: 'completed', label: 'Completed' }, { id: 'all', label: 'All' }]} />
          <SearchBox value={q} onChange={setQ} placeholder="Search student or panel…" />
          <Select id="iv-batch" aria-label="Batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="!w-auto"><option value="All">All batches</option>{batchesWithInterviews.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
          <Select id="iv-type" aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className="!w-auto"><option value="All">All types</option>{INTERVIEW_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
        </div>
        <Table head={['Student', 'Type', 'Date & time', 'Panel', 'Status', '']} minW={820}
          empty={!list.length && <Empty icon={<MessagesSquare size={20} />} title={view === 'upcoming' ? 'No upcoming interviews' : 'No interviews match these filters'} action={view === 'upcoming' ? <Button size="sm" variant="secondary" onClick={() => setScheduling(true)}>Schedule interview</Button> : undefined} />}>
          {list.map((i) => (
            <tr key={i.id}>
              <td><button onClick={() => setOpenId(i.id)} className="flex items-center gap-2.5"><Avatar name={i.studentName} size={30} /><span><span className="block font-medium text-ink-900 hover:text-royal-600 dark:text-ink-50 dark:hover:text-royal-200">{i.studentName}</span><span className="block text-xs text-ink-500 dark:text-ink-400">{i.batchName}</span></span></button></td>
              <td>{i.type}</td>
              <td className="whitespace-nowrap"><span className="tabular-nums">{fmtDate(i.date)}</span> <span className="text-ink-500 dark:text-ink-400">· {fmtTime12(i.time)}</span>{i.date === today && i.status === 'Scheduled' && <span className="ml-1.5"><Badge color="blue" dot={false}>Today</Badge></span>}</td>
              <td className="max-w-[220px] text-[13px]">{i.panel.map((p) => p.name).join(', ')}</td>
              <td>{i.status === 'Completed' && i.result ? <span className="flex flex-wrap items-center gap-2"><Badge>{i.result}</Badge><span className="text-xs tabular-nums text-ink-500 dark:text-ink-400">{avgScore(i.scores)}/5</span></span> : <Badge>{i.status}</Badge>}</td>
              <td className="whitespace-nowrap text-right">
                {i.status === 'Scheduled' && canRecord(i) && <Button size="sm" className="mr-1" onClick={() => setResultFor(i.id)}>Record result</Button>}
                <Button size="sm" variant="secondary" onClick={() => setOpenId(i.id)}>Open</Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {scheduling && <ScheduleModal onClose={() => setScheduling(false)} onSave={(f) => act.schedule(f)} />}
      {open && (
        <Modal open onClose={() => setOpenId(null)} size="lg" title={`${open.studentName} · ${open.type} interview`} sub={`${open.batchName} · ${fmtDate(open.date)} at ${fmtTime12(open.time)} · ${open.mode}`}
          footer={<>
            {canManage(open) && open.status === 'Scheduled' && <Button variant="ghost" onClick={() => setCancelFor(open.id)}>Cancel interview</Button>}
            {canManage(open) && open.status === 'Scheduled' && <Button variant="secondary" icon={<CalendarClock size={15} />} onClick={() => setRescheduleFor(open.id)}>Reschedule</Button>}
            {canRecord(open) && <Button onClick={() => setResultFor(open.id)}>{open.status === 'Completed' ? 'Edit result' : 'Record result'}</Button>}
            <Button variant="secondary" onClick={() => setOpenId(null)}>Close</Button>
          </>}>
          <div className="grid gap-5 md:grid-cols-[1fr_240px]">
            <div className="space-y-4">
              {open.status === 'Completed' && open.scores ? (
                <>
                  <div className="flex flex-wrap items-center gap-3"><Badge>{open.result}</Badge><span className="text-sm text-ink-600 dark:text-ink-300">Average <b className="text-ink-900 dark:text-ink-50">{avgScore(open.scores)}</b> / 5</span></div>
                  <ul className="space-y-2.5">{SCORE_LABELS.map(({ key, label }) => (
                    <li key={key}>
                      <div className="mb-1 flex justify-between text-sm"><span className="text-ink-700 dark:text-ink-200">{label}</span><span className="tabular-nums text-ink-900 dark:text-ink-50">{open.scores![key]} / 5</span></div>
                      <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <span key={n} className={cx('h-1.5 flex-1 rounded-full', n <= open.scores![key] ? 'bg-royal-500 dark:bg-royal-400' : 'bg-ink-100 dark:bg-ink-800')} />)}</div>
                    </li>
                  ))}</ul>
                  <div><div className="mb-1 text-[13px] font-medium text-ink-700 dark:text-ink-300">Feedback</div><p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-800 dark:bg-ink-950/50 dark:text-ink-100">{open.feedback}</p></div>
                </>
              ) : (
                <p className="rounded-lg bg-ink-50 px-3 py-3 text-sm text-ink-600 dark:bg-ink-950/50 dark:text-ink-300">
                  {open.status === 'Cancelled' ? 'This interview was cancelled.' : open.date > today ? 'Scheduled. The result can be recorded on or after the interview date.' : 'Interview date reached. Record the scores, result and feedback.'}
                </p>
              )}
              {open.focus && <div><div className="mb-1 text-[13px] font-medium text-ink-700 dark:text-ink-300">Focus</div><p className="text-sm text-ink-800 dark:text-ink-100">{open.focus}</p></div>}
            </div>
            <div className="space-y-4 text-sm">
              <div><div className="mb-1.5 text-[13px] font-medium text-ink-700 dark:text-ink-300">Panel</div><ul className="space-y-1.5">{open.panel.map((p) => <li key={p.id} className="flex items-center gap-2"><Avatar name={p.name} size={24} /><span className="text-ink-800 dark:text-ink-100">{p.name}</span></li>)}</ul></div>
              <div><div className="mb-1.5 text-[13px] font-medium text-ink-700 dark:text-ink-300">History</div><ul className="space-y-2">{[...open.history].reverse().map((h, n) => <li key={n}><div className="text-ink-800 dark:text-ink-100">{h.action}</div><div className="text-xs text-ink-500 dark:text-ink-400">{h.by} · {fmtDateTime(h.at)}{h.note && ` · ${h.note}`}</div></li>)}</ul></div>
            </div>
          </div>
        </Modal>
      )}
      {resultFor && <ResultModal iv={all.find((i) => i.id === resultFor)!} onClose={() => setResultFor(null)} onSave={(f) => act.recordResult(resultFor, f)} />}
      {rescheduleFor && <RescheduleModal iv={all.find((i) => i.id === rescheduleFor)!} onClose={() => setRescheduleFor(null)} onSave={(d, t, p) => act.reschedule(rescheduleFor, d, t, p)} />}
      <Confirm open={!!cancelFor} onClose={() => setCancelFor(null)} title="Cancel this interview?" confirmLabel="Cancel interview" tone="danger" requireReason reasonLabel="Reason"
        body="The interview stays in the list as cancelled, with your reason in its history." onConfirm={(r) => { if (cancelFor) act.cancel(cancelFor, r); }} />
    </div>
  );
}

function PanelPicker({ value, onChange, error }: { value: string[]; onChange: (v: string[]) => void; error?: string }) {
  const { state: s } = useApp();
  const people = panelCandidates(s);
  return (
    <Field label="Panel members" required error={error}>
      <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-ink-200 p-1.5 dark:border-ink-700">
        {people.map((u) => (
          <label key={u.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800/60">
            <input type="checkbox" className="h-4 w-4 accent-royal-600" checked={value.includes(u.id)} onChange={() => onChange(value.includes(u.id) ? value.filter((x) => x !== u.id) : [...value, u.id])} aria-label={`Panel ${u.name}`} />
            <Avatar name={u.name} size={24} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-800 dark:text-ink-100">{u.name}</span>
            <span className="text-xs capitalize text-ink-500 dark:text-ink-400">{u.role}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

function ScheduleModal({ onClose, onSave }: { onClose: () => void; onSave: (f: InterviewForm) => boolean }) {
  const { state: s, user } = useApp();
  const batches = s.batches.filter((b) => b.status === 'Active' && (user?.role === 'admin' || b.trainerId === user?.trainerId));
  const [f, setF] = useState<InterviewForm>({ studentId: '', type: '', date: addDays(todayISO(), 1), time: '15:00', mode: 'In person', focus: '', panelIds: user ? [user.id] : [] });
  const [shown, setShown] = useState(false);
  const errors = shown ? validateInterview(f) : {};
  const save = () => { setShown(true); if (Object.keys(validateInterview(f)).length) return; if (onSave(f)) onClose(); };
  return (
    <Modal open onClose={onClose} title="Schedule interview" size="md" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Schedule</Button></>}>
      <div className="grid gap-4">
        <Field label="Student" required error={errors.studentId}>
          <Select id="iv-student" value={f.studentId} onChange={(e) => setF({ ...f, studentId: e.target.value })}>
            <option value="">Select a student</option>
            {batches.map((b) => <optgroup key={b.id} label={b.name}>{s.students.filter((st) => st.batchId === b.id && st.status === 'Active').map((st) => <option key={st.id} value={st.id}>{st.name} ({st.id})</option>)}</optgroup>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Interview type" required error={errors.type}><Select id="iv-type-new" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as InterviewForm['type'] })}><option value="">Select type</option>{INTERVIEW_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Mode"><Select id="iv-mode" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as InterviewForm['mode'] })}><option>In person</option><option>Online</option></Select></Field>
          <Field label="Date" required error={errors.date}><Input id="iv-date" type="date" min={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Time" required error={errors.time}><Input id="iv-time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        </div>
        <Field label="Focus (optional)"><Input id="iv-focus" value={f.focus} onChange={(e) => setF({ ...f, focus: e.target.value })} placeholder="e.g. Loops and functions, self-introduction" /></Field>
        <PanelPicker value={f.panelIds} onChange={(v) => setF({ ...f, panelIds: v })} error={errors.panel} />
      </div>
    </Modal>
  );
}

function ResultModal({ iv, onClose, onSave }: { iv: Interview; onClose: () => void; onSave: (f: ResultForm) => boolean }) {
  const [f, setF] = useState<ResultForm>({ scores: { ...(iv.scores ?? {}) }, result: iv.result ?? '', feedback: iv.feedback ?? '' });
  const [shown, setShown] = useState(false);
  const errors = shown ? validateResult(f) : {};
  const avg = useMemo(() => (SCORE_LABELS.every(({ key }) => f.scores[key]) ? avgScore(f.scores as InterviewScores) : undefined), [f.scores]);
  const save = () => { setShown(true); if (Object.keys(validateResult(f)).length) return; if (onSave(f)) onClose(); };
  return (
    <Modal open onClose={onClose} title={`Result · ${iv.studentName}`} sub={`${iv.type} interview · ${fmtDate(iv.date)}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save result</Button></>}>
      <div className="grid gap-4">
        <div>
          <div className="mb-2 flex items-baseline justify-between"><span className="text-[13px] font-medium text-ink-700 dark:text-ink-300">Ratings <span className="text-red-500">*</span></span>{avg !== undefined && <span className="text-xs text-ink-500 dark:text-ink-400">Average {avg} / 5</span>}</div>
          <div className="space-y-2.5">
            {SCORE_LABELS.map(({ key, label }) => (
              <div key={key} className="flex flex-wrap items-center justify-between gap-2" role="radiogroup" aria-label={label}>
                <span className="text-sm text-ink-800 dark:text-ink-100">{label}</span>
                <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={f.scores[key] === n} aria-label={`${label} ${n}`} onClick={() => setF({ ...f, scores: { ...f.scores, [key]: n } })}
                    className={cx('h-8 w-8 rounded-lg text-sm font-medium tabular-nums transition-colors', (f.scores[key] ?? 0) >= n ? 'bg-royal-600 text-white dark:bg-royal-500' : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700')}>{n}</button>
                ))}</div>
              </div>
            ))}
          </div>
          {errors.scores && <p className="mt-1.5 text-xs text-red-600 dark:text-red-300">{errors.scores}</p>}
        </div>
        <Field label="Result" required error={errors.result}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Result">
            {INTERVIEW_RESULTS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={f.result === r} onClick={() => setF({ ...f, result: r })}
                className={cx('rounded-lg px-3 py-1.5 text-sm ring-1 ring-inset transition-colors', f.result === r ? 'bg-royal-50 font-medium text-royal-700 ring-royal-300 dark:bg-royal-400/10 dark:text-royal-200 dark:ring-royal-300/30' : 'text-ink-700 ring-ink-200 hover:bg-ink-50 dark:text-ink-200 dark:ring-ink-700 dark:hover:bg-ink-800')}>{r}</button>
            ))}
          </div>
        </Field>
        <Field label="Feedback for the student" required error={errors.feedback}><Textarea id="iv-feedback" rows={3} value={f.feedback} onChange={(e) => setF({ ...f, feedback: e.target.value })} placeholder="What went well and what to practise next" /></Field>
      </div>
    </Modal>
  );
}

function RescheduleModal({ iv, onClose, onSave }: { iv: Interview; onClose: () => void; onSave: (date: string, time: string, panelIds: string[]) => boolean }) {
  const [date, setDate] = useState(iv.date);
  const [time, setTime] = useState(iv.time);
  const [panel, setPanel] = useState(iv.panel.map((p) => p.id));
  return (
    <Modal open onClose={onClose} title="Reschedule interview" sub={`${iv.studentName} · ${iv.type}`} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => { if (onSave(date, time, panel)) onClose(); }}>Save changes</Button></>}>
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required><Input id="iv-re-date" type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time" required><Input id="iv-re-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <PanelPicker value={panel} onChange={setPanel} />
      </div>
    </Modal>
  );
}
