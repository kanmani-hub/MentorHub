import { AlertTriangle, BookOpen, CalendarClock, CheckCheck, ClipboardList, FileClock, FileText, GraduationCap, UserCheck, Users, UserCog } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import {
  activeTrainerBatches, attendanceFor, batchProgress, classBatchesOn, courseName, dailyWork, derivedStatus, publishedVersion, allTopics,
  reportMetric, trainerBatches, trainerSyllabus, workMinutes, studentsOf, reportFor, batchReportFor, nolDayCompletion,
} from '../../store/selectors';
import { Avatar, Badge, Button, Card, Details, Empty, Progress, Stat, Table } from '../../components/common/ui';
import type { ReactNode } from 'react';
import { Bars, SERIES } from '../../components/charts/Charts';
import { cx, fmtDateTime, fmtDay, fmtMins, fmtShort, prevWeekdays, todayISO, pct } from '../../utils';
import { assignedTo, myReview } from '../../store/reviews';

export default function AdminDashboard() {
  const { state: s, go, user } = useApp();
  const today = todayISO();
  const activeTrainers = s.trainers.filter((t) => t.status === 'Active');
  const activeBatches = s.batches.filter((b) => b.status === 'Active');
  const teaching = activeTrainers.filter((t) => classBatchesOn(s, t.id, today).length);
  const statuses = teaching.map((t) => derivedStatus(s, t.id, today));
  const submittedToday = statuses.filter((x) => ['Submitted', 'Under Review', 'Approved', 'Correction Requested', 'Rejected'].includes(x)).length;
  const pendingToday = statuses.filter((x) => ['Pending', 'Draft', 'Overdue'].includes(x)).length;
  // reviewer-specific counters: only reports this admin was selected to review
  const mine = assignedTo(s, user!.id);
  const awaiting = mine.filter((r) => myReview(r, user!.id).awaiting).length;
  const approvedByMe = mine.filter((r) => (r.reviewHistory ?? []).some((h) => h.reviewerId === user!.id && h.action === 'Approved')).length;
  const needCorrection = mine.filter((r) => r.status === 'Correction Requested').length;
  const last7 = [...prevWeekdays(today, 6).reverse(), today];

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

  const studentsActive = s.students.filter((x) => x.status === 'Active').length;
  const attention: { icon: ReactNode; text: string; go: () => void }[] = [
    ...overdueList.map((t) => ({ icon: <AlertTriangle size={16} className="text-red-500 dark:text-red-300" />, text: `${t.name}: daily report overdue`, go: () => go({ page: 'trainer', id: t.id }) })),
    ...(todaysClasses.length - attDone > 0 ? [{ icon: <CalendarClock size={16} className="text-amber-500 dark:text-amber-300" />, text: `${todaysClasses.length - attDone} class${todaysClasses.length - attDone === 1 ? '' : 'es'} without submitted attendance`, go: () => go('attendance') }] : []),
    ...draftSyllabi.map((v) => ({ icon: <BookOpen size={16} className="text-amber-500 dark:text-amber-300" />, text: `Syllabus draft waiting: ${s.courses.find((c) => c.id === v.courseId)?.name ?? v.courseId} v${v.version}`, go: () => go({ page: 'syllabus', id: v.courseId }) })),
    ...s.trainers.filter((t) => t.status === 'Active' && !activeTrainerBatches(s, t.id).length).map((t) => ({ icon: <UserCog size={16} className="text-ink-400" />, text: `${t.name} has no active batch`, go: () => go('batches') })),
  ];
  const metrics = [
    { k: 'Syllabus progress', d: `${sylDone} of ${sylTotal} topics`, v: pct(sylDone, sylTotal), tone: 'blue' as const },
    { k: 'Daily work today', d: `${workDone} of ${workReq} activities`, v: pct(workDone, workReq), tone: 'purple' as const },
    { k: 'Reports submitted (7 days)', d: `${sub} of ${due} due · ${appr} approved`, v: pct(sub, due), tone: 'green' as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-[22px]">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{fmtDay(today)} · {todaysClasses.length} classes today · {submittedToday} of {teaching.length} daily reports submitted</p>
        </div>
        <Button onClick={() => go('approvals')} icon={<ClipboardList size={15} />}>Review reports{awaiting ? ` (${awaiting})` : ''}</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active trainers" value={activeTrainers.length} sub={`of ${s.trainers.length} trainers`} icon={<UserCheck size={17} />} onClick={() => go('trainers')} />
        <Stat label="Active batches" value={activeBatches.length} sub={`${studentsActive} students`} icon={<GraduationCap size={17} />} tone="blue" onClick={() => go('batches')} />
        <Stat label="Today's classes" value={todaysClasses.length} sub={`${attDone} with attendance submitted`} icon={<CalendarClock size={17} />} tone="purple" onClick={() => go('attendance')} />
        <Stat label="Daily reports today" value={`${submittedToday}/${teaching.length}`} sub={pendingToday ? `${pendingToday} not yet submitted` : 'All submitted'} icon={<FileText size={17} />} tone={pendingToday ? 'orange' : 'green'} onClick={() => go('reports')} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Today's classes" pad={false} className="xl:col-span-2" action={<Button size="sm" variant="ghost" onClick={() => go('attendance')}>Attendance</Button>}>
          <Table head={['Time', 'Batch', 'Trainer', 'Attendance', 'Daily report']} minW={560} empty={!todaysClasses.length && <Empty title="No classes today" />}>
            {todaysClasses.map((b) => {
              const att = attendanceFor(s, b.id, today);
              const marked = att ? Object.keys(att.marks).length : 0;
              return (
                <tr key={b.id}>
                  <td className="whitespace-nowrap tabular-nums text-ink-500">{b.startTime}–{b.endTime}</td>
                  <td><button className="font-medium text-ink-900 hover:text-royal-600 dark:text-ink-50 dark:hover:text-royal-200" onClick={() => go({ page: 'batch', id: b.id })}>{b.name}</button></td>
                  <td>{s.trainers.find((t) => t.id === b.trainerId)?.name}</td>
                  <td>{att?.status === 'Submitted' ? <Badge>Submitted</Badge> : att ? <Badge color="orange">Draft {marked}/{studentsOf(s, b.id).length}</Badge> : <Badge color="grey">Not started</Badge>}</td>
                  <td><Badge>{derivedStatus(s, b.trainerId, today)}</Badge></td>
                </tr>
              );
            })}
          </Table>
        </Card>

        <div className="space-y-6">
          <Card title="My report reviews" pad={false}>
            <ul id="admin-review-indicators" className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
              {([['Awaiting my review', awaiting, awaiting > 0], ['Reports assigned to me', mine.length, false], ['Approved by me', approvedByMe, false], ['Requiring trainer correction', needCorrection, needCorrection > 0]] as const).map(([l, v, hot]) => (
                <li key={l}><button onClick={() => go('approvals')} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-ink-50/70 dark:hover:bg-ink-800/40 sm:px-5">
                  <span className="text-ink-700 dark:text-ink-200">{l}</span>
                  <span className={cx('tabular-nums font-semibold', hot ? 'text-royal-700 dark:text-royal-200' : 'text-ink-900 dark:text-ink-100')}>{v}</span>
                </button></li>
              ))}
            </ul>
          </Card>
          <Card title="Needs attention" pad={false}>
            {attention.length ? (
              <ul className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
                {attention.slice(0, 6).map((a, i) => (
                  <li key={i}><button onClick={a.go} className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-ink-700 hover:bg-ink-50/70 dark:text-ink-200 dark:hover:bg-ink-800/40 sm:px-5"><span className="mt-0.5 shrink-0">{a.icon}</span><span className="min-w-0">{a.text}</span></button></li>
                ))}
              </ul>
            ) : <p className="px-5 py-4 text-sm text-ink-500 dark:text-ink-400">Nothing needs attention right now.</p>}
          </Card>
        </div>
      </div>

      <Card title="Progress" action={<Button size="sm" variant="ghost" onClick={() => go('analytics')}>Analytics</Button>}>
        <div className="grid gap-5 md:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.k}>
              <div className="flex items-baseline justify-between gap-2"><span className="text-sm text-ink-700 dark:text-ink-200">{m.k}</span><span className="text-lg font-semibold tabular-nums text-ink-900 dark:text-ink-50">{m.v}%</span></div>
              <div className="mt-1.5"><Progress value={m.v} tone={m.tone} size="sm" /></div>
              <div className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">{m.d}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Trainers" pad={false} className="xl:col-span-2" action={<Button size="sm" variant="ghost" onClick={() => go('trainers')}>All trainers</Button>}>
          <Table head={['Trainer', 'Batches', 'Syllabus progress', "Today's report", '']} minW={560}>
            {activeTrainers.map((t) => {
              const sp = trainerSyllabus(s, t.id);
              const st = classBatchesOn(s, t.id, today).length ? derivedStatus(s, t.id, today) : null;
              const r = reportFor(s, t.id, today);
              return (
                <tr key={t.id}>
                  <td><button onClick={() => go({ page: 'trainer', id: t.id })} className="flex items-center gap-2.5 text-left"><Avatar name={t.name} size={28} /><span className="font-medium text-ink-900 hover:text-royal-600 dark:text-ink-50 dark:hover:text-royal-200">{t.name}</span></button></td>
                  <td className="tabular-nums">{trainerBatches(s, t.id).length}</td>
                  <td className="w-44"><Progress value={sp.pct} label size="sm" /></td>
                  <td>{st ? <Badge>{st}</Badge> : <span className="text-xs text-ink-400">No class</span>}</td>
                  <td className="whitespace-nowrap text-right">{r && r.versions.length > 0 ? <Button size="sm" variant="ghost" onClick={() => go({ page: 'report', id: r.id })}>Report</Button> : <Button size="sm" variant="ghost" onClick={() => go({ page: 'trainer', id: t.id })}>View</Button>}</td>
                </tr>
              );
            })}
          </Table>
        </Card>
        <Card title="Recent report activity" action={<Button size="sm" variant="ghost" onClick={() => go('reports')}>All reports</Button>}>
          {reportFeed.length ? (
            <ul className="space-y-3">
              {reportFeed.slice(0, 5).map((e, i) => (
                <li key={i}><button onClick={() => e.r.versions.length && go({ page: 'report', id: e.r.id })} className="w-full text-left">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-sm font-medium text-ink-900 dark:text-ink-100">{s.trainers.find((t) => t.id === e.r.trainerId)?.name}<span className="text-xs font-normal text-ink-400">{fmtDateTime(e.at)}</span></div>
                  <div className="text-xs text-ink-500 dark:text-ink-400">{e.action} · report for {fmtShort(e.r.date)}{e.by !== s.trainers.find((t) => t.id === e.r.trainerId)?.name ? ` · ${e.by}` : ''}</div>
                </button></li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-500">No report activity yet.</p>}
        </Card>
      </div>

      <Details summary={<span>Report submissions · last 7 working days</span>}>
        <div className="p-4 sm:p-5">
          <Bars data={reportData} x="day" series={[
            { key: 'Approved', name: 'Approved', color: SERIES.green, stack: 'a' },
            { key: 'Submitted', name: 'Awaiting review', color: SERIES.navy, stack: 'a' },
            { key: 'Returned', name: 'Returned', color: SERIES.orange, stack: 'a' },
            { key: 'Missing', name: 'Missing/overdue', color: SERIES.red, stack: 'a' },
          ]} height={240} />
        </div>
      </Details>
    </div>
  );
}
