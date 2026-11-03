import { useState } from 'react';
import { Plus, Layers } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import type { Course } from '../../types';
import { batchProgress, latestVersion, publishedVersion, studentsOf, trainerName, versionStats } from '../../store/selectors';
import { Badge, Button, Card, Confirm, Empty, Field, Input, KV, Menu, Modal, PageHeader, Progress, SearchBox, Select, Table, Textarea } from '../../components/common/ui';
import { SyllabusTree } from '../../components/common/SyllabusTree';
import { fmtDate, todayISO } from '../../utils';

function CourseForm({ initial, onClose }: { initial?: Course; onClose: () => void }) {
  const { raw, mutate, toast } = useApp();
  const nextId = `C${String(raw.courses.length + 1).padStart(2, '0')}`;
  const [f, setF] = useState<Course>(initial ?? { id: nextId, name: '', description: '', category: 'Programming', duration: '4 weeks', status: 'Draft', createdAt: todayISO() });
  const [err, setErr] = useState('');
  const save = () => {
    if (!f.name.trim()) return setErr('Enter a course name.');
    if (raw.courses.some((c) => c.name.toLowerCase() === f.name.trim().toLowerCase() && c.id !== f.id)) return setErr('A course with this name already exists.');
    mutate((d) => {
      if (initial) d.courses[d.courses.findIndex((c) => c.id === f.id)] = f;
      else {
        d.courses.push(f);
        d.syllabi.push({ id: `${f.id}-v1`, courseId: f.id, version: 1, status: 'Draft', createdAt: new Date().toISOString(), changeNote: 'New syllabus', modules: [] });
      }
    }, { action: initial ? 'Course updated' : 'Course added', entity: `${f.id} · ${f.name}`, prev: initial?.name ?? '—', next: f.name, reason: '' });
    toast(initial ? 'Course saved' : `${f.name} created as a draft. Add its syllabus next.`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={initial ? 'Edit course' : 'Add course'} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{initial ? 'Save' : 'Create course'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Course ID"><Input id="cf-id" value={f.id} disabled /></Field>
        <Field label="Course name" required error={err}><Input id="cf-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Data Analytics with Pandas" /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea id="cf-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Category"><Select id="cf-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['Programming', 'Data', 'Web', 'Web Framework', 'AI', 'Cloud', 'Other'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Duration"><Input id="cf-dur" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} /></Field>
      </div>
      <p className="mt-3 text-xs text-ink-500">Modules, days and topics are counted automatically from the syllabus you build in Syllabus Management.</p>
    </Modal>
  );
}

export default function Courses() {
  const { state: s, go, mutate, toast } = useApp();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [form, setForm] = useState<{ open: boolean; c?: Course }>({ open: false });
  const [del, setDel] = useState<Course | null>(null);
  const list = s.courses.filter((c) => (status === 'All' || c.status === status) && `${c.name} ${c.category} ${c.id}`.toLowerCase().includes(q.toLowerCase()));
  const setStatusOf = (c: Course, next: Course['status']) => {
    if (next === 'Published' && !publishedVersion(s, c.id) && !versionStats(latestVersion(s, c.id)).topics) { toast('Add at least one topic to the syllabus before publishing the course.', 'error'); return; }
    mutate((d) => { d.courses.find((x) => x.id === c.id)!.status = next; }, { action: `Course ${next.toLowerCase()}`, entity: c.name, prev: c.status, next, reason: '' });
    toast(`${c.name} is now ${next.toLowerCase()}`);
  };
  return (
    <div>
      <PageHeader title="Course Management" sub="Topic counts come from each course's published syllabus" actions={<Button icon={<Plus size={16} />} onClick={() => setForm({ open: true })}>Add course</Button>} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <SearchBox value={q} onChange={setQ} placeholder="Search courses…" />
          <Select id="c-status" value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto"><option>All</option><option>Draft</option><option>Published</option><option>Archived</option></Select>
        </div>
        <Table head={['ID', 'Course', 'Category', 'Duration', 'Modules', 'Days', 'Topics', 'Syllabus', 'Batches', 'Status', '']} minW={1000} empty={!list.length && <Empty title="No courses found" />}>
          {list.map((c) => {
            const pv = publishedVersion(s, c.id);
            const lv = latestVersion(s, c.id);
            const st = versionStats(pv ?? lv);
            return (
              <tr key={c.id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                <td className="font-mono text-xs">{c.id}</td>
                <td><button className="text-left" onClick={() => go({ page: 'course', id: c.id })}><span className="block font-medium text-ink-900 hover:text-royal-600 dark:text-ink-50">{c.name}</span><span className="block max-w-xs truncate text-xs text-ink-500">{c.description}</span></button></td>
                <td>{c.category}</td><td>{c.duration}</td>
                <td className="tabular-nums">{st.modules}</td><td className="tabular-nums">{st.days}</td><td className="tabular-nums">{st.topics}</td>
                <td className="whitespace-nowrap text-xs">{pv ? `v${pv.version} published` : 'Not published'}{lv && lv.status === 'Draft' && <span className="text-amber-600"> · v{lv.version} draft</span>}</td>
                <td className="tabular-nums">{s.batches.filter((b) => b.courseId === c.id).length}</td>
                <td><Badge>{c.status}</Badge></td>
                <td className="text-right"><Menu items={[
                  { label: 'View details', onClick: () => go({ page: 'course', id: c.id }) },
                  { label: 'Edit course', onClick: () => setForm({ open: true, c }) },
                  { label: 'Manage syllabus', onClick: () => go({ page: 'syllabus', id: c.id }) },
                  { label: 'Publish', onClick: () => setStatusOf(c, 'Published'), hidden: c.status === 'Published' },
                  { label: 'Archive', onClick: () => setStatusOf(c, 'Archived'), hidden: c.status === 'Archived' },
                  { label: 'Delete draft', onClick: () => setDel(c), danger: true, hidden: c.status !== 'Draft' },
                ]} /></td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {form.open && <CourseForm initial={form.c} onClose={() => setForm({ open: false })} />}
      <Confirm open={!!del} onClose={() => setDel(null)} title="Delete draft course?" confirmLabel="Delete" body={`${del?.name} and its draft syllabus will be removed. Only draft courses with no batches can be deleted.`}
        onConfirm={() => {
          if (!del) return;
          if (s.batches.some((b) => b.courseId === del.id)) { toast('This course has batches. Archive it instead.', 'error'); return; }
          mutate((d) => { d.courses = d.courses.filter((c) => c.id !== del.id); d.syllabi = d.syllabi.filter((v) => v.courseId !== del.id); }, { action: 'Draft course deleted', entity: del.name, prev: 'Draft', next: 'Deleted', reason: '' });
          toast('Draft course deleted');
        }} />
    </div>
  );
}

export function CourseDetail({ id }: { id: string }) {
  const { state: s, go } = useApp();
  const c = s.courses.find((x) => x.id === id);
  if (!c) return <Empty title="Course not found" />;
  const pv = publishedVersion(s, c.id) ?? latestVersion(s, c.id);
  const st = versionStats(pv);
  const bs = s.batches.filter((b) => b.courseId === c.id);
  return (
    <div>
      <PageHeader back={() => go('courses')} title={c.name} sub={c.description} actions={<Button icon={<Layers size={16} />} onClick={() => go({ page: 'syllabus', id: c.id })}>Manage syllabus</Button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card title="Course details">
            <dl className="grid grid-cols-2 gap-3">
              <KV k="Course ID" v={c.id} /><KV k="Status" v={<Badge>{c.status}</Badge>} /><KV k="Category" v={c.category} /><KV k="Duration" v={c.duration} />
              <KV k="Modules" v={st.modules} /><KV k="Weeks" v={st.weeks} /><KV k="Days" v={st.days} /><KV k="Topics" v={st.topics} />
              <KV k="Syllabus" v={pv ? `v${pv.version} · ${pv.status}` : '—'} /><KV k="Created" v={fmtDate(c.createdAt)} />
            </dl>
          </Card>
          <Card title="Batches on this course" pad={false}>
            {bs.length === 0 ? <Empty title="No batches yet" action={<Button size="sm" onClick={() => go('batches')}>Create batch</Button>} /> : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {bs.map((b) => { const p = batchProgress(s, b); return (
                  <li key={b.id}><button onClick={() => go({ page: 'batch', id: b.id })} className="block w-full px-4 py-3 text-left hover:bg-ink-50 dark:hover:bg-ink-800/40">
                    <div className="flex justify-between text-sm"><span className="font-medium text-ink-900 dark:text-ink-50">{b.name}</span><span className="text-xs text-ink-500">{studentsOf(s, b.id).length} students</span></div>
                    <div className="text-xs text-ink-500">{trainerName(s, b.trainerId)} · syllabus {s.syllabi.find((v) => v.id === b.syllabusVersionId)?.version ? `v${s.syllabi.find((v) => v.id === b.syllabusVersionId)!.version}` : ''}</div>
                    <div className="mt-1.5"><Progress value={p.pct} size="sm" label /></div>
                  </button></li>
                ); })}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Syllabus" subtitle={pv ? `Version ${pv.version} · ${pv.changeNote}` : undefined} className="lg:col-span-2">
          {pv && pv.modules.length ? <SyllabusTree v={pv} onTopic={(k) => go({ page: 'topic', id: k })} hasNotes={(k) => !!s.notes[k]} /> : <Empty title="No syllabus yet" action={<Button onClick={() => go({ page: 'syllabus', id: c.id })}>Build syllabus</Button>} />}
        </Card>
      </div>
    </div>
  );
}
