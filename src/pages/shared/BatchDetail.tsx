import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import {
  attendanceRate, batchProgress, courseName, lessonPlan, sessionDates, studentsOf, syllabusOf, trainerName, latestProgress, flatDays,
} from '../../store/selectors';
import { Badge, Button, Card, Empty, KV, PageHeader, Progress, Stat, Table, Tabs } from '../../components/common/ui';
import { SyllabusTree } from '../../components/common/SyllabusTree';
import { fmtDate, fmtTime12, todayISO } from '../../utils';

export function BatchDetail({ id, back, onEdit, onAddStudents }: { id: string; back: string; onEdit?: () => void; onAddStudents?: () => void }) {
  const { state: s, go, user } = useApp();
  const [tab, setTab] = useState<'overview' | 'students' | 'attendance' | 'lessons' | 'progress' | 'homework' | 'reports'>('overview');
  const b = s.batches.find((x) => x.id === id);
  if (!b) return <Card><Empty title="Batch not available" body="This batch is not assigned to you or no longer exists." action={<Button onClick={() => go(back)}>Back</Button>} /></Card>;
  const isAdmin = user!.role === 'admin';
  const v = syllabusOf(s, b);
  const p = batchProgress(s, b);
  const today = todayISO();
  const plan = lessonPlan(s, b, today);
  const studs = studentsOf(s, b.id, false);
  const att = s.attendance.filter((a) => a.batchId === b.id).sort((x, y) => y.date.localeCompare(x.date));
  const ar = attendanceRate(s, b.id);
  const dates = sessionDates(s, b.id).reverse();
  const days = flatDays(v);
  const acts = s.activities.filter((a) => a.batchId === b.id).sort((x, y) => y.date.localeCompare(x.date));
  const reports = s.reports.filter((r) => r.trainerId === b.trainerId && r.versions.some((vv) => vv.snapshot.batches.some((bb) => bb.batchId === b.id))).sort((x, y) => y.date.localeCompare(x.date));
  return (
    <div>
      <PageHeader back={() => go(back)} title={b.name} sub={`${courseName(s, b.courseId)} · ${b.classDays} · ${fmtTime12(b.startTime)}–${fmtTime12(b.endTime)} · Trainer: ${trainerName(s, b.trainerId)}`}
        actions={<>{isAdmin && onEdit && <Button variant="secondary" onClick={onEdit}>Edit batch</Button>}{isAdmin && onAddStudents && <Button onClick={onAddStudents}>Add students</Button>}{!isAdmin && <Button onClick={() => go({ page: 't-lesson', id: b.id })}>Open today's lesson</Button>}</>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Syllabus progress" value={`${p.pct}%`} sub={`${p.completed}/${p.total} topics completed`} tone="blue" />
        <Stat label="Students" value={studs.filter((x) => x.status === 'Active').length} sub={`${studs.length - studs.filter((x) => x.status === 'Active').length} inactive`} />
        <Stat label="Attendance rate" value={`${ar.pct}%`} sub={`${ar.present}/${ar.total} marks present or late`} tone="green" />
        <Stat label="Sessions held" value={dates.filter((d) => d < today).length} sub={`Next: Day ${plan.dayNumber} of ${plan.totalDays}`} tone="purple" />
      </div>
      <div className="mt-5">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'students', label: 'Students', count: studs.length }, { id: 'attendance', label: 'Attendance history', count: att.length }, { id: 'lessons', label: 'Lesson history' }, { id: 'progress', label: 'Topic progress' }, { id: 'homework', label: 'Homework' }, { id: 'reports', label: 'Daily reports', count: reports.length }]} />
        {tab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Batch details">
              <dl className="grid grid-cols-2 gap-3">
                <KV k="Batch ID" v={b.id} /><KV k="Status" v={<Badge>{b.status}</Badge>} /><KV k="Course" v={courseName(s, b.courseId)} /><KV k="Syllabus" v={v ? `v${v.version}${v.status !== 'Published' ? ` (${v.status})` : ''}` : '—'} />
                <KV k="Start" v={fmtDate(b.startDate)} /><KV k="End" v={fmtDate(b.endDate)} /><KV k="Class days" v={b.classDays} /><KV k="Timing" v={`${fmtTime12(b.startTime)}–${fmtTime12(b.endTime)}`} />
              </dl>
            </Card>
            <Card title="Progress" className="lg:col-span-2">
              <Progress value={p.pct} label />
              <div className="mt-2 flex flex-wrap gap-2 text-xs"><Badge color="green" dot={false}>{p.completed} completed</Badge><Badge color="orange" dot={false}>{p.partial} partial</Badge><Badge color="grey" dot={false}>{p.pending} not yet completed</Badge></div>
              <div className="mt-4 text-sm"><span className="font-medium text-ink-900 dark:text-ink-100">Next lesson:</span> <span className="text-ink-700 dark:text-ink-200">Day {plan.dayNumber} · {plan.flat?.day.title}</span> <span className="text-ink-500">({plan.topics.length} topics)</span></div>
              {plan.carryOver.length > 0 && <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><b>Carried over:</b> {plan.carryOver.map((c) => c.topic.title).join(', ')}</div>}
            </Card>
          </div>
        )}
        {tab === 'students' && (
          <Card pad={false}><Table head={['ID', 'Name', 'Email', 'Mobile', 'Joined', 'Attendance', 'Status']} minW={760} empty={!studs.length && <Empty title="No students in this batch" action={onAddStudents && <Button onClick={onAddStudents}>Add students</Button>} />}>
            {studs.map((st) => {
              const marks = att.filter((a) => a.status === 'Submitted').map((a) => a.marks[st.id]).filter(Boolean);
              const pr = marks.filter((m) => m === 'Present' || m === 'Late').length;
              return <tr key={st.id}><td className="font-mono text-xs">{st.id}</td><td className="font-medium text-ink-900 dark:text-ink-50">{st.name}</td><td>{st.email}</td><td className="whitespace-nowrap">{st.mobile}</td><td>{fmtDate(st.joiningDate)}</td><td className="tabular-nums">{marks.length ? `${pr}/${marks.length}` : '—'}</td><td><Badge>{st.status}</Badge></td></tr>;
            })}
          </Table></Card>
        )}
        {tab === 'attendance' && (
          <Card pad={false}><Table head={['Date', 'Status', 'Present', 'Late', 'Absent', 'Leave', 'Submitted', 'Corrections']} minW={720} empty={!att.length && <Empty title="No attendance yet" />}>
            {att.map((a) => { const m = Object.values(a.marks); return (
              <tr key={a.id}><td>{fmtDate(a.date)}</td><td><Badge>{a.status}</Badge></td>{(['Present', 'Late', 'Absent', 'Leave'] as const).map((k) => <td key={k} className="tabular-nums">{m.filter((x) => x === k).length}</td>)}<td className="text-xs">{a.submittedBy ?? '—'}</td><td className="text-xs">{a.corrections.length ? a.corrections.map((c) => `${s.students.find((x) => x.id === c.studentId)?.name}: ${c.from}→${c.to}`).join('; ') : '—'}</td></tr>
            ); })}
          </Table></Card>
        )}
        {tab === 'lessons' && (
          <Card pad={false}><Table head={['Date', 'Topics updated', 'Completed', 'Partial', 'Pending', 'Planned day']} minW={640} empty={!dates.length && <Empty title="No lessons recorded" />}>
            {dates.map((d) => {
              const recs = s.progress.filter((x) => x.batchId === b.id && x.date === d);
              const lp = lessonPlan(s, b, d);
              return <tr key={d}><td>{fmtDate(d)}{d === today && <Badge color="blue" dot={false}>Today</Badge>}</td><td className="tabular-nums">{recs.length}</td><td className="tabular-nums text-emerald-600">{recs.filter((x) => x.status === 'Completed').length}</td><td className="tabular-nums text-amber-600">{recs.filter((x) => x.status === 'Partially Completed').length}</td><td className="tabular-nums text-red-600">{recs.filter((x) => x.status === 'Pending').length}</td><td>Day {lp.dayNumber}: {lp.flat?.day.title}</td></tr>;
            })}
          </Table></Card>
        )}
        {tab === 'progress' && v && (
          <Card title="Topic-wise status" subtitle={`Latest status per topic · ${days.length} days in syllabus v${v.version}`}>
            <SyllabusTree v={v} statusOf={(k) => latestProgress(s, b.id, k)?.status} defaultOpen={3} onTopic={(k) => go({ page: isAdmin ? 'topic' : 't-topic', id: k })} />
          </Card>
        )}
        {tab === 'homework' && (
          <Card pad={false}><Table head={['Date', 'Homework', 'Assignments', 'Practicals']} minW={640} empty={!acts.length && <Empty title="No homework recorded" />}>
            {acts.map((a) => <tr key={a.id}><td className="whitespace-nowrap">{fmtDate(a.date)}</td><td>{a.homework || '—'}</td><td>{a.assignments || '—'}</td><td>{a.practicals || '—'}</td></tr>)}
          </Table></Card>
        )}
        {tab === 'reports' && (
          <Card pad={false}><Table head={['Date', 'Trainer', 'Status', 'Versions', '']} minW={560} empty={!reports.length && <Empty title="No reports include this batch yet" />}>
            {reports.map((r) => <tr key={r.id}><td>{fmtDate(r.date)}</td><td>{trainerName(s, r.trainerId)}</td><td><Badge>{r.status}</Badge></td><td>{r.versions.length}</td><td className="text-right"><Button size="sm" variant="ghost" onClick={() => go(isAdmin ? { page: 'report', id: r.id } : { page: 't-history', id: r.id })}>Open</Button></td></tr>)}
          </Table></Card>
        )}
      </div>
    </div>
  );
}
