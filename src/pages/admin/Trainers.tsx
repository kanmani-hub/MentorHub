import { useState } from 'react';
import { Plus, Mail, Phone, CalendarDays } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import type { Trainer } from '../../types';
import {
  attendanceFor, batchProgress, classBatchesOn, courseName, dailyWork, derivedStatus, reportFor, reportMetric, studentsOf, trainerBatches, trainerSyllabus, workFor, workMinutes,
} from '../../store/selectors';
import { Avatar, Badge, Button, Card, Confirm, Empty, Field, Input, KV, Menu, Modal, PageHeader, Pager, Progress, SearchBox, Select, Table, Tabs, usePaged } from '../../components/common/ui';
import { Bars, SERIES } from '../../components/charts/Charts';
import { fmtDate, fmtMins, fmtShort, minutesBetween, prevWeekdays, todayISO, uid } from '../../utils';

const blank = (): Trainer => ({ id: '', name: '', email: '', phone: '', designation: '', joiningDate: todayISO(), skills: [], courseIds: [], status: 'Active' });

export function TrainerForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Trainer }) {
  const { raw, mutate, toast } = useApp();
  const [f, setF] = useState<Trainer>(initial ?? blank());
  const [skills, setSkills] = useState((initial?.skills ?? []).join(', '));
  const [err, setErr] = useState<Record<string, string>>({});
  const nextId = `T${String(raw.trainers.length + 1).padStart(2, '0')}`;
  const save = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Enter the trainer\'s full name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Enter a valid email.';
    else if (raw.trainers.some((t) => t.email.toLowerCase() === f.email.toLowerCase() && t.id !== initial?.id)) e.email = 'Another trainer already uses this email.';
    if (f.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a 10-digit phone number.';
    if (!f.designation.trim()) e.designation = 'Enter a designation.';
    setErr(e);
    if (Object.keys(e).length) return;
    const rec: Trainer = { ...f, id: initial?.id ?? nextId, skills: skills.split(',').map((x) => x.trim()).filter(Boolean) };
    mutate((d) => {
      if (initial) {
        const i = d.trainers.findIndex((t) => t.id === initial.id);
        d.trainers[i] = rec;
        const u = d.users.find((x) => x.trainerId === rec.id);
        if (u) { u.name = rec.name; u.email = rec.email; u.title = rec.designation; u.active = rec.status === 'Active'; }
      } else {
        d.trainers.push(rec);
        d.users.push({ id: uid('U'), name: rec.name, email: rec.email, password: 'Trainer@123', role: 'trainer', title: rec.designation, trainerId: rec.id, active: rec.status === 'Active' });
      }
    }, { action: initial ? 'Trainer updated' : 'Trainer added', entity: `${rec.id} · ${rec.name}`, prev: initial ? `${initial.designation}, ${initial.status}` : '—', next: `${rec.designation}, ${rec.status}`, reason: '' });
    toast(initial ? 'Trainer details saved' : `${rec.name} added. Login: ${rec.email} / Trainer@123`);
    onClose();
  };
  const set = (k: keyof Trainer, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit trainer' : 'Add trainer'} size="lg" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>{initial ? 'Save changes' : 'Add trainer'}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Trainer ID"><Input id="tf-id" value={initial?.id ?? nextId} disabled /></Field>
        <Field label="Full name" required error={err.name}><Input id="tf-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Meenakshi Rao" /></Field>
        <Field label="Email" required error={err.email}><Input id="tf-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@trainerhub.com" /></Field>
        <Field label="Phone number" required error={err.phone}><Input id="tf-phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98xxx xxxxx" /></Field>
        <Field label="Designation" required error={err.designation}><Input id="tf-desig" value={f.designation} onChange={(e) => set('designation', e.target.value)} placeholder="Python Trainer" /></Field>
        <Field label="Joining date"><Input id="tf-join" type="date" value={f.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} /></Field>
        <Field label="Skills" hint="Separate with commas" className="sm:col-span-2"><Input id="tf-skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, Django, SQL" /></Field>
        <Field label="Assigned courses" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">
            {raw.courses.filter((c) => c.status !== 'Archived').map((c) => {
              const on = f.courseIds.includes(c.id);
              return <button type="button" key={c.id} onClick={() => set('courseIds', on ? f.courseIds.filter((x) => x !== c.id) : [...f.courseIds, c.id])}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${on ? 'bg-royal-600 text-white ring-royal-600' : 'text-ink-600 ring-ink-200 hover:bg-ink-50 dark:text-ink-300 dark:ring-ink-700 dark:hover:bg-ink-800'}`}>{c.name}</button>;
            })}
          </div>
        </Field>
        <Field label="Status"><Select id="tf-status" value={f.status} onChange={(e) => set('status', e.target.value)}><option>Active</option><option>Inactive</option></Select></Field>
      </div>
    </Modal>
  );
}

export default function Trainers() {
  const { state: s, go, mutate, toast } = useApp();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [course, setCourse] = useState('All');
  const [form, setForm] = useState<{ open: boolean; t?: Trainer }>({ open: false });
  const [confirm, setConfirm] = useState<Trainer | null>(null);
  const today = todayISO();
  const list = s.trainers.filter((t) =>
    (status === 'All' || t.status === status) && (course === 'All' || t.courseIds.includes(course)) &&
    `${t.name} ${t.email} ${t.id} ${t.skills.join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  const pg = usePaged(list, 6);
  const toggle = (t: Trainer, reason: string) => {
    const next = t.status === 'Active' ? 'Inactive' : 'Active';
    mutate((d) => {
      d.trainers.find((x) => x.id === t.id)!.status = next;
      const u = d.users.find((x) => x.trainerId === t.id); if (u) u.active = next === 'Active';
    }, { action: next === 'Active' ? 'Trainer activated' : 'Trainer deactivated', entity: `${t.id} · ${t.name}`, prev: t.status, next, reason });
    toast(`${t.name} is now ${next.toLowerCase()}`);
  };
  return (
    <div>
      <PageHeader title="Trainer Management" sub={`${s.trainers.length} trainers · ${s.trainers.filter((t) => t.status === 'Active').length} active`} actions={<Button icon={<Plus size={16} />} onClick={() => setForm({ open: true })}>Add trainer</Button>} />
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <SearchBox value={q} onChange={(v) => { setQ(v); pg.setPage(1); }} placeholder="Search name, email, skill…" />
          <Select id="tr-status" value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto"><option>All</option><option>Active</option><option>Inactive</option></Select>
          <Select id="tr-course" value={course} onChange={(e) => setCourse(e.target.value)} className="!w-auto"><option value="All">All courses</option>{s.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </div>
        <Table head={['Trainer', 'ID', 'Designation', 'Courses', 'Batches', 'Syllabus progress', "Today's report", 'Status', '']} minW={980}
          empty={list.length === 0 && <Empty title="No trainers match" body="Try another name or clear the filters." />}>
          {pg.rows.map((t) => {
            const bs = trainerBatches(s, t.id);
            const sp = trainerSyllabus(s, t.id);
            const has = classBatchesOn(s, t.id, today).length > 0;
            return (
              <tr key={t.id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                <td><button className="flex items-center gap-2.5 text-left" onClick={() => go({ page: 'trainer', id: t.id })}><Avatar name={t.name} size={30} /><span><span className="block font-medium text-ink-900 dark:text-ink-50">{t.name}</span><span className="block text-xs text-ink-500">{t.email}</span></span></button></td>
                <td className="font-mono text-xs">{t.id}</td>
                <td>{t.designation}</td>
                <td className="max-w-[200px]"><div className="flex flex-wrap gap-1">{t.courseIds.map((c) => <Badge key={c} color="navy" dot={false}>{courseName(s, c)}</Badge>)}{!t.courseIds.length && '—'}</div></td>
                <td className="tabular-nums">{bs.length}</td>
                <td className="w-36">{bs.length ? <Progress value={sp.pct} size="sm" label /> : <span className="text-xs text-ink-400">—</span>}</td>
                <td>{has ? <Badge>{derivedStatus(s, t.id, today)}</Badge> : <span className="text-xs text-ink-400">No class</span>}</td>
                <td><Badge>{t.status}</Badge></td>
                <td className="text-right">
                  <Menu items={[
                    { label: 'View details', onClick: () => go({ page: 'trainer', id: t.id }) },
                    { label: 'Edit trainer', onClick: () => setForm({ open: true, t }) },
                    { label: 'Assign batch', onClick: () => go({ page: 'assignments', id: t.id }) },
                    { label: 'View daily reports', onClick: () => go({ page: 'trainer', id: t.id, tab: 'reports' }) },
                    { label: t.status === 'Active' ? 'Deactivate' : 'Activate', onClick: () => setConfirm(t), danger: t.status === 'Active' },
                  ]} />
                </td>
              </tr>
            );
          })}
        </Table>
        <Pager {...pg} onPage={pg.setPage} />
      </Card>
      {form.open && <TrainerForm open onClose={() => setForm({ open: false })} initial={form.t} />}
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.status === 'Active' ? 'Deactivate trainer?' : 'Activate trainer?'}
        tone={confirm?.status === 'Active' ? 'danger' : 'success'} confirmLabel={confirm?.status === 'Active' ? 'Deactivate' : 'Activate'} requireReason
        body={confirm?.status === 'Active' ? `${confirm?.name} will no longer be able to sign in. Their batches stay assigned until you reassign them.` : `${confirm?.name} will be able to sign in again.`}
        onConfirm={(r) => confirm && toggle(confirm, r)} />
    </div>
  );
}

export function TrainerDetail({ id, tab: initialTab }: { id: string; tab?: string }) {
  const { state: s, go } = useApp();
  const t = s.trainers.find((x) => x.id === id);
  const [tab, setTab] = useState<'overview' | 'batches' | 'work' | 'reports'>((initialTab as 'work') ?? 'overview');
  const [edit, setEdit] = useState(false);
  if (!t) return <Empty title="Trainer not found" action={<Button onClick={() => go('trainers')}>Back to trainers</Button>} />;
  const today = todayISO();
  const bs = trainerBatches(s, t.id);
  const sp = trainerSyllabus(s, t.id);
  const dw = dailyWork(s, t.id, today);
  const dates = [...prevWeekdays(today, 9).reverse(), today];
  const rm = reportMetric(s, t.id, dates);
  const hoursData = dates.slice(-7).map((d) => { const w = workMinutes(s, t.id, d); return { day: fmtShort(d), Teaching: +(w.teaching / 60).toFixed(2), Other: +((w.total - w.teaching) / 60).toFixed(2) }; });
  const reports = s.reports.filter((r) => r.trainerId === t.id).sort((a, b) => b.date.localeCompare(a.date));
  const logs = s.work.filter((w) => w.trainerId === t.id).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  return (
    <div>
      <PageHeader back={() => go('trainers')} title={t.name} sub={`${t.designation} · ${t.id}`} actions={<><Button variant="secondary" onClick={() => setEdit(true)}>Edit</Button><Button onClick={() => go({ page: 'assignments', id: t.id })}>Assign batch</Button></>} />
      <div className="grid gap-3 md:grid-cols-3">
        <Card><div className="text-sm font-semibold text-ink-800 dark:text-ink-100">Syllabus progress</div><div className="mt-1 font-display text-3xl font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{sp.pct}%</div><Progress value={sp.pct} /><div className="mt-1.5 text-xs text-ink-500">{sp.completed} of {sp.total} topics across {bs.length} batch(es)</div></Card>
        <Card><div className="text-sm font-semibold text-ink-800 dark:text-ink-100">Daily work completion · today</div><div className="mt-1 font-display text-3xl font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{dw.pct}%</div><Progress value={dw.pct} tone="purple" /><div className="mt-1.5 text-xs text-ink-500">{dw.done} of {dw.required} required activities</div></Card>
        <Card><div className="text-sm font-semibold text-ink-800 dark:text-ink-100">Report submission · last 10 days</div><div className="mt-1 font-display text-3xl font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{rm.submissionPct}%</div><Progress value={rm.submissionPct} tone="green" /><div className="mt-1.5 text-xs text-ink-500">{rm.submitted}/{rm.due} submitted · {rm.approved} approved · {rm.returned} returned</div></Card>
      </div>
      <div className="mt-5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'batches', label: 'Batches', count: bs.length }, { id: 'reports', label: 'Daily reports', count: reports.length }]} />
        {tab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Profile">
              <div className="flex items-center gap-3"><Avatar name={t.name} size={48} /><div><div className="font-medium text-ink-900 dark:text-ink-50">{t.name}</div><Badge>{t.status}</Badge></div></div>
              <dl className="mt-4 grid gap-3">
                <KV k="Email" v={<span className="flex items-center gap-1.5"><Mail size={13} />{t.email}</span>} />
                <KV k="Phone" v={<span className="flex items-center gap-1.5"><Phone size={13} />{t.phone}</span>} />
                <KV k="Joined" v={<span className="flex items-center gap-1.5"><CalendarDays size={13} />{fmtDate(t.joiningDate)}</span>} />
                <KV k="Skills" v={<div className="flex flex-wrap gap-1">{t.skills.map((x) => <Badge key={x} color="grey" dot={false}>{x}</Badge>)}</div>} />
                <KV k="Courses" v={t.courseIds.map((c) => courseName(s, c)).join(', ') || '—'} />
              </dl>
            </Card>
            <Card title="Teaching time · last 7 days" className="lg:col-span-2" subtitle="From classes held; earlier logged preparation time shown separately">
              <Bars data={hoursData} x="day" series={[{ key: 'Teaching', name: 'Teaching', color: SERIES.navy, stack: 'h' }, { key: 'Other', name: 'Other work', color: SERIES.purple, stack: 'h' }]} unit="h" height={230} />
              <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
                <div className="mb-1.5 text-xs font-semibold text-ink-600 dark:text-ink-300">Today's required activities</div>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">{dw.items.map((i) => <li key={i.label} className={i.done ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-500'}>{i.done ? '✓' : '○'} {i.label}</li>)}</ul>
              </div>
            </Card>
          </div>
        )}
        {tab === 'batches' && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {bs.length === 0 && <Card className="md:col-span-3"><Empty title="No batches assigned" action={<Button onClick={() => go({ page: 'assignments', id: t.id })}>Assign a batch</Button>} /></Card>}
            {bs.map((b) => { const p = batchProgress(s, b); return (
              <Card key={b.id}><button className="w-full text-left" onClick={() => go({ page: 'batch', id: b.id })}>
                <div className="flex items-center justify-between"><div className="font-display font-bold text-ink-900 dark:text-ink-50">{b.name}</div><Badge>{b.status}</Badge></div>
                <div className="text-xs text-ink-500">{courseName(s, b.courseId)} · {b.startTime}–{b.endTime} · {studentsOf(s, b.id).length} students</div>
                <div className="mt-3"><Progress value={p.pct} label /></div>
                <div className="mt-1 text-xs text-ink-500">{p.completed}/{p.total} topics · attendance today: {attendanceFor(s, b.id, today)?.status ?? 'not started'}</div>
              </button></Card>
            ); })}
          </div>
        )}
        {tab === 'work' && (
          <Card pad={false}>
            <Table head={['Date', 'Activity', 'Time', 'Duration', 'Batch', 'Description']} minW={720}>
              {logs.slice(0, 40).map((w) => (
                <tr key={w.id}><td className="whitespace-nowrap">{fmtDate(w.date)}</td><td><Badge color={w.activity === 'Teaching' ? 'navy' : 'grey'} dot={false}>{w.activity}</Badge></td><td className="tabular-nums">{w.start}–{w.end}</td><td className="tabular-nums">{fmtMins(minutesBetween(w.start, w.end))}</td><td>{s.batches.find((b) => b.id === w.batchId)?.name ?? '—'}</td><td className="max-w-xs truncate">{w.description}</td></tr>
              ))}
            </Table>
            <div className="px-4 py-2 text-xs text-ink-500">Today: {fmtMins(workMinutes(s, t.id, today).total)} total · {workFor(s, t.id, today).length} entries</div>
          </Card>
        )}
        {tab === 'reports' && (
          <Card pad={false}>
            <Table head={['Date', 'Status', 'Versions', 'Submitted', '']} minW={560} empty={!reports.length && <Empty title="No reports yet" />}>
              {reports.map((r) => (
                <tr key={r.id}><td>{fmtDate(r.date)}</td><td><Badge>{derivedStatus(s, t.id, r.date)}</Badge></td><td className="tabular-nums">{r.versions.length}</td><td>{r.versions.at(-1) ? new Date(r.versions.at(-1)!.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td className="text-right">{r.versions.length > 0 && <Button size="sm" variant="ghost" onClick={() => go({ page: 'report', id: r.id })}>Open</Button>}</td></tr>
              ))}
            </Table>
            {reportFor(s, t.id, today) === undefined && classBatchesOn(s, t.id, today).length > 0 && <div className="px-4 py-2 text-xs text-amber-700">Today's report has not been started.</div>}
          </Card>
        )}
      </div>
      {edit && <TrainerForm open onClose={() => setEdit(false)} initial={t} />}
    </div>
  );
}
