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
import { BatchBlock, ExportModal } from '../../components/common/ReportView';
import { ReviewerStatusList } from '../trainer/Report';
import { assignedTo, myReview, reviewProgress, versionReviewerIds } from '../../store/reviews';
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

/** Admin's own review queue: only reports where this admin is one of the trainer's selected reviewers. */
export function AssignedReports() {
  const { state: s, user, go } = useApp();
  const me = user!.id;
  const [date, setDate] = useState('');
  const [trainer, setTrainer] = useState('All');
  const [course, setCourse] = useState('All');
  const [batch, setBatch] = useState('All');
  const [status, setStatus] = useState('Awaiting');
  const mine = assignedTo(s, me);
  const name = (id: string) => s.users.find((u) => u.id === id)?.name ?? 'Former admin';
  const rows = mine
    .map((r) => ({ r, snap: r.versions.at(-1)!.snapshot, my: myReview(r, me), prog: reviewProgress(r) }))
    .filter(({ r, snap, my }) =>
      (!date || r.date === date) &&
      (trainer === 'All' || r.trainerId === trainer) &&
      (course === 'All' || snap.batches.some((b) => s.batches.find((y) => y.id === b.batchId)?.courseId === course)) &&
      (batch === 'All' || snap.batches.some((b) => b.batchId === batch)) &&
      (status === 'All' || (status === 'Awaiting' ? my.awaiting : r.status === status)))
    .sort((a, b) => Number(b.my.awaiting) - Number(a.my.awaiting) || b.r.date.localeCompare(a.r.date));
  const myDecisions = mine.flatMap((r) => (r.reviewHistory ?? []).filter((h) => h.reviewerId === me).map((h) => ({ h, r }))).sort((a, b) => b.h.reviewedAt.localeCompare(a.h.reviewedAt));
  const courseNames = (snapBatches: { batchId: string }[]) => [...new Set(snapBatches.map((b) => s.courses.find((c) => c.id === s.batches.find((y) => y.id === b.batchId)?.courseId)?.name).filter(Boolean))].join(', ');
  return (
    <div>
      <PageHeader title="Reports Assigned to Me" sub="Consolidated daily reports where a trainer selected you as an Admin Reviewer" />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <Input id="ar-date" type="date" aria-label="Report date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto" />
          {date && <Button size="sm" variant="ghost" onClick={() => setDate('')}>All dates</Button>}
          <Select id="ar-trainer" aria-label="Trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)} className="!w-auto"><option value="All">All trainers</option>{s.trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          <Select id="ar-batch" aria-label="Batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="!w-auto"><option value="All">All batches</option>{s.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Select id="ar-course" aria-label="Course" value={course} onChange={(e) => setCourse(e.target.value)} className="!w-auto"><option value="All">All courses</option>{s.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select id="ar-status" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto">
            <option value="Awaiting">Awaiting my review</option><option value="All">All statuses</option>
            {['Submitted', 'Under Review', 'Correction Requested', 'Approved', 'Rejected'].map((x) => <option key={x}>{x}</option>)}
          </Select>
        </div>
        <Table head={['Trainer', 'Course', 'Batches', 'Report date', 'Submitted', 'Admin reviewers', 'Review status', '']} minW={1000}
          empty={!rows.length && <Empty title={mine.length ? 'No assigned reports match these filters' : 'No reports have been assigned to you yet'} body={mine.length ? undefined : 'Reports appear here when a trainer selects you as a reviewer.'} />}>
          {rows.map(({ r, snap, my, prog }) => (
            <tr key={r.id} className={my.awaiting ? 'bg-violet-50/40 dark:bg-violet-500/5' : ''}>
              <td className="whitespace-nowrap font-medium text-ink-900 dark:text-ink-50">{trainerName(s, r.trainerId)}</td>
              <td className="max-w-[160px] text-xs">{courseNames(snap.batches)}</td>
              <td className="max-w-[180px] text-xs">{snap.batches.map((b) => b.batchName).join(', ')}</td>
              <td className="whitespace-nowrap">{fmtDate(r.date)}</td>
              <td className="whitespace-nowrap text-xs">{fmtDateTime(r.versions.at(-1)!.submittedAt)}{r.versions.length > 1 && <Badge color="purple" dot={false}>v{r.versions.length}</Badge>}</td>
              <td className="max-w-[200px] text-xs">{versionReviewerIds(r).map((id) => <span key={id} className={cx('mr-1 inline-block', id === me && 'font-semibold text-ink-900 dark:text-ink-50')}>{name(id)}{id === me ? ' (you)' : ''}</span>)}</td>
              <td className="whitespace-nowrap"><Badge>{r.status}</Badge><div className="mt-0.5 text-xs text-ink-500">{prog.approved} of {prog.total} approved · you: {my.mine ? my.mine.action : my.awaiting ? 'pending' : '—'}</div></td>
              <td className="text-right"><Button size="sm" variant={my.awaiting ? 'primary' : 'secondary'} onClick={() => go({ page: 'report', id: r.id })}>{my.awaiting ? 'Review' : 'Open'}</Button></td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card className="mt-4" title="My review history" pad={false}>
        <Table head={['When', 'Trainer', 'Report date', 'Version', 'My decision', 'Remarks']} minW={720} empty={!myDecisions.length && <Empty title="You have not reviewed any reports yet" />}>
          {myDecisions.slice(0, 30).map(({ h, r }, i) => (
            <tr key={i}><td className="whitespace-nowrap text-xs">{fmtDateTime(h.reviewedAt)}</td><td>{trainerName(s, r.trainerId)}</td><td>{fmtDate(r.date)}</td><td>v{h.reportVersion}</td><td><Badge>{h.action}</Badge></td><td className="max-w-sm text-xs">{h.remarks || '—'}</td></tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}

export default function Reports({ approvals = false }: { approvals?: boolean }) {
  const { state: s, go, user } = useApp();
  const [date, setDate] = useState(approvals ? '' : todayISO());
  const [trainer, setTrainer] = useState('All');
  const [course, setCourse] = useState('All');
  const [batch, setBatch] = useState('All');
  const [sub, setSub] = useState('All');
  const [status, setStatus] = useState(approvals ? 'Awaiting' : 'All');
  const { open, el } = useActionModals();
  const [drawer, setDrawer] = useState<{ kind: 'att' | 'topics' | 'voice'; tid: string; date: string } | null>(null);

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
            const canDecide = !!r && myReview(r, user?.id).canAct;
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
                  {r && r.versions.length > 0 && <div className="mt-0.5 text-xs text-ink-500">{reviewProgress(r).approved}/{reviewProgress(r).total} approved · {versionReviewerIds(r).map((id) => s.users.find((u) => u.id === id)?.name.split(' ')[0] ?? '?').join(', ')}</div>}
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
  kind: 'att' | 'topics' | 'voice';
  tid: string;
  date: string;
  onClose: () => void;
}) {
  const { state: s } = useApp();
  const batches = classBatchesOn(s, tid, date);
  const title = { att: 'Attendance', topics: 'Topic progress', voice: 'Student Voice Notes' }[kind];

  return (
    <Modal open onClose={onClose} size="lg" title={`${title} · ${trainerName(s, tid)}`} sub={fmtDate(date)}>
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
                            {vItem?.title && <span className="text-ink-500"> – {vItem.title}</span>}
                          </span>
                          <span className="text-xs text-ink-400">{fmtDate((vItem?.submittedAt || w.savedAt || date).slice(0, 10))}</span>
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

const STATUS_COLOR: Record<string, 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'grey'> = {
  Approved: 'green', Rejected: 'red', 'Correction Requested': 'orange', 'Under Review': 'purple', Submitted: 'blue', Draft: 'grey',
};
/** milestone events shown in the compact history; drafts and remarks are left out (remarks have their own list) */
const HISTORY_STEPS: { match: (a: string) => boolean; label: string; dot: string }[] = [
  { match: (a) => a.startsWith('Resubmitted'), label: 'Resubmitted', dot: 'bg-violet-500' },
  { match: (a) => a.startsWith('Submitted'), label: 'Submitted', dot: 'bg-royal-500' },
  { match: (a) => a === 'Opened for review', label: 'Opened for Review', dot: 'bg-sky-500' },
  { match: (a) => a === 'Correction requested', label: 'Correction Requested', dot: 'bg-amber-500' },
  { match: (a) => a.startsWith('Approved'), label: 'Approved', dot: 'bg-emerald-500' },
  { match: (a) => a === 'Rejected', label: 'Rejected', dot: 'bg-red-500' },
];

/** Admin Daily Report Review: one column, built from the saved, versioned report snapshot. */
export function ReportDetail({ id }: { id: string }) {
  const { state: s, user, go } = useApp();
  const act = useReportActions();
  const r = s.reports.find((x) => x.id === id);
  const [ver, setVer] = useState<number>(r?.versions.length ?? 1);
  const [exp, setExp] = useState(false);
  const [only, setOnly] = useState<string>('all');
  const [remark, setRemark] = useState('');
  const { open, el } = useActionModals();

  // only admins the trainer selected for the latest version can review; others can read the report
  const mineState = r ? myReview(r, user?.id) : undefined;
  const canReview = !!mineState?.assigned;
  const canDecide = !!mineState?.canAct;

  // opening a submitted report moves it to "Under Review" and records it in the history
  useEffect(() => { if (r?.status === 'Submitted' && canReview) act.openForReview(r.id); }, [r?.id, r?.status, canReview]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (r) setVer(r.versions.length); }, [r?.versions.length]);

  if (!r || !r.versions.length) {
    return <Card><Empty title="Report not found or not submitted yet" action={<Button onClick={() => go('reports')}>Back to reports</Button>} /></Card>;
  }

  const v = r.versions[ver - 1] ?? r.versions.at(-1)!;
  const snap = v.snapshot;
  const latest = v.version === r.versions.length;
  const totalAttended = snap.batches.reduce((n, b) => n + b.present + b.late, 0);
  const totalCompleted = snap.batches.reduce((n, b) => n + b.completed.length, 0);
  const totalPending = snap.batches.reduce((n, b) => n + b.partial.length + b.pending.length, 0);
  const shown = only === 'all' ? snap.batches : snap.batches.filter((b) => b.batchId === only);
  const history = r.events.map((e) => ({ e, step: HISTORY_STEPS.find((h) => h.match(e.action)) })).filter((x) => x.step);
  const text = remark.trim();

  const saveRemark = () => { if (text && act.addRemark(r.id, text) !== false) setRemark(''); };
  const decide = (kind: 'approve' | 'correction' | 'reject') => {
    // the remarks box doubles as the note / mandatory reason; without text, correction and reject ask for one
    if (kind === 'approve') { act.approve(r.id, text); setRemark(''); return; }
    if (!text) { open(kind, r.id); return; }
    const ok = kind === 'correction' ? act.requestCorrection(r.id, text) : act.reject(r.id, text);
    if (ok !== false) setRemark('');
  };
  const focusRemarks = () => { const t = document.getElementById('admin-review-remark'); t?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => t?.focus(), 250); };

  const Actions = ({ compact }: { compact?: boolean }) => (
    <div className="flex flex-wrap items-center gap-2">
      {compact && <Button size="sm" variant="secondary" icon={<Download size={15} />} onClick={() => setExp(true)}>Export PDF</Button>}
      {compact && canReview && <Button size="sm" variant="secondary" icon={<MessageSquarePlus size={15} />} onClick={focusRemarks}>Add Remarks</Button>}
      {canDecide && latest && <>
        <Button size="sm" variant="success" icon={<CheckCircle2 size={15} />} onClick={() => decide('approve')}>Approve</Button>
        <Button size="sm" variant="accent" icon={<RotateCcw size={15} />} onClick={() => decide('correction')}>Request Correction</Button>
        <Button size="sm" variant="danger" icon={<XCircle size={15} />} onClick={() => decide('reject')}>Reject</Button>
      </>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">
      {/* 1. Report header */}
      <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5 dark:border-ink-800 dark:bg-ink-900">
        <button onClick={() => go('reports')} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-800 dark:hover:text-ink-200"><ArrowLeft size={14} /> Back to reports</button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-ink-900 sm:text-2xl dark:text-ink-50">{trainerName(s, r.trainerId)}</h1>
            <div className="mt-0.5 text-sm text-ink-500">Daily report · {fmtDate(r.date)}</div>
          </div>
          <Badge color={STATUS_COLOR[r.status] ?? 'blue'}>{r.status}</Badge>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-ink-500">Report Date</dt><dd className="font-medium text-ink-900 dark:text-ink-100">{fmtDate(r.date)}</dd></div>
          <div><dt className="text-xs text-ink-500">Report Status</dt><dd className="font-medium text-ink-900 dark:text-ink-100">{r.status}</dd></div>
          <div><dt className="text-xs text-ink-500">Submission Date</dt><dd className="font-medium text-ink-900 dark:text-ink-100">{fmtDateTime(v.submittedAt)}{v.late && <span className="ml-1 text-xs text-red-600">(late)</span>}</dd></div>
          <div><dt className="text-xs text-ink-500">Report Version</dt><dd>
            {r.versions.length > 1 ? (
              <Select id="rd-ver" aria-label="Report version" value={ver} onChange={(e) => setVer(Number(e.target.value))} className="!h-8 !py-0 !text-sm">
                {r.versions.map((x) => <option key={x.version} value={x.version}>Version {x.version}{x.version === r.versions.length ? ' (latest)' : ''}</option>)}
              </Select>
            ) : <span className="font-medium text-ink-900 dark:text-ink-100">Version 1</span>}
          </dd></div>
        </dl>
        {!latest && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">You are viewing version {v.version}, an earlier submission kept unchanged. Decisions apply to the latest version.</div>}
        <div className="mt-4 border-t border-ink-100 pt-3 dark:border-ink-800"><Actions compact /></div>
      </div>

      {/* 2. Daily summary (from this version's batch reports) */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm sm:grid-cols-4 dark:border-ink-800 dark:bg-ink-900">
        {([['Number of Batches', snap.batches.length, 'text-ink-900 dark:text-ink-50'], ['Total Students Attended', totalAttended, 'text-emerald-700 dark:text-emerald-400'], ['Topics Completed', totalCompleted, 'text-teal-700 dark:text-teal-400'], ['Topics Pending', totalPending, 'text-amber-700 dark:text-amber-400']] as const).map(([l, n, c], i) => (
          <div key={l} className={cx('p-4', i % 2 === 1 && 'border-l border-ink-100 dark:border-ink-800', i >= 2 && 'border-t border-ink-100 sm:border-t-0 dark:border-ink-800', i === 2 && 'sm:border-l')}>
            <div className="text-xs text-ink-500">{l}</div>
            <div className={cx('mt-0.5 font-display text-2xl font-bold tabular-nums', c)}>{n}</div>
          </div>
        ))}
      </div>

      {/* 3. Batch-wise reports */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold text-ink-500 dark:text-ink-400">Batch-wise Reports ({snap.batches.length})</h2>
          {snap.batches.length > 1 && (
            <div className="inline-flex flex-wrap rounded-lg bg-ink-100 p-0.5 dark:bg-ink-800">
              {[{ id: 'all', label: 'All batches' }, ...snap.batches.map((b) => ({ id: b.batchId, label: b.batchName }))].map((o) => (
                <button key={o.id} onClick={() => setOnly(o.id)} className={cx('rounded-md px-3 py-1 text-xs font-medium', only === o.id ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-600 hover:text-ink-900 dark:text-ink-400')}>{o.label}</button>
              ))}
            </div>
          )}
        </div>
        {shown.length ? shown.map((b) => <BatchBlock key={b.batchId} b={b} reportDate={r.date} adminView />) : <Card><Empty title="No batches in this report" /></Card>}
        {snap.remarks && <div className="rounded-xl border border-ink-200 bg-white p-4 text-sm dark:border-ink-800 dark:bg-ink-900"><span className="font-semibold text-ink-700 dark:text-ink-200">Trainer's overall remarks: </span>{snap.remarks}</div>}
      </div>

      {/* 4. Admin remarks and review */}
      <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5 dark:border-ink-800 dark:bg-ink-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink-900 dark:text-ink-50">Admin Remarks and Review</h2>
          <span className="flex items-center gap-2 text-xs text-ink-500">Current status <Badge color={STATUS_COLOR[r.status] ?? 'blue'}>{r.status}</Badge></span>
        </div>
        {r.adminRemarks.length > 0 && (
          <ul className="mt-3 space-y-2">
            {r.adminRemarks.map((m, i) => (
              <li key={i} className="rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800/50">
                <div className="text-ink-900 dark:text-ink-50">{m.text}</div>
                <div className="mt-0.5 text-xs text-ink-500">{m.by} · {fmtDateTime(m.at)}</div>
              </li>
            ))}
          </ul>
        )}
        {r.versions.length > 0 && (
          <div id="review-progress" className="mt-3 rounded-lg border border-ink-100 p-3 dark:border-ink-800">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-ink-900 dark:text-ink-50">{reviewProgress(r).label}</span><span className="text-xs text-ink-500">{reviewProgress(r).total > 1 ? 'Approved only when every selected reviewer approves' : 'Single reviewer'}</span></div>
            <ReviewerStatusList s={s} r={r} />
          </div>
        )}
        {canReview && mineState?.mine && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">You recorded “{mineState.mine.action}” for version {mineState.mine.reportVersion} on {fmtDateTime(mineState.mine.reviewedAt)}.{r.status === 'Under Review' && ' Waiting for the other selected reviewers.'}</p>}
        {canReview ? (
          <>
            <div className="mt-3">
              <Field label="Remarks">
                <Textarea id="admin-review-remark" rows={3} value={remark} onChange={(e) => setRemark(e.target.value)}
                  placeholder={canDecide ? 'Write remarks for the trainer. This text is also used as the reason when you request a correction or reject.' : 'Add a remark for the trainer'} />
              </Field>
              {canDecide && latest && <p className="mt-1 text-xs text-ink-500">A reason is required to request a correction or reject. Approve works with or without remarks.</p>}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" variant="secondary" disabled={!text} onClick={saveRemark}>Save Remarks</Button>
              {canDecide && latest ? <Actions /> : <span className="text-xs text-ink-500">{r.status === 'Approved' ? 'This report is approved.' : r.status === 'Rejected' ? 'This report was rejected.' : r.status === 'Correction Requested' ? 'Waiting for the trainer to correct and resubmit.' : !latest ? 'Switch to the latest version to take a decision.' : mineState?.mine ? 'Your decision on this version is recorded.' : ''}</span>}
            </div>
          </>
        ) : <p id="not-reviewer" className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600 dark:bg-ink-800/50 dark:text-ink-300">You are not a selected reviewer for this report, so you can view it but not review it. Selected reviewers: {versionReviewerIds(r).map((id) => s.users.find((u) => u.id === id)?.name ?? 'Former admin').join(', ')}.</p>}
      </div>

      {/* 5. Report history (compact) */}
      <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5 dark:border-ink-800 dark:bg-ink-900">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-bold text-ink-900 dark:text-ink-50">Report History</h2>
          <span className="text-xs text-ink-500">{r.versions.length} version{r.versions.length === 1 ? '' : 's'} kept · earlier versions are never overwritten</span>
        </div>
        <ol className="mt-3 space-y-2.5">
          {history.map(({ e, step }, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', step!.dot)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-ink-900 dark:text-ink-100">{step!.label === 'Approved' ? e.action : step!.label}</span>
                  <span className="text-xs text-ink-500">{e.by} · {fmtDateTime(e.at)}</span>
                  {/v\d+|version \d+/i.test(e.action) && <span className="text-xs text-ink-400">{e.action.replace(/^(Resubmitted|Submitted)\s*/, '')}</span>}
                </div>
                {e.reason && <div className="mt-0.5 text-xs text-ink-600 dark:text-ink-300">{e.reason}</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {el}
      {exp && <ExportModal open onClose={() => setExp(false)} snapshot={v.snapshot} adminView />}
    </div>
  );
}
