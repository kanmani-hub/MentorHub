import { useState } from 'react';
import { AlertTriangle, BookOpen, CalendarCheck, CheckCircle2, Circle, Clock, FileText, GraduationCap, ListTodo, Users, RotateCcw, Mail, Phone } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import {
  activeTrainerBatches, attendanceFor, batchReportFor, batchProgress, courseName, dailyWork, derivedStatus, lessonPlan, studentsOf, trainerBatches, workMinutes, reportFor, classBatchesOn,
} from '../../store/selectors';
import { Avatar, Badge, Button, Card, Empty, Field, Input, KV, Modal, PageHeader, Progress, SimNote, Stat, Table } from '../../components/common/ui';
import { BatchDetail } from '../shared/BatchDetail';
import { cx, fmtDate, fmtDateTime, fmtDay, fmtMins, fmtTime12, nowHHMM, prevWeekdays, todayISO } from '../../utils';
import { useWorkDate } from './common';
import { TrainerNolSummary } from './NolTrainer';

export function TrainerDashboard() {
  const { state: s, user, go, raw } = useApp();
  const { setDate } = useWorkDate();
  const tid = user!.trainerId!;
  const today = todayISO();
  const t = s.trainers[0];
  const all = trainerBatches(s, tid);
  const todays = activeTrainerBatches(s, tid).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const students = all.reduce((a, b) => a + studentsOf(s, b.id).length, 0);
  const pendingAtt = todays.filter((b) => attendanceFor(s, b.id, today)?.status !== 'Submitted').length;
  const plans = todays.map((b) => ({ b, plan: lessonPlan(s, b, today) }));
  const toComplete = plans.reduce((a, { b, plan }) => a + plan.topics.filter((tp) => s.progress.find((p) => p.batchId === b.id && p.topicKey === tp.key && p.date === today)?.status !== 'Completed').length, 0);
  const carry = plans.reduce((a, { plan }) => a + plan.carryOver.length, 0);
  const wm = workMinutes(s, tid, today);
  const status = derivedStatus(s, tid, today);
  const dw = dailyWork(s, tid, today);
  const corrections = s.reports.filter((r) => r.status === 'Correction Requested');
  const hr = Number(nowHHMM().slice(0, 2));
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const nowT = nowHHMM();
  const pastOverdue = useOverdueDays();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-ink-500">{fmtDay(today)}</div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900 dark:text-ink-50">{greet}, {t?.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-ink-500">{todays.length} class{todays.length === 1 ? '' : 'es'} today · report due by {fmtTime12(s.settings.reportDeadline)}</p>
        </div>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => go('t-lesson')}>Today's lesson</Button><Button onClick={() => go('t-batch-report')}>Batch reports</Button></div>
      </div>

      {corrections.map((r) => {
        const ev = [...r.events].reverse().find((e) => e.action === 'Correction requested');
        return (
          <div key={r.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-500/40 dark:bg-amber-500/10">
            <RotateCcw size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-amber-900 dark:text-amber-200">Correction requested for your {fmtDate(r.date)} report</div>
              <div className="text-sm text-amber-800 dark:text-amber-300">{ev?.reason}</div>
              <div className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/70">{ev?.by} · {fmtDateTime(ev?.at)}</div>
            </div>
            <Button variant="secondary" onClick={() => { setDate(r.date); go('t-batch-report'); }}>Fix and resubmit</Button>
          </div>
        );
      })}
      {pastOverdue.map((d) => (
        <div key={d} className="flex flex-wrap items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-500/40 dark:bg-red-500/10">
          <AlertTriangle size={18} className="shrink-0 text-red-600" />
          <div className="min-w-0 flex-1 text-sm text-red-800 dark:text-red-300"><b>Overdue:</b> your report for {fmtDate(d)} was not submitted.</div>
          <Button variant="secondary" onClick={() => { setDate(d); go('t-report'); }}>Complete it</Button>
        </div>
      ))}

      {todays.length > 0 && (() => {
        const rows = todays.map((b) => ({ b, r: batchReportFor(s, tid, b.id, today) }));
        const done = rows.filter((x) => x.r?.status === 'Submitted').length;
        const cons = reportFor(s, tid, today);
        return (
          <Card title="Today's daily report" subtitle={`${done} of ${rows.length} batch reports submitted · consolidated report: ${status}`} action={<Button size="sm" onClick={() => go(done === rows.length ? 't-report' : { page: 't-batch-report', id: rows.find((x) => x.r?.status !== 'Submitted')?.b.id })}>{done === rows.length ? (cons?.versions.length ? 'View consolidated report' : 'Send consolidated report') : 'Continue batch reports'}</Button>}>
            <Progress value={Math.round((done / rows.length) * 100)} tone="green" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {rows.map(({ b, r }) => (
                <button key={b.id} onClick={() => go({ page: 't-batch-report', id: b.id })} className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 px-3 py-2 text-left hover:border-royal-500/50 dark:border-ink-800">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-ink-900 dark:text-ink-50">{b.name}</span><span className="text-xs text-ink-500">{b.startTime}–{b.endTime}</span></span>
                  {r ? <Badge>{r.status}</Badge> : <Badge color="grey">Pending</Badge>}
                </button>
              ))}
              <div className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800/50"><span className="text-sm text-ink-700 dark:text-ink-200">Consolidated</span><Badge>{status}</Badge></div>
            </div>
          </Card>
        );
      })()}

      {(() => {
        const decisions = s.reports.flatMap((r) => r.events.filter((e) => ['Approved', 'Rejected', 'Correction requested'].includes(e.action)).map((e) => ({ ...e, r }))).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 3);
        if (!decisions.length) return null;
        return (
          <Card title="Latest report decisions" action={<Button size="sm" variant="ghost" onClick={() => go('t-history')}>Report history</Button>} pad={false}>
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">{decisions.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"><Badge>{e.action === 'Correction requested' ? 'Correction Requested' : e.action}</Badge><span className="text-ink-800 dark:text-ink-100">Report for {fmtDate(e.r.date)}</span><span className="text-xs text-ink-500">{e.by} · {fmtDateTime(e.at)}</span>{e.reason && <span className="w-full text-xs text-ink-600 dark:text-ink-300">{e.reason}</span>}</li>
            ))}</ul>
          </Card>
        );
      })()}

      <TrainerNolSummary batches={todays} date={today} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
        <Stat label="Assigned batches" value={all.length} icon={<GraduationCap size={17} />} onClick={() => go('t-batches')} />
        <Stat label="Today's classes" value={todays.length} icon={<CalendarCheck size={17} />} tone="blue" />
        <Stat label="Total students" value={students} icon={<Users size={17} />} tone="purple" />
        <Stat label="Pending attendance" value={pendingAtt} icon={<ListTodo size={17} />} tone={pendingAtt ? 'orange' : 'green'} onClick={() => go('t-attendance')} />
        <Stat label="Topics to complete" value={toComplete} icon={<BookOpen size={17} />} tone="blue" onClick={() => go('t-progress')} />
        <Stat label="Pending from previous" value={carry} icon={<AlertTriangle size={17} />} tone={carry ? 'orange' : 'green'} onClick={() => go('t-lesson')} />
        <Stat label="Teaching time today" value={fmtMins(wm.teaching)} sub="From classes held" icon={<Clock size={17} />} />
        <Stat label="Daily report" value={<Badge>{status}</Badge>} icon={<FileText size={17} />} tone="purple" onClick={() => go('t-report')} />
      </div>

      {(() => {
        // report indicators: working days in the last two weeks plus today
        const days = [today, ...prevWeekdays(today, 10)].filter((d) => classBatchesOn(s, tid, d).length);
        const awaiting = days.filter((d) => ['Pending', 'Draft', 'Overdue'].includes(derivedStatus(s, tid, d))).length;
        const n = (st: string) => s.reports.filter((r) => r.status === st).length;
        const items: [string, number, string, string][] = [
          ['Awaiting submission', awaiting, 't-report', awaiting ? 'text-amber-700 dark:text-amber-400' : 'text-ink-900 dark:text-ink-50'],
          ['Submitted', n('Submitted'), 't-history', 'text-royal-700 dark:text-blue-300'],
          ['Under admin review', n('Under Review'), 't-history', 'text-violet-700 dark:text-violet-300'],
          ['Correction requests', n('Correction Requested'), 't-history', n('Correction Requested') ? 'text-orange-700 dark:text-orange-400' : 'text-ink-900 dark:text-ink-50'],
          ['Approved', n('Approved'), 't-history', 'text-emerald-700 dark:text-emerald-400'],
        ];
        return (
          <Card title="My daily reports" pad={false}>
            <div id="trainer-report-indicators" className="grid grid-cols-2 sm:grid-cols-5">
              {items.map(([l, v, page, c]) => (
                <button key={l} onClick={() => go(page)} className="border-b border-r border-ink-100 p-3 text-left hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800/40 sm:border-b-0">
                  <div className="text-xs text-ink-500">{l}</div>
                  <div className={cx('font-display text-xl font-bold tabular-nums', c)}>{v}</div>
                </button>
              ))}
            </div>
          </Card>
        );
      })()}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Today's timetable" className="lg:col-span-2" pad={false}>
          {plans.length === 0 ? <Empty title="No classes today" /> : (
            <ul className="divide-y divide-ink-100 dark:divide-ink-800">
              {plans.map(({ b, plan }) => {
                const live = nowT >= b.startTime && nowT < b.endTime;
                const done = nowT >= b.endTime;
                const att = attendanceFor(s, b.id, today);
                return (
                  <li key={b.id} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
                    <div className="w-24 shrink-0">
                      <div className="font-display text-base font-bold tabular-nums text-ink-900 dark:text-ink-50">{fmtTime12(b.startTime)}</div>
                      <div className="text-xs tabular-nums text-ink-500">to {fmtTime12(b.endTime)}</div>
                    </div>
                    <div className={cx('h-10 w-1 shrink-0 rounded-full', live ? 'bg-emerald-500' : done ? 'bg-ink-300 dark:bg-ink-600' : 'bg-royal-500')} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-ink-900 dark:text-ink-50">{b.name}</span>{live && <Badge color="green">In class now</Badge>}{done && <Badge color="grey" dot={false}>Finished</Badge>}</div>
                      <div className="text-xs text-ink-500">{courseName(s, b.courseId)} · Day {plan.dayNumber}: {plan.flat?.day.title} · {plan.topics.length} topics{plan.carryOver.length ? ` + ${plan.carryOver.length} carried over` : ''}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant={att?.status === 'Submitted' ? 'ghost' : 'secondary'} onClick={() => go({ page: 't-attendance', id: b.id })}>{att?.status === 'Submitted' ? 'Attendance ✓' : 'Attendance'}</Button>
                      <Button size="sm" variant="secondary" onClick={() => go({ page: 't-lesson', id: b.id })}>Lesson</Button>
                      <Button size="sm" onClick={() => go({ page: 't-batch-report', id: b.id })}>Batch report</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Today's checklist" subtitle={`Daily work completion: ${dw.pct}% (${dw.done}/${dw.required})`}>
          <Progress value={dw.pct} tone="purple" />
          <ul className="mt-3 space-y-2">
            {dw.items.map((i) => (
              <li key={i.label} className="flex items-start gap-2 text-sm">{i.done ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <Circle size={16} className="mt-0.5 shrink-0 text-ink-300" />}<span className={i.done ? 'text-ink-500 line-through' : 'text-ink-800 dark:text-ink-100'}>{i.label}</span></li>
            ))}
            <li className="flex items-start gap-2 text-sm">{['Submitted', 'Under Review', 'Approved'].includes(status) ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /> : <Circle size={16} className="mt-0.5 shrink-0 text-ink-300" />}<button onClick={() => go('t-report')} className="text-left text-ink-800 hover:text-royal-600 dark:text-ink-100">Send consolidated daily report</button></li>
          </ul>
          <p className="mt-3 text-[11.5px] text-ink-500">Daily work completion is separate from syllabus progress and from report approval.</p>
        </Card>
      </div>

      <Card title="My batches · syllabus progress" pad={false}>
        <Table head={['Batch', 'Course', 'Students', 'Progress', 'Next lesson']} minW={620}>
          {all.map((b) => { const p = batchProgress(s, b); const plan = lessonPlan(s, b, today); return (
            <tr key={b.id}><td><button className="font-medium text-ink-900 hover:text-royal-600 dark:text-ink-50" onClick={() => go({ page: 't-batch', id: b.id })}>{b.name}</button></td><td>{courseName(s, b.courseId)}</td><td className="tabular-nums">{studentsOf(s, b.id).length}</td><td className="w-44"><Progress value={p.pct} size="sm" label /></td><td className="text-xs">Day {plan.dayNumber}: {plan.flat?.day.title}</td></tr>
          ); })}
        </Table>
      </Card>
    </div>
  );
}

export function useOverdueDays() {
  const { state: s, user } = useApp();
  const tid = user!.trainerId!;
  const today = todayISO();
  const days = new Set<string>();
  s.attendance.forEach((a) => { if (a.date < today) days.add(a.date); });
  return [...days].filter((d) => classBatchesOn(s, tid, d).length && derivedStatus(s, tid, d) === 'Overdue' && !reportFor(s, tid, d)?.versions.length).sort().reverse().slice(0, 3);
}

export function MyBatches() {
  const { state: s, go } = useApp();
  const today = todayISO();
  return (
    <div>
      <PageHeader title="My Batches" sub="Only batches assigned to you are listed" />
      {s.batches.length === 0 && <Card><Empty title="No batches assigned yet" body="Your admin assigns batches from the Trainer Assignments page." /></Card>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {s.batches.map((b) => {
          const p = batchProgress(s, b); const plan = lessonPlan(s, b, today);
          return (
            <Card key={b.id}>
              <div className="flex items-start justify-between gap-2"><div><div className="font-display text-lg font-bold text-ink-900 dark:text-ink-50">{b.name}</div><div className="text-sm text-ink-500">{courseName(s, b.courseId)}</div></div><Badge>{b.status}</Badge></div>
              <dl className="mt-4 grid grid-cols-2 gap-3"><KV k="Students" v={studentsOf(s, b.id).length} /><KV k="Started" v={fmtDate(b.startDate)} /><KV k="Schedule" v={`${b.classDays}`} /><KV k="Timing" v={`${fmtTime12(b.startTime)}–${fmtTime12(b.endTime)}`} /></dl>
              <div className="mt-4"><div className="mb-1 flex justify-between text-xs text-ink-500"><span>Syllabus progress</span><span className="tabular-nums">{p.completed}/{p.total} topics</span></div><Progress value={p.pct} label /></div>
              <div className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-sm dark:bg-ink-800/50"><span className="text-xs text-ink-500">Next lesson</span><div className="font-medium text-ink-900 dark:text-ink-100">Day {plan.dayNumber}: {plan.flat?.day.title}</div>{plan.carryOver.length > 0 && <div className="text-xs text-amber-700 dark:text-amber-300">+ {plan.carryOver.length} topic(s) carried over</div>}</div>
              <div className="mt-4 flex gap-2"><Button className="flex-1" onClick={() => go({ page: 't-batch', id: b.id })}>View batch</Button><Button variant="secondary" onClick={() => go({ page: 't-lesson', id: b.id })}>Lesson</Button></div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export const TrainerBatchDetail = ({ id }: { id: string }) => <BatchDetail id={id} back="t-batches" />;

export function MyProfile() {
  const { state: s, user, toast } = useApp();
  const t = s.trainers[0];
  const [pw, setPw] = useState(false);
  if (!t) return null;
  return (
    <div>
      <PageHeader title="My Profile" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex flex-col items-center text-center"><Avatar name={t.name} size={72} /><div className="mt-3 font-display text-lg font-bold text-ink-900 dark:text-ink-50">{t.name}</div><div className="text-sm text-ink-500">{t.designation}</div><div className="mt-2"><Badge>{t.status}</Badge></div></div>
          <dl className="mt-5 grid gap-3"><KV k="Trainer ID" v={t.id} /><KV k="Email" v={<span className="flex items-center gap-1.5"><Mail size={13} />{t.email}</span>} /><KV k="Phone" v={<span className="flex items-center gap-1.5"><Phone size={13} />{t.phone}</span>} /><KV k="Joined" v={fmtDate(t.joiningDate)} /><KV k="Skills" v={t.skills.join(', ')} /></dl>
          <Button variant="secondary" className="mt-5 w-full" onClick={() => setPw(true)}>Change password</Button>
        </Card>
        <Card title="Assignment history" className="lg:col-span-2" pad={false}>
          <Table head={['Batch', 'Course', 'Period', 'Schedule', 'Assigned by']} minW={600}>
            {s.assignments.map((a) => <tr key={a.id}><td className="font-medium text-ink-900 dark:text-ink-50">{s.batches.find((b) => b.id === a.batchId)?.name}</td><td>{courseName(s, a.courseId)}</td><td className="text-xs">{fmtDate(a.start)} – {fmtDate(a.end)}</td><td className="text-xs">{a.schedule}</td><td className="text-xs">{a.by}</td></tr>)}
          </Table>
          <div className="p-4"><SimNote>You see only your own profile, batches, students and reports. Other trainers' data is filtered out before any page renders; production must enforce the same rule in the backend.</SimNote></div>
        </Card>
      </div>
      {pw && <Modal open onClose={() => setPw(false)} title="Change password" size="sm" footer={<><Button variant="secondary" onClick={() => setPw(false)}>Cancel</Button><Button onClick={() => { setPw(false); toast('Password changes need the backend auth service. Nothing was changed.', 'info'); }}>Update password</Button></>}>
        <div className="space-y-3"><Field label="Current password"><Input id="pw-cur" type="password" /></Field><Field label="New password"><Input id="pw-new" type="password" /></Field><SimNote>Signed in as {user!.email}. Password storage is not part of this prototype.</SimNote></div>
      </Modal>}
    </div>
  );
}
