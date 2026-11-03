import { useState } from 'react';
import { CheckCircle2, CircleDashed, CircleDot, Copy, Mic, Play, Pause } from 'lucide-react';
import type { BatchSummary, ReportSnapshot } from '../../types';
import { fmtDay, fmtMins, fmtSecs, cx } from '../../utils';
import { Badge, Button, Modal, SimNote } from './ui';
import { useApp } from '../../store/AppStore';

const WORK_ORDER = ['Lesson Preparation', 'Teaching', 'Notes Preparation', 'Student Support', 'Doubt Clearing', 'Administrative Work', 'Daily Reporting', 'Other Work'];

export const snapshotText = (s: ReportSnapshot, institute: string) => {
  const L: string[] = [];
  L.push(`${institute} — Daily Trainer Report`, `${s.trainerName} · ${fmtDay(s.date)}`, '');
  L.push('TRAINER SUMMARY', `Total batches: ${s.totalBatches}`, `Classes today: ${s.totalClasses}`, `Teaching time: ${fmtMins(s.teachingMinutes)}`, '');
  s.batches.forEach((b, i) => {
    L.push(`BATCH ${i + 1}: ${b.batchName} (${b.course}, ${b.timing})`);
    L.push(`Attendance: ${b.present + b.late}/${b.total} present (late ${b.late}, absent ${b.absent}, leave ${b.leave})`);
    L.push(`Completed (${b.completed.length}): ${b.completed.join(', ') || '—'}`);
    L.push(`Partially completed (${b.partial.length}): ${b.partial.map((p) => `${p.title} [${p.note}]`).join(', ') || '—'}`);
    L.push(`Pending (${b.pending.length}): ${b.pending.map((p) => `${p.title} [${p.note}]`).join(', ') || '—'}`);
    if (b.absentees?.length) L.push(`Absent: ${b.absentees.map((x) => `${x.name} (${x.reason || 'no reason'})`).join(', ')}`);
    if (b.onLeave?.length) L.push(`Leave: ${b.onLeave.map((x) => `${x.name} (${x.reason || 'no reason'})`).join(', ')}`);
    if (b.lateList?.length) L.push(`Late: ${b.lateList.map((x) => `${x.name} at ${x.time || '—'}`).join(', ')}`);
    L.push(`Practicals: ${b.practicals || '—'}`, `Homework / assignments: ${b.homework || '—'}`, `Student doubts: ${b.doubts || '—'}`, `Next class plan: ${b.nextPlan || '—'}`);
    if (b.whatsappStudents) L.push('Students Who Sent WhatsApp Updates:', ...(b.whatsappStudents.length ? b.whatsappStudents.map((n) => `  • ${n}`) : ['  —']));
    if (b.voiceNames?.length) L.push(`WhatsApp voice notes: ${b.voiceNames.join('; ')}`);
    b.projects?.forEach((p) => L.push(`Project: ${p.name} [${p.status}] — today: ${p.workDone || '—'}; assigned: ${p.assigned || '—'}; students: ${p.students || '—'}`));
    if (b.batchRemarks) L.push(`Remarks: ${b.batchRemarks}`);
    L.push('');
  });
  L.push('TIME SUMMARY');
  WORK_ORDER.forEach((k) => s.work[k] && L.push(`${k}: ${fmtMins(s.work[k])}`));
  if (s.remarks) L.push('', `Trainer remarks: ${s.remarks}`);
  if (s.exception) L.push(`Recorded exception: ${s.exception}`);
  return L.join('\n');
};

export function ExportModal({ open, onClose, snapshot }: { open: boolean; onClose: () => void; snapshot: ReportSnapshot }) {
  const { raw, toast } = useApp();
  const text = snapshotText(snapshot, raw.settings.instituteName);
  return (
    <Modal open={open} onClose={onClose} title="Export report" size="lg" footer={<>
      <Button variant="secondary" onClick={onClose}>Close</Button>
      <Button icon={<Copy size={15} />} onClick={() => {
        navigator.clipboard?.writeText(text).then(() => toast('Report copied to clipboard')).catch(() => {
          const el = document.getElementById('export-text') as HTMLTextAreaElement | null; el?.select(); toast('Text selected. Press Ctrl+C to copy.', 'info');
        });
      }}>Copy as text</Button>
    </>}>
      <SimNote>File downloads (PDF/Excel) need the backend export service. In this prototype the report is exported as plain text you can paste into email or a document.</SimNote>
      <textarea id="export-text" readOnly value={text} className="mt-3 h-80 w-full rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-xs text-ink-800 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-200" />
    </Modal>
  );
}

