import { useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import type { Role } from '../../types';
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, SearchBox, Select, SimNote, Table, Tabs, Toggle } from '../../components/common/ui';
import { uid } from '../../utils';

/** What each role can do. The router guard and the role-scoped data selector (scopeFor) enforce these in the prototype. */
const MATRIX: { area: string; can: string; admin: boolean; trainer: boolean | string; student: boolean | string }[] = [
  { area: 'Dashboard', can: 'Institute-wide dashboard and analytics', admin: true, trainer: false, student: false },
  { area: 'Courses & syllabus', can: 'Create, edit and publish courses, syllabus versions and Notes of Lesson', admin: true, trainer: false, student: false },
  { area: 'Courses & syllabus', can: 'View syllabus and Notes of Lesson', admin: true, trainer: 'Assigned batches only', student: 'Own course only' },
  { area: 'Trainers', can: 'Add, edit, activate and deactivate trainers', admin: true, trainer: false, student: false },
  { area: 'Batches & students', can: 'Create batches, add and transfer students, assign trainers', admin: true, trainer: false, student: false },
  { area: 'Batches & students', can: 'View batch and student lists', admin: true, trainer: 'Assigned batches only', student: false },
  { area: 'Attendance', can: 'Mark and correct attendance', admin: false, trainer: 'Assigned batches only', student: false },
  { area: 'Attendance', can: 'View attendance', admin: true, trainer: 'Assigned batches only', student: 'Own record only' },
  { area: 'Topic progress', can: 'Update topic status and student task checklist', admin: false, trainer: 'Assigned batches only', student: false },
  { area: 'Daily reports', can: 'Fill batch reports and submit the consolidated daily report', admin: false, trainer: 'Own reports only', student: false },
  { area: 'Daily reports', can: 'View all reports, approve, request correction, reject', admin: true, trainer: false, student: false },
  { area: 'Reports & export', can: 'Export institute reports', admin: true, trainer: false, student: false },
  { area: 'Administration', can: 'Manage users, permissions and settings; view audit logs', admin: true, trainer: false, student: false },
];
const cell = (v: boolean | string) => (v === true ? <Check size={16} className="text-emerald-600" /> : v === false ? <Minus size={16} className="text-ink-300" /> : <span className="text-xs text-ink-700 dark:text-ink-200">{v}</span>);

