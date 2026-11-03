import { useState } from 'react';
import { useApp } from '../../store/AppStore';
import { attendanceRate, batchProgress, classBatchesOn, courseName, dailyWork, derivedStatus, reportMetric, studentsOf, trainerSyllabus, workMinutes, allTopics, publishedVersion } from '../../store/selectors';
import { Card, PageHeader, Progress, Select, Stat, Table } from '../../components/common/ui';
import { Bars, Donut, Lines, SERIES } from '../../components/charts/Charts';
import { fmtMins, fmtShort, pct, prevWeekdays, todayISO } from '../../utils';

export default function Analytics() {
  const { state: s } = useApp();
  const [range, setRange] = useState(5);
  const [course, setCourse] = useState('All');
  const [trainer, setTrainer] = useState('All');
  const [batch, setBatch] = useState('All');
  const today = todayISO();
  const dates = [...prevWeekdays(today, range - 1).reverse(), today];
  const batches = s.batches.filter((b) => b.status !== 'Completed' && (course === 'All' || b.courseId === course) && (trainer === 'All' || b.trainerId === trainer) && (batch === 'All' || b.id === batch));
  const trainers = s.trainers.filter((t) => t.status === 'Active' && (trainer === 'All' || t.id === trainer) && batches.some((b) => b.trainerId === t.id));

  const tRows = trainers.map((t) => {
    const sp = trainerSyllabus(s, t.id);
    let dDone = 0, dReq = 0, mins = 0, teach = 0, attSessions = 0, attDue = 0;
    dates.forEach((d) => {
      const w = dailyWork(s, t.id, d); if (classBatchesOn(s, t.id, d).length) { dDone += w.done; dReq += w.required; }
      const wm = workMinutes(s, t.id, d); mins += wm.total; teach += wm.teaching;
      classBatchesOn(s, t.id, d).forEach((b) => { attDue += 1; if (s.attendance.some((a) => a.batchId === b.id && a.date === d && a.status === 'Submitted')) attSessions += 1; });
    });
    const rm = reportMetric(s, t.id, dates);
    return { t, sp: sp.pct, work: pct(dDone, dReq), rep: rm.submissionPct, appr: rm.approved, hours: mins, teach, att: pct(attSessions, attDue), attSessions, attDue };
  });
  const bRows = batches.map((b) => ({ b, p: batchProgress(s, b), a: attendanceRate(s, b.id), n: studentsOf(s, b.id).length }));
  const cRows = s.courses.filter((c) => course === 'All' || c.id === course).map((c) => {
    const bs = bRows.filter((r) => r.b.courseId === c.id);
    const done = bs.reduce((a, r) => a + r.p.completed, 0), partial = bs.reduce((a, r) => a + r.p.partial, 0), tot = bs.reduce((a, r) => a + r.p.total, 0);
    return { c, topics: allTopics(publishedVersion(s, c.id)).length, done, partial, pending: tot - done - partial, tot, pct: pct(done, tot) };
  }).filter((r) => r.tot);

  const statusCount: Record<string, number> = { Approved: 0, 'Awaiting review': 0, 'Correction / rejected': 0, Overdue: 0, 'Pending (today)': 0 };
  const trend = dates.map((d) => {
    const row = { day: fmtShort(d), Submitted: 0, Approved: 0, Due: 0 };
    trainers.forEach((t) => {
      if (!classBatchesOn(s, t.id, d).length) return;
      const st = derivedStatus(s, t.id, d);
      row.Due += 1;
      if (['Submitted', 'Under Review', 'Approved', 'Correction Requested', 'Rejected'].includes(st)) row.Submitted += 1;
      if (st === 'Approved') { row.Approved += 1; statusCount.Approved += 1; }
      else if (st === 'Submitted' || st === 'Under Review') statusCount['Awaiting review'] += 1;
      else if (st === 'Correction Requested' || st === 'Rejected') statusCount['Correction / rejected'] += 1;
      else if (st === 'Overdue') statusCount.Overdue += 1;
      else statusCount['Pending (today)'] += 1;
    });
    return row;
  });
  const totalReports = Object.values(statusCount).reduce((a, b) => a + b, 0);
  const sumDone = bRows.reduce((a, r) => a + r.p.completed, 0), sumTot = bRows.reduce((a, r) => a + r.p.total, 0);

  return (
    <div>
      <PageHeader title="Trainer Performance & Analytics" sub="Every figure is calculated from the sample records shown elsewhere in the app" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Select id="an-range" value={range} onChange={(e) => setRange(Number(e.target.value))} className="!w-auto"><option value={5}>Last 5 working days</option><option value={7}>Last 7 working days</option><option value={10}>Last 10 working days</option></Select>
        <Select id="an-course" value={course} onChange={(e) => setCourse(e.target.value)} className="!w-auto"><option value="All">All courses</option>{s.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select id="an-trainer" value={trainer} onChange={(e) => setTrainer(e.target.value)} className="!w-auto"><option value="All">All trainers</option>{s.trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select id="an-batch" value={batch} onChange={(e) => setBatch(e.target.value)} className="!w-auto"><option value="All">All batches</option>{s.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Syllabus progress" value={`${pct(sumDone, sumTot)}%`} sub={`${sumDone}/${sumTot} topics`} tone="blue" />
        <Stat label="Reports due in range" value={totalReports} sub={`${statusCount.Approved} approved`} tone="green" />
        <Stat label="Overdue reports" value={statusCount.Overdue} tone="red" />
        <Stat label="Students in scope" value={bRows.reduce((a, r) => a + r.n, 0)} sub={`${bRows.length} batches`} />
      </div>

      <h2 className="mb-2 mt-6 font-display text-lg font-bold text-ink-900 dark:text-ink-50">Trainer analytics</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Three metrics per trainer" subtitle="Syllabus progress, daily work completion and report submission are kept separate">
          <Bars data={tRows.map((r) => ({ name: r.t.name.split(' ')[0], Syllabus: r.sp, 'Daily work': r.work, Reports: r.rep }))} x="name" series={[{ key: 'Syllabus', name: 'Syllabus progress', color: SERIES.navy }, { key: 'Daily work', name: 'Daily work completion', color: SERIES.purple }, { key: 'Reports', name: 'Report submission', color: SERIES.green }]} unit="%" height={280} max={100} />
        </Card>
        <Card title="Teaching time" subtitle="Hours of classes held in range">
          <Bars data={tRows.map((r) => ({ name: r.t.name.split(' ')[0], Teaching: +(r.teach / 60).toFixed(1), Other: +((r.hours - r.teach) / 60).toFixed(1) }))} x="name" series={[{ key: 'Teaching', name: 'Teaching', color: SERIES.navy, stack: 'h' }, { key: 'Other', name: 'Other work', color: SERIES.royal, stack: 'h' }]} unit="h" height={280} />
        </Card>
      </div>
      <Card pad={false} className="mt-4">
        <Table head={['Trainer', 'Syllabus progress', 'Daily work completion', 'Report submission', 'Approved', 'Teaching time', 'Attendance submitted']} minW={900}>
          {tRows.map((r) => <tr key={r.t.id}><td className="font-medium text-ink-900 dark:text-ink-50">{r.t.name}</td><td className="w-36"><Progress value={r.sp} size="sm" label /></td><td className="w-36"><Progress value={r.work} size="sm" label tone="purple" /></td><td className="w-36"><Progress value={r.rep} size="sm" label tone="green" /></td><td className="tabular-nums">{r.appr}</td><td className="tabular-nums">{fmtMins(r.teach)}</td><td className="tabular-nums">{r.attSessions}/{r.attDue} sessions</td></tr>)}
        </Table>
      </Card>

      <h2 className="mb-2 mt-6 font-display text-lg font-bold text-ink-900 dark:text-ink-50">Batch analytics</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Topics completed vs not yet completed"><Bars data={bRows.map((r) => ({ name: r.b.name.replace(' Batch', ''), Completed: r.p.completed, Partial: r.p.partial, Remaining: r.p.pending }))} x="name" series={[{ key: 'Completed', name: 'Completed', color: SERIES.green, stack: 't' }, { key: 'Partial', name: 'Partial', color: SERIES.orange, stack: 't' }, { key: 'Remaining', name: 'Not completed', color: SERIES.grey, stack: 't' }]} layout="vertical" height={Math.max(220, bRows.length * 32)} /></Card>
        <Card pad={false} title="Batch summary">
          <Table head={['Batch', 'Students', 'Attendance', 'Done', 'Pending', 'Progress']} minW={560}>
            {bRows.map((r) => <tr key={r.b.id}><td className="font-medium text-ink-900 dark:text-ink-50">{r.b.name}</td><td className="tabular-nums">{r.n}</td><td className="tabular-nums">{r.a.pct}%</td><td className="tabular-nums">{r.p.completed}</td><td className="tabular-nums">{r.p.total - r.p.completed}</td><td className="w-32"><Progress value={r.p.pct} size="sm" label /></td></tr>)}
          </Table>
        </Card>
      </div>

      <h2 className="mb-2 mt-6 font-display text-lg font-bold text-ink-900 dark:text-ink-50">Course analytics</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Course-wise syllabus completion"><Bars data={cRows.map((r) => ({ name: r.c.name.replace(' Programming', ''), Completion: r.pct }))} x="name" series={[{ key: 'Completion', name: 'Completion', color: SERIES.royal }]} unit="%" height={260} max={100} /></Card>
        <Card pad={false} title="Course topics">
          <Table head={['Course', 'Topics in syllabus', 'Completed', 'Partial', 'Pending', 'Applicable']} minW={560}>
            {cRows.map((r) => <tr key={r.c.id}><td className="font-medium text-ink-900 dark:text-ink-50">{courseName(s, r.c.id)}</td><td className="tabular-nums">{r.topics}</td><td className="tabular-nums text-emerald-600">{r.done}</td><td className="tabular-nums text-amber-600">{r.partial}</td><td className="tabular-nums">{r.pending}</td><td className="tabular-nums">{r.tot}</td></tr>)}
          </Table>
        </Card>
      </div>

      <h2 className="mb-2 mt-6 font-display text-lg font-bold text-ink-900 dark:text-ink-50">Daily report analytics</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Submission trend"><Lines data={trend} x="day" series={[{ key: 'Due', name: 'Due', color: SERIES.grey }, { key: 'Submitted', name: 'Submitted', color: SERIES.royal }, { key: 'Approved', name: 'Approved', color: SERIES.green }]} height={260} /></Card>
        <Card title="Report status in range"><Donut data={[
          { name: 'Approved', value: statusCount.Approved, color: SERIES.green }, { name: 'Awaiting review', value: statusCount['Awaiting review'], color: SERIES.royal },
          { name: 'Correction / rejected', value: statusCount['Correction / rejected'], color: SERIES.orange }, { name: 'Overdue', value: statusCount.Overdue, color: SERIES.red }, { name: 'Pending (today)', value: statusCount['Pending (today)'], color: SERIES.grey },
        ]} center={{ value: String(totalReports), label: 'reports due' }} height={210} /></Card>
      </div>
    </div>
  );
}