export function FakePlayer({ seconds, label }: { seconds: number; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [timer, setTimer] = useState<number | null>(null);
  const toggle = () => {
    if (playing) { if (timer) clearInterval(timer); setPlaying(false); return; }
    setPlaying(true);
    const t = window.setInterval(() => setPos((p) => { if (p + 1 >= seconds) { clearInterval(t); setPlaying(false); return 0; } return p + 1; }), 1000);
    setTimer(t);
  };
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-full bg-ink-100 py-1 pl-1 pr-3 dark:bg-ink-800">
      <button onClick={toggle} className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-700 text-white dark:bg-royal-600" aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}</button>
      <div className="flex h-5 min-w-0 flex-1 items-center gap-[2px]">
        {Array.from({ length: 32 }).map((_, i) => {
          const h = 25 + ((i * 37) % 70);
          const on = (i / 32) * seconds <= pos;
          return <span key={i} className={cx('w-[3px] rounded-full', on && (playing || pos) ? 'bg-royal-600' : 'bg-ink-300 dark:bg-ink-600')} style={{ height: `${h}%` }} />;
        })}
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-ink-500">{fmtSecs(pos)} / {fmtSecs(seconds)}</span>
      {label && <span className="hidden text-[10px] text-violet2-600 sm:inline">{label}</span>}
    </div>
  );
}

const Section = ({ title, children, empty }: { title: string; children?: React.ReactNode; empty?: boolean }) => (
  <div className="min-w-0">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{title}</div>
    <div className="mt-1 text-sm text-ink-800 dark:text-ink-100">{empty ? <span className="text-ink-400">None recorded</span> : children}</div>
  </div>
);

