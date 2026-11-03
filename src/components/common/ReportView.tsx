import { useState } from 'react';
import { CheckCircle2, CircleDashed, CircleDot, Copy, Printer, Play, Pause } from 'lucide-react';
import type { BatchSummary, ReportSnapshot, StudentVoiceNoteItem } from '../../types';
import { fmtDate, fmtDay, fmtSecs, cx } from '../../utils';
import { Badge, Button, Modal, SimNote } from './ui';
import { useApp } from '../../store/AppStore';

export function FakePlayer({ seconds, label }: { seconds: number; label?: string }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [timer, setTimer] = useState<number | null>(null);
  const toggle = () => {
    if (playing) {
      if (timer) clearInterval(timer);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    const t = window.setInterval(() => {
      setPos((p) => {
        if (p + 1 >= seconds) {
          clearInterval(t);
          setPlaying(false);
          return 0;
        }
        return p + 1;
      });
    }, 1000);
    setTimer(t);
  };
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-full bg-ink-100 py-1 pl-1 pr-3 dark:bg-ink-800">
      <button
        onClick={toggle}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-navy-700 text-white dark:bg-royal-600"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
      </button>
      <div className="flex h-5 min-w-0 flex-1 items-center gap-[2px]">
        {Array.from({ length: 32 }).map((_, i) => {
          const h = 25 + ((i * 37) % 70);
          const on = (i / 32) * seconds <= pos;
          return (
            <span
              key={i}
              className={cx('w-[3px] rounded-full', on && (playing || pos) ? 'bg-royal-600' : 'bg-ink-300 dark:bg-ink-600')}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-ink-500">
        {fmtSecs(pos)} / {fmtSecs(seconds)}
      </span>
      {label && <span className="hidden text-[10px] text-violet2-600 sm:inline">{label}</span>}
    </div>
  );
}

export const snapshotText = (s: ReportSnapshot, institute: string) => {
  const L: string[] = [];
  L.push(`${institute} — Daily Trainer Report`, `${s.trainerName} · ${fmtDay(s.date)}`, '');

  const totalAttended = s.batches.reduce((a, b) => a + b.present + b.late, 0);
  const totalCompleted = s.batches.reduce((a, b) => a + b.completed.length, 0);
  const totalPending = s.batches.reduce((a, b) => a + b.partial.length + b.pending.length, 0);

  L.push('DAILY SUMMARY');
  L.push(`Number of Batches: ${s.batches.length}`);
  L.push(`Total Students Attended: ${totalAttended}`);
  L.push(`Topics Completed: ${totalCompleted}`);
  L.push(`Topics Pending: ${totalPending}`);
  L.push('');

  s.batches.forEach((b, i) => {
    L.push(`BATCH ${i + 1}: ${b.batchName}`);
    L.push(`Course: ${b.course} | Class Date: ${fmtDate(b.classDate || s.date)} | Class Time: ${b.timing}`);
    L.push(`Attendance: Total: ${b.total}, Present: ${b.present}, Absent: ${b.absent}, Leave: ${b.leave}, Late: ${b.late}`);
    if (b.absentees?.length) L.push(`Absent students: ${b.absentees.map((x) => `${x.name} (${x.reason || 'no reason'})`).join(', ')}`);
    if (b.onLeave?.length) L.push(`On leave: ${b.onLeave.map((x) => `${x.name} (${x.reason || 'no reason'})`).join(', ')}`);
    if (b.lateList?.length) L.push(`Late arrivals: ${b.lateList.map((x) => `${x.name} at ${x.time || '—'}`).join(', ')}`);
    L.push(`Topics Completed (${b.completed.length}): ${b.completed.join(', ') || 'None'}`);
    L.push(`Partially Completed (${b.partial.length}): ${b.partial.map((p) => `${p.title}${p.day ? ` [${p.day}]` : ''} (${p.note || 'in progress'})`).join(', ') || 'None'}`);
    L.push(`Not Covered / Pending (${b.pending.length}): ${b.pending.map((p) => `${p.title}${p.day ? ` [${p.day}]` : ''} (${p.note || 'pending'})`).join(', ') || 'None'}`);
    
    L.push('Practical Activities:');
    if (b.practicalList?.length) {
      b.practicalList.forEach((p) => L.push(`  • ${p.type}: ${p.text}`));
    } else {
      L.push(`  ${b.practicals || 'No practical activities conducted'}`);
    }

    L.push('Homework / Assignments:');
    if (b.assignmentList?.length) {
      b.assignmentList.forEach((a) => L.push(`  • ${a.name} — ${a.description} (Due: ${a.deadline ? fmtDate(a.deadline) : '—'})`));
    } else {
      L.push(`  ${b.homework || 'No homework or assignments given'}`);
    }

    L.push('Student Difficulties:');
    if (b.doubtList?.length) {
      b.doubtList.forEach((d) => L.push(`  • ${d.type}: ${d.text}`));
    } else {
      L.push(`  ${b.doubts || 'No student difficulties recorded'}`);
    }

    L.push(`Student Voice Notes – ${b.batchName}:`);
    const voiceNotes = getStudentVoiceNotes(b, s.date);
    if (voiceNotes.length) {
      voiceNotes.forEach((vn) => L.push(`  • ${vn.studentName} – ${vn.title} (Submitted: ${fmtDate(vn.submittedAt || vn.date || s.date)})`));
    } else {
      L.push('  No student voice notes submitted');
    }

    L.push('Project Updates:');
    if (b.projects?.length) {
      b.projects.forEach((p) => L.push(`  • ${p.name} [${p.status}] — Work done: ${p.workDone || '—'}; Assigned: ${p.assigned || '—'}; Students: ${p.students || '—'}; Remarks: ${p.remarks || '—'}`));
    } else {
      L.push('  No project updates');
    }

    L.push(`Next Class Plan: ${b.nextPlan || 'Continue syllabus'}`);
    if (b.batchRemarks) L.push(`Trainer Remarks: ${b.batchRemarks}`);
    L.push('');
  });

  if (s.remarks) L.push(`Trainer Remarks: ${s.remarks}`);
  if (s.exception) L.push(`Recorded Exception: ${s.exception}`);
  return L.join('\n');
};

export function getStudentVoiceNotes(b: BatchSummary, defaultDate?: string): StudentVoiceNoteItem[] {
  if (b.studentVoiceNotes && b.studentVoiceNotes.length > 0) {
    return b.studentVoiceNotes;
  }
  if (b.whatsappStudents && b.whatsappStudents.length > 0) {
    const defaultVoiceTitles = [
      'Doubt clarification',
      'Topic explanation request',
      'Practical exercise feedback',
      'Assignment clarification',
    ];
    return b.whatsappStudents.map((name, i) => ({
      studentName: name,
      title: defaultVoiceTitles[i % defaultVoiceTitles.length],
      date: b.classDate || defaultDate,
      submittedAt: b.classDate || defaultDate,
    }));
  }
  return [];
}

export function ExportModal({ open, onClose, snapshot }: { open: boolean; onClose: () => void; snapshot: ReportSnapshot }) {
  const { raw, toast } = useApp();
  const text = snapshotText(snapshot, raw.settings.instituteName);
  return (
    <Modal open={open} onClose={onClose} title="Export Daily Report" size="lg" footer={<>
      <Button variant="secondary" onClick={onClose}>Close</Button>
      <Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>Print / Save PDF</Button>
      <Button icon={<Copy size={15} />} onClick={() => {
        navigator.clipboard?.writeText(text).then(() => toast('Report text copied to clipboard')).catch(() => {
          const el = document.getElementById('export-text') as HTMLTextAreaElement | null; el?.select(); toast('Text selected. Press Ctrl+C to copy.', 'info');
        });
      }}>Copy as Text</Button>
    </>}>
      <SimNote>Click "Print / Save PDF" to open the browser print dialog and save as PDF, or copy the formatted report text below.</SimNote>
      <textarea id="export-text" readOnly value={text} className="mt-3 h-80 w-full rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-xs text-ink-800 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-200" />
    </Modal>
  );
}

const Section = ({ title, children, empty }: { title: string; children?: React.ReactNode; empty?: boolean }) => (
  <div className="min-w-0">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">{title}</div>
    <div className="mt-1 text-sm text-ink-800 dark:text-ink-100">{empty ? <span className="italic text-ink-400 dark:text-ink-500">None recorded</span> : children}</div>
  </div>
);

/** One batch's report. Used in trainer preview and admin review. */
export function BatchBlock({ b, reportDate, highlight }: { b: BatchSummary; reportDate?: string; highlight?: boolean }) {
  const voiceNotes = getStudentVoiceNotes(b, reportDate);

  return (
    <div className={cx('rounded-xl border p-5 shadow-sm', highlight ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-500/5' : 'border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900/60')}>
      {/* 3.A Batch Details */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4 dark:border-ink-800">
        <div>
          <div className="font-display text-lg font-bold text-ink-900 dark:text-ink-50">{b.batchName}</div>
          <div className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            <span className="font-medium text-ink-700 dark:text-ink-200">{b.course}</span> · Class Date: {fmtDate(b.classDate || reportDate || '')} · Class Time: {b.timing}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge color={b.attendanceSubmitted ? 'green' : 'amber'}>
            Attendance: {b.present + b.late}/{b.total} Present
          </Badge>
          <Badge color="green" dot={false}>{b.completed.length} Completed</Badge>
          {b.partial.length > 0 && <Badge color="orange" dot={false}>{b.partial.length} Partially Completed</Badge>}
          {b.pending.length > 0 && <Badge color="red" dot={false}>{b.pending.length} Not Covered</Badge>}
        </div>
      </div>

      <div className="mt-4 space-y-5">
        {/* 3.B Topic Progress */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">Topic Progress</div>
          <div className="mt-2 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={14} className="shrink-0" />
                Completed ({b.completed.length})
              </div>
              {b.completed.length === 0 ? (
                <div className="text-xs italic text-ink-400">No topics marked completed</div>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {b.completed.map((t) => (
                    <li key={t} className="flex items-start gap-1.5 text-ink-800 dark:text-ink-100">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <CircleDot size={14} className="shrink-0" />
                Partially Completed ({b.partial.length})
              </div>
              {b.partial.length === 0 ? (
                <div className="text-xs italic text-ink-400">None recorded</div>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {b.partial.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-ink-800 dark:text-ink-100">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                      <div>
                        <span className="font-medium">{p.title}</span>
                        {p.day && <span className="ml-1 text-xs text-amber-700 dark:text-amber-400">({p.day})</span>}
                        {p.note && <div className="text-xs text-ink-500">{p.note}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3 dark:border-ink-800 dark:bg-ink-950/40">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <CircleDashed size={14} className="shrink-0" />
                Not Covered / Pending ({b.pending.length})
              </div>
              {b.pending.length === 0 ? (
                <div className="text-xs italic text-ink-400">None recorded</div>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {b.pending.map((p, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-ink-800 dark:text-ink-100">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                      <div>
                        <span className="font-medium">{p.title}</span>
                        {p.day && <span className="ml-1 text-xs text-rose-700 dark:text-rose-400">({p.day})</span>}
                        {p.note && <div className="text-xs text-ink-500">{p.note}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* 3.C Attendance */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">Attendance</div>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-ink-50 p-3 sm:grid-cols-5 dark:bg-ink-800/40">
            <div>
              <div className="text-[11px] text-ink-500">Total Students</div>
              <div className="font-display text-lg font-bold text-ink-900 dark:text-ink-50">{b.total}</div>
            </div>
            <div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400">Present</div>
              <div className="font-display text-lg font-bold text-emerald-700 dark:text-emerald-300">{b.present}</div>
            </div>
            <div>
              <div className="text-[11px] text-rose-600 dark:text-rose-400">Absent</div>
              <div className="font-display text-lg font-bold text-rose-700 dark:text-rose-300">{b.absent}</div>
            </div>
            <div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400">Leave</div>
              <div className="font-display text-lg font-bold text-amber-700 dark:text-amber-300">{b.leave}</div>
            </div>
            <div>
              <div className="text-[11px] text-royal-600 dark:text-royal-400">Late</div>
              <div className="font-display text-lg font-bold text-royal-700 dark:text-royal-300">{b.late}</div>
            </div>
          </div>

          {(b.absentees?.length || b.onLeave?.length || b.lateList?.length) ? (
            <div className="mt-3 grid gap-3 text-xs md:grid-cols-3">
              <div className="rounded border border-ink-100 p-2.5 dark:border-ink-800">
                <span className="font-semibold text-rose-700 dark:text-rose-400">Absent students & reasons:</span>
                {b.absentees?.length ? (
                  <ul className="mt-1 space-y-1">
                    {b.absentees.map((x) => (
                      <li key={x.name}>
                        <span className="font-medium text-ink-900 dark:text-ink-100">{x.name}</span> — {x.reason || 'No reason provided'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-0.5 text-ink-400">None</div>
                )}
              </div>
              <div className="rounded border border-ink-100 p-2.5 dark:border-ink-800">
                <span className="font-semibold text-amber-700 dark:text-amber-400">On leave & reasons:</span>
                {b.onLeave?.length ? (
                  <ul className="mt-1 space-y-1">
                    {b.onLeave.map((x) => (
                      <li key={x.name}>
                        <span className="font-medium text-ink-900 dark:text-ink-100">{x.name}</span> — {x.reason || 'No reason provided'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-0.5 text-ink-400">None</div>
                )}
              </div>
              <div className="rounded border border-ink-100 p-2.5 dark:border-ink-800">
                <span className="font-semibold text-royal-700 dark:text-royal-400">Late arrivals:</span>
                {b.lateList?.length ? (
                  <ul className="mt-1 space-y-1">
                    {b.lateList.map((x) => (
                      <li key={x.name}>
                        <span className="font-medium text-ink-900 dark:text-ink-100">{x.name}</span> — arrived {x.time || '—'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-0.5 text-ink-400">None</div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* 3.D Practical Activities & 3.E Homework / Assignments */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">Practical Activities</div>
            <div className="mt-2 text-sm text-ink-800 dark:text-ink-100">
              {b.practicalList && b.practicalList.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4">
                  {b.practicalList.map((p) => (
                    <li key={p.id}>
                      <span className="text-xs font-semibold text-ink-500">{p.type}:</span> {p.text}
                    </li>
                  ))}
                </ul>
              ) : b.practicals ? (
                <p>{b.practicals}</p>
              ) : (
                <div className="text-xs italic text-ink-400">No practical activities conducted</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">Homework / Assignments</div>
            <div className="mt-2 text-sm text-ink-800 dark:text-ink-100">
              {b.assignmentList && b.assignmentList.length > 0 ? (
                <ul className="space-y-1.5">
                  {b.assignmentList.map((a) => (
                    <li key={a.id} className="border-b border-ink-100/60 pb-1.5 last:border-0 dark:border-ink-800/60">
                      <div className="font-medium text-ink-900 dark:text-ink-50">
                        {a.name}
                        {a.deadline && <span className="ml-1 text-xs text-amber-600 dark:text-amber-400">(Due: {fmtDate(a.deadline)})</span>}
                      </div>
                      {a.description && <div className="text-xs text-ink-600 dark:text-ink-300">{a.description}</div>}
                    </li>
                  ))}
                </ul>
              ) : b.homework ? (
                <p>{b.homework}</p>
              ) : (
                <div className="text-xs italic text-ink-400">No homework or assignments given</div>
              )}
            </div>
          </div>
        </div>

        {/* 3.F Student Difficulties & 3.G Student Voice Notes */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">Student Difficulties</div>
            <div className="mt-2 text-sm text-ink-800 dark:text-ink-100">
              {b.doubtList && b.doubtList.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4">
                  {b.doubtList.map((d) => (
                    <li key={d.id}>
                      <span className="text-xs font-semibold text-ink-500">{d.type}:</span> {d.text}
                    </li>
                  ))}
                </ul>
              ) : b.doubts ? (
                <p>{b.doubts}</p>
              ) : (
                <div className="text-xs italic text-ink-400">No student difficulties recorded</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">
              Student Voice Notes – {b.batchName}
            </div>
            <div className="mt-2">
              {voiceNotes.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {voiceNotes.map((vn, i) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-1 border-b border-ink-100/60 pb-1 last:border-0 dark:border-ink-800/60">
                      <span className="font-medium text-ink-900 dark:text-ink-50">
                        • {vn.studentName} <span className="font-normal text-ink-600 dark:text-ink-300">– {vn.title}</span>
                      </span>
                      <span className="text-[11px] text-ink-400">
                        {fmtDate(vn.submittedAt || vn.date || reportDate || '')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs italic text-ink-400">No student voice notes submitted</div>
              )}
            </div>
          </div>
        </div>

        {/* 3.H Project Updates */}
        <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">Project Updates</div>
          <div className="mt-2">
            {b.projects && b.projects.length > 0 ? (
              <div className="space-y-2">
                {b.projects.map((p) => (
                  <div key={p.id} className="rounded-lg border border-ink-100 bg-ink-50/40 p-3 dark:border-ink-800 dark:bg-ink-950/30">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink-900 dark:text-ink-50">{p.name}</span>
                      <Badge color={p.status === 'Completed' ? 'green' : p.status === 'In Progress' ? 'blue' : 'grey'}>
                        {p.status}
                      </Badge>
                    </div>
                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="inline font-medium text-ink-500">Work Completed Today: </dt>
                        <dd className="inline text-ink-800 dark:text-ink-100">{p.workDone || '—'}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium text-ink-500">New Project / Assignment Assigned: </dt>
                        <dd className="inline text-ink-800 dark:text-ink-100">{p.assigned || '—'}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium text-ink-500">Students Assigned: </dt>
                        <dd className="inline text-ink-800 dark:text-ink-100">{p.students || '—'}</dd>
                      </div>
                      {p.remarks && (
                        <div>
                          <dt className="inline font-medium text-ink-500">Remarks: </dt>
                          <dd className="inline text-ink-800 dark:text-ink-100">{p.remarks}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs italic text-ink-400">No project updates</div>
            )}
          </div>
        </div>

        {/* 3.I Next Class Plan */}
        <div className="rounded-lg border border-ink-100 p-3.5 dark:border-ink-800">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300">Next Class Plan</div>
          <div className="mt-2 space-y-1 text-sm text-ink-800 dark:text-ink-100">
            <div>
              <span className="font-medium text-ink-600 dark:text-ink-300">Plan: </span>
              {b.nextPlan || 'Continue with the next scheduled syllabus topic'}
            </div>
            {b.batchRemarks && (
              <div className="mt-1 border-t border-ink-100 pt-1 text-xs text-ink-600 dark:border-ink-800 dark:text-ink-300">
                <span className="font-semibold text-ink-700 dark:text-ink-200">Additional remarks: </span>
                {b.batchRemarks}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportView({ s, highlight }: { s: ReportSnapshot; highlight?: Set<string> }) {
  const [only, setOnly] = useState<string>('all');

  // Daily Summary metrics
  const totalBatches = s.batches.length;
  const totalAttended = s.batches.reduce((a, b) => a + b.present + b.late, 0);
  const totalCompleted = s.batches.reduce((a, b) => a + b.completed.length, 0);
  const totalPending = s.batches.reduce((a, b) => a + b.partial.length + b.pending.length, 0);

  const shown = only === 'all' ? s.batches : s.batches.filter((b) => b.batchId === only);

  return (
    <div className="space-y-6">
      {/* 2. Daily Summary: Display ONLY Number of Batches, Total Students Attended, Topics Completed, Topics Pending */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">Daily Summary</div>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-ink-200/80 bg-white p-3.5 shadow-sm dark:border-ink-800 dark:bg-ink-900/60">
            <div className="text-xs font-medium text-ink-500">Number of Batches</div>
            <div className="mt-1 font-display text-2xl font-bold text-ink-900 dark:text-ink-50">{totalBatches}</div>
          </div>
          <div className="rounded-xl border border-ink-200/80 bg-white p-3.5 shadow-sm dark:border-ink-800 dark:bg-ink-900/60">
            <div className="text-xs font-medium text-ink-500">Total Students Attended</div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalAttended}</div>
          </div>
          <div className="rounded-xl border border-ink-200/80 bg-white p-3.5 shadow-sm dark:border-ink-800 dark:bg-ink-900/60">
            <div className="text-xs font-medium text-ink-500">Topics Completed</div>
            <div className="mt-1 font-display text-2xl font-bold text-teal-600 dark:text-teal-400">{totalCompleted}</div>
          </div>
          <div className="rounded-xl border border-ink-200/80 bg-white p-3.5 shadow-sm dark:border-ink-800 dark:bg-ink-900/60">
            <div className="text-xs font-medium text-ink-500">Topics Pending</div>
            <div className="mt-1 font-display text-2xl font-bold text-amber-600 dark:text-amber-400">{totalPending}</div>
          </div>
        </div>
      </div>

      {/* 3. Batch-wise Reports */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
            Batch-wise Reports ({s.batches.length})
          </div>
          {s.batches.length > 1 && (
            <div className="inline-flex flex-wrap rounded-lg bg-ink-100 p-0.5 dark:bg-ink-800">
              {[{ id: 'all', label: 'All Batches' }, ...s.batches.map((b) => ({ id: b.batchId, label: b.batchName }))].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOnly(o.id)}
                  className={cx(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    only === o.id
                      ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white'
                      : 'text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 space-y-4">
          {s.batches.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500 dark:border-ink-700">
              No classes conducted on this date.
            </div>
          )}
          {shown.map((b) => (
            <BatchBlock key={b.batchId} b={b} reportDate={s.date} highlight={highlight?.has(b.batchId)} />
          ))}
        </div>
      </div>

      {/* Trainer Remarks (if any) */}
      {(s.remarks || s.exception) && (
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm dark:border-ink-800 dark:bg-ink-900/60">
          <div className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">General Trainer Remarks</div>
          {s.remarks && <p className="mt-1 text-sm text-ink-800 dark:text-ink-100">{s.remarks}</p>}
          {s.exception && (
            <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="font-semibold">Recorded Exception: </span> {s.exception}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
