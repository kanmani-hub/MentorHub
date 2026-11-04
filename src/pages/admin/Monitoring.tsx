import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { topicDay, attendanceRate, batchProgress, courseName, lessonPlan, studentsOf, trainerName, workMinutes, allTopics, publishedVersion } from '../../store/selectors';
import { Badge, Button, Card, Empty, Modal, PageHeader, Progress, SearchBox, Select, SimNote, Stat, Table, Input } from '../../components/common/ui';
import { FakePlayer } from '../../components/common/ReportView';
import { Bars, SERIES } from '../../components/charts/Charts';
import { cx, fmtDate, fmtDateTime, fmtMins, minutesBetween, prevWeekdays, todayISO, pct } from '../../utils';

export function AdminAttendance() {
  const { state: s } = useApp();
  const [date, setDate] = useState(todayISO());
  const [batch, setBatch] = useState('All');
  const [open, setOpen] = useState<string | null>(null);
  const rows = s.batches.filter((b) => b.status === 'Active' && (batch === 'All' || b.id === batch)).map((b) => ({ b, a: s.attendance.find((x) => x.batchId === b.id && x.date === date) }));
  const sess = s.attendance.find((x) => x.id === open);
  const corrections = s.attendance.flatMap((a) => a.corrections.map((c) => ({ ...c, batch: s.batches.find((b) => b.id === a.batchId)?.name, date: a.date })));
  return (
    <div>
      <PageHeader title="Attendance Management" sub="Class-wise attendance across all batches" />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <Input id="aa-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto" />
          <Select id="aa-batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="!w-auto"><option value="All">All batches</option>{s.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        </div>
        <Table head={['Batch', 'Trainer', 'Status', 'Marked', 'Present', 'Late', 'Absent', 'Leave', 'Overall rate', '']} minW={900}>
          {rows.map(({ b, a }) => {
            const m = a ? Object.values(a.marks) : [];
            return (
              <tr key={b.id}><td className="font-medium text-ink-900 dark:text-ink-50">{b.name}</td><td>{trainerName(s, b.trainerId)}</td><td>{a ? <Badge>{a.status}</Badge> : <Badge color="grey">Not started</Badge>}</td>
                <td className="tabular-nums">{m.length}/{studentsOf(s, b.id).length}</td>{(['Present', 'Late', 'Absent', 'Leave'] as const).map((k) => <td key={k} className="tabular-nums">{m.filter((x) => x === k).length}</td>)}
                <td className="w-32"><Progress value={attendanceRate(s, b.id).pct} size="sm" label tone="green" /></td><td>{a && <Button size="sm" variant="ghost" onClick={() => setOpen(a.id)}>View</Button>}</td></tr>
            );
          })}
        </Table>
      </Card>
      <Card className="mt-4" title="Correction history" subtitle="Changes made after attendance was submitted" pad={false}>
        <Table head={['Date', 'Batch', 'Student', 'Change', 'Reason', 'By', 'When']} minW={760} empty={!corrections.length && <Empty title="No corrections recorded" />}>
          {corrections.map((c, i) => <tr key={i}><td>{fmtDate(c.date)}</td><td>{c.batch}</td><td>{s.students.find((x) => x.id === c.studentId)?.name}</td><td>{c.from} → {c.to}</td><td>{c.reason}</td><td>{c.by}</td><td className="text-xs">{fmtDateTime(c.at)}</td></tr>)}
        </Table>
      </Card>
      {sess && (
        <Modal open onClose={() => setOpen(null)} title={`${s.batches.find((b) => b.id === sess.batchId)?.name} · ${fmtDate(sess.date)}`} sub={sess.submittedBy ? `Submitted by ${sess.submittedBy} at ${fmtDateTime(sess.submittedAt)}` : 'Draft'}>
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">{studentsOf(s, sess.batchId).map((st) => <li key={st.id} className="flex items-center justify-between py-2 text-sm"><span className="text-ink-800 dark:text-ink-100">{st.name} <span className="text-xs text-ink-400">{st.id}</span></span>{sess.marks[st.id] ? <Badge>{sess.marks[st.id]}</Badge> : <Badge color="grey">Not marked</Badge>}</li>)}</ul>
        </Modal>
      )}
    </div>
  );
}

