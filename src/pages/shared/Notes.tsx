import { useState } from 'react';
import { BookText, Code2, FileText, Lock, Paperclip, Presentation, Pencil, Plus } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import type { AppState, LessonNote } from '../../types';
import { courseName, flatDays, publishedVersion, latestVersion } from '../../store/selectors';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, SearchBox, Select, SimNote, Tabs, Textarea } from '../../components/common/ui';
import { cx, fmtDateTime, nowTs, uid } from '../../utils';

export const findTopic = (s: AppState, key: string) => {
  for (const v of s.syllabi) {
    for (const fd of flatDays(v)) {
      const t = fd.day.topics.find((x) => x.key === key);
      if (t) return { topic: t, v, fd, courseId: v.courseId };
    }
  }
  return null;
};

const emptyNote = (): LessonNote => ({ definition: '', explanation: '', why: '', syntax: '', code: '', output: '', example: '', practical: [], interview: [], homework: '', attachments: [], updatedAt: '', updatedBy: '' });

function NoteForm({ k, title, initial, onClose }: { k: string; title: string; initial?: LessonNote; onClose: () => void }) {
  const { mutate, toast, user } = useApp();
  const [f, setF] = useState<LessonNote>(initial ?? emptyNote());
  const [prac, setPrac] = useState((initial?.practical ?? []).join('\n'));
  const [intv, setIntv] = useState((initial?.interview ?? []).join('\n'));
  const [att, setAtt] = useState('');
  const [attKind, setAttKind] = useState<'PPT' | 'PDF' | 'Code'>('PPT');
  const set = (key: keyof LessonNote, v: string) => setF((p) => ({ ...p, [key]: v }));
  const save = () => {
    if (!f.definition.trim()) { toast('Add at least a simple definition.', 'error'); return; }
    const rec: LessonNote = { ...f, practical: prac.split('\n').map((x) => x.trim()).filter(Boolean), interview: intv.split('\n').map((x) => x.trim()).filter(Boolean), updatedAt: nowTs(), updatedBy: user!.name };
    mutate((d) => { d.notes[k] = rec; }, { action: initial ? 'Lesson notes updated' : 'Lesson notes created', entity: title, prev: initial ? `Updated ${fmtDateTime(initial.updatedAt)}` : '—', next: 'Saved', reason: '' });
    toast('Master lesson notes saved');
    onClose();
  };
  const ta = (key: keyof LessonNote, label: string, mono = false, rows = 3) => (
    <Field label={label}><Textarea id={`nf-${key}`} rows={rows} className={mono ? 'font-mono text-xs' : ''} value={f[key] as string} onChange={(e) => set(key, e.target.value)} /></Field>
  );
  return (
    <Modal open onClose={onClose} size="xl" title={`Master notes · ${title}`} sub="Trainers see these notes read-only for their assigned batches" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save notes</Button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        {ta('definition', 'Simple definition', false, 2)}
        {ta('why', 'Why we use it', false, 2)}
        <div className="md:col-span-2">{ta('explanation', 'Detailed explanation', false, 4)}</div>
        {ta('syntax', 'Syntax', true, 3)}
        {ta('example', 'Real-time example', false, 3)}
        {ta('code', 'Step-by-step code', true, 6)}
        {ta('output', 'Code output', true, 6)}
        <Field label="Practical questions" hint="One per line"><Textarea id="nf-prac" rows={4} value={prac} onChange={(e) => setPrac(e.target.value)} /></Field>
        <Field label="Interview questions" hint="One per line"><Textarea id="nf-intv" rows={4} value={intv} onChange={(e) => setIntv(e.target.value)} /></Field>
        {ta('homework', 'Homework', false, 2)}
        <Field label="Attachments">
          <div className="flex gap-2">
            <Select id="nf-attkind" value={attKind} onChange={(e) => setAttKind(e.target.value as 'PPT')} className="w-24"><option>PPT</option><option>PDF</option><option>Code</option></Select>
            <Input id="nf-att" placeholder="File name, e.g. Loops.pptx" value={att} onChange={(e) => setAtt(e.target.value)} />
            <Button variant="secondary" onClick={() => { if (att.trim()) { setF((p) => ({ ...p, attachments: [...p.attachments, { kind: attKind, name: att.trim() }] })); setAtt(''); } }}>Add</Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">{f.attachments.map((a, i) => <span key={i} className="inline-flex items-center gap-1 rounded bg-ink-100 px-2 py-0.5 text-xs dark:bg-ink-800">{a.kind}: {a.name}<button onClick={() => setF((p) => ({ ...p, attachments: p.attachments.filter((_, j) => j !== i) }))} className="text-ink-400 hover:text-red-500">×</button></span>)}</div>
          <div className="mt-1 text-xs text-ink-500">File storage needs the backend; the prototype keeps file names only.</div>
        </Field>
      </div>
    </Modal>
  );
}

