import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, FileSpreadsheet, FileText, FileUp, Layers, Loader2, PenLine, Plus, Send, UploadCloud } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { ModuleTabs } from '../../components/layout/ModuleTabs';
import { nolIssues, useNolActions } from '../../store/actions';
import { lessonPlan, nolDayCompletion, sessionDates, taskChecksFor, trainerName } from '../../store/selectors';
import type { NotesOfLesson } from '../../types';
import { Badge, Button, Card, Confirm, Empty, Modal, PageHeader, Progress, Select, SimNote, Stat, Table, Tabs } from '../../components/common/ui';
import { NolDayEditor, NolDayView } from '../../components/common/NolDay';
import { PdfPages, PdfViewerModal } from '../../components/common/PdfViewer';
import { extractNotesFromPdf } from '../../utils/pdfExtract';
import { extractNotesFromSheet } from '../../utils/nolExcel';
import type { ParsedNotes } from '../../utils/nolParser';
import { cx, fmtDate, fmtDateTime, pct, todayISO } from '../../utils';

export function SyllabusSwitch({ value }: { value: 'syllabus' | 'nol' | 'notes' }) {
  return <ModuleTabs value={value} tabs={[{ id: 'syllabus', label: 'Syllabus structure' }, { id: 'nol', label: 'Notes of Lesson Management' }, { id: 'notes', label: 'Topic Lesson Notes' }]} />;
}

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function UploadPanel({ courseId, onDone }: { courseId: string; onDone: (nolId: string) => void }) {
  const { toast } = useApp();
  const act = useNolActions();
  const pdfRef = useRef<HTMLInputElement>(null);
  const xlRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; page: number; total: number } | null>(null);
  const [result, setResult] = useState<{ id: string; parsed: ParsedNotes; name: string; kind: string } | null>(null);
  const [drag, setDrag] = useState(false);

  const handle = async (f?: File) => {
    if (!f) return;
    const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
    const isSheet = /\.(xlsx|xls|csv)$/i.test(f.name);
    if (!isPdf && !isSheet) { toast('Choose a PDF, Excel (.xlsx/.xls) or CSV file.', 'error'); return; }
    setResult(null);
    setBusy({ name: f.name, page: 0, total: 0 });
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let parsed: ParsedNotes; let pages: number | undefined;
      if (isPdf) {
        const r = await extractNotesFromPdf(bytes, (page, total) => setBusy({ name: f.name, page, total }));
        parsed = r; pages = r.pages;
      } else parsed = extractNotesFromSheet(buf);
      const id = act.importParsed(courseId, parsed, isPdf ? 'pdf' : 'excel', { name: f.name, size: f.size, mime: f.type || (isPdf ? 'application/pdf' : 'application/vnd.ms-excel'), bytes, pages });
      if (id) setResult({ id, parsed, name: f.name, kind: isPdf ? 'PDF' : 'Excel' });
    } catch (e) {
      toast(`Could not read ${f.name}: ${(e as Error).message}`, 'error');
    } finally { setBusy(null); }
  };
  const counts = result && {
    days: result.parsed.days.length,
    topics: result.parsed.days.reduce((a, d) => a + d.topics.length, 0),
    objectives: result.parsed.days.reduce((a, d) => a + d.objectives.length, 0),
    tasks: result.parsed.days.reduce((a, d) => a + d.tasks.length, 0),
    dayWarn: result.parsed.days.filter((d) => d.warnings.length).length,
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="PDF upload" subtitle="Text is read from the PDF in your browser and split into days">
          <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
            className={cx('flex flex-col items-center rounded-xl border-2 border-dashed px-3 py-8 text-center', drag ? 'border-royal-500 bg-royal-50 dark:bg-royal-500/10' : 'border-ink-300 dark:border-ink-700')}>
            <UploadCloud size={28} className="text-royal-500" />
            <div className="mt-2 text-sm font-medium text-ink-900 dark:text-ink-100">Drop the Notes of Lesson PDF</div>
            <Button className="mt-3" variant="secondary" onClick={() => pdfRef.current?.click()} disabled={!!busy}>Browse PDF</Button>
            <input ref={pdfRef} id="nol-pdf" type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <p className="mt-2 text-xs text-ink-500">Expected layout: “Day N – Title”, then “Topics to Cover”, “Learning Objectives” and “Student Tasks” with bulleted or numbered items.</p>
        </Card>
        <Card title="Excel upload" subtitle="One sheet, one row per item or one row per day">
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-ink-300 px-3 py-8 text-center dark:border-ink-700" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handle(e.dataTransfer.files[0]); }}>
            <FileSpreadsheet size={28} className="text-emerald-600" />
            <div className="mt-2 text-sm font-medium text-ink-900 dark:text-ink-100">Drop an .xlsx, .xls or .csv file</div>
            <Button className="mt-3" variant="secondary" onClick={() => xlRef.current?.click()} disabled={!!busy}>Browse spreadsheet</Button>
            <input ref={xlRef} id="nol-xl" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[300px] text-[11px]"><thead><tr className="text-left text-ink-500">{['Day', 'Day Title', 'Section', 'Item'].map((h) => <th key={h} className="border-b border-ink-200 px-1 py-0.5 dark:border-ink-700">{h}</th>)}</tr></thead>
            <tbody className="text-ink-700 dark:text-ink-300"><tr><td className="px-1">1</td><td className="px-1">Programming Basics</td><td className="px-1">Topics to Cover</td><td className="px-1">What is programming?</td></tr><tr><td className="px-1">1</td><td /><td className="px-1">Student Tasks</td><td className="px-1">Write an algorithm…</td></tr></tbody></table>
            <p className="mt-1 text-[11px] text-ink-500">Or columns Day · Day Title · Topics to Cover · Learning Objectives · Student Tasks, with items on separate lines.</p></div>
        </Card>
        <Card title="Manual lesson entries" subtitle="Type the notes day by day">
          <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-ink-300 px-3 py-8 text-center dark:border-ink-700">
            <PenLine size={28} className="text-violet2-600" />
            <div className="mt-2 text-sm text-ink-600 dark:text-ink-300">Start an empty draft and add days with topics, objectives and five tasks each.</div>
            <Button className="mt-3" variant="secondary" icon={<Plus size={15} />} onClick={() => { const id = act.createDraft(courseId); if (id) { act.addDay(id); onDone(id); } }}>Start manual notes</Button>
          </div>
        </Card>
      </div>
      {busy && <Card><div className="flex items-center gap-3"><Loader2 className="animate-spin text-royal-600" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">Reading {busy.name}</div>{busy.total > 0 && <Progress value={pct(busy.page, busy.total)} label />}<div className="text-xs text-ink-500">{busy.total ? `Page ${busy.page} of ${busy.total}` : 'Opening file…'}</div></div></div></Card>}
      {result && counts && (
        <Card title={`Extracted from ${result.name}`} subtitle={`${result.parsed.title || 'Untitled'}${result.parsed.duration ? ` · ${result.parsed.duration}` : ''}`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><Stat label="Lesson days" value={counts.days} tone="blue" /><Stat label="Topics" value={counts.topics} /><Stat label="Learning objectives" value={counts.objectives} tone="purple" /><Stat label="Student tasks" value={counts.tasks} tone="green" /><Stat label="Days with warnings" value={counts.dayWarn} tone={counts.dayWarn ? 'orange' : 'green'} /></div>
          {result.parsed.warnings.length > 0 ? <div className="mt-3 space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{result.parsed.warnings.slice(0, 12).map((w) => <div key={w}>⚠ {w}</div>)}</div>
            : <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={16} />Every day has its three sections and all tasks were found.</div>}
          <div className="mt-4 flex justify-end"><Button icon={<Eye size={15} />} onClick={() => onDone(result.id)}>Review extracted content</Button></div>
        </Card>
      )}
    </div>
  );
}

function PreviewPublish({ n, onPublished }: { n: NotesOfLesson; onPublished: () => void }) {
  const { state: s } = useApp();
  const act = useNolActions();
  const [dayId, setDayId] = useState(n.days[0]?.id);
  const [page, setPage] = useState<number | undefined>(n.days[0]?.page);
  const [gen, setGen] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [discard, setDiscard] = useState(false);
  const file = s.files.find((f) => f.id === n.sourceFileId);
  const day = n.days.find((d) => d.id === dayId) ?? n.days[0];
  const issues = nolIssues(n);
  const draft = n.status === 'Draft';
  const batchesUsing = s.batches.filter((b) => b.courseId === n.courseId && b.nolId);
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><div className="font-display font-bold text-ink-900 dark:text-ink-50">{n.title} · v{n.version}</div><div className="text-xs text-ink-500">{n.days.length} days · source {n.sourceKind.toUpperCase()}{file ? ` (${file.name})` : ''} · <Badge>{n.status}</Badge></div></div>
          {draft && <>
            <Button variant="ghost" onClick={() => setDiscard(true)}>Discard draft</Button>
            <Button variant="secondary" onClick={() => act.saveDraft(n.id)}>Save as draft</Button>
            <Button variant="success" icon={<Send size={15} />} onClick={() => setConfirm(true)} disabled={issues.length > 0}>Publish</Button>
          </>}
        </div>
        {draft && (issues.length || n.warnings.length) ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {issues.length > 0 && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300"><b>Fix before publishing:</b>{issues.slice(0, 8).map((i) => <div key={i}>• {i}</div>)}{issues.length > 8 && <div>…and {issues.length - 8} more</div>}</div>}
            {n.warnings.length > 0 && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><b>Extraction warnings:</b>{n.warnings.slice(0, 8).map((w) => <div key={w}>⚠ {w}</div>)}</div>}
          </div>
        ) : draft ? <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={16} />Ready to publish: every day has topics, objectives and five student tasks.</div> : null}
      </Card>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {n.days.map((d) => {
          const bad = d.warnings.length || d.tasks.length !== 5 || !d.topics.length || !d.objectives.length;
          return <button key={d.id} onClick={() => { setDayId(d.id); if (d.page) setPage(d.page); }} className={cx('shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset', d.id === day?.id ? 'bg-navy-700 text-white ring-navy-700 dark:bg-royal-600' : bad ? 'bg-amber-50 text-amber-800 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-white text-ink-700 ring-ink-200 dark:bg-ink-900 dark:text-ink-200 dark:ring-ink-700')}>Day {d.dayNumber}</button>;
        })}
        {draft && <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => act.addDay(n.id)}>Add day</Button>}
      </div>
      <div className={cx('grid gap-4', file?.mime === 'application/pdf' && 'xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
        {file?.mime === 'application/pdf' && <Card title="Original PDF" subtitle="Compare the extraction with the source page"><PdfPages fileId={file.id} page={page ?? 1} onPage={setPage} /></Card>}
        <Card title={day ? `Day ${day.dayNumber} – ${day.title || 'Untitled'}` : 'No days'} subtitle={draft ? 'Edit anything extracted incorrectly. The original wording is kept for comparison.' : 'Published notes are read-only'}>
          {!day ? <Empty title="No lesson days yet" action={draft && <Button onClick={() => act.addDay(n.id)}>Add day</Button>} /> : draft
            ? <NolDayEditor key={day.id} day={day} onChange={(p) => act.updateDay(n.id, day.id, p)} onRestore={() => act.restoreDay(n.id, day.id)} onDelete={() => act.deleteDay(n.id, day.id)} />
            : <NolDayView day={day} />}
        </Card>
      </div>
      {confirm && (
        <Modal open onClose={() => setConfirm(false)} size="md" title={`Publish ${n.title} v${n.version}?`} footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="success" onClick={() => { if (act.publish(n.id, { generateSyllabus: gen })) { setConfirm(false); onPublished(); } }}>Publish</Button></>}>
          <div className="grid grid-cols-3 gap-2"><Stat label="Days" value={n.days.length} /><Stat label="Topics" value={n.days.reduce((a, d) => a + d.topics.length, 0)} /><Stat label="Student tasks" value={n.days.reduce((a, d) => a + d.tasks.length, 0)} /></div>
          <label className="mt-4 flex items-start gap-2 text-sm text-ink-700 dark:text-ink-200"><input id="nol-gen" type="checkbox" className="mt-1 accent-royal-600" checked={gen} onChange={(e) => setGen(e.target.checked)} /><span>Generate a new syllabus version from these days, so Today's Lesson and topic progress follow the notes. Topics that keep their day and wording keep their recorded progress.</span></label>
          <p className="mt-3 text-xs text-ink-500">Batches already on {batchesUsing.length ? batchesUsing.map((b) => b.name).join(', ') : 'earlier notes'} keep their current version until you assign this one. The published syllabus is never changed in place.</p>
        </Modal>
      )}
      <Confirm open={discard} onClose={() => setDiscard(false)} title="Discard this draft?" body="The extracted days are deleted. The uploaded file stays in Source files." confirmLabel="Discard" onConfirm={() => { act.discardDraft(n.id); onPublished(); }} />
    </div>
  );
}

