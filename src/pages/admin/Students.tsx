import { useRef, useState } from 'react';
import { Check, FileSpreadsheet, Plus, Upload } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import type { Student } from '../../types';
import { attendanceRate, courseName } from '../../store/selectors';
import { Avatar, Badge, Button, Card, Empty, Field, Input, KV, Menu, Modal, PageHeader, Pager, SearchBox, Select, SimNote, Table, usePaged } from '../../components/common/ui';
import { cx, fmtDate, todayISO } from '../../utils';

function StudentForm({ initial, onClose }: { initial?: Student; onClose: () => void }) {
  const { raw, mutate, toast } = useApp();
  const nextId = `S${String(raw.students.length + 1).padStart(3, '0')}`;
  const [f, setF] = useState<Student>(initial ?? { id: nextId, name: '', email: '', mobile: '', batchId: raw.batches[0].id, joiningDate: todayISO(), status: 'Active' });
  const [err, setErr] = useState<Record<string, string>>({});
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Enter the student\'s name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email.';
    else if (raw.students.some((s) => s.email.toLowerCase() === f.email.toLowerCase() && s.id !== f.id)) e.email = 'A student with this email already exists.';
    if (f.mobile.replace(/\D/g, '').length < 10) e.mobile = 'Enter a 10-digit mobile number.';
    setErr(e);
    if (Object.keys(e).length) return;
    mutate((d) => { if (initial) d.students[d.students.findIndex((s) => s.id === f.id)] = f; else d.students.push(f); }, { action: initial ? 'Student updated' : 'Student added', entity: `${f.id} · ${f.name}`, prev: initial ? initial.batchId : '—', next: f.batchId, reason: '' });
    toast(initial ? 'Student saved' : `${f.name} added`);
    onClose();
  };
  const set = (k: keyof Student, v: string) => setF((p) => ({ ...p, [k]: v }));
  const b = raw.batches.find((x) => x.id === f.batchId);
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit student' : 'Add student'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{initial ? 'Save' : 'Add student'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student ID"><Input id="sf-id" value={f.id} disabled /></Field>
        <Field label="Student name" required error={err.name}><Input id="sf-name" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Email" required error={err.email}><Input id="sf-email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Mobile number" required error={err.mobile}><Input id="sf-mobile" value={f.mobile} onChange={(e) => set('mobile', e.target.value)} /></Field>
        <Field label="Batch"><Select id="sf-batch" value={f.batchId} onChange={(e) => set('batchId', e.target.value)}>{raw.batches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
        <Field label="Course"><Input id="sf-course" value={b ? courseName(raw, b.courseId) : '—'} disabled /></Field>
        <Field label="Joining date"><Input id="sf-join" type="date" value={f.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} /></Field>
        <Field label="Status"><Select id="sf-status" value={f.status} onChange={(e) => set('status', e.target.value)}><option>Active</option><option>Inactive</option></Select></Field>
      </div>
    </Modal>
  );
}

const IMPORT_HEADERS = ['Full Name', 'Email ID', 'Phone', 'Batch Code', 'Join Date'];
const IMPORT_ROWS = [
  ['Lakshmi Priya', 'lakshmi.priya@mail.com', '+91 98400 11223', 'B01', '2026-11-03'],
  ['Mohammed Irfan', 'irfan.m@mail.com', '+91 90031 44556', 'B01', '2026-11-03'],
  ['Diya Patel', 'diya.patel@mail.com', '+91 98123 88771', 'B01', '2026-11-03'],
  ['Sowmya R', 'sowmya.r@mail.com', '', 'B09', '2026-11-03'],
  ['Joel Thomas', 'joel.thomas@mail.com', '+91 97890 12345', 'B09', '2026-11-03'],
  ['Joel Thomas', 'joel.thomas@mail.com', '+91 97890 12345', 'B09', '2026-11-03'],
  ['Hari Prasad', 'hari.prasad@mail.com', '+91 94441 77889', 'B99', '2026-11-03'],
];

