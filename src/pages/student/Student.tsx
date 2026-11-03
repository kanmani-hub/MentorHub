import { useState } from 'react';
import { Award, BookOpen, CalendarCheck, HelpCircle, TrendingUp } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { batchProgress, courseName, flatDays, latestProgress, lessonPlan, syllabusOf } from '../../store/selectors';
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Progress, SimNote, Stat, Table, Textarea } from '../../components/common/ui';
import { SyllabusTree } from '../../components/common/SyllabusTree';
import { NotesIndex } from '../shared/Notes';
import { fmtDate, fmtDateTime, nowTs, pct, todayISO, uid } from '../../utils';

const useMe = () => {
  const { state: s } = useApp();
  const me = s.students[0];
  const b = s.batches[0];
  return { s, me, b };
};

const ASSESSMENTS = [
  { name: 'Week 1 Quiz', topic: 'Introduction, Variables, Data Types', score: 17, max: 20, date: -6 },
  { name: 'Operators Mini Test', topic: 'Operators', score: 8, max: 10, date: -3 },
  { name: 'Conditionals Lab', topic: 'Conditional Statements', score: null as number | null, max: 25, date: 2 },
];

export function StudentDashboard() {
  const { s, me, b } = useMe();
  const { go } = useApp();
  if (!me || !b) return <Empty title="No enrolment found" />;
  const p = batchProgress(s, b);
  const mine = s.attendance.map((a) => a.marks[me.id]).filter(Boolean);
  const present = mine.filter((m) => m === 'Present' || m === 'Late').length;
  const plan = lessonPlan(s, b, todayISO());
  const lastHw = [...s.activities].sort((x, y) => y.date.localeCompare(x.date))[0];
  return (
    <div className="space-y-5">
      <PageHeader title={`Welcome, ${me.name.split(' ')[0]}`} sub={`${courseName(s, b.courseId)} · ${b.name}`} />
      <SimNote>The student portal is an optional module. Students see only their own attendance and published learning material.</SimNote>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Course progress" value={`${p.pct}%`} sub={`${p.completed}/${p.total} topics taught`} icon={<TrendingUp size={17} />} tone="blue" />
        <Stat label="My attendance" value={`${pct(present, mine.length)}%`} sub={`${present}/${mine.length} classes`} icon={<CalendarCheck size={17} />} tone="green" />
        <Stat label="Next lesson" value={`Day ${plan.dayNumber}`} sub={plan.flat?.day.title} icon={<BookOpen size={17} />} tone="purple" />
        <Stat label="Open doubts" value={s.doubts.filter((d) => d.status === 'Open').length} icon={<HelpCircle size={17} />} tone="orange" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Latest homework">{lastHw ? <><div className="text-xs text-ink-500">{fmtDate(lastHw.date)}</div><p className="mt-1 text-sm text-ink-800 dark:text-ink-100">{lastHw.homework || 'No homework set'}</p></> : <Empty title="No homework yet" />}<Button className="mt-3" size="sm" variant="secondary" onClick={() => go('s-homework')}>All homework</Button></Card>
        <Card title="Upcoming assessment">{(() => { const a = ASSESSMENTS.find((x) => x.score === null)!; return <><div className="font-medium text-ink-900 dark:text-ink-50">{a.name}</div><div className="text-sm text-ink-500">{a.topic} · out of {a.max}</div></>; })()}<Button className="mt-3" size="sm" variant="secondary" onClick={() => go('s-assessments')}>View assessments</Button></Card>
      </div>
    </div>
  );
}

export function StudentCourse() {
  const { s, b } = useMe();
  if (!b) return null;
  const v = syllabusOf(s, b);
  return <div><PageHeader title="My Course" sub={`${courseName(s, b.courseId)} · syllabus v${v?.version}`} /><Card>{v && <SyllabusTree v={v} statusOf={(k) => latestProgress(s, b.id, k)?.status} defaultOpen={2} />}</Card></div>;
}

export const StudentNotes = () => <NotesIndex detailPage="s-topic" />;

