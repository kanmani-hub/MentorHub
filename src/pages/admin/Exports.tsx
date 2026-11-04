import { useMemo, useState } from 'react';
import { Copy, Download, FileSpreadsheet } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { batchReportFor, buildSnapshot, courseName, derivedStatus, flatDays, latestProgress, reportFor, studentsOf, syllabusOf, trainerName } from '../../store/selectors';
import { Button, Card, Field, Input, PageHeader, Select, SimNote, Table } from '../../components/common/ui';
import { addDays, fmtMins, todayISO } from '../../utils';

type Kind = 'daily' | 'batch' | 'attendance' | 'topics' | 'tasks' | 'students';
const KINDS: { id: Kind; label: string; needs: ('dates' | 'trainer' | 'batch')[] }[] = [
  { id: 'daily', label: 'Consolidated daily reports', needs: ['dates', 'trainer'] },
  { id: 'batch', label: 'Batch reports (activities, assignments, projects)', needs: ['dates', 'batch'] },
  { id: 'attendance', label: 'Attendance register', needs: ['dates', 'batch'] },
  { id: 'topics', label: 'Topic progress by syllabus day', needs: ['batch'] },
  { id: 'tasks', label: 'Student task checklist (Notes of Lesson)', needs: ['dates', 'batch'] },
  { id: 'students', label: 'Student list', needs: ['batch'] },
];

const csvCell = (v: unknown) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const toCsv = (head: string[], rows: (string | number)[][]) => [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
const datesBetween = (from: string, to: string) => { const out: string[] = []; for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d); return out; };

