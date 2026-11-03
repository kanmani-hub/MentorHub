import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { courseName, trainerName } from '../../store/selectors';
import { Badge, Button, Card, Field, Input, PageHeader, Select, SimNote, Table } from '../../components/common/ui';
import { fmtDate, fmtDateTime, nowTs, uid } from '../../utils';

export default function Assignments({ trainerId, batchId }: { trainerId?: string; batchId?: string }) {
  const { raw, state: s, mutate, notify, toast, user } = useApp();
  const initBatch = s.batches.find((b) => b.id === batchId) ?? s.batches.find((b) => !b.trainerId) ?? s.batches[0];
  const [f, setF] = useState({
    trainerId: trainerId ?? '', courseId: initBatch.courseId, batchId: batchId ?? initBatch.id, syllabusVersionId: initBatch.syllabusVersionId,
    start: initBatch.startDate, end: initBatch.endDate, days: initBatch.classDays, st: initBatch.startTime, et: initBatch.endTime,
  });
  const [err, setErr] = useState('');
  const pickBatch = (id: string) => { const b = s.batches.find((x) => x.id === id)!; setF((p) => ({ ...p, batchId: id, courseId: b.courseId, syllabusVersionId: b.syllabusVersionId, start: b.startDate, end: b.endDate, days: b.classDays, st: b.startTime, et: b.endTime })); };
  const batch = s.batches.find((b) => b.id === f.batchId)!;
  const assign = () => {
    if (!f.trainerId) return setErr('Select a trainer.');
    if (f.trainerId === batch.trainerId) return setErr(`${trainerName(s, f.trainerId)} is already assigned to ${batch.name}.`);
    const clash = s.batches.find((b) => b.id !== f.batchId && b.trainerId === f.trainerId && b.status === 'Active' && b.startTime < f.et && f.st < b.endTime);
    if (clash) return setErr(`Schedule clash: ${trainerName(s, f.trainerId)} teaches ${clash.name} ${clash.startTime}–${clash.endTime}.`);
    setErr('');
    const prev = batch.trainerId;
    mutate((d) => {
      const b = d.batches.find((x) => x.id === f.batchId)!;
      Object.assign(b, { trainerId: f.trainerId, syllabusVersionId: f.syllabusVersionId, startDate: f.start, endDate: f.end, classDays: f.days, startTime: f.st, endTime: f.et });
      const t = d.trainers.find((x) => x.id === f.trainerId)!;
      if (!t.courseIds.includes(f.courseId)) t.courseIds.push(f.courseId);
      d.assignments.unshift({ id: uid('as'), trainerId: f.trainerId, prevTrainerId: prev || undefined, batchId: f.batchId, courseId: f.courseId, syllabusVersionId: f.syllabusVersionId, start: f.start, end: f.end, schedule: `${f.days} · ${f.st}–${f.et}`, at: nowTs(), by: user!.name });
    }, { action: prev ? 'Trainer reassigned' : 'Trainer assigned', entity: batch.name, prev: prev ? trainerName(s, prev) : 'Unassigned', next: trainerName(s, f.trainerId), reason: '' });
    const ids = [raw.users.find((u) => u.trainerId === f.trainerId)?.id, prev ? raw.users.find((u) => u.trainerId === prev)?.id : undefined].filter(Boolean) as string[];
    notify(ids.slice(0, 1), { type: 'assignment', title: 'New batch assigned', body: `${batch.name} (${courseName(s, f.courseId)}), ${f.days} ${f.st}–${f.et}.`, link: { page: 't-batches' } });
    if (ids[1]) notify([ids[1]], { type: 'assignment', title: 'Batch reassigned', body: `${batch.name} has been reassigned to another trainer.`, link: { page: 't-batches' } });
    toast(`${batch.name} assigned to ${trainerName(s, f.trainerId)}. They now see it in My Batches.`);
  };
  const versions = s.syllabi.filter((v) => v.courseId === f.courseId && v.status !== 'Draft');
  return (
    <div>
      <PageHeader title="Trainer-Batch Assignment" sub="Assign a trainer to a batch. The trainer portal shows only batches assigned here." />
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <Card title="New assignment">
          <div className="grid gap-3">
            <Field label="Trainer" required><Select id="as-trainer" value={f.trainerId} onChange={(e) => setF({ ...f, trainerId: e.target.value })}><option value="">Select trainer</option>{s.trainers.filter((t) => t.status === 'Active').map((t) => <option key={t.id} value={t.id}>{t.name} — {t.designation}</option>)}</Select></Field>
            <Field label="Batch" required><Select id="as-batch" value={f.batchId} onChange={(e) => pickBatch(e.target.value)}>{s.batches.filter((b) => b.status !== 'Completed').map((b) => <option key={b.id} value={b.id}>{b.name} ({b.trainerId ? trainerName(s, b.trainerId) : 'unassigned'})</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Course"><Input id="as-course" value={courseName(s, f.courseId)} disabled /></Field>
              <Field label="Syllabus version"><Select id="as-syl" value={f.syllabusVersionId} onChange={(e) => setF({ ...f, syllabusVersionId: e.target.value })}>{versions.map((v) => <option key={v.id} value={v.id}>v{v.version} · {v.status}</option>)}</Select></Field>
              <Field label="Start date"><Input id="as-start" type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
              <Field label="End date"><Input id="as-end" type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
              <Field label="Class days"><Select id="as-days" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })}>{['Mon–Fri', 'Mon/Wed/Fri', 'Tue/Thu/Sat', 'Sat–Sun'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <div className="grid grid-cols-2 gap-2"><Field label="From"><Input id="as-st" type="time" value={f.st} onChange={(e) => setF({ ...f, st: e.target.value })} /></Field><Field label="To"><Input id="as-et" type="time" value={f.et} onChange={(e) => setF({ ...f, et: e.target.value })} /></Field></div>
            </div>
            {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</div>}
            {batch.trainerId && f.trainerId && f.trainerId !== batch.trainerId && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">This replaces {trainerName(s, batch.trainerId)}. Past attendance and reports stay with the original trainer.</div>}
            <Button onClick={assign}>Assign trainer</Button>
            <p className="text-xs text-ink-500">The trainer sees the batch in My Batches as soon as it is assigned.</p>
          </div>
        </Card>
        <Card title="Assignment history" pad={false} subtitle={`${s.assignments.length} records`}>
          <Table head={['When', 'Batch', 'Course', 'Trainer', 'Period', 'Schedule', 'By']} minW={860}>
            {[...s.assignments].sort((a, b) => b.at.localeCompare(a.at)).map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(a.at)}</td>
                <td className="font-medium text-ink-900 dark:text-ink-50">{s.batches.find((b) => b.id === a.batchId)?.name}</td>
                <td>{courseName(s, a.courseId)}</td>
                <td className="whitespace-nowrap">{a.prevTrainerId ? <span className="inline-flex items-center gap-1"><span className="text-ink-400 line-through">{trainerName(s, a.prevTrainerId)}</span><ArrowRight size={12} />{trainerName(s, a.trainerId)}</span> : trainerName(s, a.trainerId)}{a.prevTrainerId && <Badge color="orange" dot={false}>Reassigned</Badge>}</td>
                <td className="whitespace-nowrap text-xs">{fmtDate(a.start)} – {fmtDate(a.end)}</td>
                <td className="whitespace-nowrap text-xs">{a.schedule}</td>
                <td className="text-xs">{a.by}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}
