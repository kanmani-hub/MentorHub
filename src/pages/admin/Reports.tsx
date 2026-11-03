import { useEffect, useState } from 'react';
import { CheckCircle2, Download, MessageSquarePlus, RotateCcw, XCircle, Mic, CalendarCheck, ListChecks, Clock } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { useReportActions } from '../../store/actions';
import type { DerivedReportStatus } from '../../types';
import { classBatchesOn, derivedStatus, reportFor, studentsOf, trainerName, workFor, workMinutes, buildSnapshot } from '../../store/selectors';
import { Badge, Button, Card, Confirm, Empty, Field, Input, Menu, Modal, PageHeader, Select, Stat, Table, Textarea } from '../../components/common/ui';
import { ExportModal, FakePlayer, ReportView } from '../../components/common/ReportView';
import { cx, fmtDate, fmtDateTime, fmtMins, minutesBetween, todayISO } from '../../utils';

const ALL_STATUSES: DerivedReportStatus[] = ['Draft', 'Pending', 'Submitted', 'Overdue', 'Under Review', 'Correction Requested', 'Approved', 'Rejected'];

function useActionModals() {
  const act = useReportActions();
  const [m, setM] = useState<{ kind: 'approve' | 'correction' | 'reject' | 'remark'; id: string } | null>(null);
  const [text, setText] = useState('');
  const el = m && (
    m.kind === 'approve' ? (
      <Modal open onClose={() => setM(null)} title="Approve report" size="sm" footer={<><Button variant="secondary" onClick={() => setM(null)}>Cancel</Button><Button variant="success" onClick={() => { act.approve(m.id, text.trim()); setM(null); setText(''); }}>Approve</Button></>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">The report is locked as approved, your name and the time are recorded, and the trainer is notified.</p>
        <Field label="Remark (optional)" className="mt-3"><Textarea id="ap-remark" value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </Modal>
    ) : m.kind === 'remark' ? (
      <Modal open onClose={() => setM(null)} title="Add remark" size="sm" footer={<><Button variant="secondary" onClick={() => setM(null)}>Cancel</Button><Button disabled={!text.trim()} onClick={() => { act.addRemark(m.id, text.trim()); setM(null); setText(''); }}>Add remark</Button></>}>
        <Field label="Remark"><Textarea id="rm-text" value={text} onChange={(e) => setText(e.target.value)} autoFocus /></Field>
      </Modal>
    ) : (
      <Confirm open onClose={() => setM(null)} requireReason reasonLabel={m.kind === 'correction' ? 'What needs to be corrected?' : 'Reason for rejection'}
        title={m.kind === 'correction' ? 'Request correction' : 'Reject report'} tone={m.kind === 'correction' ? 'accent' : 'danger'} confirmLabel={m.kind === 'correction' ? 'Send to trainer' : 'Reject report'}
        body={m.kind === 'correction' ? 'The trainer is notified and can edit and resubmit. The current version is preserved.' : 'The report is closed as rejected. Its full history is preserved.'}
        onConfirm={(r) => (m.kind === 'correction' ? act.requestCorrection(m.id, r) : act.reject(m.id, r))} />
    )
  );
  return { open: (kind: 'approve' | 'correction' | 'reject' | 'remark', id: string) => { setText(''); setM({ kind, id }); }, el };
}

export default function Reports({ approvals = false }: { approvals?: boolean }) {
  const { state: s, go } = useApp();
  const [date, setDate] = useState(approvals ? '' : todayISO());
  const [trainer, setTrainer] = useState('All');
  const [course, setCourse] = useState('All');
  const [batch, setBatch] = useState('All');
  const [sub, setSub] = useState('All');
  const [status, setStatus] = useState(approvals ? 'Awaiting' : 'All');
  const { open, el } = useActionModals();
  const [drawer, setDrawer] = useState<{ kind: 'att' | 'topics' | 'hours' | 'voice'; tid: string; date: string } | null>(null);

  // rows: every trainer-day with classes (existing reports + missing ones for the chosen date)
  const keys = new Map<string, { tid: string; date: string }>();
  s.reports.forEach((r) => keys.set(`${r.trainerId}|${r.date}`, { tid: r.trainerId, date: r.date }));
  const dates = date ? [date] : [...new Set(s.reports.map((r) => r.date))];
  dates.forEach((d) => s.trainers.forEach((t) => { if (classBatchesOn(s, t.id, d).length) keys.set(`${t.id}|${d}`, { tid: t.id, date: d }); }));
  const rows = [...keys.values()].map(({ tid, date: d }) => {
    const r = reportFor(s, tid, d);
    const st = derivedStatus(s, tid, d);
    const snap = r?.versions.at(-1)?.snapshot ?? buildSnapshot(s, tid, d);
    return { tid, d, r, st, snap };
  }).filter((x) => (!date || x.d === date) && (trainer === 'All' || x.tid === trainer)
    && (course === 'All' || x.snap.batches.some((b) => s.batches.find((y) => y.id === b.batchId)?.courseId === course))
    && (batch === 'All' || x.snap.batches.some((b) => b.batchId === batch))
    && (sub === 'All' || (sub === 'Submitted' ? (x.r?.versions.length ?? 0) > 0 : !(x.r?.versions.length)))
    && (status === 'All' || (status === 'Awaiting' ? ['Submitted', 'Under Review'].includes(x.st) : x.st === status)))
    .sort((a, b) => b.d.localeCompare(a.d) || a.tid.localeCompare(b.tid));

  const decided = s.reports.flatMap((r) => r.events.filter((e) => ['Approved', 'Rejected', 'Correction requested'].includes(e.action)).map((e) => ({ ...e, r }))).sort((a, b) => b.at.localeCompare(a.at));
  const count = (st: string) => s.reports.filter((r) => r.status === st).length;
  return (
    <div>
      <PageHeader title={approvals ? 'Report Approvals' : 'Daily Reports Management'} sub={approvals ? 'Reports waiting for a decision, and the decisions already made' : 'One consolidated report per trainer per working day'} />
      {approvals && <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Submitted" value={count('Submitted')} tone="blue" /><Stat label="Under review" value={count('Under Review')} tone="purple" /><Stat label="Correction requested" value={count('Correction Requested')} tone="orange" /><Stat label="Approved" value={count('Approved')} tone="green" /></div>}
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <Input id="rp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto" />
          {date && <Button size="sm" variant="ghost" onClick={() => setDate('')}>All dates</Button>}
          <Select id="rp-trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)} className="!w-auto"><option value="All">All trainers</option>{s.trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          <Select id="rp-course" value={course} onChange={(e) => setCourse(e.target.value)} className="!w-auto"><option value="All">All courses</option>{s.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select id="rp-batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="!w-auto"><option value="All">All batches</option>{s.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Select id="rp-sub" value={sub} onChange={(e) => setSub(e.target.value)} className="!w-auto"><option value="All">Any submission</option><option>Submitted</option><option value="Not submitted">Not submitted</option></Select>
          <Select id="rp-status" value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto"><option value="All">Any status</option><option value="Awaiting">Awaiting approval</option>{ALL_STATUSES.map((x) => <option key={x}>{x}</option>)}</Select>
        </div>
        <Table head={['Trainer', 'Date', 'Batches', 'Attendance', 'Completed', 'Pending', 'Teaching time', 'Submitted at', 'Status', 'Actions']} minW={1150} empty={!rows.length && <Empty title="No reports match these filters" />}>
          {rows.map(({ tid, d, r, st, snap }) => {
            const present = snap.batches.reduce((a, b) => a + b.present + b.late, 0), total = snap.batches.reduce((a, b) => a + b.total, 0);
            const last = r?.versions.at(-1);
            const live = !last;
            const canDecide = r && ['Submitted', 'Under Review'].includes(r.status);
            return (
              <tr key={`${tid}${d}`} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                <td className="whitespace-nowrap font-medium text-ink-900 dark:text-ink-50">{trainerName(s, tid)}</td>
                <td className="whitespace-nowrap">{fmtDate(d)}</td>
                <td className="max-w-[200px] text-xs"><span className="font-semibold text-ink-900 dark:text-ink-100">{snap.batches.length} batch{snap.batches.length === 1 ? '' : 'es'}</span><br />{snap.batches.map((b) => b.batchName).join(', ')}</td>
                <td className="tabular-nums">{total ? `${present}/${total}` : '—'}</td>
                <td className="tabular-nums text-emerald-600">{snap.batches.reduce((a, b) => a + b.completed.length, 0)}</td>
                <td className="tabular-nums text-amber-600">{snap.batches.reduce((a, b) => a + b.partial.length + b.pending.length, 0)}</td>
                <td className="whitespace-nowrap tabular-nums">{fmtMins(snap.teachingMinutes)}</td>
                <td className="whitespace-nowrap text-xs">{last ? <>{fmtDateTime(last.submittedAt)}{last.late && <Badge color="red" dot={false}>Late</Badge>}{r!.versions.length > 1 && <Badge color="purple" dot={false}>v{r!.versions.length}</Badge>}</> : live ? <span className="text-ink-400">Not submitted</span> : '—'}</td>
                <td><Badge>{st}</Badge></td>
                <td className="whitespace-nowrap">
                  {last && <Button size="sm" variant="secondary" onClick={() => go({ page: 'report', id: r!.id })}>View</Button>}
                  <Menu items={[
                    { label: 'View report', onClick: () => go({ page: 'report', id: r!.id }), hidden: !last },
                    { label: 'View WhatsApp updates', onClick: () => setDrawer({ kind: 'voice', tid, date: d }) },
                    { label: 'View attendance', onClick: () => setDrawer({ kind: 'att', tid, date: d }) },
                    { label: 'View topic progress', onClick: () => setDrawer({ kind: 'topics', tid, date: d }) },
                    { label: 'Approve', onClick: () => open('approve', r!.id), hidden: !canDecide },
                    { label: 'Request correction', onClick: () => open('correction', r!.id), hidden: !canDecide },
                    { label: 'Reject', onClick: () => open('reject', r!.id), danger: true, hidden: !canDecide },
                    { label: 'Add remarks', onClick: () => open('remark', r!.id), hidden: !last },
                  ]} />
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {approvals && (
        <Card className="mt-4" title="Approval history" pad={false}>
          <Table head={['When', 'Trainer', 'Report date', 'Decision', 'By', 'Reason / remark']} minW={760} empty={!decided.length && <Empty title="No decisions yet" />}>
            {decided.map((e, i) => <tr key={i}><td className="whitespace-nowrap text-xs">{fmtDateTime(e.at)}</td><td>{trainerName(s, e.r.trainerId)}</td><td>{fmtDate(e.r.date)}</td><td><Badge>{e.action === 'Correction requested' ? 'Correction Requested' : e.action}</Badge></td><td>{e.by}</td><td className="max-w-sm text-xs">{e.reason ?? '—'}</td></tr>)}
          </Table>
        </Card>
      )}
      {el}
      {drawer && <RecordDrawer {...drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

export function RecordDrawer({ kind, tid, date, onClose }: { kind: 'att' | 'topics' | 'hours' | 'voice'; tid: string; date: string; onClose: () => void }) {
  const { state: s } = useApp();
  const batches = classBatchesOn(s, tid, date);
  const title = { att: 'Attendance', topics: 'Topic progress', hours: 'Working hours', voice: 'WhatsApp student updates' }[kind];
  return (
    <Modal open onClose={onClose} size="lg" title={`${title} · ${trainerName(s, tid)}`} sub={fmtDate(date)}>
      {kind === 'hours' && (
        <Table head={['Activity', 'Time', 'Duration', 'Batch', 'Description']} minW={560}>
          {workFor(s, tid, date).map((w) => <tr key={w.id}><td>{w.activity}</td><td className="tabular-nums">{w.start}–{w.end}</td><td className="tabular-nums">{fmtMins(minutesBetween(w.start, w.end))}</td><td>{s.batches.find((b) => b.id === w.batchId)?.name ?? '—'}</td><td>{w.description}</td></tr>)}
          <tr><td colSpan={2} className="font-semibold">Total</td><td className="font-semibold tabular-nums">{fmtMins(workMinutes(s, tid, date).total)}</td><td colSpan={2} className="text-xs text-ink-500">Teaching {fmtMins(workMinutes(s, tid, date).teaching)}</td></tr>
        </Table>
      )}
      {kind === 'voice' && (batches.length ? batches.map((b) => { const w = s.waUpdates.find((x) => x.batchId === b.id && x.date === date); return (
        <div key={b.id} className="mb-3"><div className="font-display font-bold text-ink-900 dark:text-ink-50">{b.name}</div>
          {w && w.studentIds.length ? <ul className="mt-1 list-disc pl-5 text-sm text-ink-800 dark:text-ink-100">{w.studentIds.map((id) => <li key={id}>{s.students.find((x) => x.id === id)?.name}</li>)}</ul> : <div className="text-sm text-ink-500">No students recorded.</div>}
        </div>); }) : <Empty title="No classes on this date" />)}
      {(kind === 'att' || kind === 'topics') && batches.map((b) => (
        <div key={b.id} className="mb-4">
          <div className="mb-1.5 font-display font-bold text-ink-900 dark:text-ink-50">{b.name}</div>
          {kind === 'att' ? (() => { const a = s.attendance.find((x) => x.batchId === b.id && x.date === date); return (
            <div className="grid gap-1 sm:grid-cols-2">{studentsOf(s, b.id).map((st) => <div key={st.id} className="rounded border border-ink-100 px-2 py-1 text-sm dark:border-ink-800"><div className="flex items-center justify-between"><span className="text-ink-700 dark:text-ink-200">{st.name}</span>{a?.marks[st.id] ? <Badge>{a.marks[st.id]}</Badge> : <Badge color="grey">—</Badge>}</div>{a?.reasons?.[st.id] && (a.marks[st.id] === 'Absent' || a.marks[st.id] === 'Leave') && <div className="text-xs text-ink-500">Reason: {a.reasons[st.id]}</div>}{a?.marks[st.id] === 'Late' && a.lateTimes?.[st.id] && <div className="text-xs text-ink-500">Arrived {a.lateTimes[st.id]}</div>}</div>)}</div>
          ); })() : (
            <ul className="space-y-1 text-sm">{s.progress.filter((p) => p.batchId === b.id && p.date === date).map((p) => { const t = s.syllabi.flatMap((v) => v.modules.flatMap((m) => m.weeks.flatMap((w) => w.days.flatMap((d) => d.topics)))).find((x) => x.key === p.topicKey); return <li key={p.id} className="flex flex-wrap items-center gap-2"><Badge>{p.status}</Badge><span className="text-ink-800 dark:text-ink-100">{t?.title}</span>{p.reason && <span className="text-xs text-ink-500">— {p.reason}</span>}<span className="ml-auto text-xs text-ink-400">{p.updatedBy ?? ''}</span></li>; })}</ul>
          )}
        </div>
      ))}
    </Modal>
  );
}

export function ReportDetail({ id }: { id: string }) {
  const { state: s, go } = useApp();
  const act = useReportActions();
  const r = s.reports.find((x) => x.id === id);
  const [ver, setVer] = useState<number>(r?.versions.length ?? 1);
  const [exp, setExp] = useState(false);
  const [drawer, setDrawer] = useState<'att' | 'topics' | 'hours' | 'voice' | null>(null);
  const { open, el } = useActionModals();
  useEffect(() => { if (r?.status === 'Submitted') act.openForReview(r.id); /* eslint-disable-next-line */ }, [r?.id]);
  useEffect(() => { if (r) setVer(r.versions.length); }, [r?.versions.length]);
  if (!r || !r.versions.length) return <Card><Empty title="Report not found or not submitted yet" action={<Button onClick={() => go('reports')}>Back to reports</Button>} /></Card>;
  const v = r.versions[ver - 1] ?? r.versions.at(-1)!;
  const canDecide = ['Submitted', 'Under Review'].includes(r.status);
  return (
    <div>
      <PageHeader back={() => go('reports')} title={`${trainerName(s, r.trainerId)} · ${fmtDate(r.date)}`} sub={<span className="inline-flex flex-wrap items-center gap-2"><Badge>{r.status}</Badge> Version {v.version} submitted {fmtDateTime(v.submittedAt)}{v.late && <Badge color="red" dot={false}>Late</Badge>}</span>}
        actions={<>
          <Button variant="secondary" icon={<Download size={15} />} onClick={() => setExp(true)}>Export</Button>
          <Button variant="secondary" icon={<MessageSquarePlus size={15} />} onClick={() => open('remark', r.id)}>Add remarks</Button>
          {canDecide && <>
            <Button variant="danger" icon={<XCircle size={15} />} onClick={() => open('reject', r.id)}>Reject</Button>
            <Button variant="accent" icon={<RotateCcw size={15} />} onClick={() => open('correction', r.id)}>Request correction</Button>
            <Button variant="success" icon={<CheckCircle2 size={15} />} onClick={() => open('approve', r.id)}>Approve</Button>
          </>}
        </>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card title="Consolidated report" subtitle="Locked snapshot as submitted. Later edits create a new version." action={r.versions.length > 1 && (
          <Select id="rd-ver" value={ver} onChange={(e) => setVer(Number(e.target.value))} className="!w-auto">{r.versions.map((x) => <option key={x.version} value={x.version}>Version {x.version}{x.version === r.versions.length ? ' (latest)' : ''}</option>)}</Select>
        )}>
          <ReportView s={v.snapshot} />
        </Card>
        <div className="space-y-4">
          <Card title="Source records">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={<CalendarCheck size={14} />} onClick={() => setDrawer('att')}>Attendance</Button>
              <Button variant="secondary" icon={<ListChecks size={14} />} onClick={() => setDrawer('topics')}>Topics</Button>
              <Button variant="secondary" icon={<Mic size={14} />} onClick={() => setDrawer('voice')}>WhatsApp</Button>
            </div>
          </Card>
          <Card title="Admin remarks">
            {r.adminRemarks.length ? <ul className="space-y-2">{r.adminRemarks.map((m, i) => <li key={i} className="rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800/50"><div className="text-ink-800 dark:text-ink-100">{m.text}</div><div className="text-xs text-ink-500">{m.by} · {fmtDateTime(m.at)}</div></li>)}</ul> : <div className="text-sm text-ink-500">No remarks yet.</div>}
          </Card>
          <Card title="History">
            <ol className="relative space-y-3 border-l border-ink-200 pl-4 dark:border-ink-700">
              {[...r.events].reverse().map((e, i) => (
                <li key={i} className="relative">
                  <span className={cx('absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-ink-900', /Approved/.test(e.action) ? 'bg-emerald-500' : /Reject/.test(e.action) ? 'bg-red-500' : /Correction/.test(e.action) ? 'bg-amber-500' : 'bg-royal-500')} />
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-100">{e.action}</div>
                  <div className="text-xs text-ink-500">{e.by} · {fmtDateTime(e.at)}</div>
                  {e.reason && <div className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">{e.reason}</div>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
      {el}
      {exp && <ExportModal open onClose={() => setExp(false)} snapshot={v.snapshot} />}
      {drawer && <RecordDrawer kind={drawer} tid={r.trainerId} date={r.date} onClose={() => setDrawer(null)} />}
    </div>
  );
}