export function StudentHomework({ assignments }: { assignments?: boolean }) {
  const { s } = useMe();
  const list = [...s.activities].sort((x, y) => y.date.localeCompare(x.date)).filter((a) => (assignments ? a.assignments : a.homework));
  return (
    <div><PageHeader title={assignments ? 'Assignments' : 'Homework'} />
      <Card pad={false}><Table head={['Date', assignments ? 'Assignment' : 'Homework', 'Status']} minW={480} empty={!list.length && <Empty title="Nothing set yet" />}>
        {list.map((a, i) => <tr key={a.id}><td className="whitespace-nowrap">{fmtDate(a.date)}</td><td>{assignments ? a.assignments : a.homework}</td><td><Badge color={i === 0 ? 'orange' : 'green'}>{i === 0 ? 'Due next class' : 'Submitted'}</Badge></td></tr>)}
      </Table></Card>
      <p className="mt-2 text-xs text-ink-500">Submission tracking is illustrative in this prototype.</p>
    </div>
  );
}

export function StudentAttendance() {
  const { s, me } = useMe();
  const list = [...s.attendance].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div><PageHeader title="My Attendance" />
      <Card pad={false}><Table head={['Date', 'Status']} minW={360} empty={!list.length && <Empty title="No attendance recorded" />}>
        {list.map((a) => <tr key={a.id}><td>{fmtDate(a.date)}</td><td><Badge>{a.marks[me.id] ?? 'Not marked'}</Badge></td></tr>)}
      </Table></Card>
    </div>
  );
}

export function StudentAssessments() {
  return (
    <div><PageHeader title="Assessments" />
      <Card pad={false}><Table head={['Assessment', 'Topics', 'Date', 'Score']} minW={560}>
        {ASSESSMENTS.map((a) => { const d = new Date(); d.setDate(d.getDate() + a.date); return <tr key={a.name}><td className="font-medium text-ink-900 dark:text-ink-50">{a.name}</td><td>{a.topic}</td><td>{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td><td>{a.score === null ? <Badge color="blue">Upcoming</Badge> : <span className="tabular-nums">{a.score}/{a.max}</span>}</td></tr>; })}
      </Table></Card>
      <p className="mt-2 flex items-center gap-1 text-xs text-ink-500"><Award size={13} />Assessment scores are sample data.</p>
    </div>
  );
}

export function StudentProgress() {
  const { s, b } = useMe();
  if (!b) return null;
  const days = flatDays(syllabusOf(s, b));
  const p = batchProgress(s, b);
  return (
    <div><PageHeader title="My Progress" sub="Topics your batch has completed" />
      <Card><Progress value={p.pct} label /><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{days.map((d) => { const done = d.day.topics.filter((t) => latestProgress(s, b.id, t.key)?.status === 'Completed').length; return <div key={d.day.id} className="rounded-lg border border-ink-200 p-3 dark:border-ink-800"><div className="text-xs text-ink-500">Day {d.index + 1}</div><div className="text-sm font-medium text-ink-900 dark:text-ink-50">{d.day.title}</div><div className="mt-1.5"><Progress value={pct(done, d.day.topics.length)} size="sm" tone={done === d.day.topics.length ? 'green' : 'blue'} /></div></div>; })}</div></Card>
    </div>
  );
}

export function StudentDoubts() {
  const { s, me } = useMe();
  const { mutate, toast } = useApp();
  const [topic, setTopic] = useState('');
  const [text, setText] = useState('');
  return (
    <div><PageHeader title="Doubts" sub="Ask your trainer about any topic" />
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card title="Ask a doubt"><div className="space-y-3"><Field label="Topic"><Input id="db-topic" value={topic} onChange={(e) => setTopic(e.target.value)} /></Field><Field label="Your question"><Textarea id="db-text" value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <Button onClick={() => { if (!topic.trim() || !text.trim()) { toast('Enter the topic and your question.', 'error'); return; } mutate((d) => { d.doubts.unshift({ id: uid('d'), studentId: me.id, topic, text, at: nowTs(), status: 'Open' }); }); setTopic(''); setText(''); toast('Doubt sent to your trainer'); }}>Submit doubt</Button></div></Card>
        <Card title="My doubts" pad={false}>{s.doubts.length === 0 ? <Empty title="No doubts yet" /> : <ul className="divide-y divide-ink-100 dark:divide-ink-800">{s.doubts.map((d) => <li key={d.id} className="px-4 py-3"><div className="flex items-center justify-between gap-2"><span className="font-medium text-ink-900 dark:text-ink-50">{d.topic}</span><Badge>{d.status}</Badge></div><p className="text-sm text-ink-700 dark:text-ink-200">{d.text}</p>{d.answer && <p className="mt-1 rounded bg-emerald-50 px-2 py-1 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">{d.answer}</p>}<div className="text-xs text-ink-400">{fmtDateTime(d.at)}</div></li>)}</ul>}</Card>
      </div>
    </div>
  );
}
