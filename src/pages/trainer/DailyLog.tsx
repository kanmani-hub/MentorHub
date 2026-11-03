import { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, Mic, Square, Trash2, Upload, Plus } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { VOICE_CATEGORIES, type DailyActivity, type VoiceCategory, type WorkCategory } from '../../types';
import { activityFor, classBatchesOn, workFor, workMinutes } from '../../store/selectors';
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, SimNote, Stat, Table, Textarea } from '../../components/common/ui';
import { FakePlayer } from '../../components/common/ReportView';
import { cx, fmtDate, fmtMins, fmtMinsLong, fmtSecs, minutesBetween, nowHHMM, nowTs, todayISO, uid } from '../../utils';
import { BatchPills, LockedBanner, WorkDatePicker, useBatchSel, useLocked, useWorkDate } from './common';

export function WorkingHoursPage() {
  const { state: s, user, mutate, toast } = useApp();
  const { date } = useWorkDate();
  const tid = user!.trainerId!;
  const locked = useLocked(date) && !s.settings.trainerEditWorkAfterSubmit;
  const [f, setF] = useState({ activity: 'Teaching' as WorkCategory, start: '', end: '', description: '', batchId: '' });
  const [err, setErr] = useState('');
  const logs = workFor(s, tid, date);
  const wm = workMinutes(s, tid, date);
  const ci = s.checkins.find((c) => c.trainerId === tid && c.date === date);
  const batches = classBatchesOn(s, tid, date);
  const dur = minutesBetween(f.start, f.end);
  const add = () => {
    if (!f.start || !f.end) return setErr('Enter start and end time.');
    if (f.end <= f.start) return setErr('End time must be after start time.');
    const overlap = logs.find((l) => l.start < f.end && f.start < l.end);
    if (overlap) return setErr(`Overlaps with ${overlap.activity} ${overlap.start}–${overlap.end}.`);
    if (f.activity === 'Teaching' && !f.batchId) return setErr('Select the batch you taught.');
    setErr('');
    mutate((d) => { d.work.push({ id: uid('wl'), trainerId: tid, date, activity: f.activity, start: f.start, end: f.end, description: f.description.trim(), batchId: f.batchId || undefined }); },
      { action: 'Working hours added', entity: `${f.activity} ${f.start}–${f.end}`, prev: '—', next: fmtMins(dur), reason: '' });
    toast(`${f.activity} · ${fmtMins(dur)} added`);
    setF({ ...f, start: f.end, end: '', description: '' });
  };
  const preset = (activity: WorkCategory, b?: string) => {
    const bb = batches.find((x) => x.id === b);
    setF({ activity, start: bb?.startTime ?? '', end: bb?.endTime ?? '', description: bb ? `Class for ${bb.name}` : '', batchId: b ?? '' });
  };
  const checkin = (kind: 'in' | 'out') => {
    mutate((d) => { let c = d.checkins.find((x) => x.trainerId === tid && x.date === date); if (!c) { c = { trainerId: tid, date }; d.checkins.push(c); } c[kind] = nowHHMM(); });
    toast(kind === 'in' ? `Checked in at ${nowHHMM()}` : `Checked out at ${nowHHMM()}`);
  };
  const cats = s.settings.workCategories as WorkCategory[];
  return (
    <div>
      <PageHeader title="Working Hours" sub="Durations are calculated from start and end times" actions={<WorkDatePicker />} />
      <LockedBanner date={date} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Teaching time" value={fmtMins(wm.teaching)} tone="navy" />
        <Stat label="Total working time" value={fmtMins(wm.total)} sub={fmtMinsLong(wm.total)} tone="purple" />
        <Stat label="Entries" value={logs.length} />
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-ink-200 bg-white p-3.5 dark:border-ink-800 dark:bg-ink-900">
          <div className="text-xs font-medium text-ink-500">Check-in / out (optional)</div>
          <div className="text-sm tabular-nums text-ink-900 dark:text-ink-100">{ci?.in ?? '--:--'} → {ci?.out ?? '--:--'}</div>
          {date === todayISO() && <div className="flex gap-1.5"><Button size="sm" variant="secondary" icon={<LogIn size={13} />} disabled={!!ci?.in} onClick={() => checkin('in')}>In</Button><Button size="sm" variant="secondary" icon={<LogOut size={13} />} disabled={!ci?.in || !!ci?.out} onClick={() => checkin('out')}>Out</Button></div>}
        </div>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[380px_1fr]">
        <Card title="Add entry">
          <div className="mb-3 flex flex-wrap gap-1.5">{batches.map((b) => <Button key={b.id} size="sm" variant="ghost" onClick={() => preset('Teaching', b.id)}>+ Teaching {b.name.replace(' Batch', '')}</Button>)}</div>
          <div className="grid gap-3">
            <Field label="Activity"><Select id="wh-act" value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value as WorkCategory })}>{cats.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Start"><Input id="wh-start" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
              <Field label="End"><Input id="wh-end" type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
              <Field label="Duration"><Input id="wh-dur" value={dur ? fmtMins(dur) : '—'} disabled /></Field>
            </div>
            <Field label="Related batch"><Select id="wh-batch" value={f.batchId} onChange={(e) => setF({ ...f, batchId: e.target.value })}><option value="">Not batch-specific</option>{batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
            <Field label="Description"><Input id="wh-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            {err && <div className="text-sm text-red-600">{err}</div>}
            <Button icon={<Plus size={15} />} disabled={locked} onClick={add}>Add entry</Button>
          </div>
        </Card>
        <Card title={`Entries · ${fmtDate(date)}`} pad={false}>
          <Table head={['Activity', 'Start', 'End', 'Duration', 'Batch', 'Description', '']} minW={680} empty={!logs.length && <Empty title="No time logged yet" body="Add teaching, preparation and support time as you go." />}>
            {logs.map((l) => <tr key={l.id}><td><Badge color={l.activity === 'Teaching' ? 'navy' : 'grey'} dot={false}>{l.activity}</Badge></td><td className="tabular-nums">{l.start}</td><td className="tabular-nums">{l.end}</td><td className="tabular-nums font-medium">{fmtMins(minutesBetween(l.start, l.end))}</td><td>{s.batches.find((b) => b.id === l.batchId)?.name ?? '—'}</td><td className="max-w-[200px] truncate">{l.description}</td>
              <td>{!locked && <button className="text-ink-400 hover:text-red-500" aria-label="Delete entry" onClick={() => { mutate((d) => { d.work = d.work.filter((x) => x.id !== l.id); }, { action: 'Working hours removed', entity: `${l.activity} ${l.start}–${l.end}`, prev: fmtMins(minutesBetween(l.start, l.end)), next: '—', reason: '' }); toast('Entry removed'); }}><Trash2 size={15} /></button>}</td></tr>)}
          </Table>
          {logs.length > 0 && (
            <div className="grid gap-x-6 gap-y-1 border-t border-ink-100 px-4 py-3 text-sm sm:grid-cols-2 dark:border-ink-800">
              {Object.entries(wm.byCat).map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-ink-600 dark:text-ink-300">{k}</span><span className="tabular-nums">{fmtMinsLong(v)}</span></div>)}
              <div className="flex justify-between border-t border-ink-100 pt-1 font-semibold sm:col-span-2 dark:border-ink-800"><span>Total</span><span className="tabular-nums">{fmtMinsLong(wm.total)}</span></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export function DailyActivitiesPage({ batchId }: { batchId?: string }) {
  const { state: s, go } = useApp();
  const { date } = useWorkDate();
  const [sel, setSel, list] = useBatchSel(batchId);
  const history = s.activities.filter((a) => a.batchId === sel).sort((a, b) => b.date.localeCompare(a.date));
  if (!sel) return <div><PageHeader title="Activity Log" actions={<WorkDatePicker />} /><Card><Empty title="No classes for this date" /></Card></div>;
  return (
    <div>
      <PageHeader title="Activity Log" sub="Practicals, homework and doubts are entered once in the batch report and listed here" actions={<><WorkDatePicker /><Button onClick={() => go({ page: 't-batch-report', id: sel })}>Edit in batch report</Button></>} />
      <BatchPills value={sel} onChange={setSel} date={date} />
      <Card pad={false} title={list.find((b) => b.id === sel)?.name}>
        <Table head={['Date', 'Practicals', 'Homework / assignments', 'Doubts', 'Next class plan']} minW={820} empty={!history.length && <Empty title="No activity logged yet" body="Submit a batch report and its activities appear here." />}>
          {history.map((a) => <tr key={a.id}><td className="whitespace-nowrap">{fmtDate(a.date)}{a.date === date && <Badge color="blue" dot={false}>Selected</Badge>}</td><td className="min-w-[160px] text-xs">{a.practicals || '—'}</td><td className="min-w-[160px] text-xs">{a.homework || '—'}</td><td className="min-w-[140px] text-xs">{a.doubts || '—'}</td><td className="min-w-[160px] text-xs">{a.nextPlan || '—'}</td></tr>)}
        </Table>
      </Card>
    </div>
  );
}