function BatchAssignment({ courseId }: { courseId: string }) {
  const { state: s } = useApp();
  const act = useNolActions();
  const published = s.nols.filter((n) => n.courseId === courseId && n.status !== 'Draft').sort((a, b) => b.version - a.version);
  const [nolId, setNolId] = useState(published.find((n) => n.status === 'Published')?.id ?? published[0]?.id ?? '');
  const [sel, setSel] = useState<string[]>([]);
  const batches = s.batches.filter((b) => b.courseId === courseId);
  const target = s.nols.find((n) => n.id === nolId);
  if (!published.length) return <Card><Empty title="Nothing to assign yet" body="Publish the Notes of Lesson first." /></Card>;
  return (
    <Card title="Assign to batches" subtitle="Each batch uses exactly one Notes of Lesson version and the syllabus version generated with it" pad={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
        <Select id="assign-nol" value={nolId} onChange={(e) => setNolId(e.target.value)} className="!w-auto">{published.map((n) => <option key={n.id} value={n.id} disabled={n.status !== 'Published'}>v{n.version} · {n.status}{n.publishedAt ? ` · ${fmtDate(n.publishedAt.slice(0, 10))}` : ''}</option>)}</Select>
        <span className="text-xs text-ink-500">{target?.syllabusVersionId ? `Linked syllabus v${s.syllabi.find((v) => v.id === target.syllabusVersionId)?.version}` : 'No linked syllabus version'}</span>
        <span className="flex-1" />
        <Button disabled={!sel.length || target?.status !== 'Published'} onClick={() => { if (act.assign(nolId, sel)) setSel([]); }}>Assign to {sel.length || ''} batch{sel.length === 1 ? '' : 'es'}</Button>
      </div>
      <Table head={['', 'Batch', 'Trainer', 'Status', 'Notes of Lesson', 'Syllabus', '']} minW={760} empty={!batches.length && <Empty title="No batches on this course" />}>
        {batches.map((b) => {
          const cur = s.nols.find((n) => n.id === b.nolId);
          return (
            <tr key={b.id}>
              <td><input type="checkbox" aria-label={`Select ${b.name}`} className="accent-royal-600" checked={sel.includes(b.id)} onChange={(e) => setSel(e.target.checked ? [...sel, b.id] : sel.filter((x) => x !== b.id))} /></td>
              <td className="font-medium text-ink-900 dark:text-ink-50">{b.name}</td><td>{trainerName(s, b.trainerId)}</td><td><Badge>{b.status}</Badge></td>
              <td>{cur ? <span className="flex items-center gap-1.5">v{cur.version} <Badge>{cur.status}</Badge></span> : <Badge color="grey">Not assigned</Badge>}</td>
              <td>v{s.syllabi.find((v) => v.id === b.syllabusVersionId)?.version}</td>
              <td className="text-right">{cur && <Button size="sm" variant="ghost" onClick={() => act.unassign(b.id)}>Unassign</Button>}</td>
            </tr>
          );
        })}
      </Table>
    </Card>
  );
}

function TrainerProgress({ courseId }: { courseId: string }) {
  const { state: s } = useApp();
  const batches = s.batches.filter((b) => b.courseId === courseId && b.nolId);
  if (!batches.length) return <Card><Empty title="No batches have these notes yet" /></Card>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">Two separate measures: topic completion per lesson day (syllabus progress) and student tasks marked completed by the trainer.</p>
      {batches.map((b) => {
        const n = s.nols.find((x) => x.id === b.nolId)!;
        const held = sessionDates(s, b.id);
        const today = todayISO();
        const plan = lessonPlan(s, b, today);
        return (
          <Card key={b.id} title={`${b.name} · ${trainerName(s, b.trainerId)}`} subtitle={`Notes v${n.version} · next lesson Day ${plan.dayNumber} · ${held.filter((d) => d < today).length} classes held`}>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 lg:grid-cols-[repeat(25,minmax(0,1fr))]">
              {n.days.map((d) => {
                const c = nolDayCompletion(s, b, d.dayNumber);
                const tasks = s.taskChecks.filter((t) => t.batchId === b.id && t.dayNumber === d.dayNumber && t.status === 'Completed').length;
                const tone = c.complete ? 'bg-emerald-500 text-white' : c.done ? 'bg-amber-400 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800';
                return <div key={d.id} title={`Day ${d.dayNumber} – ${d.title}: topics ${c.done}/${c.total}, tasks ${tasks}/${d.tasks.length}`} className={cx('rounded-md px-1 py-1.5 text-center text-[11px] font-semibold tabular-nums', tone)}>{d.dayNumber}<div className="text-[9px] font-normal opacity-80">{tasks}/{d.tasks.length}</div></div>;
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-500"><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-500" />All topics completed</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-400" />Some topics completed</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-ink-200 dark:bg-ink-700" />Not started</span><span>Small number = student tasks completed / 5</span></div>
            {(() => { const last = held.filter((d) => d <= today).slice(-1)[0]; const ch = last ? taskChecksFor(s, b.id, last) : []; return last ? <div className="mt-2 text-xs text-ink-600 dark:text-ink-300">Last class {fmtDate(last)}: {ch.filter((c) => c.status === 'Completed').length} of {ch.length || 5} student tasks completed</div> : null; })()}
          </Card>
        );
      })}
    </div>
  );
}

export default function NotesOfLessonPage({ courseId: initial }: { courseId?: string }) {
  const { state: s } = useApp();
  const [cid, setCid] = useState(initial ?? 'C01');
  const [tab, setTab] = useState<'days' | 'upload' | 'preview' | 'assign' | 'files' | 'progress'>('days');
  const versions = useMemo(() => s.nols.filter((n) => n.courseId === cid).sort((a, b) => b.version - a.version), [s.nols, cid]);
  const [vid, setVid] = useState<string | null>(null);
  const [viewFile, setViewFile] = useState<{ id: string; name: string } | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  const act = useNolActions();
  const current = versions.find((v) => v.id === vid) ?? versions.find((v) => v.status === 'Draft') ?? versions.find((v) => v.status === 'Published') ?? versions[0];
  const coursesWithNol = new Set(s.nols.filter((n) => n.status === 'Published').map((n) => n.courseId));
  const pdfs = s.files.filter((f) => f.mime === 'application/pdf');
  const assigned = s.batches.filter((b) => b.nolId);
  const files = s.files.filter((f) => f.courseId === cid);
  const day = current?.days[Math.min(dayIdx, (current?.days.length ?? 1) - 1)];

  return (
    <div>
      <SyllabusSwitch value="nol" />
      <PageHeader title="Notes of Lesson Management" sub="Upload the Notes of Lesson once, check the day-wise extraction against the original, publish, then assign to batches." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Courses with Notes of Lesson" value={coursesWithNol.size} sub={`of ${s.courses.length} courses`} tone="blue" />
        <Stat label="Lesson PDFs uploaded" value={pdfs.length} tone="purple" />
        <Stat label="Published Notes of Lesson" value={s.nols.filter((n) => n.status === 'Published').length} sub={`${s.nols.filter((n) => n.status === 'Draft').length} draft`} tone="green" />
        <Stat label="Batches with lesson notes" value={assigned.length} sub={`of ${s.batches.filter((b) => b.status !== 'Completed').length} batches`} />
      </div>

      <h2 className="mb-2 mt-6 font-display text-base font-bold text-ink-900 dark:text-ink-50">Course notes</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {s.courses.map((c) => {
          const vs = s.nols.filter((n) => n.courseId === c.id);
          const pub = vs.find((n) => n.status === 'Published');
          const dr = vs.find((n) => n.status === 'Draft');
          return (
            <button key={c.id} onClick={() => { setCid(c.id); setVid(null); setDayIdx(0); setTab(vs.length ? 'days' : 'upload'); }} className={cx('rounded-xl border p-3.5 text-left transition', cid === c.id ? 'border-royal-500 bg-royal-50/50 ring-1 ring-royal-500 dark:bg-royal-500/10' : 'border-ink-200 bg-white hover:border-royal-500/50 dark:border-ink-800 dark:bg-ink-900')}>
              <div className="flex items-start justify-between gap-2"><span className="font-medium text-ink-900 dark:text-ink-50">{c.name}</span>{pub ? <Badge>Published</Badge> : dr ? <Badge>Draft</Badge> : <Badge color="grey" dot={false}>None</Badge>}</div>
              <div className="mt-1 text-xs text-ink-500">{(pub ?? dr) ? `${(pub ?? dr)!.days.length} lesson days · v${(pub ?? dr)!.version}${pub && dr ? ` · v${dr.version} draft` : ''}` : 'No notes uploaded'}</div>
              <div className="mt-0.5 text-xs text-ink-500">{s.batches.filter((b) => b.courseId === c.id && b.nolId).length} batch(es) assigned</div>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold text-ink-900 dark:text-ink-50">{s.courses.find((c) => c.id === cid)?.name}</h2>
          {versions.length > 0 && <Select id="nol-version" value={current?.id} onChange={(e) => { setVid(e.target.value); setDayIdx(0); }} className="!w-auto">{versions.map((v) => <option key={v.id} value={v.id}>v{v.version} · {v.status} · {v.days.length} days</option>)}</Select>}
          {current && current.status !== 'Draft' && !versions.some((v) => v.status === 'Draft') && <Button size="sm" variant="secondary" onClick={() => { const id = act.createDraft(cid, current.id); if (id) { setVid(id); setTab('preview'); } }}>Create revision to edit</Button>}
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'days', label: 'Day-wise lessons', count: current?.days.length }, { id: 'upload', label: 'Upload notes' }, { id: 'preview', label: 'Preview & publish' }, { id: 'assign', label: 'Batch assignment' }, { id: 'files', label: 'Source files', count: files.length }, { id: 'progress', label: 'Trainer progress' }]} />
        {tab === 'upload' && <UploadPanel courseId={cid} onDone={(id) => { setVid(id); setDayIdx(0); setTab('preview'); }} />}
        {tab === 'days' && (!current ? <Card><Empty icon={<FileUp size={20} />} title="No Notes of Lesson for this course" body="Upload a PDF or Excel file, or enter lessons manually." action={<Button onClick={() => setTab('upload')}>Upload notes</Button>} /></Card> : (
          <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
            <Card pad={false} title={`${current.days.length} days`} subtitle={`v${current.version} · ${current.status}`}>
              <ul className="max-h-[560px] overflow-y-auto py-1">{current.days.map((d, i) => (
                <li key={d.id}><button onClick={() => setDayIdx(i)} className={cx('flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm', i === dayIdx ? 'bg-royal-50 text-royal-700 dark:bg-royal-500/10 dark:text-blue-300' : 'text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800/40')}>
                  <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-ink-400">Day {d.dayNumber}</span><span className="truncate">{d.title}</span>{d.warnings.length > 0 && <AlertTriangle size={13} className="ml-auto shrink-0 text-amber-500" />}
                </button></li>
              ))}</ul>
            </Card>
            {day ? (
              <Card title={`Day ${day.dayNumber} – ${day.title}`} subtitle={current.status === 'Draft' ? 'Draft: edit in Preview & publish' : 'Published content, read-only'} action={<>
                {current.sourceFileId && s.files.find((f) => f.id === current.sourceFileId)?.mime === 'application/pdf' && <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={() => setViewFile({ id: current.sourceFileId!, name: s.files.find((f) => f.id === current.sourceFileId)!.name })}>Original PDF{day.page ? ` · p.${day.page}` : ''}</Button>}
                {current.status === 'Draft' && <Button size="sm" onClick={() => setTab('preview')}>Edit</Button>}
              </>}>
                <NolDayView day={day} />
              </Card>
            ) : <Card><Empty title="No days" /></Card>}
          </div>
        ))}
        {tab === 'preview' && (current ? <PreviewPublish key={current.id} n={current} onPublished={() => { setVid(null); setTab('days'); }} /> : <Card><Empty title="Nothing to preview" action={<Button onClick={() => setTab('upload')}>Upload notes</Button>} /></Card>)}
        {tab === 'assign' && <BatchAssignment key={cid} courseId={cid} />}
        {tab === 'files' && (
          <Card pad={false} title="Original uploaded files" subtitle="Each file stays linked to the Notes of Lesson version extracted from it">
            <Table head={['File', 'Size', 'Pages', 'Uploaded', 'By', 'Linked notes', '']} minW={760} empty={!files.length && <Empty title="No files uploaded for this course" />}>
              {files.map((f) => { const n = s.nols.find((x) => x.id === f.nolId); return (
                <tr key={f.id}><td className="font-medium text-ink-900 dark:text-ink-50"><span className="flex items-center gap-2">{f.mime === 'application/pdf' ? <FileText size={15} className="text-red-500" /> : <FileSpreadsheet size={15} className="text-emerald-600" />}{f.name}</span></td>
                  <td className="tabular-nums">{kb(f.size)}</td><td className="tabular-nums">{f.pages ?? '—'}</td><td className="whitespace-nowrap text-xs">{fmtDateTime(f.uploadedAt)}</td><td>{f.uploadedBy}</td><td>{n ? <span className="flex items-center gap-1.5">v{n.version}<Badge>{n.status}</Badge></span> : '—'}</td>
                  <td className="text-right">{f.mime === 'application/pdf' && <Button size="sm" variant="secondary" icon={<Eye size={13} />} onClick={() => setViewFile({ id: f.id, name: f.name })}>View</Button>}</td></tr>
              ); })}
            </Table>
          </Card>
        )}
        {tab === 'progress' && <TrainerProgress courseId={cid} />}
      </div>
      {viewFile && <PdfViewerModal fileId={viewFile.id} name={viewFile.name} page={tab === 'days' ? day?.page : 1} onClose={() => setViewFile(null)} />}
    </div>
  );
}
