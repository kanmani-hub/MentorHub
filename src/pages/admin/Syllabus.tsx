import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, CheckCircle2, ChevronDown, ChevronRight, FileSpreadsheet, FileText, GitCompare, Pencil, Plus, Trash2, UploadCloud, X,
} from 'lucide-react';
import { useApp } from '../../store/AppStore';
import type { AppState, Module, SyllabusVersion, Topic } from '../../types';
import { allTopics, courseName, flatDays, latestVersion, publishedVersion, versionStats } from '../../store/selectors';
import { MOCK_EXCEL_HEADERS, MOCK_EXCEL_ROWS } from '../../data/mockSyllabus';
import { extractNotesFromPdf } from '../../utils/pdfExtract';
import { getFile, putFile } from '../../utils/fileStore';
import { PdfPages } from '../../components/common/PdfViewer';
import { Badge, Button, Card, Confirm, Empty, Field, Input, Modal, PageHeader, Progress, Select, SimNote, Stat, Table, Tabs } from '../../components/common/ui';
import { cx, fmtDate, nowTs, uid } from '../../utils';
import { SyllabusSwitch } from './NotesOfLesson';

/* ---------- validation helpers ---------- */
export const validateVersion = (v: SyllabusVersion | undefined, minPerDay: number) => {
  const days = flatDays(v);
  const dupes: { day: string; title: string }[] = [];
  let missing = 0;
  const review = new Set<string>();
  days.forEach(({ day }) => {
    const seen = new Set<string>();
    if (day.topics.length === 0) { missing += 1; review.add(day.id); }
    if (day.topics.length < minPerDay) review.add(day.id);
    day.topics.forEach((t) => {
      const k = t.title.trim().toLowerCase();
      if (!k) { missing += 1; review.add(day.id); }
      else if (seen.has(k)) { dupes.push({ day: day.title, title: t.title }); review.add(day.id); }
      seen.add(k);
    });
  });
  const imported = allTopics(v).filter((t) => t.source === 'pdf' || t.source === 'excel').length;
  return { dupes, missing, review: review.size, reviewIds: review, imported };
};

const diffVersions = (oldV?: SyllabusVersion, newV?: SyllabusVersion) => {
  const o = new Map(allTopics(oldV).map((t) => [t.key, t.title]));
  const n = new Map(allTopics(newV).map((t) => [t.key, t.title]));
  const added = [...n].filter(([k]) => !o.has(k)).map(([, t]) => t);
  const removed = [...o].filter(([k]) => !n.has(k)).map(([, t]) => t);
  const renamed = [...n].filter(([k, t]) => o.has(k) && o.get(k) !== t).map(([k, t]) => `${o.get(k)} → ${t}`);
  const om = (oldV?.modules ?? []).map((m) => m.title);
  const addedModules = (newV?.modules ?? []).filter((m) => !om.includes(m.title)).map((m) => m.title);
  return { added, removed, renamed, addedModules };
};

/* ---------- inline editable label ---------- */
function Editable({ value, onSave, className, disabled }: { value: string; onSave: (v: string) => void; className?: string; disabled?: boolean }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  if (edit) return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { onSave(v.trim() || value); setEdit(false); } if (e.key === 'Escape') setEdit(false); }}
        className="min-w-0 flex-1 rounded border border-royal-500 bg-white px-1.5 py-0.5 text-sm text-ink-900 focus:outline-none dark:bg-ink-900 dark:text-ink-100" />
      <button onClick={() => { onSave(v.trim() || value); setEdit(false); }} className="text-emerald-600" aria-label="Save"><Check size={15} /></button>
      <button onClick={() => { setV(value); setEdit(false); }} className="text-ink-400" aria-label="Cancel"><X size={15} /></button>
    </span>
  );
  return (
    <span className={cx('group/ed flex min-w-0 flex-1 items-center gap-1', className)}>
      <span className={cx('truncate', !value && 'italic text-red-500')}>{value || 'Untitled'}</span>
      {!disabled && <button onClick={() => { setV(value); setEdit(true); }} className="shrink-0 text-ink-300 opacity-0 hover:text-royal-600 group-hover/ed:opacity-100 focus:opacity-100" aria-label="Rename"><Pencil size={12} /></button>}
    </span>
  );
}

const IconBtn = ({ onClick, label, children, danger }: { onClick: () => void; label: string; children: React.ReactNode; danger?: boolean }) => (
  <button onClick={onClick} aria-label={label} title={label} className={cx('rounded p-1 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800', danger ? 'hover:text-red-600' : 'hover:text-royal-600')}>{children}</button>
);

