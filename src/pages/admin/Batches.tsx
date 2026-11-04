import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import type { Batch } from '../../types';
import { batchProgress, courseName, lessonPlan, publishedVersion, studentsOf, trainerName } from '../../store/selectors';
import { Badge, Button, Card, Empty, Field, Input, Menu, Modal, PageHeader, Progress, SearchBox, Select, Table } from '../../components/common/ui';
import { BatchDetail } from '../shared/BatchDetail';
import { addDays, fmtDate, nowTs, todayISO, uid } from '../../utils';

export function BatchForm({ initial, onClose }: { initial?: Batch; onClose: () => void }) {
  const { raw, mutate, toast, notify } = useApp();
  const nextId = `B${String(raw.batches.length + 1).padStart(2, '0')}`;
  const [f, setF] = useState<Batch>(initial ?? { id: nextId, name: '', courseId: 'C01', syllabusVersionId: publishedVersion(raw, 'C01')?.id ?? '', trainerId: '', startDate: todayISO(), endDate: addDays(todayISO(), 56), classDays: 'Mon–Fri', startTime: '10:00', endTime: '12:00', status: 'Upcoming' });
  const [err, setErr] = useState<Record<string, string>>({});
  const versions = raw.syllabi.filter((v) => v.courseId === f.courseId && v.status !== 'Draft');
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Enter a batch name.';
    if (!f.syllabusVersionId) e.syl = 'This course has no published syllabus yet.';
    if (f.endDate <= f.startDate) e.end = 'End date must be after the start date.';
    if (f.endTime <= f.startTime) e.time = 'End time must be after start time.';
    if (f.trainerId) {
      const clash = raw.batches.find((b) => b.id !== f.id && b.trainerId === f.trainerId && b.status === 'Active' && b.startTime < f.endTime && f.startTime < b.endTime);
      if (clash) e.trainer = `Timing overlaps with ${clash.name} (${clash.startTime}–${clash.endTime}).`;
    }
    setErr(e);
    if (Object.keys(e).length) return;
    const changedTrainer = initial && initial.trainerId !== f.trainerId;
    mutate((d) => {
      if (initial) d.batches[d.batches.findIndex((b) => b.id === f.id)] = f; else d.batches.push(f);
      if ((!initial && f.trainerId) || changedTrainer) d.assignments.unshift({ id: uid('as'), trainerId: f.trainerId, prevTrainerId: initial?.trainerId, batchId: f.id, courseId: f.courseId, syllabusVersionId: f.syllabusVersionId, start: f.startDate, end: f.endDate, schedule: `${f.classDays} · ${f.startTime}–${f.endTime}`, at: nowTs(), by: raw.users.find((u) => u.role === 'admin')!.name });
    }, { action: initial ? 'Batch updated' : 'Batch created', entity: `${f.id} · ${f.name}`, prev: initial ? `${trainerName(raw, initial.trainerId)}, ${initial.status}` : '—', next: `${trainerName(raw, f.trainerId)}, ${f.status}`, reason: '' });
    const tu = raw.users.find((u) => u.trainerId === f.trainerId);
    if (tu && (!initial || changedTrainer)) notify([tu.id], { type: 'assignment', title: 'New batch assigned', body: `You are now the trainer for ${f.name} (${courseName(raw, f.courseId)}).`, link: { page: 't-batches' } });
    toast(initial ? 'Batch saved' : `${f.name} created`);
    onClose();
  };
  const set = (k: keyof Batch, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal open onClose={onClose} size="lg" title={initial ? 'Edit batch' : 'Create batch'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{initial ? 'Save' : 'Create batch'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Batch ID"><Input id="bf-id" value={f.id} disabled /></Field>
        <Field label="Batch name" required error={err.name}><Input id="bf-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Python Batch C" /></Field>
        <Field label="Course" required><Select id="bf-course" value={f.courseId} disabled={!!initial} onChange={(e) => { const c = e.target.value; setF((p) => ({ ...p, courseId: c, syllabusVersionId: publishedVersion(raw, c)?.id ?? '' })); }}>{raw.courses.filter((c) => c.status !== 'Archived').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label="Syllabus version" required error={err.syl} hint={initial ? 'Changing version keeps progress for topics present in both versions' : undefined}>
          <Select id="bf-syl" value={f.syllabusVersionId} onChange={(e) => set('syllabusVersionId', e.target.value)}>{!versions.length && <option value="">No published version</option>}{versions.map((v) => <option key={v.id} value={v.id}>v{v.version} · {v.status}</option>)}</Select>
        </Field>
        <Field label="Trainer" error={err.trainer}><Select id="bf-trainer" value={f.trainerId} onChange={(e) => set('trainerId', e.target.value)}><option value="">Unassigned</option>{raw.trainers.filter((t) => t.status === 'Active').map((t) => <option key={t.id} value={t.id}>{t.name}{t.courseIds.includes(f.courseId) ? '' : ' (not mapped to course)'}</option>)}</Select></Field>
        <Field label="Status"><Select id="bf-status" value={f.status} onChange={(e) => set('status', e.target.value)}>{['Upcoming', 'Active', 'On Hold', 'Completed'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Start date"><Input id="bf-start" type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
        <Field label="End date" error={err.end}><Input id="bf-end" type="date" value={f.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
        <Field label="Class days"><Select id="bf-days" value={f.classDays} onChange={(e) => set('classDays', e.target.value)}>{['Mon–Fri', 'Mon/Wed/Fri', 'Tue/Thu/Sat', 'Sat–Sun'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start time"><Input id="bf-st" type="time" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
          <Field label="End time" error={err.time}><Input id="bf-et" type="time" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>
        </div>
      </div>
    </Modal>
  );
}

export function AddStudentsModal({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const { raw, mutate, toast } = useApp();
  const b = raw.batches.find((x) => x.id === batchId)!;
  const candidates = raw.students.filter((s) => s.batchId !== batchId);
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState('');
  return (
    <Modal open onClose={onClose} title={`Add students to ${b.name}`} sub="Selected students are moved from their current batch" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!sel.length} onClick={() => {
      mutate((d) => d.students.forEach((s) => { if (sel.includes(s.id)) s.batchId = batchId; }), { action: 'Students added to batch', entity: b.name, prev: '—', next: `${sel.length} student(s)`, reason: '' });
      toast(`${sel.length} student(s) added to ${b.name}`); onClose();
    }}>Add {sel.length || ''} student{sel.length === 1 ? '' : 's'}</Button></>}>
      <SearchBox value={q} onChange={setQ} placeholder="Search students" />
      <ul className="mt-3 max-h-80 divide-y divide-ink-100 overflow-y-auto dark:divide-ink-800">
        {candidates.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())).map((s) => (
          <li key={s.id}><label className="flex items-center gap-3 px-1 py-2 text-sm"><input type="checkbox" className="accent-royal-600" checked={sel.includes(s.id)} onChange={(e) => setSel(e.target.checked ? [...sel, s.id] : sel.filter((x) => x !== s.id))} />
            <span className="min-w-0 flex-1"><span className="block text-ink-900 dark:text-ink-100">{s.name}</span><span className="text-xs text-ink-500">{s.id} · currently {raw.batches.find((x) => x.id === s.batchId)?.name ?? 'unassigned'}</span></span></label></li>
        ))}
      </ul>
    </Modal>
  );
}

export default function Batches() {
  const { state: s, go, mutate, toast } = useApp();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [course, setCourse] = useState('All');
  const [form, setForm] = useState<{ open: boolean; b?: Batch }>({ open: false });
  const [add, setAdd] = useState<string | null>(null);
  const list = s.batches.filter((b) => (status === 'All' || b.status === status) && (course === 'All' || b.courseId === course) && `${b.name} ${b.id} ${trainerName(s, b.trainerId)}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Batch Management" sub="Batches on the same course share the master syllabus but keep separate progress" actions={<Button icon={<Plus size={16} />} onClick={() => setForm({ open: true })}>Create batch</Button>} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <SearchBox value={q} onChange={setQ} placeholder="Search batch or trainer…" />
          <Select id="b-status" value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto"><option>All</option>{['Upcoming', 'Active', 'On Hold', 'Completed'].map((x) => <option key={x}>{x}</option>)}</Select>
          <Select id="b-course" value={course} onChange={(e) => setCourse(e.target.value)} className="!w-auto"><option value="All">All courses</option>{s.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </div>
        <Table head={['Batch', 'Course', 'Syllabus', 'Trainer', 'Dates', 'Schedule', 'Students', 'Progress', 'Next lesson', 'Status', '']} minW={1180} empty={!list.length && <Empty title="No batches match" />}>
          {list.map((b) => {
            const p = batchProgress(s, b);
            const v = s.syllabi.find((x) => x.id === b.syllabusVersionId);
            const plan = lessonPlan(s, b, todayISO());
            return (
              <tr key={b.id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                <td><button onClick={() => go({ page: 'batch', id: b.id })} className="text-left"><span className="block font-medium text-ink-900 hover:text-royal-600 dark:text-ink-50">{b.name}</span><span className="font-mono text-xs text-ink-500">{b.id}</span></button></td>
                <td>{courseName(s, b.courseId)}</td>
                <td>v{v?.version}</td>
                <td>{b.trainerId ? trainerName(s, b.trainerId) : <Badge color="orange">Unassigned</Badge>}</td>
                <td className="whitespace-nowrap text-xs">{fmtDate(b.startDate)} – {fmtDate(b.endDate)}</td>
                <td className="whitespace-nowrap text-xs">{b.classDays}<br />{b.startTime}–{b.endTime}</td>
                <td className="tabular-nums">{studentsOf(s, b.id).length}</td>
                <td className="w-32"><Progress value={p.pct} size="sm" label /></td>
                <td className="max-w-[160px] truncate text-xs">Day {plan.dayNumber}: {plan.flat?.day.title}</td>
                <td><Badge>{b.status}</Badge></td>
                <td className="text-right"><Menu items={[
                  { label: 'View batch', onClick: () => go({ page: 'batch', id: b.id }) },
                  { label: 'Edit batch', onClick: () => setForm({ open: true, b }) },
                  { label: 'Add students', onClick: () => setAdd(b.id) },
                  { label: 'Assign trainer', onClick: () => setForm({ open: true, b }) },
                  ...(['Active', 'On Hold', 'Completed'] as const).filter((x) => x !== b.status).map((x) => ({ label: `Mark ${x}`, onClick: () => { mutate((d) => { d.batches.find((y) => y.id === b.id)!.status = x; }, { action: 'Batch status changed', entity: b.name, prev: b.status, next: x, reason: '' }); toast(`${b.name} marked ${x}`); } })),
                ]} /></td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {form.open && <BatchForm initial={form.b} onClose={() => setForm({ open: false })} />}
      {add && <AddStudentsModal batchId={add} onClose={() => setAdd(null)} />}
    </div>
  );
}

export function AdminBatchDetail({ id }: { id: string }) {
  const { state: s } = useApp();
  const [edit, setEdit] = useState(false);
  const [add, setAdd] = useState(false);
  const b = s.batches.find((x) => x.id === id);
  return (
    <>
      <BatchDetail id={id} back="batches" onEdit={() => setEdit(true)} onAddStudents={() => setAdd(true)} />
      {edit && b && <BatchForm initial={b} onClose={() => setEdit(false)} />}
      {add && <AddStudentsModal batchId={id} onClose={() => setAdd(false)} />}
    </>
  );
}
