import { createContext, useContext, useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { activeTrainerBatches, classBatchesOn, derivedStatus, isDayLocked } from '../../store/selectors';
import { fmtDate, prevWeekdays, todayISO } from '../../utils';
import { Select } from '../../components/common/ui';

const Ctx = createContext<{ date: string; setDate: (d: string) => void }>({ date: todayISO(), setDate: () => {} });
export const WorkDateProvider = ({ children }: { children: ReactNode }) => {
  const [date, setDate] = useState(todayISO());
  return <Ctx.Provider value={{ date, setDate }}>{children}</Ctx.Provider>;
};
export const useWorkDate = () => useContext(Ctx);

/** today plus past days that still need work (overdue, draft, correction requested) */
export const useWorkDates = () => {
  const { state: s, user } = useApp();
  const tid = user!.trainerId!;
  const today = todayISO();
  const past = prevWeekdays(today, 10).filter((d) => classBatchesOn(s, tid, d).length && ['Overdue', 'Correction Requested', 'Draft'].includes(derivedStatus(s, tid, d)));
  return [today, ...past];
};

export function WorkDatePicker() {
  const { date, setDate } = useWorkDate();
  const { state: s, user } = useApp();
  const dates = [...new Set([...useWorkDates(), date])].sort().reverse();
  if (dates.length <= 1) return <span className="rounded-lg bg-ink-100 px-3 py-1.5 text-sm text-ink-700 dark:bg-ink-800 dark:text-ink-200">{date === todayISO() ? 'Today · ' : 'Class date · '}{fmtDate(date)}</span>;
  return (
    <Select id="work-date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto">
      {dates.map((d) => <option key={d} value={d}>{d === todayISO() ? `Today · ${fmtDate(d)}` : `${fmtDate(d)} · ${derivedStatus(s, user!.trainerId!, d)}`}</option>)}
    </Select>
  );
}

export const useLocked = (date: string) => {
  const { state: s, user } = useApp();
  return isDayLocked(s, user!.trainerId!, date);
};

export function LockedBanner({ date }: { date: string }) {
  const { state: s, user } = useApp();
  if (!isDayLocked(s, user!.trainerId!, date)) return null;
  const r = s.reports.find((x) => x.trainerId === user!.trainerId && x.date === date);
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700 dark:border-ink-700 dark:bg-ink-800/50 dark:text-ink-200">
      <Lock size={15} className="mt-0.5 shrink-0" />
      <span>The daily report for {fmtDate(date)} is <b>{r?.status}</b>, so this day's records are locked. They reopen only if an admin requests a correction.</span>
    </div>
  );
}

export function BatchPills({ value, onChange, date }: { value: string; onChange: (id: string) => void; date: string }) {
  const { state: s, user } = useApp();
  const list = date === todayISO() ? activeTrainerBatches(s, user!.trainerId!) : classBatchesOn(s, user!.trainerId!, date);
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {list.map((b) => (
        <button key={b.id} onClick={() => onChange(b.id)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition ${value === b.id ? 'bg-navy-700 text-white ring-navy-700 dark:bg-royal-600 dark:ring-royal-600' : 'bg-white text-ink-700 ring-ink-200 hover:bg-ink-50 dark:bg-ink-900 dark:text-ink-200 dark:ring-ink-700'}`}>
          {b.name} <span className="ml-1 text-xs opacity-70">{b.startTime}</span>
        </button>
      ))}
    </div>
  );
}

export const useBatchSel = (initial?: string) => {
  const { state: s, user } = useApp();
  const { date } = useWorkDate();
  const list = date === todayISO() ? activeTrainerBatches(s, user!.trainerId!) : classBatchesOn(s, user!.trainerId!, date);
  const [sel, setSel] = useState(initial && list.some((b) => b.id === initial) ? initial : list[0]?.id ?? '');
  const valid = list.some((b) => b.id === sel) ? sel : list[0]?.id ?? '';
  return [valid, setSel, list] as const;
};
