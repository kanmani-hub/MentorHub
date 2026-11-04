import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, Lock, Save, Send, RotateCcw, Download } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { NO_REVIEWER, useReportActions } from '../../store/actions';
import { batchReportFor, batchReportStatus, buildSnapshot, classBatchesOn, courseName, derivedStatus, reportFor, validateReport } from '../../store/selectors';
import { activeAdmins, reviewProgress, reviewsFor, versionReviewerIds } from '../../store/reviews';
import type { AppState, DailyReport } from '../../types';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Modal, PageHeader, Select, Table, Textarea } from '../../components/common/ui';
import { ExportModal, ReportView } from '../../components/common/ReportView';
import { cx, fmtDate, fmtDateTime, fmtTime12, todayISO } from '../../utils';
import { WorkDatePicker, useWorkDate } from './common';

const PAGE_FOR: Record<string, string> = { attendance: 't-attendance', progress: 't-progress', activities: 't-activities', voice: 't-voice', 'batch-report': 't-batch-report', lesson: 't-lesson' };
const userName = (s: AppState, id: string) => s.users.find((u) => u.id === id)?.name ?? 'Former admin';
const reviewerNames = (s: AppState, ids: string[]) => ids.map((id) => userName(s, id)).join(', ');

/** each reviewer's state on the latest version: Approved / Correction requested / Rejected / Pending */
export function ReviewerStatusList({ s, r }: { s: AppState; r: DailyReport }) {
  const recs = reviewsFor(r);
  return (
    <ul className="space-y-1.5 text-sm">
      {versionReviewerIds(r).map((id) => {
        const rec = recs.find((x) => x.reviewerId === id);
        return (
          <li key={id} className="flex flex-wrap items-center gap-2">
            <Avatar name={userName(s, id)} size={22} />
            <span className="min-w-0 flex-1 text-ink-800 dark:text-ink-100">{rec?.reviewerName ?? userName(s, id)}</span>
            <Badge color={!rec ? 'grey' : rec.action === 'Approved' ? 'green' : rec.action === 'Rejected' ? 'red' : 'orange'} dot={false}>{rec ? rec.action : 'Pending'}</Badge>
            {rec && <span className="w-full pl-8 text-xs text-ink-500">{fmtDateTime(rec.reviewedAt)}{rec.remarks && ` · ${rec.remarks}`}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function DailyReportPage() {
  const { state: s, user, go } = useApp();
  const { date } = useWorkDate();
  const act = useReportActions();
  const tid = user!.trainerId!;
  const r = reportFor(s, tid, date);
  const status = derivedStatus(s, tid, date);
  const admins = activeAdmins(s);
  const [remarks, setRemarks] = useState(r?.draftRemarks ?? '');
  const [exception, setException] = useState(r?.exception ?? '');
  const [reviewers, setReviewers] = useState<string[]>(r?.selectedReviewerIds ?? []);
  const [preview, setPreview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [exp, setExp] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  useEffect(() => { setRemarks(r?.draftRemarks ?? ''); setException(r?.exception ?? ''); setReviewers(r?.selectedReviewerIds ?? []); setShowIssues(false); /* eslint-disable-next-line */ }, [date, r?.id]);
  const batches = classBatchesOn(s, tid, date);
  const locked = !!r && ['Submitted', 'Under Review', 'Approved', 'Rejected'].includes(r.status);
  const issues = validateReport(s, tid, date);
  const snap = { ...buildSnapshot(s, tid, date), remarks, exception: exception || undefined };
  const highlight = new Set(issues.filter((i) => i.batchId).map((i) => i.batchId!));
  const canException = s.settings.allowException && issues.length > 0;
  const chosen = reviewers.filter((id) => admins.some((a) => a.id === id));
  const noReviewer = chosen.length === 0;
  // the exception reason can cover missing items, never the reviewer requirement
  const blocked = (issues.length > 0 && !(canException && exception.trim().length >= 10)) || noReviewer;
  const correctionEv = r?.status === 'Correction Requested' ? [...r.events].reverse().find((e) => e.action === 'Correction requested') : undefined;
  const last = r?.versions.at(-1);
  const trySubmit = () => { setShowIssues(true); if (blocked) { if (noReviewer) document.getElementById('reviewer-select')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } setConfirm(true); };
  const toggleReviewer = (id: string) => setReviewers((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const prog = r && r.versions.length ? reviewProgress(r) : undefined;

  if (!batches.length) return <div><PageHeader title="Daily Report" actions={<WorkDatePicker />} /><Card><Empty title="No classes on this date" body="A daily report is generated only for working days with classes." /></Card></div>;

  return (
    <div>
      <PageHeader title="Consolidated Daily Report" sub={`Combines your batch reports into one report for your selected admin reviewers · due by ${fmtTime12(s.settings.reportDeadline)}`} actions={<><WorkDatePicker /><Badge>{status}</Badge></>} />
      {correctionEv && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
          <RotateCcw size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="text-sm"><div className="font-medium text-amber-900 dark:text-amber-200">Correction requested by {correctionEv.by}</div><div className="text-amber-800 dark:text-amber-300">{correctionEv.reason}</div><div className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/70">Version {r!.versions.length} is preserved. Open the batch report that needs changes, use Edit report, submit it again, then resubmit here as version {r!.versions.length + 1}.</div></div>
        </div>
      )}
      {locked && last && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <div className="flex flex-wrap items-center gap-3">
            {r!.status === 'Rejected' ? <AlertCircle className="text-red-600" /> : <CheckCircle2 className="text-emerald-600" />}
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-medium text-ink-900 dark:text-ink-50">{r!.status}: version {last.version} submitted {fmtDateTime(last.submittedAt)}{last.late && ' (late)'}</div>
              <div className="flex items-center gap-1 text-ink-600 dark:text-ink-300"><Lock size={13} /> This version is locked. Changes are possible only if a reviewer requests a correction.{r!.status === 'Rejected' && ` Reason: ${[...r!.events].reverse().find((e) => e.action === 'Rejected')?.reason}`}</div>
              {prog && <div className="mt-1 text-ink-700 dark:text-ink-200">Reviewers: {reviewerNames(s, versionReviewerIds(r!))} · <b>{prog.label}</b></div>}
            </div>
            <Button variant="secondary" icon={<Download size={14} />} onClick={() => setExp(true)}>Export</Button>
            <Button variant="secondary" onClick={() => go({ page: 't-history', id: r!.id })}>View in history</Button>
          </div>
        </div>
      )}

      <Card className="mb-4" pad={false} title="Batch reports included" subtitle="Each batch keeps its own report. All must be submitted before the consolidated report can go to your reviewers.">
        <Table head={['Batch', 'Course', 'Class time', 'Batch report status', 'Last updated', '']} minW={640}>
          {batches.map((b) => { const br = batchReportFor(s, tid, b.id, date); const bst = batchReportStatus(s, tid, b.id, date); return (
            <tr key={b.id}><td className="font-medium text-ink-900 dark:text-ink-50">{b.name}</td><td>{courseName(s, b.courseId)}</td><td className="tabular-nums">{b.startTime}–{b.endTime}</td>
              <td><Badge color={bst === 'Not Started' ? 'grey' : undefined}>{bst}</Badge></td><td className="text-xs">{br ? fmtDateTime(br.updatedAt) : '—'}</td>
              <td className="text-right"><Button size="sm" variant={br?.status === 'Submitted' ? 'ghost' : 'secondary'} onClick={() => go({ page: 't-batch-report', id: b.id })}>{locked ? 'View' : br?.status === 'Submitted' ? 'Review' : br ? 'Continue' : 'Start'}</Button></td></tr>
          ); })}
        </Table>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card title="Report preview" subtitle={locked ? 'As submitted' : 'Built live from your batch reports, attendance, topic progress and student voice notes'}>
          <ReportView s={locked && last ? last.snapshot : snap} highlight={showIssues || !locked ? highlight : undefined} />
        </Card>
        <div className="space-y-4">
          {!locked && (
            <Card title="Before you submit" subtitle={issues.length + (noReviewer ? 1 : 0) ? `${issues.length + (noReviewer ? 1 : 0)} item(s) missing` : 'All mandatory items are complete'} className={cx(showIssues && (issues.length > 0 || noReviewer) && 'border-red-400')}>
              {issues.length === 0 && !noReviewer ? <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={16} />Ready to submit</div> : (
                <ul className="space-y-2">
                  {issues.map((i, n) => (
                    <li key={n} className="flex items-start gap-2 text-sm"><AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                      <span className="min-w-0 flex-1"><span className="text-ink-800 dark:text-ink-100">{i.message}</span><button className="ml-1 text-xs font-medium text-royal-600 hover:underline dark:text-blue-300" onClick={() => go({ page: PAGE_FOR[i.page] ?? 't-batch-report', id: i.batchId })}>Fix in {i.section} →</button></span></li>
                  ))}
                  {noReviewer && <li className="flex items-start gap-2 text-sm"><AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" /><span className="min-w-0 flex-1 text-ink-800 dark:text-ink-100">Select at least one Admin Reviewer <button className="ml-1 text-xs font-medium text-royal-600 hover:underline dark:text-blue-300" onClick={() => document.getElementById('reviewer-select')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Choose below →</button></span></li>}
                </ul>
              )}
            </Card>
          )}
          {!locked && (
            <Card title="Remarks & submission">
              <Field label="Overall remarks (optional)"><Textarea id="rep-remarks" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Anything management should know" /></Field>
              {canException && (
                <Field label="Exception reason" className="mt-3" hint="Allowed by admin settings. Explain why the missing items cannot be completed (min 10 characters). It does not replace choosing a reviewer." error={showIssues && issues.length > 0 && exception.trim().length < 10 ? 'Complete the missing items or record an exception reason.' : undefined}>
                  <Textarea id="rep-exception" rows={2} value={exception} onChange={(e) => setException(e.target.value)} placeholder="e.g. Batch cancelled after first hour due to power outage" />
                </Field>
              )}
              <fieldset id="reviewer-select" className={cx('mt-4 rounded-lg border p-3', showIssues && noReviewer ? 'border-red-400 bg-red-50/40 dark:bg-red-500/5' : 'border-ink-200 dark:border-ink-700')}>
                <legend className="px-1 text-xs font-semibold text-ink-700 dark:text-ink-200">Select Admin Reviewer <span className="text-red-500">*</span></legend>
                {admins.length ? (
                  <ul className="max-h-60 space-y-1 overflow-y-auto">
                    {admins.map((a) => (
                      <li key={a.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-ink-50 dark:hover:bg-ink-800/60">
                          <input type="checkbox" className="h-4 w-4 shrink-0 accent-royal-600" checked={reviewers.includes(a.id)} onChange={() => toggleReviewer(a.id)} aria-label={`Reviewer ${a.name}`} />
                          <Avatar name={a.name} size={28} />
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-50">{a.name}</span><span className="block truncate text-[11.5px] text-ink-500">{a.email}</span></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-red-600">No active admin accounts are available. Ask an admin to add one in User Roles & Permissions.</p>}
                <div className="mt-2 border-t border-ink-100 pt-2 text-xs dark:border-ink-800">
                  <span className="text-ink-500">Selected Reviewers: </span>
                  <span id="selected-reviewers" className="font-medium text-ink-900 dark:text-ink-100">{chosen.length ? reviewerNames(s, chosen) : 'None'}</span>
                </div>
                {showIssues && noReviewer && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{NO_REVIEWER}</p>}
              </fieldset>
              <div className="mt-4 grid gap-2">
                <Button variant="secondary" icon={<Save size={15} />} onClick={() => act.saveDraft(tid, date, remarks, exception, reviewers)}>Save draft</Button>
                <Button variant="secondary" icon={<Eye size={15} />} onClick={() => setPreview(true)}>Preview report</Button>
                <Button icon={<Send size={15} />} onClick={trySubmit}>{r?.status === 'Correction Requested' ? 'Resubmit corrected report' : 'Submit Consolidated Report'}</Button>
              </div>
              {date < todayISO() && <p className="mt-2 text-xs text-red-600">This day is past the deadline; it will be marked as a late submission.</p>}
            </Card>
          )}
          {locked && r && r.versions.length > 0 && (
            <Card title="Admin review" subtitle={prog?.label}><ReviewerStatusList s={s} r={r} /></Card>
          )}
          {r && r.events.length > 0 && (
            <Card title="Report activity">
              <ul className="space-y-2 text-sm">{[...r.events].reverse().slice(0, 6).map((e, i) => <li key={i}><div className="text-ink-800 dark:text-ink-100">{e.action}</div><div className="text-xs text-ink-500">{e.by} · {fmtDateTime(e.at)}</div>{e.reason && <div className="text-xs text-ink-600 dark:text-ink-300">{e.reason}</div>}</li>)}</ul>
            </Card>
          )}
        </div>
      </div>
      {preview && <Modal open onClose={() => setPreview(false)} size="xl" title="Report preview" sub={`${snap.trainerName} · ${fmtDate(date)}`} footer={<><Button variant="secondary" onClick={() => setPreview(false)}>Close</Button><Button onClick={() => { setPreview(false); trySubmit(); }}>Submit</Button></>}><ReportView s={snap} highlight={highlight} /></Modal>}
      <Confirm open={confirm} onClose={() => setConfirm(false)} tone="primary" confirmLabel={r?.status === 'Correction Requested' ? 'Resubmit' : 'Submit report'} title="Submit Consolidated Daily Report?"
        body={<>The report for {fmtDate(date)} covering {batches.length} batch(es) is locked once submitted and sent to: <b>{reviewerNames(s, chosen)}</b>.{chosen.length > 1 && ' It is approved only when every selected reviewer approves.'}{issues.length > 0 && <span className="mt-2 block text-amber-700">Submitting with a recorded exception for {issues.length} missing item(s).</span>}</>}
        onConfirm={() => act.submit(tid, date, remarks, issues.length ? exception : undefined, chosen)} />
      {exp && last && <ExportModal open onClose={() => setExp(false)} snapshot={last.snapshot} />}
    </div>
  );
}

export function ReportHistory({ openId }: { openId?: string }) {
  const { state: s, user, go } = useApp();
  const { setDate } = useWorkDate();
  const tid = user!.trainerId!;
  const [filter, setFilter] = useState('All');
  const [open, setOpen] = useState<string | null>(openId && s.reports.some((r) => r.id === openId) ? openId : null);
  const [ver, setVer] = useState(0);
  const [exp, setExp] = useState(false);
  const list = s.reports.filter((r) => r.versions.length && (filter === 'All' || r.status === filter)).sort((a, b) => b.date.localeCompare(a.date));
  const r = s.reports.find((x) => x.id === open);
  const v = r ? r.versions[(ver || r.versions.length) - 1] : undefined;
  const correct = (d: string) => { setDate(d); go('t-report'); };
  return (
    <div>
      <PageHeader title="My Report History" sub="Every submitted version is kept. Corrections create a new version." />
      <Card pad={false}>
        <div className="border-b border-ink-100 p-3 dark:border-ink-800"><Select id="rh-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-auto">{['All', 'Submitted', 'Under Review', 'Correction Requested', 'Approved', 'Rejected'].map((x) => <option key={x}>{x}</option>)}</Select></div>
        <Table head={['Report date', 'Batches', 'Admin reviewers', 'Submitted', 'Status', 'Reviewer remarks', 'Approved on', '']} minW={980} empty={!list.length && <Empty title="No submitted reports yet" />}>
          {list.map((x) => {
            const lv = x.versions.at(-1)!;
            const recs = reviewsFor(x).filter((h) => h.remarks);
            const prog = reviewProgress(x);
            return (
              <tr key={x.id}>
                <td className="whitespace-nowrap font-medium text-ink-900 dark:text-ink-50">{fmtDate(x.date)}</td>
                <td className="tabular-nums" title={lv.snapshot.batches.map((b) => b.batchName).join(', ')}>{lv.snapshot.batches.length}</td>
                <td className="max-w-[200px] text-xs">{reviewerNames(s, versionReviewerIds(x))}{prog.total > 1 && <div className="text-ink-500">{prog.approved} of {prog.total} approved</div>}</td>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(lv.submittedAt)}{lv.late && <Badge color="red" dot={false}>Late</Badge>}{x.versions.length > 1 && <Badge color="purple" dot={false}>v{x.versions.length}</Badge>}</td>
                <td><Badge>{derivedStatus(s, tid, x.date)}</Badge></td>
                <td className="max-w-[240px] text-xs">{recs.length ? recs.map((h, i) => <div key={i}><b>{h.reviewerName}:</b> {h.remarks}</div>) : '—'}</td>
                <td className="whitespace-nowrap text-xs">{x.status === 'Approved' && x.approvedAt ? fmtDateTime(x.approvedAt) : '—'}</td>
                <td className="whitespace-nowrap text-right">
                  {x.status === 'Correction Requested' && <Button size="sm" className="mr-1" onClick={() => correct(x.date)}>Correct & resubmit</Button>}
                  <Button size="sm" variant="secondary" onClick={() => { setOpen(x.id); setVer(0); }}>Open</Button>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {r && v && (
        <Modal open onClose={() => setOpen(null)} size="xl" title={`Report · ${fmtDate(r.date)}`} sub={<span className="inline-flex items-center gap-2"><Badge>{r.status}</Badge>Version {v.version} · {fmtDateTime(v.submittedAt)}</span>}
          footer={<>{r.status === 'Correction Requested' && <Button onClick={() => { setOpen(null); correct(r.date); }}>Correct & resubmit</Button>}<Button variant="secondary" icon={<Download size={14} />} onClick={() => setExp(true)}>Export</Button><Button variant="secondary" onClick={() => setOpen(null)}>Close</Button></>}>
          {r.versions.length > 1 && <div className="mb-3"><Select id="rh-ver" value={v.version} onChange={(e) => setVer(Number(e.target.value))} className="!w-auto">{r.versions.map((x) => <option key={x.version} value={x.version}>Version {x.version}</option>)}</Select></div>}
          <div className="mb-3 rounded-lg border border-ink-200 p-3 dark:border-ink-700">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Reviewers for version {v.version}</div>
            <ul className="space-y-1 text-sm">{(v.reviewerIds ?? []).map((id) => { const rec = reviewsFor(r, v.version).find((h) => h.reviewerId === id); return (
              <li key={id}><span className="font-medium text-ink-900 dark:text-ink-50">{rec?.reviewerName ?? userName(s, id)}</span> <Badge color={!rec ? 'grey' : rec.action === 'Approved' ? 'green' : rec.action === 'Rejected' ? 'red' : 'orange'} dot={false}>{rec ? rec.action : 'Pending'}</Badge>{rec && <span className="text-xs text-ink-500"> {fmtDateTime(rec.reviewedAt)}{rec.remarks && ` · ${rec.remarks}`}</span>}</li>
            ); })}</ul>
          </div>
          <ReportView s={v.snapshot} />
          <div className="mt-5 border-t border-ink-100 pt-3 dark:border-ink-800"><div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">History</div><ul className="space-y-1.5 text-sm">{[...r.events].reverse().filter((e) => !/Draft saved/.test(e.action)).map((e, i) => <li key={i}><span className="text-ink-800 dark:text-ink-100">{e.action}</span> <span className="text-xs text-ink-500">· {e.by} · {fmtDateTime(e.at)}</span>{e.reason && <div className="text-xs text-ink-600 dark:text-ink-300">{e.reason}</div>}</li>)}</ul></div>
          {exp && <ExportModal open onClose={() => setExp(false)} snapshot={v.snapshot} />}
        </Modal>
      )}
    </div>
  );
}
