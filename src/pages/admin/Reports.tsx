import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Download,
  MessageSquarePlus,
  RotateCcw,
  XCircle,
  FileText,
  Clock,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { useReportActions } from '../../store/actions';
import type { DerivedReportStatus } from '../../types';
import {
  classBatchesOn,
  derivedStatus,
  reportFor,
  studentsOf,
  trainerName,
  workFor,
  workMinutes,
  buildSnapshot,
} from '../../store/selectors';
import {
  Badge,
  Button,
  Card,
  Confirm,
  Empty,
  Field,
  Input,
  Menu,
  Modal,
  PageHeader,
  Select,
  Stat,
  Table,
  Textarea,
} from '../../components/common/ui';
import { ExportModal, getStudentVoiceNotes } from '../../components/common/ReportView';
import { cx, fmtDate, fmtDateTime, minutesBetween, todayISO } from '../../utils';

const ALL_STATUSES: DerivedReportStatus[] = [
  'Draft',
  'Pending',
  'Submitted',
  'Overdue',
  'Under Review',
  'Correction Requested',
  'Approved',
  'Rejected',
];

function useActionModals() {
  const act = useReportActions();
  const [m, setM] = useState<{ kind: 'approve' | 'correction' | 'reject' | 'remark'; id: string } | null>(null);
  const [text, setText] = useState('');

  const el = m && (
    m.kind === 'approve' ? (
      <Modal
        open
        onClose={() => setM(null)}
        title="Approve Report"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setM(null)}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => {
                act.approve(m.id, text.trim());
                setM(null);
                setText('');
              }}
            >
              Approve Report
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-300">
          The report will be locked as approved. Your name, review decision and timestamp are recorded, and the trainer is notified.
        </p>
        <Field label="Remark (optional)" className="mt-3">
          <Textarea id="ap-remark" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add any congratulatory note or remark for the trainer..." />
        </Field>
      </Modal>
    ) : m.kind === 'remark' ? (
      <Modal
        open
        onClose={() => setM(null)}
        title="Add Admin Remark"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setM(null)}>
              Cancel
            </Button>
            <Button
              disabled={!text.trim()}
              onClick={() => {
                act.addRemark(m.id, text.trim());
                setM(null);
                setText('');
              }}
            >
              Add Remark
            </Button>
          </>
        }
      >
        <Field label="Remark">
          <Textarea
            id="rm-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your review remark..."
            autoFocus
          />
        </Field>
      </Modal>
    ) : (
      <Confirm
        open
        onClose={() => setM(null)}
        requireReason
        reasonLabel={m.kind === 'correction' ? 'What needs to be corrected? (Mandatory reason)' : 'Reason for rejection (Mandatory reason)'}
        title={m.kind === 'correction' ? 'Request Report Correction' : 'Reject Daily Report'}
        tone={m.kind === 'correction' ? 'accent' : 'danger'}
        confirmLabel={m.kind === 'correction' ? 'Send Correction Request' : 'Reject Report'}
        body={
          m.kind === 'correction'
            ? 'The trainer is notified to make corrections and resubmit. The current submitted version is preserved in history.'
            : 'The report will be closed as rejected. Its full version history and reason are preserved.'
        }
        onConfirm={(r) => (m.kind === 'correction' ? act.requestCorrection(m.id, r) : act.reject(m.id, r))}
      />
    )
  );

  return {
    open: (kind: 'approve' | 'correction' | 'reject' | 'remark', id: string) => {
      setText('');
      setM({ kind, id });
    },
    el,
  };
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

  // rows: every trainer-day with classes
  const keys = new Map<string, { tid: string; date: string }>();
  s.reports.forEach((r) => keys.set(`${r.trainerId}|${r.date}`, { tid: r.trainerId, date: r.date }));
  const dates = date ? [date] : [...new Set(s.reports.map((r) => r.date))];
  dates.forEach((d) =>
    s.trainers.forEach((t) => {
      if (classBatchesOn(s, t.id, d).length) keys.set(`${t.id}|${d}`, { tid: t.id, date: d });
    })
  );

  const rows = [...keys.values()]
    .map(({ tid, date: d }) => {
      const r = reportFor(s, tid, d);
      const st = derivedStatus(s, tid, d);
      const snap = r?.versions.at(-1)?.snapshot ?? buildSnapshot(s, tid, d);
      return { tid, d, r, st, snap };
    })
    .filter(
      (x) =>
        (!date || x.d === date) &&
        (trainer === 'All' || x.tid === trainer) &&
        (course === 'All' || x.snap.batches.some((b) => s.batches.find((y) => y.id === b.batchId)?.courseId === course)) &&
        (batch === 'All' || x.snap.batches.some((b) => b.batchId === batch)) &&
        (sub === 'All' || (sub === 'Submitted' ? (x.r?.versions.length ?? 0) > 0 : !(x.r?.versions.length))) &&
        (status === 'All' || (status === 'Awaiting' ? ['Submitted', 'Under Review'].includes(x.st) : x.st === status))
    )
    .sort((a, b) => b.d.localeCompare(a.d) || a.tid.localeCompare(b.tid));

  const decided = s.reports
    .flatMap((r) => r.events.filter((e) => ['Approved', 'Rejected', 'Correction requested'].includes(e.action)).map((e) => ({ ...e, r })))
    .sort((a, b) => b.at.localeCompare(a.at));
  const count = (st: string) => s.reports.filter((r) => r.status === st).length;

  return (
    <div>
      <PageHeader
        title={approvals ? 'Report Approvals' : 'Daily Reports Management'}
        sub={approvals ? 'Reports waiting for review decisions, and the decisions already made' : 'One consolidated report per trainer per working day'}
      />
      {approvals && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Submitted" value={count('Submitted')} tone="blue" />
          <Stat label="Under Review" value={count('Under Review')} tone="purple" />
          <Stat label="Correction Requested" value={count('Correction Requested')} tone="orange" />
          <Stat label="Approved" value={count('Approved')} tone="green" />
        </div>
      )}
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <Input id="rp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto" />
          {date && (
            <Button size="sm" variant="ghost" onClick={() => setDate('')}>
              All dates
            </Button>
          )}
          <Select id="rp-trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)} className="!w-auto">
            <option value="All">All trainers</option>
            {s.trainers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select id="rp-course" value={course} onChange={(e) => setCourse(e.target.value)} className="!w-auto">
            <option value="All">All courses</option>
            {s.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select id="rp-batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="!w-auto">
            <option value="All">All batches</option>
            {s.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select id="rp-sub" value={sub} onChange={(e) => setSub(e.target.value)} className="!w-auto">
            <option value="All">Any submission</option>
            <option>Submitted</option>
            <option value="Not submitted">Not submitted</option>
          </Select>
          <Select id="rp-status" value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto">
            <option value="All">Any status</option>
            <option value="Awaiting">Awaiting approval</option>
            {ALL_STATUSES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </div>
        <Table
          head={['Trainer', 'Date', 'Batches', 'Attendance', 'Completed', 'Pending', 'Submitted at', 'Status', 'Actions']}
          minW={1050}
          empty={!rows.length && <Empty title="No reports match these filters" />}
        >
          {rows.map(({ tid, d, r, st, snap }) => {
            const present = snap.batches.reduce((a, b) => a + b.present + b.late, 0),
              total = snap.batches.reduce((a, b) => a + b.total, 0);
            const last = r?.versions.at(-1);
            const live = !last;
            const canDecide = r && ['Submitted', 'Under Review'].includes(r.status);
            return (
              <tr key={`${tid}${d}`} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                <td className="whitespace-nowrap font-medium text-ink-900 dark:text-ink-50">{trainerName(s, tid)}</td>
                <td className="whitespace-nowrap">{fmtDate(d)}</td>
                <td className="max-w-[200px] text-xs">
                  <span className="font-semibold text-ink-900 dark:text-ink-100">
                    {snap.batches.length} batch{snap.batches.length === 1 ? '' : 'es'}
                  </span>
                  <br />
                  {snap.batches.map((b) => b.batchName).join(', ')}
                </td>
                <td className="tabular-nums">{total ? `${present}/${total}` : '—'}</td>
                <td className="tabular-nums text-emerald-600">{snap.batches.reduce((a, b) => a + b.completed.length, 0)}</td>
                <td className="tabular-nums text-amber-600">{snap.batches.reduce((a, b) => a + b.partial.length + b.pending.length, 0)}</td>
                <td className="whitespace-nowrap text-xs">
                  {last ? (
                    <>
                      {fmtDateTime(last.submittedAt)}
                      {last.late && (
                        <Badge color="red" dot={false}>
                          Late
                        </Badge>
                      )}
                      {r!.versions.length > 1 && (
                        <Badge color="purple" dot={false}>
                          v{r!.versions.length}
                        </Badge>
                      )}
                    </>
                  ) : live ? (
                    <span className="text-ink-400">Not submitted</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  <Badge>{st}</Badge>
                </td>
                <td className="whitespace-nowrap">
                  {last && (
                    <Button size="sm" variant="secondary" onClick={() => go({ page: 'report', id: r!.id })}>
                      View
                    </Button>
                  )}
                  <Menu
                    items={[
                      { label: 'View review page', onClick: () => go({ page: 'report', id: r!.id }), hidden: !last },
                      { label: 'View voice notes', onClick: () => setDrawer({ kind: 'voice', tid, date: d }) },
                      { label: 'View attendance', onClick: () => setDrawer({ kind: 'att', tid, date: d }) },
                      { label: 'View topic progress', onClick: () => setDrawer({ kind: 'topics', tid, date: d }) },
                      { label: 'Approve', onClick: () => open('approve', r!.id), hidden: !canDecide },
                      { label: 'Request correction', onClick: () => open('correction', r!.id), hidden: !canDecide },
                      { label: 'Reject', onClick: () => open('reject', r!.id), danger: true, hidden: !canDecide },
                      { label: 'Add remarks', onClick: () => open('remark', r!.id), hidden: !last },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {approvals && (
        <Card className="mt-4" title="Approval history" pad={false}>
          <Table
            head={['When', 'Trainer', 'Report date', 'Decision', 'By', 'Reason / remark']}
            minW={760}
            empty={!decided.length && <Empty title="No decisions yet" />}
          >
            {decided.map((e, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(e.at)}</td>
                <td>{trainerName(s, e.r.trainerId)}</td>
                <td>{fmtDate(e.r.date)}</td>
                <td>
                  <Badge>{e.action === 'Correction requested' ? 'Correction Requested' : e.action}</Badge>
                </td>
                <td>{e.by}</td>
                <td className="max-w-sm text-xs">{e.reason ?? '—'}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {el}
      {drawer && <RecordDrawer {...drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

export function RecordDrawer({
  kind,
  tid,
  date,
  onClose,
}: {
  kind: 'att' | 'topics' | 'hours' | 'voice';
  tid: string;
  date: string;
  onClose: () => void;
}) {
  const { state: s } = useApp();
  const batches = classBatchesOn(s, tid, date);
  const title = { att: 'Attendance', topics: 'Topic progress', hours: 'Working hours', voice: 'Student Voice Notes' }[kind];

  return (
    <Modal open onClose={onClose} size="lg" title={`${title} · ${trainerName(s, tid)}`} sub={fmtDate(date)}>
      {kind === 'hours' && (
        <Table head={['Activity', 'Time', 'Duration', 'Batch', 'Description']} minW={560}>
          {workFor(s, tid, date).map((w) => (
            <tr key={w.id}>
              <td>{w.activity}</td>
              <td className="tabular-nums">
                {w.start}–{w.end}
              </td>
              <td className="tabular-nums">{minutesBetween(w.start, w.end)} min</td>
              <td>{s.batches.find((b) => b.id === w.batchId)?.name ?? '—'}</td>
              <td>{w.description}</td>
            </tr>
          ))}
        </Table>
      )}
      {kind === 'voice' &&
        (batches.length ? (
          batches.map((b) => {
            const w = s.waUpdates.find((x) => x.batchId === b.id && x.date === date);
            return (
              <div key={b.id} className="mb-4 rounded-lg border border-ink-100 p-3 dark:border-ink-800">
                <div className="font-display font-bold text-ink-900 dark:text-ink-50">{b.name}</div>
                {w && w.studentIds.length ? (
                  <ul className="mt-2 space-y-1 text-sm text-ink-800 dark:text-ink-100">
                    {w.studentIds.map((id) => {
                      const vItem = w.voiceNotes?.find((v) => v.studentId === id);
                      return (
                        <li key={id} className="flex items-center justify-between">
                          <span>
                            • {s.students.find((x) => x.id === id)?.name ?? id}
                            <span className="text-ink-500"> – {vItem?.title || 'Doubt clarification'}</span>
                          </span>
                          <span className="text-xs text-ink-400">{fmtDate(vItem?.submittedAt || w.savedAt || date)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="mt-1 text-sm italic text-ink-400">No student voice notes submitted.</div>
                )}
              </div>
            );
          })
        ) : (
          <Empty title="No classes on this date" />
        ))}
      {(kind === 'att' || kind === 'topics') &&
        batches.map((b) => (
          <div key={b.id} className="mb-4">
            <div className="mb-1.5 font-display font-bold text-ink-900 dark:text-ink-50">{b.name}</div>
            {kind === 'att' ? (
              (() => {
                const a = s.attendance.find((x) => x.batchId === b.id && x.date === date);
                return (
                  <div className="grid gap-1 sm:grid-cols-2">
                    {studentsOf(s, b.id).map((st) => (
                      <div key={st.id} className="rounded border border-ink-100 px-2 py-1 text-sm dark:border-ink-800">
                        <div className="flex items-center justify-between">
                          <span className="text-ink-700 dark:text-ink-200">{st.name}</span>
                          {a?.marks[st.id] ? <Badge>{a.marks[st.id]}</Badge> : <Badge color="grey">—</Badge>}
                        </div>
                        {a?.reasons?.[st.id] && (a.marks[st.id] === 'Absent' || a.marks[st.id] === 'Leave') && (
                          <div className="text-xs text-ink-500">Reason: {a.reasons[st.id]}</div>
                        )}
                        {a?.marks[st.id] === 'Late' && a.lateTimes?.[st.id] && (
                          <div className="text-xs text-ink-500">Arrived {a.lateTimes[st.id]}</div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <ul className="space-y-1 text-sm">
                {s.progress
                  .filter((p) => p.batchId === b.id && p.date === date)
                  .map((p) => {
                    const t = s.syllabi
                      .flatMap((v) => v.modules.flatMap((m) => m.weeks.flatMap((w) => w.days.flatMap((d) => d.topics))))
                      .find((x) => x.key === p.topicKey);
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-2">
                        <Badge>{p.status}</Badge>
                        <span className="text-ink-800 dark:text-ink-100">{t?.title}</span>
                        {p.reason && <span className="text-xs text-ink-500">— {p.reason}</span>}
                        <span className="ml-auto text-xs text-ink-400">{p.updatedBy ?? ''}</span>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        ))}
    </Modal>
  );
}

/**
 * Admin Daily Report Review Page – Final Version
 * Clean, simple, and professional single-column layout without redundant cards or side panels.
 */
export function ReportDetail({ id }: { id: string }) {
  const { state: s, user, go } = useApp();
  const act = useReportActions();
  const r = s.reports.find((x) => x.id === id);
  const [ver, setVer] = useState<number>(r?.versions.length ?? 1);
  const [exp, setExp] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [inlineRemark, setInlineRemark] = useState('');
  const { open, el } = useActionModals();

  // Enforce Admin review permissions
  const canReview = user?.role === 'admin' && user.canReview !== false;
  const canDecide = canReview && !!r && ['Submitted', 'Under Review'].includes(r.status);

  useEffect(() => {
    if (r?.status === 'Submitted' && user?.role === 'admin') {
      act.openForReview(r.id);
    }
  }, [r?.id, r?.status, user?.role]);

  useEffect(() => {
    if (r) setVer(r.versions.length);
  }, [r?.versions.length]);

  if (!r || !r.versions.length) {
    return (
      <Card>
        <Empty
          title="Report not found or not submitted yet"
          action={<Button onClick={() => go('reports')}>Back to reports</Button>}
        />
      </Card>
    );
  }

  const v = r.versions[ver - 1] ?? r.versions.at(-1)!;
  const snap = v.snapshot;

  // 2. Daily Summary calculations from actual submitted batch reports
  const totalBatches = snap.batches.length;
  const totalAttended = snap.batches.reduce((sum, b) => sum + b.present + b.late, 0);
  const totalCompleted = snap.batches.reduce((sum, b) => sum + b.completed.length, 0);
  const totalPending = snap.batches.reduce((sum, b) => sum + b.partial.length + b.pending.length, 0);

  const shownBatches = selectedBatchId === 'all' ? snap.batches : snap.batches.filter((b) => b.batchId === selectedBatchId);

  const handleInlineAddRemark = () => {
    if (!inlineRemark.trim()) return;
    act.addRemark(r.id, inlineRemark.trim());
    setInlineRemark('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* 1. Report Header */}
      <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm dark:border-ink-800 dark:bg-ink-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-100 pb-4 dark:border-ink-800">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Button size="sm" variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => go('reports')}>
                Back to reports
              </Button>
            </div>
            <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-ink-50">
              {trainerName(s, r.trainerId)}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-ink-600 dark:text-ink-300">
              <span>Report Date: <strong className="text-ink-900 dark:text-ink-100">{fmtDate(r.date)}</strong></span>
              <span>·</span>
              <span>
                Report Status: <Badge color={r.status === 'Approved' ? 'green' : r.status === 'Rejected' ? 'red' : r.status === 'Correction Requested' ? 'orange' : 'blue'}>{r.status}</Badge>
              </span>
              <span>·</span>
              <span>Submission Date: <strong className="text-ink-900 dark:text-ink-100">{fmtDateTime(v.submittedAt)}</strong></span>
              {v.late && <Badge color="red" dot={false}>Late Submission</Badge>}
            </div>
          </div>

          {/* Admin Header Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={<Download size={15} />} onClick={() => setExp(true)}>
              Export PDF
            </Button>
            <Button variant="secondary" icon={<MessageSquarePlus size={15} />} onClick={() => open('remark', r.id)}>
              Add Remarks
            </Button>
            {canDecide && (
              <>
                <Button variant="danger" icon={<XCircle size={15} />} onClick={() => open('reject', r.id)}>
                  Reject
                </Button>
                <Button variant="accent" icon={<RotateCcw size={15} />} onClick={() => open('correction', r.id)}>
                  Request Correction
                </Button>
                <Button variant="success" icon={<CheckCircle2 size={15} />} onClick={() => open('approve', r.id)}>
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Report Version switcher if multiple versions exist */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink-700 dark:text-ink-300">Report Version:</span>
            {r.versions.length > 1 ? (
              <Select
                id="rd-ver"
                value={ver}
                onChange={(e) => setVer(Number(e.target.value))}
                className="!h-8 !py-0 !text-xs font-medium"
              >
                {r.versions.map((x) => (
                  <option key={x.version} value={x.version}>
                    Version {x.version} {x.version === r.versions.length ? '(Latest)' : ''} — submitted {fmtDateTime(x.submittedAt)}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="rounded bg-ink-100 px-2 py-0.5 font-medium text-ink-800 dark:bg-ink-800 dark:text-ink-200">
                Version 1 (Initial Submission)
              </span>
            )}
          </div>
          {r.versions.length > 1 && (
            <span className="text-ink-500">
              Preserving all {r.versions.length} versions · History is never overwritten
            </span>
          )}
        </div>
      </div>

      {/* 2. Daily Summary: Display ONLY Number of Batches, Total Students Attended, Topics Completed, Topics Pending */}
      <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm dark:border-ink-800 dark:bg-ink-900">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          Daily Summary
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-3.5 text-center dark:border-ink-800 dark:bg-ink-950/40">
            <div className="text-xs font-medium text-ink-500">Number of Batches</div>
            <div className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-ink-50">{totalBatches}</div>
          </div>
          <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-3.5 text-center dark:border-ink-800 dark:bg-ink-950/40">
            <div className="text-xs font-medium text-ink-500">Total Students Attended</div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalAttended}</div>
          </div>
          <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-3.5 text-center dark:border-ink-800 dark:bg-ink-950/40">
            <div className="text-xs font-medium text-ink-500">Topics Completed</div>
            <div className="mt-1 font-display text-2xl font-bold text-teal-600 dark:text-teal-400">{totalCompleted}</div>
          </div>
          <div className="rounded-lg border border-ink-100 bg-ink-50/60 p-3.5 text-center dark:border-ink-800 dark:bg-ink-950/40">
            <div className="text-xs font-medium text-ink-500">Topics Pending</div>
            <div className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">{totalPending}</div>
          </div>
        </div>
      </div>

      {/* 3. Batch-wise Reports */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Batch-wise Reports ({snap.batches.length})
          </div>
          {snap.batches.length > 1 && (
            <div className="inline-flex rounded-lg bg-ink-100 p-0.5 dark:bg-ink-800">
              {[{ id: 'all', label: 'All Batches' }, ...snap.batches.map((b) => ({ id: b.batchId, label: b.batchName }))].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelectedBatchId(o.id)}
                  className={cx(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    selectedBatchId === o.id
                      ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white'
                      : 'text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {shownBatches.map((b) => {
          const voiceNotes = getStudentVoiceNotes(b, r.date);
          return (
            <div
              key={b.batchId}
              className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm dark:border-ink-800 dark:bg-ink-900"
            >
              {/* 3.A Batch Details */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3 dark:border-ink-800">
                <div>
                  <h2 className="font-display text-lg font-bold text-ink-900 dark:text-ink-50">{b.batchName}</h2>
                  <div className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">
                    <span className="font-semibold text-ink-800 dark:text-ink-100">Course:</span> {b.course} ·{' '}
                    <span className="font-semibold text-ink-800 dark:text-ink-100">Class Date:</span> {fmtDate(b.classDate || r.date)} ·{' '}
                    <span className="font-semibold text-ink-800 dark:text-ink-100">Class Time:</span> {b.timing}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge color="green" dot={false}>
                    {b.completed.length} Completed
                  </Badge>
                  {b.partial.length > 0 && (
                    <Badge color="orange" dot={false}>
                      {b.partial.length} Partially Completed
                    </Badge>
                  )}
                  {b.pending.length > 0 && (
                    <Badge color="red" dot={false}>
                      {b.pending.length} Not Covered
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-5">
                {/* 3.B Topic Progress */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">
                    Topic Progress
                  </div>
                  <div className="mt-2 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 size={14} className="shrink-0" />
                        Completed ({b.completed.length})
                      </div>
                      {b.completed.length === 0 ? (
                        <div className="text-xs italic text-ink-400">No topics marked completed</div>
                      ) : (
                        <ul className="space-y-1.5 text-sm">
                          {b.completed.map((t) => (
                            <li key={t} className="flex items-start gap-1.5 text-ink-800 dark:text-ink-100">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <CircleDot size={14} className="shrink-0" />
                        Partially Completed ({b.partial.length})
                      </div>
                      {b.partial.length === 0 ? (
                        <div className="text-xs italic text-ink-400">None recorded</div>
                      ) : (
                        <ul className="space-y-1.5 text-sm">
                          {b.partial.map((p, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-ink-800 dark:text-ink-100">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                              <div>
                                <span className="font-medium">{p.title}</span>
                                {p.day && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">({p.day})</span>}
                                {p.note && <div className="text-xs text-ink-500">{p.note}</div>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                        <CircleDashed size={14} className="shrink-0" />
                        Not Covered / Pending ({b.pending.length})
                      </div>
                      {b.pending.length === 0 ? (
                        <div className="text-xs italic text-ink-400">None recorded</div>
                      ) : (
                        <ul className="space-y-1.5 text-sm">
                          {b.pending.map((p, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-ink-800 dark:text-ink-100">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                              <div>
                                <span className="font-medium">{p.title}</span>
                                {p.day && <span className="ml-1 text-xs text-rose-700 dark:text-rose-400">({p.day})</span>}
                                {p.note && <div className="text-xs text-ink-500">{p.note}</div>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3.C Attendance */}
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">
                    Attendance
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-ink-50 p-3 sm:grid-cols-5 dark:bg-ink-800/40">
                    <div>
                      <div className="text-[11px] text-ink-500">Total Students</div>
                      <div className="font-display text-lg font-bold text-ink-900 dark:text-ink-50">{b.total}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400">Present</div>
                      <div className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-300">{b.present}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-rose-600 dark:text-rose-400">Absent</div>
                      <div className="font-display text-lg font-bold text-rose-700 dark:text-rose-300">{b.absent}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">Leave</div>
                      <div className="font-display text-lg font-bold text-amber-700 dark:text-amber-300">{b.leave}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-royal-600 dark:text-royal-400">Late</div>
                      <div className="font-display text-lg font-bold text-royal-700 dark:text-royal-300">{b.late}</div>
                    </div>
                  </div>

                  {(b.absentees?.length || b.onLeave?.length || b.lateList?.length) ? (
                    <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
                      <div className="rounded border border-ink-100 p-2.5 dark:border-ink-800">
                        <span className="font-semibold text-rose-700 dark:text-rose-400">Absent students & reasons:</span>
                        {b.absentees?.length ? (
                          <ul className="mt-1 space-y-1">
                            {b.absentees.map((x) => (
                              <li key={x.name}>
                                <span className="font-medium text-ink-900 dark:text-ink-100">{x.name}</span> — {x.reason || 'No reason provided'}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-0.5 text-ink-400">None</div>
                        )}
                      </div>
                      <div className="rounded border border-ink-100 p-2.5 dark:border-ink-800">
                        <span className="font-semibold text-amber-700 dark:text-amber-400">On leave & reasons:</span>
                        {b.onLeave?.length ? (
                          <ul className="mt-1 space-y-1">
                            {b.onLeave.map((x) => (
                              <li key={x.name}>
                                <span className="font-medium text-ink-900 dark:text-ink-100">{x.name}</span> — {x.reason || 'No reason provided'}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-0.5 text-ink-400">None</div>
                        )}
                      </div>
                      <div className="rounded border border-ink-100 p-2.5 dark:border-ink-800">
                        <span className="font-semibold text-royal-700 dark:text-royal-400">Late arrivals:</span>
                        {b.lateList?.length ? (
                          <ul className="mt-1 space-y-1">
                            {b.lateList.map((x) => (
                              <li key={x.name}>
                                <span className="font-medium text-ink-900 dark:text-ink-100">{x.name}</span> — arrived {x.time || '—'}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-0.5 text-ink-400">None</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* 3.D Practical Activities & 3.E Homework / Assignments */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
                    <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">
                      Practical Activities
                    </div>
                    <div className="mt-2 text-sm text-ink-800 dark:text-ink-100">
                      {b.practicalList && b.practicalList.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4">
                          {b.practicalList.map((p) => (
                            <li key={p.id}>
                              <span className="text-xs font-semibold text-ink-500">{p.type}:</span> {p.text}
                            </li>
                          ))}
                        </ul>
                      ) : b.practicals ? (
                        <p>{b.practicals}</p>
                      ) : (
                        <div className="text-xs italic text-ink-400">No practical activities conducted</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
                    <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">
                      Homework / Assignments
                    </div>
                    <div className="mt-2 text-sm text-ink-800 dark:text-ink-100">
                      {b.assignmentList && b.assignmentList.length > 0 ? (
                        <ul className="space-y-1.5">
                          {b.assignmentList.map((a) => (
                            <li key={a.id} className="border-b border-ink-100/60 pb-1.5 last:border-0 dark:border-ink-800/60">
                              <div className="font-medium text-ink-900 dark:text-ink-50">
                                {a.name}
                                {a.deadline && (
                                  <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">
                                    (Due: {fmtDate(a.deadline)})
                                  </span>
                                )}
                              </div>
                              {a.description && <div className="text-xs text-ink-600 dark:text-ink-300">{a.description}</div>}
                            </li>
                          ))}
                        </ul>
                      ) : b.homework ? (
                        <p>{b.homework}</p>
                      ) : (
                        <div className="text-xs italic text-ink-400">No homework or assignments given</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3.F Student Difficulties & 3.G Student Voice Notes */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
                    <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">
                      Student Difficulties
                    </div>
                    <div className="mt-2 text-sm text-ink-800 dark:text-ink-100">
                      {b.doubtList && b.doubtList.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4">
                          {b.doubtList.map((d) => (
                            <li key={d.id}>
                              <span className="text-xs font-semibold text-ink-500">{d.type}:</span> {d.text}
                            </li>
                          ))}
                        </ul>
                      ) : b.doubts ? (
                        <p>{b.doubts}</p>
                      ) : (
                        <div className="text-xs italic text-ink-400">No student difficulties recorded</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
                    <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">
                      Student Voice Notes – {b.batchName}
                    </div>
                    <div className="mt-2">
                      {voiceNotes.length > 0 ? (
                        <ul className="space-y-1.5 text-sm">
                          {voiceNotes.map((vn, i) => (
                            <li
                              key={i}
                              className="flex flex-wrap items-center justify-between gap-1 border-b border-ink-100/60 pb-1 last:border-0 dark:border-ink-800/60"
                            >
                              <span className="font-medium text-ink-900 dark:text-ink-50">
                                • {vn.studentName} <span className="font-normal text-ink-600 dark:text-ink-300">– {vn.title}</span>
                              </span>
                              <span className="text-[11px] text-ink-400">
                                Submitted: {fmtDate(vn.submittedAt || vn.date || r.date)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs italic text-ink-400">No student voice notes submitted</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3.H Project Updates */}
                <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">
                    Project Updates
                  </div>
                  <div className="mt-2">
                    {b.projects && b.projects.length > 0 ? (
                      <div className="space-y-2">
                        {b.projects.map((p) => (
                          <div
                            key={p.id}
                            className="rounded-lg border border-ink-100 bg-ink-50/40 p-3 dark:border-ink-800 dark:bg-ink-950/30"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-ink-900 dark:text-ink-50">{p.name}</span>
                              <Badge color={p.status === 'Completed' ? 'green' : p.status === 'In Progress' ? 'blue' : 'grey'}>
                                {p.status}
                              </Badge>
                            </div>
                            <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                              <div>
                                <dt className="inline font-medium text-ink-500">Work Completed Today: </dt>
                                <dd className="inline text-ink-800 dark:text-ink-100">{p.workDone || '—'}</dd>
                              </div>
                              <div>
                                <dt className="inline font-medium text-ink-500">New Project / Assignment Assigned: </dt>
                                <dd className="inline text-ink-800 dark:text-ink-100">{p.assigned || '—'}</dd>
                              </div>
                              <div>
                                <dt className="inline font-medium text-ink-500">Students Assigned: </dt>
                                <dd className="inline text-ink-800 dark:text-ink-100">{p.students || '—'}</dd>
                              </div>
                              {p.remarks && (
                                <div>
                                  <dt className="inline font-medium text-ink-500">Remarks: </dt>
                                  <dd className="inline text-ink-800 dark:text-ink-100">{p.remarks}</dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs italic text-ink-400">No project updates</div>
                    )}
                  </div>
                </div>

                {/* 3.I Next Class Plan */}
                <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">
                    Next Class Plan
                  </div>
                  <div className="mt-2 space-y-1 text-sm text-ink-800 dark:text-ink-100">
                    <div>
                      <span className="font-medium text-ink-600 dark:text-ink-300">Plan: </span>
                      {b.nextPlan || 'Continue with next scheduled syllabus topic'}
                    </div>
                    {b.batchRemarks && (
                      <div className="mt-1 border-t border-ink-100 pt-1 text-xs text-ink-600 dark:border-ink-800 dark:text-ink-300">
                        <span className="font-semibold text-ink-700 dark:text-ink-200">Additional trainer remarks: </span>
                        {b.batchRemarks}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Admin Remarks and Review Section */}
      <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm dark:border-ink-800 dark:bg-ink-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3 dark:border-ink-800">
          <div>
            <div className="font-display text-base font-bold text-ink-900 dark:text-ink-50">
              Admin Remarks & Review Decision
            </div>
            <div className="text-xs text-ink-500">
              Provide your review remarks and take action on this report.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-600 dark:text-ink-300">Current Status:</span>
            <Badge color={r.status === 'Approved' ? 'green' : r.status === 'Rejected' ? 'red' : r.status === 'Correction Requested' ? 'orange' : 'blue'}>
              {r.status}
            </Badge>
          </div>
        </div>

        {/* Existing Admin Remarks */}
        <div className="mt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Previous Remarks ({r.adminRemarks.length})
          </div>
          {r.adminRemarks.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {r.adminRemarks.map((m, i) => (
                <li key={i} className="rounded-lg bg-ink-50 px-3.5 py-2.5 text-sm dark:bg-ink-800/50">
                  <div className="text-ink-900 dark:text-ink-50">{m.text}</div>
                  <div className="mt-1 text-xs text-ink-500">
                    By <span className="font-medium text-ink-700 dark:text-ink-300">{m.by}</span> · {fmtDateTime(m.at)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 text-xs italic text-ink-400">No remarks added yet.</div>
          )}
        </div>

        {/* Remarks Input Area */}
        <div className="mt-4">
          <Field label="Add Review Remark">
            <Textarea
              id="admin-review-remark"
              rows={3}
              value={inlineRemark}
              onChange={(e) => setInlineRemark(e.target.value)}
              placeholder="Enter remarks, observations, or instructions for the trainer..."
            />
          </Field>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={!inlineRemark.trim()}
              onClick={handleInlineAddRemark}
            >
              Save Remark Only
            </Button>

            {canDecide ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="danger"
                  icon={<XCircle size={15} />}
                  onClick={() => open('reject', r.id)}
                >
                  Reject Report
                </Button>
                <Button
                  variant="accent"
                  icon={<RotateCcw size={15} />}
                  onClick={() => open('correction', r.id)}
                >
                  Request Correction
                </Button>
                <Button
                  variant="success"
                  icon={<CheckCircle2 size={15} />}
                  onClick={() => {
                    if (inlineRemark.trim()) {
                      act.approve(r.id, inlineRemark.trim());
                      setInlineRemark('');
                    } else {
                      open('approve', r.id);
                    }
                  }}
                >
                  Approve Report
                </Button>
              </div>
            ) : (
              <span className="text-xs text-ink-400">
                {r.status === 'Approved'
                  ? 'This report is approved and locked.'
                  : r.status === 'Rejected'
                  ? 'This report is rejected and closed.'
                  : 'Review decision completed.'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Report History */}
      <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm dark:border-ink-800 dark:bg-ink-900">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Report Version History ({r.events.length} Events · {r.versions.length} Version{r.versions.length === 1 ? '' : 's'})
          </div>
          <span className="text-xs text-ink-400">Chronological submission audit</span>
        </div>
        <ol className="relative space-y-4 border-l border-ink-200 pl-4 dark:border-ink-700">
          {[...r.events].reverse().map((e, i) => (
            <li key={i} className="relative">
              <span
                className={cx(
                  'absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-ink-900',
                  /Approved/.test(e.action)
                    ? 'bg-emerald-500'
                    : /Reject/.test(e.action)
                    ? 'bg-red-500'
                    : /Correction/.test(e.action)
                    ? 'bg-amber-500'
                    : /Resubmitted/.test(e.action)
                    ? 'bg-purple-500'
                    : 'bg-royal-500'
                )}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink-900 dark:text-ink-100">{e.action}</span>
                <span className="text-xs text-ink-400">by {e.by}</span>
                <span className="text-xs text-ink-400">· {fmtDateTime(e.at)}</span>
              </div>
              {e.reason && (
                <div className="mt-1 rounded bg-ink-50 px-2.5 py-1 text-xs text-ink-700 dark:bg-ink-800/60 dark:text-ink-300">
                  <span className="font-medium text-ink-900 dark:text-ink-100">Note / Reason: </span>
                  {e.reason}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      {el}
      {exp && <ExportModal open onClose={() => setExp(false)} snapshot={v.snapshot} />}
    </div>
  );
}