export default function Exports() {
  const { state: s, toast, mutate } = useApp();
  const [kind, setKind] = useState<Kind>('daily');
  const [from, setFrom] = useState(addDays(todayISO(), -7));
  const [to, setTo] = useState(todayISO());
  const [trainer, setTrainer] = useState('All');
  const [batch, setBatch] = useState('All');
  const k = KINDS.find((x) => x.id === kind)!;
  const batches = s.batches.filter((b) => batch === 'All' || b.id === batch);

  const { head, rows } = useMemo(() => {
    const dates = datesBetween(from, to);
    if (kind === 'daily') {
      const rows: (string | number)[][] = [];
      dates.forEach((d) => s.trainers.filter((t) => trainer === 'All' || t.id === trainer).forEach((t) => {
        const r = reportFor(s, t.id, d);
        if (!r && !s.attendance.some((a) => a.date === d && s.batches.find((b) => b.id === a.batchId)?.trainerId === t.id)) return;
        const snap = r?.versions.at(-1)?.snapshot ?? buildSnapshot(s, t.id, d);
        rows.push([d, t.name, snap.batches.map((b) => b.batchName).join('; '), derivedStatus(s, t.id, d), r?.versions.length ?? 0, r?.versions.at(-1)?.submittedAt ?? '',
          snap.batches.reduce((a, b) => a + b.present + b.late, 0) + '/' + snap.batches.reduce((a, b) => a + b.total, 0),
          snap.batches.reduce((a, b) => a + b.completed.length, 0), snap.batches.reduce((a, b) => a + b.partial.length, 0), snap.batches.reduce((a, b) => a + b.pending.length, 0), fmtMins(snap.teachingMinutes)]);
      }));
      return { head: ['Date', 'Trainer', 'Batches', 'Status', 'Versions', 'Last submitted', 'Attended', 'Topics completed', 'Partially completed', 'Pending', 'Teaching time'], rows };
    }
    if (kind === 'batch') {
      const rows: (string | number)[][] = [];
      s.batchReports.filter((r) => r.date >= from && r.date <= to && batches.some((b) => b.id === r.batchId)).sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => {
        rows.push([r.date, trainerName(s, r.trainerId), s.batches.find((b) => b.id === r.batchId)?.name ?? '', r.status, r.practicals.map((p) => `${p.type}: ${p.text}`).join('; '),
          r.assignments.map((a) => `${a.name} (due ${a.deadline})`).join('; '), r.doubts.map((d) => d.text).join('; '), (() => { const w = s.waUpdates.find((x) => x.batchId === r.batchId && x.date === r.date); return (w?.studentIds ?? []).map((id) => { const n = s.students.find((x) => x.id === id)?.name ?? id; const t = w?.voiceNotes?.find((x) => x.studentId === id)?.title; return t ? `${n} – ${t}` : n; }).join('; '); })(),
          r.projects.map((p) => `${p.name} [${p.status}] ${p.assigned}`).join('; '), r.remarks]);
      });
      return { head: ['Date', 'Trainer', 'Batch', 'Status', 'Practical activities', 'Homework / assignments', 'Doubts', 'Student voice notes', 'Project work', 'Remarks'], rows };
    }
    if (kind === 'attendance') {
      const rows: (string | number)[][] = [];
      s.attendance.filter((a) => a.date >= from && a.date <= to && batches.some((b) => b.id === a.batchId)).sort((a, b) => a.date.localeCompare(b.date)).forEach((a) => {
        studentsOf(s, a.batchId, false).forEach((st) => rows.push([a.date, s.batches.find((b) => b.id === a.batchId)?.name ?? '', st.id, st.name, a.marks[st.id] ?? 'Not marked', a.reasons?.[st.id] ?? '', a.lateTimes?.[st.id] ?? '', a.status]));
      });
      return { head: ['Date', 'Batch', 'Student ID', 'Student', 'Status', 'Reason', 'Arrival time', 'Session status'], rows };
    }
    if (kind === 'topics') {
      const rows: (string | number)[][] = [];
      batches.forEach((b) => flatDays(syllabusOf(s, b)).forEach((fd) => fd.day.topics.forEach((t) => {
        const lp = latestProgress(s, b.id, t.key);
        rows.push([b.name, courseName(s, b.courseId), fd.index + 1, fd.day.title, t.title, lp?.status === 'Pending' ? 'Not Covered' : lp?.status ?? 'Not started', lp?.date ?? '', lp?.reason ?? '']);
      })));
      return { head: ['Batch', 'Course', 'Day', 'Day title', 'Topic', 'Latest status', 'Updated on', 'Reason'], rows };
    }
    if (kind === 'tasks') {
      const rows: (string | number)[][] = [];
      s.taskChecks.filter((t) => t.date >= from && t.date <= to && batches.some((b) => b.id === t.batchId)).sort((a, b) => a.date.localeCompare(b.date) || a.taskIndex - b.taskIndex).forEach((t) => {
        const day = s.nols.find((n) => n.id === t.nolId)?.days.find((d) => d.dayNumber === t.dayNumber);
        rows.push([t.date, s.batches.find((b) => b.id === t.batchId)?.name ?? '', trainerName(s, t.trainerId), t.dayNumber, day?.title ?? '', t.taskIndex + 1, day?.tasks[t.taskIndex] ?? '', t.status]);
      });
      return { head: ['Class date', 'Batch', 'Trainer', 'Lesson day', 'Day title', 'Task no.', 'Task', 'Status'], rows };
    }
    const rows = s.students.filter((st) => batches.some((b) => b.id === st.batchId)).map((st) => { const b = s.batches.find((x) => x.id === st.batchId)!; return [st.id, st.name, st.email, st.mobile, courseName(s, b.courseId), b.name, st.joiningDate, st.status]; });
    return { head: ['Student ID', 'Name', 'Email', 'Mobile', 'Course', 'Batch', 'Joined', 'Status'], rows };
  }, [s, kind, from, to, trainer, batch]);

  const csv = toCsv(head, rows);
  const fileName = `trainerhub_${kind}_${k.needs.includes('dates') ? `${from}_to_${to}` : todayISO()}.csv`;
  const audit = (how: string) => mutate(() => {}, { action: `Report exported (${how})`, entity: k.label, prev: '—', next: `${rows.length} rows`, reason: fileName });
  const copy = () => navigator.clipboard?.writeText(csv).then(() => { toast(`${rows.length} rows copied as CSV`); audit('copied'); }).catch(() => { (document.getElementById('csv-out') as HTMLTextAreaElement)?.select(); toast('Text selected. Press Ctrl+C to copy.', 'info'); });
  const download = async () => {
    // inside the Claude viewer, files are offered through the downloads capability; when run locally, a normal browser download
    const host = (window as unknown as { claude?: { use: (n: string) => Promise<{ save: (r: { filename: string; data: string }) => Promise<unknown> } | null> } }).claude;
    const dl = host ? await host.use('downloads').catch(() => null) : null;
    if (dl) {
      try { await dl.save({ filename: fileName, data: `\ufeff${csv}` }); toast(`${fileName} saved`); audit('downloaded'); }
      catch (e) { const code = (e as { code?: string }).code; if (code !== 'declined') toast(code === 'rate_limited' ? 'A save is already waiting for your answer.' : 'This view cannot save files. Use Copy CSV instead.', code === 'rate_limited' ? 'info' : 'error'); }
      return;
    }
    if (host) { toast('This view cannot save files. Use Copy CSV instead.', 'error'); return; }
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Download started: ${fileName}`); audit('downloaded');
  };

  return (
    <div>
      <PageHeader title="Reports & Export" sub="Build a report from live records, preview it, then copy or download it as CSV (opens in Excel)" />
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card title="Report">
          <div className="space-y-3">
            <Field label="Report type"><Select id="ex-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>{KINDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></Field>
            {k.needs.includes('dates') && <div className="grid grid-cols-2 gap-2"><Field label="From"><Input id="ex-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><Input id="ex-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></div>}
            {k.needs.includes('trainer') && <Field label="Trainer"><Select id="ex-trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)}><option value="All">All trainers</option>{s.trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>}
            {k.needs.includes('batch') && <Field label="Batch"><Select id="ex-batch" value={batch} onChange={(e) => setBatch(e.target.value)}><option value="All">All batches</option>{s.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>}
            <div className="rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800/50"><span className="font-display text-xl font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{rows.length}</span> <span className="text-ink-500">rows · {head.length} columns</span></div>
            <div className="grid gap-2">
              <Button icon={<Download size={15} />} onClick={download} disabled={!rows.length}>Download CSV</Button>
              <Button variant="secondary" icon={<Copy size={15} />} onClick={copy} disabled={!rows.length}>Copy CSV</Button>
            </div>
            <SimNote>Download asks you to confirm the file before saving. PDF exports need the backend.</SimNote>
            <p className="text-xs text-ink-500">A single consolidated report can also be exported as text from its page in Daily Reports Management.</p>
          </div>
        </Card>
        <div className="min-w-0 space-y-4">
          <Card pad={false} title={<span className="flex items-center gap-2"><FileSpreadsheet size={16} className="text-emerald-600" />{fileName}</span>} subtitle={rows.length > 50 ? 'Showing the first 50 rows' : undefined}>
            <Table head={head} minW={Math.max(640, head.length * 130)} empty={!rows.length && <div className="p-6 text-center text-sm text-ink-500">No records match these filters.</div>}>
              {rows.slice(0, 50).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="max-w-[260px] truncate text-xs" title={String(c)}>{String(c) || '—'}</td>)}</tr>)}
            </Table>
          </Card>
          <details className="rounded-xl border border-ink-200 bg-white p-3 text-sm dark:border-ink-800 dark:bg-ink-900"><summary className="cursor-pointer text-ink-700 dark:text-ink-200">Raw CSV</summary><textarea id="csv-out" readOnly value={csv} className="mt-2 h-48 w-full rounded-lg border border-ink-200 bg-ink-50 p-2 font-mono text-[11px] text-ink-800 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-200" /></details>
        </div>
      </div>
    </div>
  );
}