export function TopicDetail({ k, backTo }: { k: string; backTo: string }) {
  const { state: s, user, go, mutate, toast } = useApp();
  const [tab, setTab] = useState<'overview' | 'explanation' | 'code' | 'practical' | 'interview' | 'homework' | 'attachments'>('overview');
  const [edit, setEdit] = useState(false);
  const [sup, setSup] = useState('');
  const found = findTopic(s, k);
  if (!found) return <Card><Empty icon={<Lock size={20} />} title="Notes not available" body="This topic is not part of a course assigned to you." action={<Button onClick={() => go(backTo)}>Back</Button>} /></Card>;
  const { topic, fd, courseId } = found;
  const note = s.notes[k];
  const isAdmin = user!.role === 'admin';
  const myBatch = s.batches.find((b) => b.courseId === courseId);
  const supNotes = s.supplemental.filter((n) => n.topicKey === k);
  const block = (label: string, body?: string, mono = false) => body ? (
    <div><div className="text-xs font-semibold text-ink-400">{label}</div>
      {mono ? <pre className="mt-1 overflow-x-auto rounded-lg bg-navy-950 p-3 font-mono text-[12.5px] leading-relaxed text-blue-50">{body}</pre> : <p className="mt-1 max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-ink-800 dark:text-ink-100">{body}</p>}
    </div>
  ) : null;
  return (
    <div>
      <PageHeader back={() => go(backTo)} title={topic.title} sub={`${courseName(s, courseId)} · ${fd.moduleTitle} · ${fd.weekTitle} · Day ${fd.index + 1}: ${fd.day.title}`}
        actions={isAdmin ? <Button icon={note ? <Pencil size={15} /> : <Plus size={15} />} onClick={() => setEdit(true)}>{note ? 'Edit master notes' : 'Create master notes'}</Button> : <Badge color="grey" dot={false}>Read-only master notes</Badge>} />
      {!note ? (
        <Card><Empty icon={<BookText size={20} />} title="No master notes yet" body={isAdmin ? 'Create notes with definition, explanation, code, practicals and interview questions.' : 'The academic team has not published notes for this topic yet.'} action={isAdmin && <Button onClick={() => setEdit(true)}>Create notes</Button>} /></Card>
      ) : (
        <Card>
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'explanation', label: 'Explanation' }, { id: 'code', label: 'Code' }, { id: 'practical', label: 'Practical', count: note.practical.length }, { id: 'interview', label: 'Interview Questions', count: note.interview.length }, { id: 'homework', label: 'Homework' }, { id: 'attachments', label: 'Attachments', count: note.attachments.length }]} />
          <div className="space-y-4">
            {tab === 'overview' && <>
              <div className="rounded-xl bg-gradient-to-br from-navy-50 to-violet2-50 p-4 dark:from-navy-600/15 dark:to-violet2-500/10"><div className="text-xs font-semibold text-violet2-600 dark:text-violet-300">In one line</div><p className="mt-1 font-display text-lg font-bold text-ink-900 dark:text-ink-50">{note.definition}</p></div>
              {block('Why we use it', note.why)}
              {block('Real-time example', note.example)}
            </>}
            {tab === 'explanation' && <>{block('Detailed explanation', note.explanation)}{block('Syntax', note.syntax, true)}</>}
            {tab === 'code' && <div className="grid gap-4 lg:grid-cols-2">{block('Step-by-step code', note.code, true) ?? <Empty title="No code sample" />}{block('Output', note.output, true)}</div>}
            {tab === 'practical' && (note.practical.length ? <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-800 dark:text-ink-100">{note.practical.map((p) => <li key={p}>{p}</li>)}</ol> : <Empty title="No practical questions" />)}
            {tab === 'interview' && (note.interview.length ? <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-800 dark:text-ink-100">{note.interview.map((p) => <li key={p}>{p}</li>)}</ol> : <Empty title="No interview questions" />)}
            {tab === 'homework' && (block('Homework', note.homework) ?? <Empty title="No homework set" />)}
            {tab === 'attachments' && (note.attachments.length ? (
              <div className="grid gap-2 sm:grid-cols-2">{note.attachments.map((a) => { const I = a.kind === 'PPT' ? Presentation : a.kind === 'PDF' ? FileText : Code2; return (
                <button key={a.name} onClick={() => toast('Opening attachments needs the backend file store. This prototype keeps file names only.', 'info')} className="flex items-center gap-3 rounded-lg border border-ink-200 p-3 text-left hover:border-royal-500/50 dark:border-ink-800">
                  <I size={20} className={cx(a.kind === 'PPT' ? 'text-amber-600' : a.kind === 'PDF' ? 'text-red-500' : 'text-royal-600')} /><span className="min-w-0"><span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-100">{a.name}</span><span className="text-xs text-ink-500">{a.kind} attachment</span></span>
                </button>); })}</div>
            ) : <Empty icon={<Paperclip size={20} />} title="No attachments" />)}
            <div className="border-t border-ink-100 pt-2 text-xs text-ink-400 dark:border-ink-800">Master notes last updated {fmtDateTime(note.updatedAt)} by {note.updatedBy}</div>
          </div>
        </Card>
      )}
      <Card className="mt-4" title="Supplemental trainer notes" subtitle="Kept separately; they never overwrite the master notes">
        {supNotes.length === 0 && <div className="text-sm text-ink-500">No supplemental notes.</div>}
        <ul className="space-y-2">{supNotes.map((n) => <li key={n.id} className="rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800/50"><div className="text-ink-800 dark:text-ink-100">{n.text}</div><div className="mt-0.5 text-xs text-ink-500">{s.trainers.find((t) => t.id === n.trainerId)?.name ?? 'Trainer'} · {s.batches.find((b) => b.id === n.batchId)?.name} · {fmtDateTime(n.at)}</div></li>)}</ul>
        {user!.role === 'trainer' && s.settings.trainerSupplementalNotes && myBatch && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input id="sup-note" value={sup} onChange={(e) => setSup(e.target.value)} placeholder="Add a tip or extra example for your batch" />
            <Button onClick={() => { if (!sup.trim()) return; mutate((d) => { d.supplemental.push({ id: uid('sn'), topicKey: k, trainerId: user!.trainerId!, batchId: myBatch.id, text: sup.trim(), at: nowTs() }); }); setSup(''); toast('Supplemental note added'); }}>Add note</Button>
          </div>
        )}
      </Card>
      {edit && <NoteForm k={k} title={topic.title} initial={note} onClose={() => setEdit(false)} />}
    </div>
  );
}