function ImportStudents({ onClose }: { onClose: () => void }) {
  const { raw, mutate, toast } = useApp();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState('');
  const [map, setMap] = useState({ name: 0, email: 1, mobile: 2, batch: 3, join: 4 });
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const rows = IMPORT_ROWS.map((r, i) => {
    const rec = { name: r[map.name], email: r[map.email], mobile: r[map.mobile], batch: r[map.batch], join: r[map.join] };
    const issues: string[] = [];
    if (!rec.name || !rec.email || !rec.mobile) issues.push('Missing field');
    if (!raw.batches.some((b) => b.id === rec.batch)) issues.push('Unknown batch');
    if (raw.students.some((s) => s.email.toLowerCase() === rec.email?.toLowerCase())) issues.push('Already enrolled');
    if (IMPORT_ROWS.slice(0, i).some((p) => p[map.email] === rec.email)) issues.push('Duplicate in file');
    return { row: i + 2, rec, issues };
  });
  const valid = rows.filter((r) => !r.issues.length);
  const pick = (f?: File) => { if (!f) return; if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { toast('Choose an .xlsx, .xls or .csv file.', 'error'); return; } setFile(f.name); setStep(2); };
  const doImport = () => {
    let n = raw.students.length;
    mutate((d) => valid.forEach(({ rec }) => { n += 1; d.students.push({ id: `S${String(n).padStart(3, '0')}`, name: rec.name, email: rec.email, mobile: rec.mobile, batchId: rec.batch, joiningDate: rec.join, status: 'Active' }); }),
      { action: 'Students imported', entity: file, prev: '—', next: `${valid.length} added`, reason: `${rows.length - valid.length} rows skipped` });
    setResult({ added: valid.length, skipped: rows.length - valid.length });
    setStep(4);
    toast(`${valid.length} students imported`);
  };
  return (
    <Modal open onClose={onClose} size="lg" title="Import students from Excel / CSV" footer={step === 4 ? <Button onClick={onClose}>Done</Button> : undefined}>
      <SimNote>File parsing is simulated: any spreadsheet loads the same 7 sample rows, including a duplicate, an existing student, a missing phone and an unknown batch.</SimNote>
      <div className="my-4 flex flex-wrap gap-2">{['Upload', 'Map columns', 'Preview & validate', 'Result'].map((s, i) => <span key={s} className={cx('flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium', step === i + 1 ? 'bg-royal-600 text-white' : step > i + 1 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>{step > i + 1 && <Check size={12} />}{s}</span>)}</div>
      {step === 1 && (
        <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-ink-300 py-10 text-center dark:border-ink-700" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
          <FileSpreadsheet size={30} className="text-emerald-600" /><div className="mt-2 font-medium text-ink-900 dark:text-ink-100">Drop a student list here</div>
          <div className="mt-3 flex gap-2"><Button variant="secondary" onClick={() => ref.current?.click()}>Browse files</Button><Button variant="ghost" onClick={() => { setFile('November_Admissions.xlsx'); setStep(2); }}>Use sample file</Button></div>
          <input ref={ref} id="st-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      )}
      {step === 2 && (
        <div>
          <div className="text-sm text-ink-600 dark:text-ink-300">{file} · {IMPORT_ROWS.length} rows</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-5">
            {(Object.keys(map) as (keyof typeof map)[]).map((k) => (
              <Field key={k} label={{ name: 'Student name', email: 'Email', mobile: 'Mobile', batch: 'Batch', join: 'Joining date' }[k]}><Select id={`sm-${k}`} value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}>{IMPORT_HEADERS.map((h, i) => <option key={h} value={i}>{h}</option>)}</Select></Field>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setStep(1)}>Back</Button><Button onClick={() => setStep(3)}>Preview</Button></div>
        </div>
      )}
      {step === 3 && (
        <div>
          <Table head={['Row', 'Name', 'Email', 'Mobile', 'Batch', 'Check']} minW={680}>
            {rows.map((r) => <tr key={r.row} className={r.issues.length ? 'bg-red-50/50 dark:bg-red-500/5' : ''}><td>{r.row}</td><td>{r.rec.name}</td><td>{r.rec.email}</td><td>{r.rec.mobile || <span className="text-red-500">missing</span>}</td><td>{r.rec.batch}</td><td>{r.issues.length ? <Badge color="red">{r.issues.join(', ')}</Badge> : <Badge color="green">Ready</Badge>}</td></tr>)}
          </Table>
          <div className="mt-4 flex items-center justify-between gap-2"><span className="text-sm text-ink-600 dark:text-ink-300">{valid.length} ready · {rows.length - valid.length} will be skipped</span><div className="flex gap-2"><Button variant="secondary" onClick={() => setStep(2)}>Back</Button><Button onClick={doImport} disabled={!valid.length}>Import {valid.length} students</Button></div></div>
        </div>
      )}
      {step === 4 && result && (
        <div className="py-6 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Check /></div><div className="mt-3 font-display text-lg font-bold text-ink-900 dark:text-ink-50">{result.added} students added</div><div className="text-sm text-ink-500">{result.skipped} rows skipped. Fix them in the source file and import again.</div></div>
      )}
    </Modal>
  );
}

export default function Students() {
  const { state: s, mutate, toast } = useApp();
  const [q, setQ] = useState('');
  const [batch, setBatch] = useState('All');
  const [status, setStatus] = useState('All');
  const [form, setForm] = useState<{ open: boolean; st?: Student }>({ open: false });
  const [view, setView] = useState<Student | null>(null);
  const [transfer, setTransfer] = useState<Student | null>(null);
  const [toBatch, setToBatch] = useState('');
  const [imp, setImp] = useState(false);
  const list = s.students.filter((x) => (batch === 'All' || x.batchId === batch) && (status === 'All' || x.status === status) && `${x.name} ${x.email} ${x.id} ${x.mobile}`.toLowerCase().includes(q.toLowerCase()));
  const pg = usePaged(list, 10);
  const bname = (id: string) => s.batches.find((b) => b.id === id);
  return (
    <div>
      <PageHeader title="Student Management" sub={`${s.students.length} students · ${s.students.filter((x) => x.status === 'Active').length} active`} actions={<><Button variant="secondary" icon={<Upload size={15} />} onClick={() => setImp(true)}>Upload Excel/CSV</Button><Button icon={<Plus size={16} />} onClick={() => setForm({ open: true })}>Add student</Button></>} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <SearchBox value={q} onChange={(v) => { setQ(v); pg.setPage(1); }} placeholder="Search name, email, ID…" />
          <Select id="s-batch" value={batch} onChange={(e) => { setBatch(e.target.value); pg.setPage(1); }} className="!w-auto"><option value="All">All batches</option>{s.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Select id="s-status" value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto"><option>All</option><option>Active</option><option>Inactive</option></Select>
        </div>
        <Table head={['Student', 'ID', 'Mobile', 'Course', 'Batch', 'Joined', 'Status', '']} minW={900} empty={!list.length && <Empty title="No students match" />}>
          {pg.rows.map((x) => { const b = bname(x.batchId); return (
            <tr key={x.id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
              <td><button onClick={() => setView(x)} className="flex items-center gap-2.5 text-left"><Avatar name={x.name} size={28} /><span><span className="block font-medium text-ink-900 dark:text-ink-50">{x.name}</span><span className="text-xs text-ink-500">{x.email}</span></span></button></td>
              <td className="font-mono text-xs">{x.id}</td><td className="whitespace-nowrap">{x.mobile}</td><td>{b ? courseName(s, b.courseId) : '—'}</td><td>{b?.name ?? '—'}</td><td className="whitespace-nowrap">{fmtDate(x.joiningDate)}</td><td><Badge>{x.status}</Badge></td>
              <td className="text-right"><Menu items={[
                { label: 'View', onClick: () => setView(x) }, { label: 'Edit', onClick: () => setForm({ open: true, st: x }) },
                { label: 'Transfer batch', onClick: () => { setTransfer(x); setToBatch(''); } },
                { label: x.status === 'Active' ? 'Deactivate' : 'Activate', danger: x.status === 'Active', onClick: () => { const n = x.status === 'Active' ? 'Inactive' : 'Active'; mutate((d) => { d.students.find((y) => y.id === x.id)!.status = n; }, { action: `Student ${n.toLowerCase()}`, entity: x.name, prev: x.status, next: n, reason: '' }); toast(`${x.name} marked ${n.toLowerCase()}`); } },
              ]} /></td>
            </tr>
          ); })}
        </Table>
        <Pager {...pg} onPage={pg.setPage} />
      </Card>
      {form.open && <StudentForm initial={form.st} onClose={() => setForm({ open: false })} />}
      {imp && <ImportStudents onClose={() => setImp(false)} />}
      {view && (
        <Modal open onClose={() => setView(null)} title={view.name} sub={view.id} footer={<Button onClick={() => { setForm({ open: true, st: view }); setView(null); }}>Edit</Button>}>
          <dl className="grid grid-cols-2 gap-3">
            <KV k="Email" v={view.email} /><KV k="Mobile" v={view.mobile} /><KV k="Batch" v={bname(view.batchId)?.name} /><KV k="Course" v={bname(view.batchId) ? courseName(s, bname(view.batchId)!.courseId) : '—'} />
            <KV k="Joined" v={fmtDate(view.joiningDate)} /><KV k="Status" v={<Badge>{view.status}</Badge>} />
            <KV k="Attendance" v={(() => { const recs = s.attendance.filter((a) => a.status === 'Submitted' && a.marks[view.id]); const p = recs.filter((a) => ['Present', 'Late'].includes(a.marks[view.id])).length; return `${p}/${recs.length} sessions`; })()} />
            <KV k="Batch attendance rate" v={`${attendanceRate(s, view.batchId).pct}%`} />
          </dl>
        </Modal>
      )}
      {transfer && (
        <Modal open onClose={() => setTransfer(null)} title={`Transfer ${transfer.name}`} size="sm" footer={<><Button variant="secondary" onClick={() => setTransfer(null)}>Cancel</Button><Button disabled={!toBatch} onClick={() => {
          mutate((d) => { d.students.find((y) => y.id === transfer.id)!.batchId = toBatch; }, { action: 'Student transferred', entity: transfer.name, prev: bname(transfer.batchId)?.name ?? '—', next: bname(toBatch)?.name ?? '—', reason: '' });
          toast(`${transfer.name} moved to ${bname(toBatch)?.name}`); setTransfer(null);
        }}>Transfer</Button></>}>
          <p className="text-sm text-ink-600 dark:text-ink-300">Currently in <b>{bname(transfer.batchId)?.name}</b>. Past attendance stays with the old batch.</p>
          <Field label="Move to batch" className="mt-3"><Select id="tr-batch" value={toBatch} onChange={(e) => setToBatch(e.target.value)}><option value="">Select batch</option>{s.batches.filter((b) => b.id !== transfer.batchId).map((b) => <option key={b.id} value={b.id}>{b.name} · {courseName(s, b.courseId)}</option>)}</Select></Field>
        </Modal>
      )}
    </div>
  );
}
