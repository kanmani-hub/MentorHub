import { AlertTriangle, BookOpen, CalendarClock, CheckCheck, ClipboardList, FileClock, FileText, GraduationCap, UserCheck, Users, UserCog } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import {
  activeTrainerBatches, attendanceFor, batchProgress, classBatchesOn, courseName, dailyWork, derivedStatus, publishedVersion, allTopics,
  reportMetric, trainerBatches, trainerSyllabus, workMinutes, studentsOf, reportFor, batchReportFor, nolDayCompletion,
} from '../../store/selectors';
import { Avatar, Badge, Button, Card, Progress, Stat, Table } from '../../components/common/ui';
import { Bars, SERIES } from '../../components/charts/Charts';
import { fmtDateTime, fmtMins, fmtShort, prevWeekdays, todayISO, pct } from '../../utils';

export default function AdminDashboard() {
  const { state: s, go, user } = useApp();
  const today = todayISO();
  const activeTrainers = s.trainers.filter((t) => t.status === 'Active');
  const activeBatches = s.batches.filter((b) => b.status === 'Active');
  const teaching = activeTrainers.filter((t) => classBatchesOn(s, t.id, today).length);
  const statuses = teaching.map((t) => derivedStatus(s, t.id, today));
  const submittedToday = statuses.filter((x) => ['Submitted', 'Under Review', 'Approved', 'Correction Requested', 'Rejected'].includes(x)).length;
  const pendingToday = statuses.filter((x) => ['Pending', 'Draft', 'Overdue'].includes(x)).length;
  const awaiting = s.reports.filter((r) => r.status === 'Submitted' || r.status === 'Under Review').length;
  const last7 = [...prevWeekdays(today, 6).reverse(), today];

  const courseData = s.courses.filter((c) => c.status === 'Published').map((c) => {
    const bs = s.batches.filter((b) => b.courseId === c.id);
    let done = 0, total = 0;
    bs.forEach((b) => { const p = batchProgress(s, b); done += p.completed; total += p.total; });
    return { name: c.name.replace(' Programming', ''), progress: pct(done, total), batches: bs.length };
  });
  const batchData = activeBatches.map((b) => ({ name: b.name.replace(' Batch', ''), progress: batchProgress(s, b).pct }));
  const reportData = last7.map((d) => {
    const row = { day: fmtShort(d), Approved: 0, Submitted: 0, Returned: 0, Missing: 0 };
    activeTrainers.forEach((t) => {
      if (!classBatchesOn(s, t.id, d).length) return;
      const st = derivedStatus(s, t.id, d);
      if (st === 'Approved') row.Approved += 1;
      else if (st === 'Submitted' || st === 'Under Review') row.Submitted += 1;
      else if (st === 'Correction Requested' || st === 'Rejected') row.Returned += 1;
      else if (st === 'Overdue') row.Missing += 1;
    });
    return row;
  });

  // institute-level three metrics (kept separate)
  let sylDone = 0, sylTotal = 0;
  activeBatches.forEach((b) => { const p = batchProgress(s, b); sylDone += p.completed; sylTotal += p.total; });
  let workDone = 0, workReq = 0;
  teaching.forEach((t) => { const w = dailyWork(s, t.id, today); workDone += w.done; workReq += w.required; });
  let due = 0, sub = 0, appr = 0;
  activeTrainers.forEach((t) => { const m = reportMetric(s, t.id, last7); due += m.due; sub += m.submitted; appr += m.approved; });

  const todaysClasses = activeBatches.sort((a, b) => a.startTime.localeCompare(b.startTime));
  const attDone = todaysClasses.filter((b) => attendanceFor(s, b.id, today)?.status === 'Submitted').length;
  // report status feed comes straight from report history (no separate notifications module)
  const reportFeed = s.reports.flatMap((r) => r.events.filter((e) => /Submitted|Resubmitted|Approved|Rejected|Correction requested/.test(e.action)).map((e) => ({ ...e, r }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  void user;
  const draftSyllabi = s.syllabi.filter((v) => v.status === 'Draft');
  const overdueList = teaching.filter((t) => derivedStatus(s, t.id, today) === 'Overdue' || prevWeekdays(today, 5).some((d) => classBatchesOn(s, t.id, d).length && derivedStatus(s, t.id, d) === 'Overdue'));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 dark:text-ink-50">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">Every number below is computed from attendance, topic and report records.</p>
        </div>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => go('analytics')}>Open analytics</Button><Button onClick={() => go('approvals')}>Review reports ({awaiting})</Button></div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9">
        <Stat label="Total Trainers" value={s.trainers.length} icon={<UserCog size={17} />} onClick={() => go('trainers')} />
        <Stat label="Active Trainers" value={activeTrainers.length} icon={<UserCheck size={17} />} tone="green" onClick={() => go('trainers')} />
        <Stat label="Total Courses" value={s.courses.length} icon={<BookOpen size={17} />} tone="blue" onClick={() => go('courses')} />
        <Stat label="Active Batches" value={activeBatches.length} icon={<GraduationCap size={17} />} tone="purple" onClick={() => go('batches')} />
        <Stat label="Total Students" value={s.students.filter((x) => x.status === 'Active').length} icon={<Users size={17} />} onClick={() => go('students')} />
        <Stat label="Today's Classes" value={todaysClasses.length} sub={`${attDone} attendance submitted`} icon={<CalendarClock size={17} />} tone="blue" onClick={() => go('attendance')} />
        <Stat label="Submitted Today" value={submittedToday} sub={`of ${teaching.length} trainers`} icon={<FileText size={17} />} tone="green" onClick={() => go('reports')} />
        <Stat label="Reports Pending" value={pendingToday} icon={<FileClock size={17} />} tone="orange" onClick={() => go('reports')} />
        <Stat label="Awaiting Approval" value={awaiting} icon={<CheckCheck size={17} />} tone="purple" onClick={() => go('approvals')} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { k: 'Syllabus progress', d: 'Completed topics ÷ total topics, active batches', v: pct(sylDone, sylTotal), n: `${sylDone} of ${sylTotal} topics`, tone: 'blue' as const },
          { k: 'Daily work completion · today', d: 'Required daily activities done', v: pct(workDone, workReq), n: `${workDone} of ${workReq} activities`, tone: 'purple' as const },
          { k: 'Report submission · last 7 days', d: 'Reports submitted when due', v: pct(sub, due), n: `${sub} of ${due} due · ${appr} approved`, tone: 'green' as const },
        ].map((m) => (
          <div key={m.k} className="rounded-xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-ink-800 dark:text-ink-100">{m.k}</div>
              <div className="font-display text-2xl font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{m.v}%</div>
            </div>
            <div className="mt-2"><Progress value={m.v} tone={m.tone} /></div>
            <div className="mt-2 flex justify-between gap-2 text-[11.5px] text-ink-500"><span>{m.d}</span><span className="shrink-0 tabular-nums">{m.n}</span></div>
          </div>
        ))}
      </div>

      {(() => {
        const nolBatches = s.batches.filter((b) => b.nolId && b.status !== 'Completed');
        const published = s.nols.filter((n) => n.status === 'Published');
        const maxDays = Math.max(0, ...published.map((n) => n.days.length));
        const dayData = Array.from({ length: maxDays }, (_, i) => {
          const eligible = nolBatches.filter((b) => s.nols.find((n) => n.id === b.nolId)?.days.some((d) => d.dayNumber === i + 1));
          const complete = eligible.filter((b) => nolDayCompletion(s, b, i + 1).complete).length;
          return { day: `D${i + 1}`, Completed: pct(complete, eligible.length) };
        });
        return (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Card title="Notes of Lesson" action={<Button size="sm" variant="secondary" onClick={() => go('nol')}>Manage</Button>}>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Courses with notes" value={new Set(published.map((n) => n.courseId)).size} tone="blue" />
                <Stat label="Lesson PDFs uploaded" value={s.files.filter((f) => f.mime === 'application/pdf').length} tone="purple" />
                <Stat label="Published notes" value={published.length} tone="green" />
                <Stat label="Batches assigned notes" value={nolBatches.length} />
              </div>
            </Card>
            <Card title="Day-wise lesson completion" subtitle={`% of assigned batches that have completed every topic of each lesson day (${nolBatches.map((b) => b.name).join(', ') || 'no batches'})`}>
              <Bars data={dayData} x="day" series={[{ key: 'Completed', name: 'Batches completed', color: SERIES.green }]} unit="%" height={200} max={100} />
            </Card>
          </div>
        );
      })()}

      <Card title="Trainer performance" subtitle="Click a trainer for the detailed view" pad={false} action={<Button size="sm" variant="secondary" onClick={() => go('trainers')}>All trainers</Button>}>
        <Table head={['Trainer', 'Assigned courses', 'Batches', 'Students', 'Syllabus progress', 'Batch reports today', "Today's report", 'Teaching time', 'Actions']} minW={1000}>
          {activeTrainers.map((t) => {
            const bs = trainerBatches(s, t.id);
            const sp = trainerSyllabus(s, t.id);
            const st = classBatchesOn(s, t.id, today).length ? derivedStatus(s, t.id, today) : null;
            const wm = workMinutes(s, t.id, today);
            const r = reportFor(s, t.id, today);
            return (
              <tr key={t.id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                <td><button onClick={() => go({ page: 'trainer', id: t.id })} className="flex items-center gap-2.5 text-left"><Avatar name={t.name} size={28} /><span className="font-medium text-ink-900 hover:text-royal-600 dark:text-ink-50">{t.name}</span></button></td>
                <td className="max-w-[180px] truncate">{[...new Set(bs.map((b) => courseName(s, b.courseId)))].join(', ') || '—'}</td>
                <td className="tabular-nums">{bs.length}</td>
                <td className="tabular-nums">{bs.reduce((a, b) => a + studentsOf(s, b.id).length, 0)}</td>
                <td className="w-40"><Progress value={sp.pct} label size="sm" /></td>
                <td className="tabular-nums">{(() => { const cb = classBatchesOn(s, t.id, today); if (!cb.length) return <span className="text-xs text-ink-400">—</span>; const n = cb.filter((b) => batchReportFor(s, t.id, b.id, today)?.status === 'Submitted').length; return <Badge color={n === cb.length ? 'green' : n ? 'orange' : 'grey'} dot={false}>{n}/{cb.length} submitted</Badge>; })()}</td>
                <td>{st ? <Badge>{st}</Badge> : <span className="text-xs text-ink-400">No class</span>}</td>
                <td className="tabular-nums">{fmtMins(wm.teaching)}</td>
                <td className="whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => go({ page: 'trainer', id: t.id })}>View</Button>
                  {r && r.versions.length > 0 && <Button size="sm" variant="ghost" onClick={() => go({ page: 'report', id: r.id })}>Report</Button>}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Course progress" subtitle="Topics completed across all batches of each course">
          <Bars data={courseData} x="name" series={[{ key: 'progress', name: 'Progress', color: SERIES.navy }]} unit="%" layout="vertical" height={260} max={100} />
        </Card>
        <Card title="Batch-wise progress" subtitle="Click a batch below to open it">
          <Bars data={batchData} x="name" series={[{ key: 'progress', name: 'Progress', color: SERIES.royal }]} unit="%" layout="vertical" height={260} max={100} />
        </Card>
        <Card title="Daily report submissions" subtitle="Trainers with classes, last 7 working days">
          <Bars data={reportData} x="day" series={[
            { key: 'Approved', name: 'Approved', color: SERIES.green, stack: 'a' },
            { key: 'Submitted', name: 'Awaiting review', color: SERIES.royal, stack: 'a' },
            { key: 'Returned', name: 'Returned', color: SERIES.orange, stack: 'a' },
            { key: 'Missing', name: 'Missing/overdue', color: SERIES.red, stack: 'a' },
          ]} height={260} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Today's activity" subtitle={`${todaysClasses.length} classes scheduled`} className="xl:col-span-2" pad={false}>
          <Table head={['Time', 'Batch', 'Trainer', 'Attendance', "Today's topics", 'Report']} minW={640}>
            {todaysClasses.map((b) => {
              const att = attendanceFor(s, b.id, today);
              const marked = att ? Object.keys(att.marks).length : 0;
              const recs = s.progress.filter((p) => p.batchId === b.id && p.date === today);
              const done = recs.filter((p) => p.status === 'Completed').length;
              return (
                <tr key={b.id}>
                  <td className="whitespace-nowrap tabular-nums text-ink-500">{b.startTime}–{b.endTime}</td>
                  <td><button className="font-medium text-ink-900 hover:text-royal-600 dark:text-ink-50" onClick={() => go({ page: 'batch', id: b.id })}>{b.name}</button></td>
                  <td>{s.trainers.find((t) => t.id === b.trainerId)?.name}</td>
                  <td>{att?.status === 'Submitted' ? <Badge>Submitted</Badge> : att ? <Badge color="orange">Draft {marked}/{studentsOf(s, b.id).length}</Badge> : <Badge color="grey">Not started</Badge>}</td>
                  <td className="tabular-nums">{recs.length ? `${done} done · ${recs.length - done} open` : <span className="text-ink-400">Not updated</span>}</td>
                  <td><Badge>{derivedStatus(s, b.trainerId, today)}</Badge></td>
                </tr>
              );
            })}
          </Table>
        </Card>
        <div className="space-y-4">
          <Card title="Pending tasks">
            <ul className="space-y-2.5 text-sm">
              {awaiting > 0 && <li className="flex items-start gap-2"><ClipboardList size={16} className="mt-0.5 shrink-0 text-violet2-500" /><button onClick={() => go('approvals')} className="text-left text-ink-700 hover:text-royal-600 dark:text-ink-200">{awaiting} report(s) waiting for review</button></li>}
              {overdueList.map((t) => <li key={t.id} className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" /><button onClick={() => go({ page: 'trainer', id: t.id })} className="text-left text-ink-700 hover:text-royal-600 dark:text-ink-200">{t.name} has an overdue report</button></li>)}
              {draftSyllabi.map((v) => <li key={v.id} className="flex items-start gap-2"><BookOpen size={16} className="mt-0.5 shrink-0 text-amber-500" /><button onClick={() => go({ page: 'syllabus', id: v.courseId })} className="text-left text-ink-700 hover:text-royal-600 dark:text-ink-200">{courseName(s, v.courseId)} v{v.version} draft needs review before publishing</button></li>)}
              {todaysClasses.length - attDone > 0 && <li className="flex items-start gap-2"><CalendarClock size={16} className="mt-0.5 shrink-0 text-amber-500" /><button onClick={() => go('attendance')} className="text-left text-ink-700 hover:text-royal-600 dark:text-ink-200">{todaysClasses.length - attDone} class(es) without submitted attendance</button></li>}
              {s.trainers.filter((t) => t.status === 'Active' && !activeTrainerBatches(s, t.id).length).map((t) => <li key={t.id} className="flex items-start gap-2"><UserCog size={16} className="mt-0.5 shrink-0 text-ink-400" /><span className="text-ink-600 dark:text-ink-300">{t.name} has no active batch</span></li>)}
            </ul>
          </Card>
          <Card title="Report status updates" subtitle="Latest submissions and decisions" action={<Button size="sm" variant="ghost" onClick={() => go('reports')}>All reports</Button>}>
            <ul className="space-y-2.5">
              {reportFeed.map((e, i) => (
                <li key={i}><button onClick={() => e.r.versions.length && go({ page: 'report', id: e.r.id })} className="text-left">
                  <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-ink-900 dark:text-ink-100">{s.trainers.find((t) => t.id === e.r.trainerId)?.name}<Badge>{e.action.startsWith('Correction') ? 'Correction Requested' : /^(Re)?[Ss]ubmitted/.test(e.action) ? 'Submitted' : e.action}</Badge></div>
                  <div className="text-xs text-ink-500">{e.action} · report for {e.r.date}{e.by !== s.trainers.find((t) => t.id === e.r.trainerId)?.name ? ` · by ${e.by}` : ''}</div>
                  <div className="text-[11px] text-ink-400">{fmtDateTime(e.at)}</div>
                </button></li>
              ))}
              {!reportFeed.length && <li className="text-sm text-ink-500">No report activity yet.</li>}
            </ul>
          </Card>
        </div>
      </div>
      <p className="text-xs text-ink-400">Published syllabus topics institute-wide: {s.courses.reduce((a, c) => a + allTopics(publishedVersion(s, c.id)).length, 0)}.</p>
    </div>
  );
}