export function NotesIndex({ detailPage }: { detailPage: 'topic' | 't-topic' | 's-topic' }) {
  const { state: s, go, user } = useApp();
  const courses = s.courses;
  const [cid, setCid] = useState(courses[0]?.id ?? '');
  const [q, setQ] = useState('');
  const [only, setOnly] = useState('all');
  const v = user!.role === 'trainer' ? s.syllabi.find((x) => x.courseId === cid) : (publishedVersion(s, cid) ?? latestVersion(s, cid));
  const days = flatDays(v);
  const total = days.reduce((a, d) => a + d.day.topics.length, 0);
  const withNotes = days.reduce((a, d) => a + d.day.topics.filter((t) => s.notes[t.key]).length, 0);
  return (
    <div>
      <PageHeader title="Lesson Notes" sub={user!.role === 'admin' ? 'Master notes for every topic. Trainers see them read-only for their assigned courses.' : 'Notes for the courses assigned to you'} />
      {courses.length === 0 ? <Card><Empty title="No courses assigned" /></Card> : (
        <Card pad={false}>
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
            <Select id="ln-course" value={cid} onChange={(e) => setCid(e.target.value)} className="!w-auto">{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            <SearchBox value={q} onChange={setQ} placeholder="Search topics…" />
            <Select id="ln-only" value={only} onChange={(e) => setOnly(e.target.value)} className="!w-auto"><option value="all">All topics</option><option value="with">With notes</option><option value="without">Without notes</option></Select>
            <span className="ml-auto text-xs text-ink-500">{withNotes} of {total} topics have master notes</span>
          </div>
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {days.map((fd) => {
              const ts = fd.day.topics.filter((t) => t.title.toLowerCase().includes(q.toLowerCase()) && (only === 'all' || (only === 'with') === !!s.notes[t.key]));
              if (!ts.length) return null;
              return (
                <div key={fd.day.id} className="px-4 py-3">
                  <div className="text-xs text-ink-500"><span className="font-semibold text-ink-700 dark:text-ink-300">Day {fd.index + 1}: {fd.day.title}</span> · {fd.moduleTitle} · {fd.weekTitle}</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {ts.map((t) => (
                      <button key={t.key} onClick={() => go({ page: detailPage, id: t.key })} className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2 text-left text-sm hover:border-royal-500/50 dark:border-ink-800">
                        <span className="truncate text-ink-800 dark:text-ink-100">{t.title}</span>
                        {s.notes[t.key] ? <Badge color="green" dot={false}>Notes</Badge> : <Badge color="grey" dot={false}>Empty</Badge>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {user!.role === 'trainer' && <div className="mt-3"><SimNote>Only courses from your assigned batches are listed. Other courses' notes are filtered out before this page renders.</SimNote></div>}
    </div>
  );
}