/** One batch's report. Used in the trainer preview, the consolidated report and the admin review. */
export function BatchBlock({ b, highlight }: { b: BatchSummary; highlight?: boolean }) {
  const isNew = b.batchReportStatus !== undefined;
  return (
    <div className={cx('rounded-xl border p-4', highlight ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-500/5' : 'border-ink-200 dark:border-ink-800')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-bold text-ink-900 dark:text-ink-50">{b.batchName}</div>
          <div className="text-xs text-ink-500">{b.course} · {b.timing}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isNew && b.batchReportStatus !== 'Submitted' && <Badge color="red">Batch report {b.batchReportStatus?.toLowerCase()}</Badge>}
          <Badge color={b.attendanceSubmitted ? 'green' : 'red'}>{b.attendanceSubmitted ? `Attendance ${b.present + b.late}/${b.total}` : 'Attendance not submitted'}</Badge>
          <Badge color="green" dot={false}>{b.completed.length} covered</Badge>
          {b.partial.length > 0 && <Badge color="orange" dot={false}>{b.partial.length} partial</Badge>}
          {b.pending.length > 0 && <Badge color="red" dot={false}>{b.pending.length} pending</Badge>}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Section title={`Topics covered (${b.completed.length})`} empty={!b.completed.length}>
          <ul className="space-y-1">{b.completed.map((t) => <li key={t} className="flex gap-1.5"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />{t}</li>)}</ul>
        </Section>
        <Section title={`Partially covered (${b.partial.length})`} empty={!b.partial.length}>
          <ul className="space-y-1">{b.partial.map((t) => <li key={t.title} className="flex gap-1.5"><CircleDot size={14} className="mt-0.5 shrink-0 text-amber-500" /><span>{t.title}<span className="block text-xs text-ink-500">{t.note}</span></span></li>)}</ul>
        </Section>
        <Section title={`Pending / not covered (${b.pending.length})`} empty={!b.pending.length}>
          <ul className="space-y-1">{b.pending.map((t) => <li key={t.title} className="flex gap-1.5"><CircleDashed size={14} className="mt-0.5 shrink-0 text-red-500" /><span>{t.title}<span className="block text-xs text-ink-500">{t.note}</span></span></li>)}</ul>
        </Section>
      </div>
      <div className="mt-4 grid gap-2 rounded-lg bg-ink-50 p-3 text-sm sm:grid-cols-5 dark:bg-ink-800/50">
        {[['Total students', b.total], ['Present', b.present], ['Late', b.late], ['Absent', b.absent], ['Leave', b.leave]].map(([k, v]) => (
          <div key={k}><div className="text-[11px] text-ink-500">{k}</div><div className="font-display text-lg font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{v}</div></div>
        ))}
      </div>
      {isNew && (b.absentees?.length || b.onLeave?.length || b.lateList?.length) ? (
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <Section title="Absent students & reasons" empty={!b.absentees?.length}><ul className="space-y-0.5">{b.absentees?.map((x) => <li key={x.name}><b className="font-medium">{x.name}</b> — {x.reason || <span className="text-red-500">no reason</span>}</li>)}</ul></Section>
          <Section title="On leave & reasons" empty={!b.onLeave?.length}><ul className="space-y-0.5">{b.onLeave?.map((x) => <li key={x.name}><b className="font-medium">{x.name}</b> — {x.reason || <span className="text-red-500">no reason</span>}</li>)}</ul></Section>
          <Section title="Late arrivals" empty={!b.lateList?.length}><ul className="space-y-0.5">{b.lateList?.map((x) => <li key={x.name}><b className="font-medium">{x.name}</b> — arrived {x.time || '—'}</li>)}</ul></Section>
        </div>
      ) : null}
      {isNew ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Section title="Practical activities conducted" empty={!b.practicalList?.length}><ul className="list-disc space-y-0.5 pl-4">{b.practicalList?.map((p) => <li key={p.id}><span className="text-xs text-ink-500">{p.type}:</span> {p.text}</li>)}</ul></Section>
          <Section title="Homework / assignments given" empty={!b.assignmentList?.length}><ul className="space-y-1">{b.assignmentList?.map((a) => <li key={a.id}><b className="font-medium">{a.name}</b>{a.deadline && <span className="text-xs text-ink-500"> · due {fmtDay(a.deadline)}</span>}<div className="text-xs text-ink-600 dark:text-ink-300">{a.description}</div></li>)}</ul></Section>
          <Section title="Student doubts / difficulties" empty={!b.doubtList?.length}><ul className="list-disc space-y-0.5 pl-4">{b.doubtList?.map((d) => <li key={d.id}><span className="text-xs text-ink-500">{d.type}:</span> {d.text}</li>)}</ul></Section>
          {b.studentTasks && <div className="md:col-span-2"><Section title={`Student tasks (Notes of Lesson) · ${b.studentTasks.filter((t) => t.status === 'Completed').length}/${b.studentTasks.length} completed`}>
            <ol className="grid gap-1 sm:grid-cols-2">{b.studentTasks.map((t, i) => <li key={i} className="flex gap-1.5"><span className={cx('mt-0.5 shrink-0 rounded px-1 text-[10px] font-semibold', t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : t.status === 'Not Completed' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>{t.status === 'Completed' ? 'Done' : t.status === 'Not Completed' ? 'Not done' : '—'}</span><span>{i + 1}. {t.text}</span></li>)}</ol>
          </Section></div>}
          <Section title="Students Who Sent WhatsApp Updates" empty={!b.whatsappStudents?.length}><ul className="list-disc space-y-0.5 pl-4">{b.whatsappStudents?.map((n) => <li key={n}>{n}</li>)}</ul></Section>
          <Section title="WhatsApp voice notes shared" empty={!b.voiceNames?.length}><ul className="space-y-0.5">{b.voiceNames?.map((v, i) => <li key={i} className="flex items-center gap-1.5"><Mic size={13} className="shrink-0 text-emerald-600" />{v}</li>)}</ul></Section>
          <div className="md:col-span-2"><Section title="Project work / assignments" empty={!b.projects?.length}>
            <div className="space-y-2">{b.projects?.map((p) => (
              <div key={p.id} className="rounded-lg border border-ink-100 p-2.5 dark:border-ink-800">
                <div className="flex flex-wrap items-center justify-between gap-2"><b className="font-medium">{p.name}</b><Badge color={p.status === 'Completed' ? 'green' : p.status === 'In Progress' ? 'blue' : 'grey'}>{p.status}</Badge></div>
                <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2"><div><dt className="inline text-ink-500">Work today: </dt><dd className="inline">{p.workDone || '—'}</dd></div><div><dt className="inline text-ink-500">Assigned: </dt><dd className="inline">{p.assigned || '—'}</dd></div><div><dt className="inline text-ink-500">Students: </dt><dd className="inline">{p.students || '—'}</dd></div>{p.remarks && <div><dt className="inline text-ink-500">Remarks: </dt><dd className="inline">{p.remarks}</dd></div>}</dl>
              </div>
            ))}</div>
          </Section></div>
          <Section title="Next class plan">{b.nextPlan || '—'}</Section>
          {b.batchRemarks ? <Section title="Additional remarks">{b.batchRemarks}</Section> : null}
        </div>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          {[['Practical activities', b.practicals], ['Homework', b.homework], ['Student doubts', b.doubts], ['Next class plan', b.nextPlan]].map(([k, v]) => <Section key={k} title={k} empty={!v}>{v}</Section>)}
          {b.voice.length > 0 && <Section title="Voice updates">{b.voice.map((v, i) => <div key={i} className="flex items-center gap-1.5"><Mic size={13} className="text-violet2-500" />{v.category}: {v.description} <span className="text-xs text-ink-500">({fmtSecs(v.seconds)})</span></div>)}</Section>}
        </dl>
      )}
    </div>
  );
}

export function ReportView({ s, highlight }: { s: ReportSnapshot; highlight?: Set<string> }) {
  const [only, setOnly] = useState<string>('all');
  const stat = (k: string, v: string) => (
    <div className="rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800/60"><div className="text-[11px] text-ink-500">{k}</div><div className="font-display text-lg font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{v}</div></div>
  );
  const shown = only === 'all' ? s.batches : s.batches.filter((b) => b.batchId === only);
  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Trainer summary</div>
        <div className="mt-1 font-display text-lg font-bold text-ink-900 dark:text-ink-50">{s.trainerName} <span className="font-sans text-sm font-normal text-ink-500">· {fmtDay(s.date)}</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stat('Batches in report', String(s.batches.length))}
          {stat('Classes today', String(s.totalClasses))}
          {stat('Teaching time', fmtMins(s.teachingMinutes))}
          {stat('Students attended', `${s.batches.reduce((a, b) => a + b.present + b.late, 0)}/${s.batches.reduce((a, b) => a + b.total, 0)}`)}
        </div>
      </div>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Batch-wise reports</div>
          {s.batches.length > 1 && (
            <div className="inline-flex flex-wrap rounded-lg bg-ink-100 p-0.5 dark:bg-ink-800">
              {[{ id: 'all', label: 'All batches' }, ...s.batches.map((b) => ({ id: b.batchId, label: b.batchName }))].map((o) => (
                <button key={o.id} onClick={() => setOnly(o.id)} className={cx('rounded-md px-2.5 py-1 text-xs font-medium', only === o.id ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500')}>{o.label}</button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 space-y-3">
          {s.batches.length === 0 && <div className="rounded-lg border border-dashed border-ink-200 p-4 text-sm text-ink-500 dark:border-ink-700">No classes scheduled on this date.</div>}
          {shown.map((b) => <BatchBlock key={b.batchId} b={b} highlight={highlight?.has(b.batchId)} />)}
        </div>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Time summary</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {WORK_ORDER.filter((k) => s.work[k]).map((k) => (
            <div key={k} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm dark:border-ink-800">
              <span className="truncate text-ink-600 dark:text-ink-300">{k}</span><span className="font-medium tabular-nums text-ink-900 dark:text-ink-100">{fmtMins(s.work[k] ?? 0)}</span>
            </div>
          ))}
        </div>
      </div>
      {(s.remarks || s.exception) && (
        <div className="space-y-2 text-sm">
          {s.remarks && <div><span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Trainer remarks</span><p className="text-ink-800 dark:text-ink-100">{s.remarks}</p></div>}
          {s.exception && <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><b>Recorded exception:</b> {s.exception}</div>}
        </div>
      )}
    </div>
  );
}