export function AdminSyllabusProgress() {
  const { state: s, go } = useApp();
  const [fb, setFb] = useState('All');
  const [fd, setFd] = useState(todayISO());
  const titleOf = (key: string) => s.syllabi.flatMap((v) => v.modules.flatMap((m) => m.weeks.flatMap((w) => w.days.flatMap((d) => d.topics)))).find((t) => t.key === key)?.title ?? key;
  const updates = s.progress.filter((p) => (fb === 'All' || p.batchId === fb) && (!fd || p.date === fd)).sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
  const rows = s.batches.map((b) => ({ b, p: batchProgress(s, b), plan: lessonPlan(s, b, todayISO()) }));
  const courses = s.courses.map((c) => {
    const bs = rows.filter((r) => r.b.courseId === c.id);
    const done = bs.reduce((a, r) => a + r.p.completed, 0), total = bs.reduce((a, r) => a + r.p.total, 0);
    return { c, bs: bs.length, done, total, pct: pct(done, total), topics: allTopics(publishedVersion(s, c.id)).length };
  });
  return (
    <div>
      <PageHeader title="Topic Progress Monitoring" sub="Metric 1: completed topics ÷ applicable topics. Partial and pending topics are never counted as completed." />
      <Card pad={false} title="Batch-wise">
        <Table head={['Batch', 'Course', 'Trainer', 'Completed', 'Partial', 'Not completed', 'Total', 'Progress', 'Current day', 'Carry-over']} minW={1000}>
          {rows.map(({ b, p, plan }) => (
            <tr key={b.id}><td><button className="font-medium text-ink-900 hover:text-royal-600 dark:text-ink-50" onClick={() => go({ page: 'batch', id: b.id })}>{b.name}</button></td><td>{courseName(s, b.courseId)}</td><td>{trainerName(s, b.trainerId)}</td>
              <td className="tabular-nums text-emerald-600">{p.completed}</td><td className="tabular-nums text-amber-600">{p.partial}</td><td className="tabular-nums">{p.pending}</td><td className="tabular-nums">{p.total}</td>
              <td className="w-36"><Progress value={p.pct} size="sm" label /></td><td className="text-xs">Day {plan.dayNumber}/{plan.totalDays}: {plan.flat?.day.title}</td><td>{plan.carryOver.length ? <Badge color="orange">{plan.carryOver.length} topics</Badge> : <Badge color="green">None</Badge>}</td></tr>
          ))}
        </Table>
      </Card>
      <Card className="mt-4" pad={false} title="Course-wise">
        <Table head={['Course', 'Topics in syllabus', 'Batches', 'Completed (all batches)', 'Applicable', 'Progress']} minW={760}>
          {courses.map((r) => <tr key={r.c.id}><td className="font-medium text-ink-900 dark:text-ink-50">{r.c.name}</td><td className="tabular-nums">{r.topics}</td><td className="tabular-nums">{r.bs}</td><td className="tabular-nums">{r.done}</td><td className="tabular-nums">{r.total}</td><td className="w-40">{r.total ? <Progress value={r.pct} size="sm" label /> : <span className="text-xs text-ink-400">No batches</span>}</td></tr>)}
        </Table>
      </Card>
      <Card className="mt-4" pad={false} title="Saved topic progress" subtitle="Status and reason recorded by trainers for each class date">
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <Select id="tpm-batch" value={fb} onChange={(e) => setFb(e.target.value)} className="!w-auto"><option value="All">All batches</option>{s.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Input id="tpm-date" type="date" value={fd} onChange={(e) => setFd(e.target.value)} className="!w-auto" />
          {fd && <Button size="sm" variant="ghost" onClick={() => setFd('')}>All dates</Button>}
        </div>
        <Table head={['Class date', 'Batch', 'Trainer', 'Syllabus day', 'Topic', 'Status', 'Reason', 'Saved']} minW={1000} empty={!updates.length && <Empty title="No topic progress saved for this filter" />}>
          {updates.slice(0, 80).map((p) => { const b = s.batches.find((x) => x.id === p.batchId); return (
            <tr key={p.id}><td className="whitespace-nowrap">{fmtDate(p.date)}</td><td className="whitespace-nowrap">{b?.name}</td><td className="whitespace-nowrap">{p.updatedBy ?? (b ? trainerName(s, b.trainerId) : '—')}</td><td className="whitespace-nowrap">{p.dayNumber ? `Day ${p.dayNumber}` : (b && topicDay(s, b, p.topicKey) ? `Day ${topicDay(s, b, p.topicKey)!.dayNumber}` : '—')}</td><td>{titleOf(p.topicKey)}</td><td><Badge color={p.status === 'Completed' ? 'green' : p.status === 'Pending' ? 'red' : 'orange'}>{p.status === 'Pending' ? 'Not Covered' : p.status}</Badge></td><td className="max-w-xs text-xs">{p.reason || '—'}</td><td className="whitespace-nowrap text-xs">{fmtDateTime(p.updatedAt)}</td></tr>
          ); })}
        </Table>
      </Card>
    </div>
  );
}

export function AdminHours() {
  const { state: s } = useApp();
  const [date, setDate] = useState(todayISO());
  const active = s.trainers.filter((t) => t.status === 'Active');
  const rows = active.map((t) => ({ t, w: workMinutes(s, t.id, date), ci: s.checkins.find((c) => c.trainerId === t.id && c.date === date) }));
  const week = [...prevWeekdays(todayISO(), 4).reverse(), todayISO()];
  const chart = active.map((t) => { const tot = week.reduce((a, d) => a + workMinutes(s, t.id, d).total, 0); const tea = week.reduce((a, d) => a + workMinutes(s, t.id, d).teaching, 0); return { name: t.name.split(' ')[0], Teaching: +(tea / 60).toFixed(1), Other: +((tot - tea) / 60).toFixed(1) }; });
  const cats = ['Lesson Preparation', 'Teaching', 'Notes Preparation', 'Student Support', 'Doubt Clearing', 'Administrative Work', 'Daily Reporting', 'Other Work'];
  return (
    <div>
      <PageHeader title="Working Hours" sub="Teaching time and total working time are tracked separately" actions={<Input id="ah-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto" />} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card pad={false} title={`By trainer · ${fmtDate(date)}`} className="xl:col-span-2">
          <Table head={['Trainer', 'Check-in', 'Check-out', ...cats.map((c) => c.replace(' Preparation', ' prep').replace('Administrative Work', 'Admin').replace('Daily Reporting', 'Reporting')), 'Teaching', 'Total']} minW={1100}>
            {rows.map(({ t, w, ci }) => (
              <tr key={t.id}><td className="whitespace-nowrap font-medium text-ink-900 dark:text-ink-50">{t.name}</td><td className="tabular-nums">{ci?.in ?? '—'}</td><td className="tabular-nums">{ci?.out ?? '—'}</td>
                {cats.map((c) => <td key={c} className="tabular-nums text-xs">{w.byCat[c] ? fmtMins(w.byCat[c]) : '—'}</td>)}
                <td className="tabular-nums font-medium">{fmtMins(w.teaching)}</td><td className="tabular-nums font-semibold text-ink-900 dark:text-ink-50">{fmtMins(w.total)}</td></tr>
            ))}
          </Table>
        </Card>
        <Card title="This week (hours)" subtitle="Last 5 working days">
          <Bars data={chart} x="name" series={[{ key: 'Teaching', name: 'Teaching', color: SERIES.navy, stack: 'a' }, { key: 'Other', name: 'Other work', color: SERIES.purple, stack: 'a' }]} unit="h" height={300} />
        </Card>
      </div>
    </div>
  );
}

export function AdminActivities() {
  const { state: s, go } = useApp();
  const [date, setDate] = useState(todayISO());
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'activities' | 'projects' | 'voice'>('activities');
  const list = s.activities.filter((a) => a.date === date && `${a.practicals} ${a.homework} ${a.doubts} ${a.nextPlan}`.toLowerCase().includes(q.toLowerCase()));
  const brs = s.batchReports.filter((r) => r.date === date && r.status === 'Submitted');
  const projects = brs.flatMap((r) => r.projects.map((p) => ({ ...p, r }))).filter((p) => `${p.name} ${p.assigned} ${p.students}`.toLowerCase().includes(q.toLowerCase()));
  const sname = (id: string) => s.students.find((x) => x.id === id)?.name ?? id;
  const voice = s.waUpdates.filter((w) => w.date === date).flatMap((w) => w.studentIds.map((id) => ({ id: `${w.id}-${id}`, w, student: sname(id), title: w.voiceNotes?.find((x) => x.studentId === id)?.title ?? '' })))
    .filter((v) => `${v.student} ${v.title}`.toLowerCase().includes(q.toLowerCase()));
  const repId = (tid: string) => s.reports.find((x) => x.trainerId === tid && x.date === date && x.versions.length)?.id;
  return (
    <div>
      <PageHeader title="Daily Activities" sub="Practicals, homework, project work and student voice notes from batch reports" />
      <div className="mb-3 grid grid-cols-3 gap-3"><Stat label="Batch reports submitted" value={brs.length} tone="blue" /><Stat label="Project entries" value={brs.reduce((a, r) => a + r.projects.length, 0)} tone="purple" /><Stat label="Student voice notes" value={s.waUpdates.filter((w) => w.date === date).reduce((a, w) => a + w.studentIds.length, 0)} tone="green" /></div>
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 p-3 dark:border-ink-800">
          <Input id="ad-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto" /><SearchBox value={q} onChange={setQ} placeholder="Search…" />
          <div className="ml-auto inline-flex rounded-lg bg-ink-100 p-0.5 dark:bg-ink-800">{([['activities', 'Activities'], ['projects', 'Project work'], ['voice', 'Student Voice Notes']] as const).map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cx('rounded-md px-2.5 py-1 text-xs font-medium', tab === k ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500')}>{l}</button>)}</div>
        </div>
        {tab === 'activities' && (
          <Table head={['Trainer', 'Batch', 'Practicals', 'Homework / assignments', 'Doubts', 'Remarks', 'Next class']} minW={1100} empty={!list.length && <Empty title="No activities logged for this date" />}>
            {list.map((a) => <tr key={a.id}><td className="whitespace-nowrap">{trainerName(s, a.trainerId)}</td><td className="whitespace-nowrap">{s.batches.find((b) => b.id === a.batchId)?.name}</td>{[a.practicals, a.homework, a.doubts, a.feedback, a.nextPlan].map((x, i) => <td key={i} className={cx('min-w-[140px] text-xs', !x && 'text-ink-400')}>{x || '—'}</td>)}</tr>)}
          </Table>
        )}
        {tab === 'projects' && (
          <Table head={['Trainer', 'Batch', 'Project', 'Work completed today', 'Assigned', 'Students', 'Status', 'Remarks', '']} minW={1100} empty={!projects.length && <Empty title="No project work recorded for this date" />}>
            {projects.map((p) => <tr key={p.id}><td className="whitespace-nowrap">{trainerName(s, p.r.trainerId)}</td><td className="whitespace-nowrap">{s.batches.find((b) => b.id === p.r.batchId)?.name}</td><td className="font-medium text-ink-900 dark:text-ink-50">{p.name}</td><td className="text-xs">{p.workDone || '—'}</td><td className="text-xs">{p.assigned || '—'}</td><td className="text-xs">{p.students || '—'}</td><td><Badge color={p.status === 'Completed' ? 'green' : p.status === 'In Progress' ? 'blue' : 'grey'}>{p.status}</Badge></td><td className="text-xs">{p.remarks || '—'}</td><td>{repId(p.r.trainerId) && <Button size="sm" variant="ghost" onClick={() => go({ page: 'report', id: repId(p.r.trainerId) })}>Report</Button>}</td></tr>)}
          </Table>
        )}
        {tab === 'voice' && (
          <Table head={['Trainer', 'Batch', 'Student', 'Voice note', '']} minW={640} empty={!voice.length && <Empty title="No student voice notes recorded for this date" />}>
            {voice.map((v) => <tr key={v.id}><td className="whitespace-nowrap">{trainerName(s, v.w.trainerId)}</td><td className="whitespace-nowrap">{s.batches.find((b) => b.id === v.w.batchId)?.name}</td><td className="whitespace-nowrap">{v.student}</td><td className={cx(!v.title && 'text-xs italic text-ink-400')}>{v.title || 'no description'}</td><td>{repId(v.w.trainerId) && <Button size="sm" variant="ghost" onClick={() => go({ page: 'report', id: repId(v.w.trainerId) })}>Report</Button>}</td></tr>)}
          </Table>
        )}
      </Card>
    </div>
  );
}

export function NotificationsPage() {
  const { raw, user, mutate, go } = useApp();
  const [filter, setFilter] = useState('all');
  const mine = raw.notifications.filter((n) => n.userId === user!.id && (filter === 'all' || (filter === 'unread' ? !n.read : n.type === filter))).sort((a, b) => b.at.localeCompare(a.at));
  const reviewers = raw.users.filter((u) => u.role === 'admin' && u.active && u.canReview);
  return (
    <div>
      <PageHeader title="Notifications" actions={<Button variant="secondary" icon={<CheckCheck size={15} />} onClick={() => mutate((d) => d.notifications.forEach((n) => { if (n.userId === user!.id) n.read = true; }))}>Mark all read</Button>} />
      <SimNote>Notifications are simulated in this browser. Email and WhatsApp delivery need backend integration. {user!.role === 'admin' && `Report submissions go to all ${reviewers.length} active admins with review permission: ${reviewers.map((r) => r.name).join(', ')}.`}</SimNote>
      <div className="my-3"><Select id="nt-filter" value={filter} onChange={(e) => setFilter(e.target.value)} className="!w-auto"><option value="all">All</option><option value="unread">Unread</option><option value="report-submitted">Report submitted</option><option value="correction">Corrections</option><option value="approved">Approvals</option><option value="overdue">Overdue alerts</option><option value="assignment">Assignments</option></Select></div>
      <Card pad={false}>
        {mine.length === 0 && <Empty icon={<Bell size={20} />} title="No notifications" />}
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {mine.map((n) => (
            <li key={n.id} className={cx('flex flex-wrap items-start gap-3 px-4 py-3', !n.read && 'bg-royal-50/40 dark:bg-royal-500/5')}>
              <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-ink-200 dark:bg-ink-700' : 'bg-royal-500')} />
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium text-ink-900 dark:text-ink-100">{n.title}</span><Badge color={n.type === 'overdue' || n.type === 'rejected' ? 'red' : n.type === 'correction' ? 'orange' : n.type === 'approved' ? 'green' : 'blue'} dot={false}>{n.type.replace('-', ' ')}</Badge></div><div className="text-sm text-ink-600 dark:text-ink-300">{n.body}</div><div className="text-xs text-ink-400">{fmtDateTime(n.at)}</div></div>
              <div className="flex gap-1">{n.link && <Button size="sm" variant="secondary" onClick={() => { mutate((d) => { d.notifications.find((x) => x.id === n.id)!.read = true; }); go(n.link!); }}>Open</Button>}{!n.read && <Button size="sm" variant="ghost" onClick={() => mutate((d) => { d.notifications.find((x) => x.id === n.id)!.read = true; })}>Mark read</Button>}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function AuditLogs() {
  const { state: s } = useApp();
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const types = ['All', 'Attendance', 'Topic', 'Working hours', 'Report', 'Correction', 'Syllabus', 'Trainer', 'Batch', 'Student', 'Course'];
  const list = s.audit.filter((a) => (type === 'All' || `${a.action}`.toLowerCase().includes(type.toLowerCase())) && `${a.user} ${a.action} ${a.entity} ${a.reason}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Audit Logs" sub={`${s.audit.length} events · every change records who, what, before, after and why`} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 border-b border-ink-100 p-3 dark:border-ink-800"><SearchBox value={q} onChange={setQ} placeholder="Search user, entity, reason…" /><Select id="au-type" value={type} onChange={(e) => setType(e.target.value)} className="!w-auto">{types.map((t) => <option key={t}>{t}</option>)}</Select></div>
        <Table head={['Timestamp', 'User', 'Action', 'Entity', 'Previous value', 'New value', 'Reason']} minW={1000} empty={!list.length && <Empty title="No matching events" />}>
          {list.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-xs tabular-nums">{fmtDateTime(a.at)}</td><td className="whitespace-nowrap">{a.user}</td><td className="whitespace-nowrap font-medium text-ink-900 dark:text-ink-50">{a.action}</td><td>{a.entity}</td><td className="text-xs text-red-600/80 dark:text-red-300/80">{a.prev || '—'}</td><td className="text-xs text-emerald-700 dark:text-emerald-300">{a.next || '—'}</td><td className="max-w-xs text-xs">{a.reason || '—'}</td></tr>)}
        </Table>
      </Card>
    </div>
  );
}

export const minutesFmt = (a: string, b: string) => fmtMins(minutesBetween(a, b));
