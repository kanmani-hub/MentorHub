import { useEffect, useRef, useState } from 'react';
import { CheckSquare, ClipboardPaste, FileSpreadsheet, Mic, Save, Upload } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { useWhatsAppUpdates } from '../../store/actions';
import { activeTrainerBatches, isDayLocked, studentsOf } from '../../store/selectors';
import type { WhatsAppUpdate } from '../../types';
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Table, Textarea } from '../../components/common/ui';
import { matchNames, namesFromSheet, namesFromText } from '../../utils/waNames';
import { cx, fmtDate, fmtDateTime, todayISO } from '../../utils';
import { useWorkDate } from './common';

type Source = WhatsAppUpdate['source'];

export function WhatsAppUpdatesPage() {
  const { state: s, user, toast } = useApp();
  const { date, setDate } = useWorkDate();
  const save = useWhatsAppUpdates();
  const tid = user!.trainerId!;
  const batches = activeTrainerBatches(s, tid).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const [bid, setBid] = useState(batches[0]?.id ?? '');
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [paste, setPaste] = useState('');
  const [fromUpload, setFromUpload] = useState<Record<string, string>>({}); // studentId -> name as written in the upload
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, { title: string; submittedAt: string }>>({}); // studentId -> what the voice note was about
  const [source, setSource] = useState<Source>('manual');
  const [fileName, setFileName] = useState<string>();
  const [found, setFound] = useState<number | null>(null);
  const [fBatch, setFBatch] = useState('All');
  const [fDate, setFDate] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const b = batches.find((x) => x.id === bid);
  const saved = b ? s.waUpdates.find((w) => w.batchId === b.id && w.date === date) : undefined;
  const locked = isDayLocked(s, tid, date);
  const studs = b ? studentsOf(s, b.id) : [];

  // reopen: load the saved selection for this batch + date
  useEffect(() => {
    setTicked(new Set(saved?.studentIds ?? []));
    setNotes(Object.fromEntries((saved?.voiceNotes ?? []).map((v) => [v.studentId, { title: v.title ?? '', submittedAt: (v.submittedAt ?? date).slice(0, 10) }])));
    setUnmatched(saved?.unmatched ?? []);
    setFromUpload({}); setFound(null); setSource(saved?.source ?? 'manual'); setFileName(saved?.fileName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid, date, saved?.savedAt]);

  const ingest = (names: string[], src: Source, fname?: string) => {
    if (!b) return;
    if (!names.length) { toast('No names were found. Check the text or file.', 'error'); return; }
    const r = matchNames(names, studs);
    setFromUpload(Object.fromEntries(r.matched.map((m) => [m.studentId, m.name])));
    setUnmatched(r.unmatched);
    setFound(names.length); setSource(src); setFileName(fname);
    toast(`${names.length} name${names.length === 1 ? '' : 's'} read · ${r.matched.length} matched · ${r.unmatched.length} need review`, r.unmatched.length ? 'info' : 'success');
  };
  const onFile = async (f?: File) => {
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'txt') ingest(namesFromText(await f.text()), 'txt', f.name);
      else if (ext === 'csv') ingest(namesFromSheet(await f.arrayBuffer()), 'csv', f.name);
      else if (ext === 'xlsx' || ext === 'xls') ingest(namesFromSheet(await f.arrayBuffer()), 'excel', f.name);
      else toast('Choose an Excel (.xlsx/.xls), CSV or TXT file.', 'error');
    } catch (e) { toast(`Could not read ${f.name}: ${(e as Error).message}`, 'error'); }
  };
  const toggle = (id: string) => setTicked((t) => { const n = new Set(t); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const matchUnmatched = (name: string, studentId: string) => {
    if (!studentId) return;
    setFromUpload((m) => ({ ...m, [studentId]: name }));
    setUnmatched((u) => u.filter((x) => x !== name));
  };
  const noteOf = (id: string) => notes[id] ?? { title: '', submittedAt: date };
  const setNote = (id: string, patch: Partial<{ title: string; submittedAt: string }>) => setNotes((n) => ({ ...n, [id]: { ...noteOf(id), ...patch } }));
  const onSave = () => { if (b) save(b.id, date, [...ticked], unmatched, source, fileName, Object.fromEntries([...ticked].map((id) => [id, noteOf(id)]))); };

  const ordered = [...studs].sort((x, y) => Number(!!fromUpload[y.id]) - Number(!!fromUpload[x.id]) || x.name.localeCompare(y.name));
  const savedNote = (id: string) => saved?.voiceNotes?.find((v) => v.studentId === id);
  const notesChanged = [...ticked].some((id) => { const n = noteOf(id), o = savedNote(id); return n.title.trim() !== (o?.title ?? '') || n.submittedAt !== (o?.submittedAt ?? date).slice(0, 10); });
  const dirty = !saved ? ticked.size > 0 : [...ticked].sort().join() !== [...saved.studentIds].sort().join() || notesChanged;
  const myUpdates = s.waUpdates.filter((w) => (fBatch === 'All' || w.batchId === fBatch) && (!fDate || w.date === fDate)).sort((x, y) => y.date.localeCompare(x.date) || x.batchId.localeCompare(y.batchId));
  const nameOf = (id: string) => s.students.find((x) => x.id === id)?.name ?? id;

  if (!b) return <div><PageHeader title="Student Voice Notes" /><Card><Empty title="No active batches assigned" /></Card></div>;
  return (
    <div>
      <PageHeader title="Student Voice Notes" sub="Record which students sent you a voice note and what it was about. The list goes into your daily report under the batch and class date." />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_200px_auto]">
          <Field label="Batch"><Select id="wa-batch" value={b.id} onChange={(e) => setBid(e.target.value)}>{batches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
          <Field label="Class date"><Input id="wa-date" type="date" value={date} max={todayISO()} min={b.startDate} onChange={(e) => e.target.value && e.target.value <= todayISO() && setDate(e.target.value)} /></Field>
          <div className="flex items-end">{saved ? <Badge color="green">Saved · {saved.studentIds.length} voice note{saved.studentIds.length === 1 ? '' : 's'}</Badge> : <Badge color="grey">Nothing saved for this date</Badge>}</div>
        </div>
      </Card>
      {locked && <div className="mt-3 rounded-lg bg-ink-100 px-3 py-2 text-sm text-ink-600 dark:bg-ink-800 dark:text-ink-300">The daily report for {fmtDate(date)} has been submitted, so this selection can no longer be edited.</div>}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Card title="1. Add names" subtitle="Paste names (chat lines work too) or upload a list. Names are matched to this batch only; no students are created.">
          <div className="mb-3 inline-flex rounded-lg bg-ink-100 p-0.5 dark:bg-ink-800">
            {([['paste', 'Paste names', ClipboardPaste], ['file', 'Upload file', Upload]] as const).map(([k, l, I]) => (
              <button key={k} onClick={() => setMode(k)} className={cx('flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium', mode === k ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500')}><I size={14} />{l}</button>
            ))}
          </div>
          {mode === 'paste' ? (
            <>
              <Textarea id="wa-paste" rows={7} value={paste} disabled={locked} onChange={(e) => setPaste(e.target.value)} placeholder={'One name per line, or paste chat lines, e.g.\nDiya Patel\n[04/11/26, 9:15 am] Ishaan Reddy: voice note\n+91 98123 88771'} />
              <div className="mt-2 flex justify-end"><Button disabled={locked || !paste.trim()} onClick={() => ingest(namesFromText(paste), 'paste')}>Read names</Button></div>
            </>
          ) : (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-ink-300 px-3 py-8 text-center dark:border-ink-700" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!locked) onFile(e.dataTransfer.files[0]); }}>
              <FileSpreadsheet size={26} className="text-emerald-600" />
              <div className="mt-2 text-sm font-medium text-ink-900 dark:text-ink-100">Excel, CSV or TXT</div>
              <div className="text-xs text-ink-500">A "Name" column, or one name per row / line</div>
              <Button className="mt-3" variant="secondary" disabled={locked} onClick={() => fileRef.current?.click()}>Browse file</Button>
              <input ref={fileRef} id="wa-file" type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          )}
          {found !== null && (
            <div className="mt-3 text-sm text-ink-600 dark:text-ink-300">{fileName ? `${fileName}: ` : ''}{found} name{found === 1 ? '' : 's'} read · <b className="text-emerald-700 dark:text-emerald-400">{Object.keys(fromUpload).length} matched</b> · <b className={unmatched.length ? 'text-amber-700 dark:text-amber-400' : ''}>{unmatched.length} unmatched</b></div>
          )}
          {unmatched.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <div className="mb-2 text-xs font-semibold text-amber-800 dark:text-amber-300">Not matched to a student in {b.name} — review</div>
              <ul className="space-y-1.5">{unmatched.map((n) => (
                <li key={n} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 text-ink-800 dark:text-ink-100">{n}</span>
                  <Select aria-label={`Match ${n}`} value="" disabled={locked} onChange={(e) => matchUnmatched(n, e.target.value)} className="h-8 !w-44 py-0 text-xs"><option value="">Match to student…</option>{studs.filter((st) => !fromUpload[st.id]).map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</Select>
                  <Button size="sm" variant="ghost" disabled={locked} onClick={() => setUnmatched((u) => u.filter((x) => x !== n))}>Ignore</Button>
                </li>
              ))}</ul>
            </div>
          )}
        </Card>

        <Card title="2. Tick students and describe each voice note" subtitle={`${ticked.size} of ${studs.length} selected`}
          action={<>
            {Object.keys(fromUpload).length > 0 && <Button size="sm" variant="secondary" icon={<CheckSquare size={14} />} disabled={locked} onClick={() => setTicked((t) => new Set([...t, ...Object.keys(fromUpload)]))}>Tick all from upload</Button>}
            <Button size="sm" variant="ghost" disabled={locked || !ticked.size} onClick={() => setTicked(new Set())}>Clear</Button>
          </>}>
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {ordered.map((st) => (
              <li key={st.id}>
                <label className={cx('flex cursor-pointer items-center gap-3 py-2', locked && 'cursor-not-allowed')}>
                  <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={ticked.has(st.id)} disabled={locked} onChange={() => toggle(st.id)} aria-label={st.name} />
                  <span className="min-w-0 flex-1"><span className="text-sm text-ink-900 dark:text-ink-50">{st.name}</span> <span className="font-mono text-xs text-ink-400">{st.id}</span>
                    {fromUpload[st.id] && <span className="block text-xs text-emerald-700 dark:text-emerald-400">In upload as “{fromUpload[st.id]}”</span>}</span>
                  {fromUpload[st.id] && <Badge color="green" dot={false}>Matched</Badge>}
                </label>
                {ticked.has(st.id) && (
                  <div className="mb-2 ml-7 grid gap-2 sm:grid-cols-[1fr_150px]">
                    <Input aria-label={`Voice note title for ${st.name}`} value={noteOf(st.id).title} disabled={locked} maxLength={120} onChange={(e) => setNote(st.id, { title: e.target.value })} placeholder="Title or description, e.g. Doubt on loops" className="h-8 text-sm" />
                    <Input aria-label={`Submission date for ${st.name}`} type="date" value={noteOf(st.id).submittedAt} max={todayISO()} disabled={locked} onChange={(e) => e.target.value && setNote(st.id, { submittedAt: e.target.value })} className="h-8 text-sm" />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-ink-100 pt-3 dark:border-ink-800">
            <span className="mr-auto text-xs text-ink-500">{saved ? `Last saved ${fmtDateTime(saved.savedAt)} by ${saved.savedBy}` : 'Not saved yet'}{dirty ? ' · unsaved changes' : ''}</span>
            <Button icon={<Save size={15} />} disabled={locked || (!dirty && !!saved)} onClick={onSave}>Save</Button>
          </div>
        </Card>
      </div>

      <Card className="mt-4" pad={false} title="Saved voice notes" subtitle="Shown in the daily report as “Student Voice Notes”"
        action={<>
          <Select id="wa-fbatch" value={fBatch} onChange={(e) => setFBatch(e.target.value)} className="!w-auto"><option value="All">All my batches</option>{s.batches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          <Input id="wa-fdate" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="!w-auto" />
          {fDate && <Button size="sm" variant="ghost" onClick={() => setFDate('')}>All dates</Button>}
        </>}>
        <Table head={['Class date', 'Batch', 'Student voice notes', 'Saved', '']} minW={720} empty={!myUpdates.length && <Empty icon={<Mic size={20} />} title="No saved voice notes for this filter" />}>
          {myUpdates.map((w) => {
            const lockedW = isDayLocked(s, tid, w.date);
            return (
              <tr key={w.id} className={w.batchId === b.id && w.date === date ? 'bg-royal-50/50 dark:bg-royal-500/5' : ''}>
                <td className="whitespace-nowrap">{fmtDate(w.date)}</td>
                <td className="whitespace-nowrap">{s.batches.find((x) => x.id === w.batchId)?.name}</td>
                <td><ul className="list-disc space-y-0.5 pl-4 text-sm">{w.studentIds.map((id) => { const vn = w.voiceNotes?.find((x) => x.studentId === id); return <li key={id}>{nameOf(id)}{vn?.title && <span className="text-ink-500"> – {vn.title}</span>}</li>; })}</ul>{!w.studentIds.length && <span className="text-xs text-ink-400">None selected</span>}</td>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(w.savedAt)}<br />{w.savedBy}</td>
                <td className="text-right">{lockedW ? <Badge color="grey" dot={false}>Report submitted</Badge> : <Button size="sm" variant="secondary" onClick={() => { setBid(w.batchId); setDate(w.date); window.scrollTo({ top: 0 }); document.getElementById('main-scroll')?.scrollTo({ top: 0 }); }}>Edit</Button>}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}

export function AdminWhatsAppUpdates() {
  const { state: s } = useApp();
  const [fBatch, setFBatch] = useState('All');
  const [fDate, setFDate] = useState(todayISO());
  const list = s.waUpdates.filter((w) => (fBatch === 'All' || w.batchId === fBatch) && (!fDate || w.date === fDate)).sort((x, y) => y.date.localeCompare(x.date));
  return (
    <div>
      <PageHeader title="Student Voice Notes" sub="Voice notes each trainer recorded per batch and class date" />
      <Card pad={false} action={<>
        <Select id="awa-batch" value={fBatch} onChange={(e) => setFBatch(e.target.value)} className="!w-auto"><option value="All">All batches</option>{s.batches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
        <Input id="awa-date" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className="!w-auto" />
        {fDate && <Button size="sm" variant="ghost" onClick={() => setFDate('')}>All dates</Button>}
      </>} title={`${list.length} record${list.length === 1 ? '' : 's'}`}>
        <Table head={['Class date', 'Batch', 'Trainer', 'Student voice notes', 'Count', 'Unmatched names', 'Saved']} minW={900} empty={!list.length && <Empty icon={<Mic size={20} />} title="No student voice notes for this filter" />}>
          {list.map((w) => (
            <tr key={w.id}>
              <td className="whitespace-nowrap">{fmtDate(w.date)}</td><td className="whitespace-nowrap">{s.batches.find((x) => x.id === w.batchId)?.name}</td><td className="whitespace-nowrap">{s.trainers.find((t) => t.id === w.trainerId)?.name}</td>
              <td><ul className="list-disc space-y-0.5 pl-4">{w.studentIds.map((id) => { const vn = w.voiceNotes?.find((x) => x.studentId === id); return <li key={id}>{s.students.find((x) => x.id === id)?.name}{vn?.title && <span className="text-ink-500"> – {vn.title}</span>}</li>; })}</ul></td>
              <td className="tabular-nums">{w.studentIds.length}/{studentsOf(s, w.batchId).length}</td>
              <td className="text-xs text-ink-500">{w.unmatched.join(', ') || '—'}</td>
              <td className="whitespace-nowrap text-xs">{fmtDateTime(w.savedAt)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