const move = <T,>(arr: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

/* ---------- tree editor ---------- */
function TreeEditor({ v, editable, reviewIds }: { v: SyllabusVersion; editable: boolean; reviewIds: Set<string> }) {
  const { mutate, toast } = useApp();
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(v.modules.map((m) => [m.id, true])));
  const [newTopic, setNewTopic] = useState<Record<string, string>>({});
  const [del, setDel] = useState<{ label: string; fn: (d: AppState) => void } | null>(null);
  const edit = (fn: (mods: Module[]) => void, msg?: string) => {
    mutate((d) => { const x = d.syllabi.find((y) => y.id === v.id)!; fn(x.modules); });
    if (msg) toast(msg);
  };
  const addTopic = (mi: number, wi: number, di: number, dayId: string) => {
    const title = (newTopic[dayId] ?? '').trim();
    if (!title) return;
    const key = uid(`${v.courseId}-t`);
    edit((m) => m[mi].weeks[wi].days[di].topics.push({ id: key, key, title, source: 'manual' }));
    setNewTopic((p) => ({ ...p, [dayId]: '' }));
  };
  let dayCounter = 0;
  return (
    <div className="space-y-3">
      {v.modules.length === 0 && <Empty title="This syllabus is empty" body="Add the first module, or import from a PDF or Excel file." />}
      {v.modules.map((m, mi) => (
        <div key={m.id} className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
          <div className="flex items-center gap-1.5 bg-navy-50/70 px-2.5 py-2 dark:bg-navy-600/10">
            <button onClick={() => setOpen((o) => ({ ...o, [m.id]: !o[m.id] }))} className="text-ink-500" aria-label="Expand">{open[m.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
            <span className="shrink-0 text-xs font-semibold text-violet2-600 dark:text-violet-300">Module {mi + 1}</span>
            <Editable value={m.title} disabled={!editable} className="font-medium text-ink-900 dark:text-ink-50" onSave={(t) => edit((ms) => { ms[mi].title = t; })} />
            {editable && <>
              <IconBtn label="Move module up" onClick={() => edit((ms) => move(ms, mi, -1))}><ArrowUp size={14} /></IconBtn>
              <IconBtn label="Move module down" onClick={() => edit((ms) => move(ms, mi, 1))}><ArrowDown size={14} /></IconBtn>
              <IconBtn label="Add week" onClick={() => edit((ms) => { const n = ms.reduce((a, x) => a + x.weeks.length, 0) + 1; ms[mi].weeks.push({ id: uid('w'), title: `Week ${n}`, days: [] }); }, 'Week added')}><Plus size={14} /></IconBtn>
              <IconBtn danger label="Delete module" onClick={() => setDel({ label: `module "${m.title}" with all its weeks, days and topics`, fn: (d) => { d.syllabi.find((y) => y.id === v.id)!.modules.splice(mi, 1); } })}><Trash2 size={14} /></IconBtn>
            </>}
          </div>
          {open[m.id] && (
            <div className="space-y-3 p-3">
              {m.weeks.length === 0 && <div className="text-xs text-ink-500">No weeks yet{editable && ' — use + on the module row'}.</div>}
              {m.weeks.map((w, wi) => (
                <div key={w.id}>
                  <div className="flex items-center gap-1.5">
                    <Editable value={w.title} disabled={!editable} className="text-xs font-semibold text-royal-700 dark:text-blue-300" onSave={(t) => edit((ms) => { ms[mi].weeks[wi].title = t; })} />
                    {editable && <>
                      <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => edit((ms) => ms[mi].weeks[wi].days.push({ id: uid('d'), title: 'New lesson', topics: [] }), 'Day added')}>Add day</Button>
                      <IconBtn danger label="Delete week" onClick={() => setDel({ label: `${w.title} and its days`, fn: (d) => { d.syllabi.find((y) => y.id === v.id)!.modules[mi].weeks.splice(wi, 1); } })}><Trash2 size={13} /></IconBtn>
                    </>}
                  </div>
                  <div className="mt-1.5 space-y-2">
                    {w.days.map((day, di) => {
                      dayCounter += 1;
                      const flagged = reviewIds.has(day.id);
                      return (
                        <div key={day.id} className={cx('rounded-lg border p-2.5', flagged ? 'border-amber-400/70 bg-amber-50/40 dark:bg-amber-500/5' : 'border-ink-100 dark:border-ink-800')}>
                          <div className="flex items-center gap-1.5">
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-400">DAY {dayCounter}</span>
                            <Editable value={day.title} disabled={!editable} className="text-sm font-medium text-ink-900 dark:text-ink-100" onSave={(t) => edit((ms) => { ms[mi].weeks[wi].days[di].title = t; })} />
                            {flagged && <Badge color="orange" dot={false}>Review</Badge>}
                            {editable && <>
                              <IconBtn label="Move day up" onClick={() => edit((ms) => move(ms[mi].weeks[wi].days, di, -1))}><ArrowUp size={13} /></IconBtn>
                              <IconBtn label="Move day down" onClick={() => edit((ms) => move(ms[mi].weeks[wi].days, di, 1))}><ArrowDown size={13} /></IconBtn>
                              <IconBtn danger label="Delete day" onClick={() => setDel({ label: `day "${day.title}" and its ${day.topics.length} topics`, fn: (d) => { d.syllabi.find((y) => y.id === v.id)!.modules[mi].weeks[wi].days.splice(di, 1); } })}><Trash2 size={13} /></IconBtn>
                            </>}
                          </div>
                          <ol className="mt-1.5 space-y-0.5">
                            {day.topics.map((t: Topic, ti) => (
                              <li key={t.id} className="group flex items-center gap-1.5 rounded px-1 py-0.5 text-[13px] hover:bg-ink-50 dark:hover:bg-ink-800/50">
                                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-ink-400">{ti + 1}.</span>
                                <Editable value={t.title} disabled={!editable} className="text-ink-700 dark:text-ink-200" onSave={(x) => edit((ms) => { ms[mi].weeks[wi].days[di].topics[ti].title = x; })} />
                                {t.source && t.source !== 'seed' && <span className="shrink-0 rounded bg-ink-100 px-1 text-xs text-ink-500 dark:bg-ink-800">{t.source}</span>}
                                {editable && <span className="flex shrink-0 opacity-60 group-hover:opacity-100">
                                  <IconBtn label="Move topic up" onClick={() => edit((ms) => move(ms[mi].weeks[wi].days[di].topics, ti, -1))}><ArrowUp size={12} /></IconBtn>
                                  <IconBtn label="Move topic down" onClick={() => edit((ms) => move(ms[mi].weeks[wi].days[di].topics, ti, 1))}><ArrowDown size={12} /></IconBtn>
                                  <IconBtn danger label="Delete topic" onClick={() => edit((ms) => { ms[mi].weeks[wi].days[di].topics.splice(ti, 1); }, 'Topic deleted from draft')}><Trash2 size={12} /></IconBtn>
                                </span>}
                              </li>
                            ))}
                          </ol>
                          {editable && (
                            <div className="mt-1.5 flex gap-1.5 pl-6">
                              <input id={`nt-${day.id}`} value={newTopic[day.id] ?? ''} onChange={(e) => setNewTopic((p) => ({ ...p, [day.id]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && addTopic(mi, wi, di, day.id)}
                                placeholder="Add a topic and press Enter" className="h-7 min-w-0 flex-1 rounded-md border border-dashed border-ink-300 bg-transparent px-2 text-xs text-ink-800 placeholder:text-ink-400 focus:border-royal-500 focus:outline-none dark:border-ink-700 dark:text-ink-100" />
                              <Button size="sm" variant="secondary" onClick={() => addTopic(mi, wi, di, day.id)}>Add topic</Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {editable && <Button variant="secondary" icon={<Plus size={15} />} onClick={() => edit((ms) => ms.push({ id: uid('m'), title: `Module ${ms.length + 1}`, weeks: [{ id: uid('w'), title: `Week ${ms.reduce((a, x) => a + x.weeks.length, 0) + 1}`, days: [] }] }), 'Module added')}>Add module</Button>}
      <Confirm open={!!del} onClose={() => setDel(null)} title="Delete from draft?" confirmLabel="Delete" body={`Remove ${del?.label}? This only changes the draft; published versions and batch progress are untouched.`}
        onConfirm={() => { if (del) { mutate(del.fn); toast('Removed from draft'); } }} />
    </div>
  );
}

/* ---------- PDF import ---------- */
function PdfImport({ onDone }: { onDone: (courseId: string) => void }) {
  const { raw, mutate, toast } = useApp();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'pick' | 'upload' | 'preview'>('pick');
  const [prog, setProg] = useState(0);
  const [drag, setDrag] = useState(false);
  const [target, setTarget] = useState('C06');
  const [dropDupes, setDropDupes] = useState(true);
  const [dropEmpty, setDropEmpty] = useState(true);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const [extracted, setExtracted] = useState<Module[]>([]);
  const [pdfWarn, setPdfWarn] = useState<string[]>([]);
  const [pages, setPages] = useState(0);
  const vTmp: SyllabusVersion = { id: 'tmp', courseId: target, version: 0, status: 'Draft', createdAt: '', changeNote: '', modules: extracted };
  const val = validateVersion(vTmp, raw.settings.syllabusMinTopicsPerDay);
  const accept = (f?: File) => {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) { setErr('Choose a .pdf file. For spreadsheets use the Excel upload tab.'); return; }
    setErr(''); setFile(f); setStep('upload'); setProg(0);
    f.arrayBuffer().then(async (buf) => {
      const bytes = new Uint8Array(buf);
      putFile('syllabus-upload', bytes);
      const r = await extractNotesFromPdf(bytes, (pg, total) => setProg(Math.round((pg / total) * 100)));
      // syllabus import takes the day structure and Topics to Cover; objectives and tasks belong to Notes of Lesson
      const weeks: Module['weeks'] = [];
      r.days.forEach((d, i) => {
        const w = Math.floor(i / 5);
        if (!weeks[w]) weeks[w] = { id: uid('w'), title: `Week ${w + 1}`, days: [] };
        weeks[w].days.push({ id: uid('d'), title: d.title || `Day ${d.dayNumber}`, topics: d.topics.map((t) => { const k = uid('x-t'); return { id: k, key: k, title: t, source: 'pdf' as const }; }) });
      });
      setExtracted(weeks.length ? [{ id: uid('m'), title: (r.title || f.name.replace(/\.pdf$/i, '')).replace(/\s*[–-]\s*notes of lesson$/i, ''), weeks }] : []);
      setPdfWarn(r.warnings);
      setPages(r.pages);
      setStep('preview');
    }).catch((e) => { setErr(`Could not read this PDF: ${(e as Error).message}`); setStep('pick'); });
  };
  const doImport = () => {
    const mods: Module[] = JSON.parse(JSON.stringify(extracted));
    mods.forEach((m) => m.weeks.forEach((w) => {
      if (dropEmpty) w.days = w.days.filter((d) => d.topics.length);
      w.days.forEach((d) => {
        if (dropDupes) { const seen = new Set<string>(); d.topics = d.topics.filter((t) => { const k = t.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); }
        d.topics.forEach((t) => { t.id = uid(`${target}-t`); t.key = t.id; });
      });
    }));
    let vid = '';
    mutate((d) => {
      const lv = latestVersion(d, target);
      if (lv && lv.status === 'Draft') { lv.modules.push(...mods); vid = lv.id; }
      else {
        const base: Module[] = lv ? JSON.parse(JSON.stringify(lv.modules)) : [];
        const nv: SyllabusVersion = { id: uid(`${target}-v`), courseId: target, version: (lv?.version ?? 0) + 1, status: 'Draft', createdAt: nowTs(), changeNote: `Imported from ${file?.name}`, modules: [...base, ...mods] };
        d.syllabi.push(nv); vid = nv.id;
      }
    }, { action: 'Syllabus imported (PDF)', entity: courseName(raw, target), prev: '—', next: `${allTopics({ modules: mods } as SyllabusVersion).length} topics into draft`, reason: file?.name ?? '' });
    toast('Imported into a draft version. Review it, then publish.');
    void vid;
    onDone(target);
  };
  return (
    <div className="space-y-4">
      <SimNote>The PDF is read in your browser with pdf.js. Days are found from “Day N – Title” headings and their “Topics to Cover”. To keep learning objectives and student tasks too, upload the same file in Notes of Lesson Management.</SimNote>
      {step === 'pick' && (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]); }}
          className={cx('flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-12 text-center transition', drag ? 'border-royal-500 bg-royal-50 dark:bg-royal-500/10' : 'border-ink-300 dark:border-ink-700')}>
          <UploadCloud size={32} className="text-royal-500" />
          <div className="mt-2 font-medium text-ink-900 dark:text-ink-100">Drag and drop the syllabus PDF here</div>
          <div className="text-sm text-ink-500">or</div>
          <Button className="mt-2" variant="secondary" onClick={() => ref.current?.click()}>Browse files</Button>
          <input ref={ref} id="pdf-file" type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => accept(e.target.files?.[0])} />
          {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => { const b = getFile('F-PF-1'); if (b) accept(new File([new Uint8Array(b)], 'Python_Foundations_Notes_of_Lesson.pdf', { type: 'application/pdf' })); }}>Use the stored Python Foundations PDF</Button>
        </div>
      )}
      {step === 'upload' && (
        <Card><div className="flex items-center gap-3"><FileText className="text-red-500" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">{file?.name}</div><Progress value={Math.min(prog, 100)} label /></div></div><div className="mt-2 text-xs text-ink-500">Reading pages…</div></Card>
      )}
      {step === 'preview' && (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="File preview" subtitle={`${file?.name} · ${file ? Math.max(1, Math.round(file.size / 1024)) : 0} KB · ${pages} pages`} className="lg:col-span-2">
              <PdfPages fileId="syllabus-upload" />

            </Card>
            <Card title="Extracted content" subtitle={extracted.length ? 'Edit after import' : 'No day headings were found'} className="lg:col-span-3">
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1 text-sm">
                {extracted.map((m) => (
                  <div key={m.id}><div className="font-medium text-ink-900 dark:text-ink-50">{m.title}</div>
                    {m.weeks.map((w) => (
                      <div key={w.id} className="ml-3 mt-1"><div className="text-xs font-semibold text-royal-700 dark:text-blue-300">{w.title}</div>
                        {w.days.map((d) => (
                          <div key={d.id} className="ml-3 mt-1"><span className={cx('text-ink-800 dark:text-ink-100', !d.topics.length && 'text-red-600')}>{d.title}</span>
                            <span className="text-xs text-ink-500"> — {d.topics.map((t) => t.title).join(', ') || 'no topics found'}</span></div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card title="Validation summary">
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Modules / days" value={`${extracted.length} / ${flatDays(vTmp).length}`} />
              <Stat label="Topics found" value={allTopics(vTmp).length} tone="blue" />
              <Stat label="Duplicates" value={val.dupes.length} tone="orange" sub={val.dupes.map((d) => d.title).join(', ')} />
              <Stat label="Days without topics" value={flatDays(vTmp).filter((f) => !f.day.topics.length).length} tone="red" />
            </div>
            {pdfWarn.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{pdfWarn.slice(0, 8).map((w) => <div key={w}>⚠ {w}</div>)}</div>}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Import into course"><Select id="pdf-target" value={target} onChange={(e) => setTarget(e.target.value)}>{raw.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
              <label className="flex items-center gap-2 pt-5 text-sm text-ink-700 dark:text-ink-200"><input id="pdf-dupes" type="checkbox" checked={dropDupes} onChange={(e) => setDropDupes(e.target.checked)} className="accent-royal-600" />Skip duplicate topics</label>
              <label className="flex items-center gap-2 pt-5 text-sm text-ink-700 dark:text-ink-200"><input id="pdf-empty" type="checkbox" checked={dropEmpty} onChange={(e) => setDropEmpty(e.target.checked)} className="accent-royal-600" />Skip days with no topics</label>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => { setStep('pick'); setFile(null); }}>Choose another file</Button>
              <Button onClick={doImport} disabled={!extracted.length}>Confirm import to draft</Button>
            </div>
            <p className="mt-2 text-right text-xs text-ink-500">Topics land in a draft version of {courseName(raw, target)}. Nothing changes for running batches until you publish.</p>
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------- Excel import ---------- */
function ExcelImport({ onDone }: { onDone: (courseId: string) => void }) {
  const { raw, mutate, toast } = useApp();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<string>('');
  const [err, setErr] = useState('');
  const [map, setMap] = useState({ module: 0, week: 1, day: 2, topic: 3 });
  const [target, setTarget] = useState('__new');
  const ref = useRef<HTMLInputElement>(null);
  const rows = MOCK_EXCEL_ROWS.map((r, i) => {
    const rec = { module: r[map.module] ?? '', week: r[map.week] ?? '', day: r[map.day] ?? '', topic: r[map.topic] ?? '' };
    const missing = Object.entries(rec).filter(([, v]) => !v.trim()).map(([k]) => k);
    const dupe = MOCK_EXCEL_ROWS.slice(0, i).some((p) => p[map.module] === r[map.module] && p[map.day] === r[map.day] && p[map.topic] === r[map.topic] && r[map.topic]);
    return { i: i + 2, rec, missing, dupe, ok: !missing.length && !dupe };
  });
  const valid = rows.filter((r) => r.ok);
  const pick = (f?: File) => {
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { setErr('Choose an .xlsx, .xls or .csv file.'); return; }
    setErr(''); setFile(f.name); setStep(2);
  };
  const doImport = () => {
    let cid = target;
    const tree: Record<string, Record<string, Record<string, string[]>>> = {};
    valid.forEach(({ rec }) => { ((tree[rec.module] ??= {})[rec.week] ??= {})[rec.day] ??= []; tree[rec.module][rec.week][rec.day].push(rec.topic); });
    mutate((d) => {
      if (cid === '__new') {
        cid = `C${String(d.courses.length + 1).padStart(2, '0')}`;
        d.courses.push({ id: cid, name: 'Data Analytics with Pandas', description: 'Data wrangling and visualisation with pandas, matplotlib and seaborn.', category: 'Data', duration: '3 weeks', status: 'Draft', createdAt: new Date().toISOString().slice(0, 10) });
      }
      const mods: Module[] = Object.entries(tree).map(([mt, weeks]) => ({ id: uid('m'), title: mt, weeks: Object.entries(weeks).map(([wt, days]) => ({ id: uid('w'), title: wt, days: Object.entries(days).map(([dt, ts]) => ({ id: uid('d'), title: dt, topics: ts.map((t) => { const k = uid(`${cid}-t`); return { id: k, key: k, title: t, source: 'excel' as const }; }) })) })) }));
      const lv = latestVersion(d, cid);
      if (lv && lv.status === 'Draft') lv.modules.push(...mods);
      else d.syllabi.push({ id: uid(`${cid}-v`), courseId: cid, version: (lv?.version ?? 0) + 1, status: 'Draft', createdAt: nowTs(), changeNote: `Imported from ${file}`, modules: [...(lv ? JSON.parse(JSON.stringify(lv.modules)) : []), ...mods] });
    }, { action: 'Syllabus imported (Excel)', entity: target === '__new' ? 'Data Analytics with Pandas' : courseName(raw, target), prev: '—', next: `${valid.length} topics into draft`, reason: `${rows.length - valid.length} rows skipped` });
    toast(`${valid.length} topics imported, ${rows.length - valid.length} rows skipped`);
    setTimeout(() => onDone(cid), 0);
  };
  const steps = ['Upload file', 'Map columns', 'Validate rows', 'Confirm'];
  return (
    <div className="space-y-4">
      <SimNote>Spreadsheet parsing is simulated. Any file you choose loads the same 12 sample rows, including a duplicate and rows with missing fields.</SimNote>
      <div className="flex flex-wrap gap-2">{steps.map((s, i) => <div key={s} className={cx('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', step === i + 1 ? 'bg-royal-600 text-white' : step > i + 1 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>{step > i + 1 ? <Check size={12} /> : <span>{i + 1}</span>}{s}</div>)}</div>
      {step === 1 && (
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-ink-300 px-4 py-10 text-center dark:border-ink-700" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
          <FileSpreadsheet size={30} className="text-emerald-600" />
          <div className="mt-2 font-medium text-ink-900 dark:text-ink-100">Upload the syllabus spreadsheet</div>
          <div className="text-sm text-ink-500">One row per topic: module, week, day and topic title</div>
          <div className="mt-3 flex gap-2"><Button variant="secondary" onClick={() => ref.current?.click()}>Browse files</Button><Button variant="ghost" onClick={() => { setFile('Pandas_Syllabus.xlsx'); setStep(2); }}>Use sample file</Button></div>
          <input ref={ref} id="xl-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
        </div>
      )}
      {step === 2 && (
        <Card title="Map spreadsheet columns" subtitle={`${file} · ${MOCK_EXCEL_ROWS.length} data rows found`}>
          <div className="grid gap-3 sm:grid-cols-4">
            {(['module', 'week', 'day', 'topic'] as const).map((k) => (
              <Field key={k} label={{ module: 'Module', week: 'Week', day: 'Day / Lesson', topic: 'Topic' }[k]} required>
                <Select id={`map-${k}`} value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}>{MOCK_EXCEL_HEADERS.map((h, i) => <option key={h} value={i}>{h}</option>)}</Select>
              </Field>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-800">
            <table className="w-full min-w-[640px] text-xs"><thead><tr className="bg-ink-50 dark:bg-ink-800/50">{MOCK_EXCEL_HEADERS.map((h, i) => <th key={h} className={cx('px-2 py-1.5 text-left font-semibold', Object.values(map).includes(i) ? 'text-royal-700 dark:text-blue-300' : 'text-ink-400')}>{h}</th>)}</tr></thead>
              <tbody>{MOCK_EXCEL_ROWS.slice(0, 4).map((r, i) => <tr key={i} className="border-t border-ink-100 dark:border-ink-800">{r.map((c, j) => <td key={j} className="px-2 py-1.5 text-ink-700 dark:text-ink-200">{c || <span className="text-red-400">empty</span>}</td>)}</tr>)}</tbody></table>
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button onClick={() => new Set(Object.values(map)).size === 4 ? setStep(3) : toast('Each field must map to a different column.', 'error')}>Validate rows</Button></div>
        </Card>
      )}
      {step === 3 && (
        <Card title="Row validation" subtitle={`${valid.length} valid · ${rows.filter((r) => r.dupe).length} duplicate · ${rows.filter((r) => r.missing.length).length} with missing fields`} pad={false}>
          <Table head={['Row', 'Module', 'Week', 'Day', 'Topic', 'Result']} minW={720}>
            {rows.map((r) => (
              <tr key={r.i} className={r.ok ? '' : 'bg-red-50/50 dark:bg-red-500/5'}>
                <td className="tabular-nums">{r.i}</td><td>{r.rec.module || '—'}</td><td>{r.rec.week || <span className="text-red-500">missing</span>}</td><td>{r.rec.day}</td><td>{r.rec.topic || <span className="text-red-500">missing</span>}</td>
                <td>{r.ok ? <Badge color="green">Valid</Badge> : r.dupe ? <Badge color="orange">Duplicate — skipped</Badge> : <Badge color="red">Missing {r.missing.join(', ')}</Badge>}</td>
              </tr>
            ))}
          </Table>
          <div className="flex justify-end gap-2 p-3"><Button variant="secondary" onClick={() => setStep(2)}>Back</Button><Button onClick={() => setStep(4)}>Continue</Button></div>
        </Card>
      )}
      {step === 4 && (
        <Card title="Confirm import">
          <p className="text-sm text-ink-600 dark:text-ink-300">{valid.length} topics will be imported into a draft syllabus version. {rows.length - valid.length} rows will be skipped.</p>
          <Field label="Target course" className="mt-3 max-w-sm"><Select id="xl-target" value={target} onChange={(e) => setTarget(e.target.value)}><option value="__new">+ New course: Data Analytics with Pandas</option>{raw.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setStep(3)}>Back</Button><Button onClick={doImport}>Import {valid.length} topics</Button></div>
        </Card>
      )}
    </div>
  );
}

/* ---------- page ---------- */
export default function Syllabus({ courseId: initial }: { courseId?: string }) {
  const { state: s, mutate, toast, raw } = useApp();
  const [cid, setCid] = useState(initial ?? 'C01');
  const [tab, setTab] = useState<'editor' | 'pdf' | 'excel' | 'versions'>('editor');
  const [review, setReview] = useState(false);
  const [viewVid, setViewVid] = useState<string | null>(null);
  const course = s.courses.find((c) => c.id === cid);
  const versions = s.syllabi.filter((v) => v.courseId === cid).sort((a, b) => b.version - a.version);
  const pub = publishedVersion(s, cid);
  const draft = versions.find((v) => v.status === 'Draft');
  const shown = (viewVid && versions.find((v) => v.id === viewVid)) || draft || pub || versions[0];
  const minPer = s.settings.syllabusMinTopicsPerDay;

  // institute-wide validation dashboard (latest version of each course)
  const totals = s.courses.reduce((acc, c) => {
    const v = latestVersion(s, c.id);
    const st = versionStats(v);
    const val = validateVersion(v, minPer);
    acc.modules += st.modules; acc.weeks += st.weeks; acc.days += st.days; acc.topics += st.topics;
    acc.imported += val.imported; acc.missing += val.missing; acc.dupes += val.dupes.length; acc.review += val.review;
    return acc;
  }, { modules: 0, weeks: 0, days: 0, topics: 0, imported: 0, missing: 0, dupes: 0, review: 0 });
  const curVal = validateVersion(shown, minPer);
  const diff = diffVersions(pub, draft);
  const batchesOn = (vid: string) => s.batches.filter((b) => b.syllabusVersionId === vid);

  const newDraft = () => {
    const base = pub ?? versions[0];
    mutate((d) => {
      const nv: SyllabusVersion = { ...JSON.parse(JSON.stringify(base)), id: uid(`${cid}-v`), version: Math.max(...versions.map((v) => v.version), 0) + 1, status: 'Draft', createdAt: nowTs(), publishedAt: undefined, changeNote: 'Draft changes' };
      d.syllabi.push(nv);
    }, { action: 'Syllabus draft created', entity: course?.name ?? cid, prev: base ? `v${base.version}` : '—', next: 'New draft', reason: '' });
    setViewVid(null);
    toast('New draft created from the published version');
  };
  const publish = (note: string, migrate: boolean) => {
    if (!draft) return;
    const moved = migrate ? batchesOn(pub?.id ?? '').map((b) => b.id) : [];
    mutate((d) => {
      d.syllabi.forEach((v) => { if (v.courseId === cid && v.status === 'Published') v.status = 'Superseded'; });
      const x = d.syllabi.find((v) => v.id === draft.id)!;
      x.status = 'Published'; x.publishedAt = nowTs(); x.changeNote = note || x.changeNote;
      d.batches.forEach((b) => { if (moved.includes(b.id)) b.syllabusVersionId = x.id; });
      const c = d.courses.find((y) => y.id === cid); if (c && c.status === 'Draft') c.status = 'Published';
    }, { action: 'Syllabus published', entity: `${course?.name} v${draft.version}`, prev: pub ? `v${pub.version}` : '—', next: `v${draft.version} (+${diff.added.length} / −${diff.removed.length} topics)`, reason: `${note}${moved.length ? ` · ${moved.length} batch(es) moved` : ' · running batches stay on their version'}` });
    toast(`Version ${draft.version} published${moved.length ? ` and ${moved.length} batch(es) moved to it` : ''}`);
  };

  return (
    <div>
      <SyllabusSwitch value="syllabus" />
      <PageHeader title="Syllabus Management" sub="Course → Module → Week → Day → Topic. Edit drafts freely; publishing never rewrites a batch's recorded progress." />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-ink-200/80 bg-white px-4 py-3 text-sm shadow-sm dark:border-ink-800 dark:bg-ink-900 dark:shadow-none sm:px-5">
        {([['courses', s.courses.length], ['modules', totals.modules], ['weeks', totals.weeks], ['days', totals.days], ['topics', totals.topics], ['imported', totals.imported]] as const).map(([k, v]) => (
          <span key={k} className="text-ink-500 dark:text-ink-400"><b className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">{v}</b> {k}</span>
        ))}
        <span className="ml-auto flex flex-wrap gap-2">
          {totals.missing > 0 && <Badge color="red">{totals.missing} missing topics</Badge>}
          {totals.dupes > 0 && <Badge color="orange">{totals.dupes} duplicates</Badge>}
          {totals.review > 0 && <Badge color="orange">{totals.review} days need review</Badge>}
          {!totals.missing && !totals.dupes && !totals.review && <Badge color="green">No issues</Badge>}
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card title="Courses" pad={false}>
          <ul className="max-h-[560px] overflow-y-auto py-1">
            {s.courses.map((c) => {
              const lv = latestVersion(s, c.id); const pv = publishedVersion(s, c.id);
              return (
                <li key={c.id}><button onClick={() => { setCid(c.id); setViewVid(null); setTab('editor'); }} className={cx('flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm', cid === c.id ? 'bg-royal-50 text-royal-700 dark:bg-royal-500/10 dark:text-blue-300' : 'text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800/40')}>
                  <span className="min-w-0"><span className="block truncate font-medium">{c.name}</span><span className="block text-xs text-ink-500">{versionStats(lv).topics} topics · {pv ? `v${pv.version} live` : 'unpublished'}</span></span>
                  {lv?.status === 'Draft' && <Badge color="orange" dot={false}>Draft</Badge>}
                </button></li>
              );
            })}
          </ul>
        </Card>
        <div className="min-w-0">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'editor', label: 'Syllabus tree' }, { id: 'pdf', label: 'PDF upload' }, { id: 'excel', label: 'Excel upload' }, { id: 'versions', label: 'Versions', count: versions.length }]} />
          {tab === 'editor' && shown && (
            <Card title={<span className="flex flex-wrap items-center gap-2">{course?.name} <Badge>{shown.status}</Badge><span className="text-xs font-normal text-ink-500">v{shown.version}</span></span>}
              subtitle={`${versionStats(shown).modules} modules · ${versionStats(shown).days} days · ${versionStats(shown).topics} topics · ${shown.changeNote}`}
              action={<>
                {shown.status !== 'Draft' && !draft && <Button size="sm" onClick={newDraft}>Create draft to edit</Button>}
                {shown.status !== 'Draft' && draft && <Button size="sm" variant="secondary" onClick={() => setViewVid(null)}>Open draft v{draft.version}</Button>}
                {shown.status === 'Draft' && <>
                  <Button size="sm" variant="secondary" onClick={() => toast(`Draft v${shown.version} saved. Changes are kept while you edit.`)}>Save as draft</Button>
                  <Button size="sm" variant="success" icon={<GitCompare size={14} />} onClick={() => setReview(true)}>Review & publish</Button>
                </>}
              </>}>
              {shown.status !== 'Draft' && <div className="mb-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800/50 dark:text-ink-300">Published versions are read-only. Create a draft to change topics; batches keep using v{shown.version} until you move them.</div>}
              {(curVal.dupes.length > 0 || curVal.missing > 0) && <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><AlertTriangle size={14} className="mt-px shrink-0" />{curVal.dupes.length} duplicate topic(s), {curVal.missing} missing topic(s). Highlighted days need review.</div>}
              <TreeEditor key={shown.id} v={shown} editable={shown.status === 'Draft'} reviewIds={curVal.reviewIds} />
            </Card>
          )}
          {tab === 'editor' && !shown && <Card><Empty title="No syllabus for this course" action={<Button onClick={() => mutate((d) => { d.syllabi.push({ id: uid(`${cid}-v`), courseId: cid, version: 1, status: 'Draft', createdAt: nowTs(), changeNote: 'New syllabus', modules: [] }); })}>Start a syllabus</Button>} /></Card>}
          {tab === 'pdf' && <PdfImport onDone={(c) => { setCid(c); setViewVid(null); setTab('editor'); }} />}
          {tab === 'excel' && <ExcelImport onDone={(c) => { setCid(c); setViewVid(null); setTab('editor'); }} />}
          {tab === 'versions' && (
            <Card pad={false} title="Version history" subtitle="Each batch stays pinned to the version it was assigned">
              <Table head={['Version', 'Status', 'Topics', 'Created', 'Published', 'Change note', 'Batches using it', '']} minW={820}>
                {versions.map((v) => (
                  <tr key={v.id}><td className="font-medium">v{v.version}</td><td><Badge>{v.status}</Badge></td><td className="tabular-nums">{versionStats(v).topics}</td><td>{fmtDate(v.createdAt.slice(0, 10))}</td><td>{v.publishedAt ? fmtDate(v.publishedAt.slice(0, 10)) : '—'}</td><td className="max-w-xs truncate">{v.changeNote}</td>
                    <td>{batchesOn(v.id).map((b) => b.name).join(', ') || '—'}</td><td><Button size="sm" variant="ghost" onClick={() => { setViewVid(v.id); setTab('editor'); }}>View</Button></td></tr>
                ))}
              </Table>
            </Card>
          )}
        </div>
      </div>
      {review && draft && <ReviewModal onClose={() => setReview(false)} diff={diff} draft={draft} pubVersion={pub?.version} batches={batchesOn(pub?.id ?? '').map((b) => b.name)} val={validateVersion(draft, minPer)} reviewRequired={raw.settings.syllabusReviewRequired} onPublish={publish} />}
    </div>
  );
}

function ReviewModal({ onClose, diff, draft, pubVersion, batches, val, onPublish, reviewRequired }: {
  onClose: () => void; diff: ReturnType<typeof diffVersions>; draft: SyllabusVersion; pubVersion?: number; batches: string[]; val: ReturnType<typeof validateVersion>; reviewRequired: boolean; onPublish: (note: string, migrate: boolean) => void;
}) {
  const [note, setNote] = useState(draft.changeNote);
  const [migrate, setMigrate] = useState(false);
  const [ack, setAck] = useState(!reviewRequired);
  const blocked = val.missing > 0;
  return (
    <Modal open onClose={onClose} size="lg" title={`Review changes · v${pubVersion ?? 0} → v${draft.version}`} sub="Check what changes before it goes live"
      footer={<><Button variant="secondary" onClick={onClose}>Keep editing</Button><Button variant="success" disabled={blocked || !ack} onClick={() => { onPublish(note, migrate); onClose(); }}>Publish v{draft.version}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Topics added" value={diff.added.length} tone="green" /><Stat label="Topics removed" value={diff.removed.length} tone="red" /><Stat label="Renamed" value={diff.renamed.length} tone="orange" /><Stat label="New modules" value={diff.addedModules.length} tone="purple" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
        <div><div className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Added</div><ul className="space-y-0.5">{diff.added.map((t) => <li key={t} className="text-ink-700 dark:text-ink-200">+ {t}</li>)}{!diff.added.length && <li className="text-ink-400">None</li>}</ul></div>
        <div><div className="mb-1 text-xs font-semibold text-red-600">Removed / renamed</div><ul className="space-y-0.5">{diff.removed.map((t) => <li key={t} className="text-ink-700 dark:text-ink-200">− {t}</li>)}{diff.renamed.map((t) => <li key={t} className="text-ink-700 dark:text-ink-200">~ {t}</li>)}{!diff.removed.length && !diff.renamed.length && <li className="text-ink-400">None</li>}</ul></div>
      </div>
      {val.dupes.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Duplicate topics: {val.dupes.map((d) => `${d.title} (${d.day})`).join(', ')}</div>}
      {blocked && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-300">{val.missing} day(s)/topic(s) are empty. Fix them before publishing.</div>}
      <Field label="Change note" className="mt-4"><Input id="rv-note" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="mt-4 rounded-lg border border-ink-200 p-3 text-sm dark:border-ink-800">
        <div className="font-medium text-ink-900 dark:text-ink-100">Running batches on v{pubVersion ?? '—'}: {batches.join(', ') || 'none'}</div>
        <p className="mt-1 text-xs text-ink-500">By default they keep their current version. Moving them carries over progress for topics that exist in both versions; recorded history is never rewritten.</p>
        <label className="mt-2 flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200"><input id="rv-migrate" type="checkbox" checked={migrate} onChange={(e) => setMigrate(e.target.checked)} className="accent-royal-600" disabled={!batches.length} />Move these batches to v{draft.version} now</label>
      </div>
      {reviewRequired && <label className="mt-3 flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200"><input id="rv-ack" type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="accent-royal-600" /><CheckCircle2 size={14} className="text-emerald-500" />I have reviewed these changes</label>}
    </Modal>
  );
}