export default function Roles() {
  const { raw, user: me, mutate, toast } = useApp();
  const [tab, setTab] = useState<'users' | 'matrix' | 'trainer'>('users');
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'All' | Role>('All');
  const [f, setF] = useState({ name: '', email: '', title: '' });
  const users = raw.users.filter((u) => (role === 'All' || u.role === role) && `${u.name} ${u.email} ${u.title}`.toLowerCase().includes(q.toLowerCase()));
  const st = raw.settings;
  const setSetting = (k: 'trainerSupplementalNotes' | 'trainerUploadVoice' | 'studentPortal', v: boolean) => {
    mutate((d) => { d.settings[k] = v; }, { action: 'Permission changed', entity: k, prev: String(st[k]), next: String(v), reason: '' });
    toast('Permission updated');
  };
  const toggleActive = (id: string) => {
    const u = raw.users.find((x) => x.id === id)!;
    if (u.id === me!.id) { toast('You cannot deactivate your own account.', 'error'); return; }
    if (u.role === 'admin' && u.active && raw.users.filter((x) => x.role === 'admin' && x.active).length === 1) { toast('At least one admin must stay active.', 'error'); return; }
    mutate((d) => {
      const x = d.users.find((y) => y.id === id)!; x.active = !x.active;
      if (x.trainerId) { const t = d.trainers.find((y) => y.id === x.trainerId); if (t) t.status = x.active ? 'Active' : 'Inactive'; }
      if (x.studentId) { const s = d.students.find((y) => y.id === x.studentId); if (s) s.status = x.active ? 'Active' : 'Inactive'; }
    }, { action: u.active ? 'User deactivated' : 'User activated', entity: `${u.name} (${u.role})`, prev: u.active ? 'Active' : 'Inactive', next: u.active ? 'Inactive' : 'Active', reason: '' });
    toast(`${u.name} ${u.active ? 'can no longer' : 'can now'} sign in`);
  };
  return (
    <div>
      <PageHeader title="User Roles & Permissions" sub="Who can sign in, with which role, and what each role may see and change" />
      <div className="mb-4 grid grid-cols-3 gap-3">
        {(['admin', 'trainer', 'student'] as Role[]).map((r) => <div key={r} className="rounded-xl border border-ink-200 bg-white p-3.5 dark:border-ink-800 dark:bg-ink-900"><div className="text-xs capitalize text-ink-500">{r} accounts</div><div className="font-display text-2xl font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{raw.users.filter((u) => u.role === r).length}</div><div className="text-[11.5px] text-ink-500">{raw.users.filter((u) => u.role === r && u.active).length} active</div></div>)}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'users', label: 'Users', count: raw.users.length }, { id: 'matrix', label: 'Role permissions' }, { id: 'trainer', label: 'Trainer & student options' }]} />
      {tab === 'users' && (
        <div className="space-y-4">
          <Card pad={false}>
            <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
              <SearchBox value={q} onChange={setQ} placeholder="Search users…" />
              <Select id="ru-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="!w-auto"><option value="All">All roles</option><option value="admin">Admin</option><option value="trainer">Trainer</option><option value="student">Student</option></Select>
            </div>
            <Table head={['User', 'Role', 'Title', 'Reviews reports', 'Status', '']} minW={760}>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><span className="flex items-center gap-2.5"><Avatar name={u.name} size={28} /><span><span className="block font-medium text-ink-900 dark:text-ink-50">{u.name}{u.id === me!.id && <span className="ml-1 text-xs text-ink-400">(you)</span>}</span><span className="text-xs text-ink-500">{u.email}</span></span></span></td>
                  <td><Badge color={u.role === 'admin' ? 'navy' : u.role === 'trainer' ? 'blue' : 'purple'} dot={false}>{u.role}</Badge></td>
                  <td>{u.title}</td>
                  <td>{u.role === 'admin' ? <input type="checkbox" aria-label={`${u.name} reviews reports`} className="accent-royal-600" checked={!!u.canReview} onChange={(e) => { mutate((d) => { d.users.find((x) => x.id === u.id)!.canReview = e.target.checked; }, { action: 'Review permission changed', entity: u.name, prev: u.canReview ? 'Can review' : 'Cannot review', next: e.target.checked ? 'Can review' : 'Cannot review', reason: '' }); toast('Review permission updated'); }} /> : <span className="text-xs text-ink-400">—</span>}</td>
                  <td><Badge>{u.active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="text-right"><Button size="sm" variant="ghost" onClick={() => toggleActive(u.id)}>{u.active ? 'Deactivate' : 'Activate'}</Button></td>
                </tr>
              ))}
            </Table>
          </Card>
          <Card title="Add admin user" subtitle="Trainer and student accounts are created from Trainer Management and Student Management">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
              <Field label="Full name"><Input id="ra-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
              <Field label="Email"><Input id="ra-email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Title"><Input id="ra-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Academic Coordinator" /></Field>
              <Button icon={<Plus size={15} />} onClick={() => {
                if (!f.name.trim() || !/^\S+@\S+\.\S+$/.test(f.email)) { toast('Enter a name and a valid email.', 'error'); return; }
                if (raw.users.some((u) => u.email.toLowerCase() === f.email.toLowerCase())) { toast('That email already has an account.', 'error'); return; }
                mutate((d) => { d.users.push({ id: uid('U'), name: f.name.trim(), email: f.email.trim(), password: 'Admin@123', role: 'admin', title: f.title.trim() || 'Admin', canReview: true, active: true }); }, { action: 'Admin user added', entity: f.name, prev: '—', next: f.email, reason: '' });
                toast(`${f.name} added. Temporary password Admin@123`); setF({ name: '', email: '', title: '' });
              }}>Add admin</Button>
            </div>
          </Card>
        </div>
      )}
      {tab === 'matrix' && (
        <Card pad={false} title="Role permissions" subtitle="Applied on every page and to every data list in this prototype">
          <Table head={['Area', 'Permission', 'Admin', 'Trainer', 'Student']} minW={760}>
            {MATRIX.map((m, i) => <tr key={i}><td className="whitespace-nowrap text-xs font-semibold text-ink-500">{m.area}</td><td>{m.can}</td><td>{cell(m.admin)}</td><td>{cell(m.trainer)}</td><td>{cell(m.student)}</td></tr>)}
          </Table>
          <div className="p-4"><SimNote>Pages and data are filtered by role in the browser here. The production backend must apply the same checks in its APIs and database queries.</SimNote></div>
        </Card>
      )}
      {tab === 'trainer' && (
        <Card className="max-w-2xl">
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            <Toggle id="pm-sup" checked={st.trainerSupplementalNotes} onChange={(v) => setSetting('trainerSupplementalNotes', v)} label="Trainers can add supplemental topic notes (master notes stay unchanged)" />
            <Toggle id="pm-student" checked={st.studentPortal} onChange={(v) => setSetting('studentPortal', v)} label="Students can sign in to the optional student portal" />
          </div>
          <p className="mt-3 text-xs text-ink-500">Trainers can never edit published syllabus or Notes of Lesson, or see another trainer's batches, students or reports.</p>
        </Card>
      )}
    </div>
  );
}
