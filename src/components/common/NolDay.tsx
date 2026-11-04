import { useState, type ReactNode } from 'react';
import { BookOpen, ClipboardList, Plus, RotateCcw, Target, Trash2, AlertTriangle } from 'lucide-react';
import type { NolDay, NolDayContent } from '../../types';
import { Badge, Button, Input } from './ui';
import { cx } from '../../utils';

const SECTIONS: { key: 'topics' | 'objectives' | 'tasks'; title: string; icon: ReactNode; tone: string }[] = [
  { key: 'topics', title: 'Topics to Cover', icon: <BookOpen size={15} />, tone: 'text-royal-600 dark:text-blue-300' },
  { key: 'objectives', title: 'Learning Objectives', icon: <Target size={15} />, tone: 'text-violet2-600 dark:text-violet-300' },
  { key: 'tasks', title: 'Student Tasks', icon: <ClipboardList size={15} />, tone: 'text-emerald-700 dark:text-emerald-300' },
];

/** Read-only day: exactly the three sections from the Notes of Lesson. `taskSlot` lets the trainer view add a checklist control per task. */
export function NolDayView({ day, taskSlot, compact }: { day: NolDayContent & { dayNumber: number }; taskSlot?: (i: number) => ReactNode; compact?: boolean }) {
  return (
    <div className={cx('grid gap-4', !compact && 'lg:grid-cols-3')}>
      {SECTIONS.map((s, si) => (
        <div key={s.key} className={cx('min-w-0 rounded-xl border border-ink-200 p-3.5 dark:border-ink-800', s.key === 'tasks' && !compact && 'lg:col-span-1')}>
          <div className={cx('mb-2 flex items-center gap-1.5 text-xs font-bold', s.tone)}>{s.icon}{si + 1}. {s.title}<span className="ml-auto font-normal normal-case tracking-normal text-ink-400">{day[s.key].length}</span></div>
          {s.key === 'tasks' ? (
            <ol className="space-y-2">{day.tasks.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-800 dark:text-ink-100">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{i + 1}</span>
                <span className="min-w-0 flex-1">{t}{taskSlot && <div className="mt-1">{taskSlot(i)}</div>}</span>
              </li>
            ))}</ol>
          ) : (
            <ul className="space-y-1">{day[s.key].map((t, i) => <li key={i} className="flex gap-2 text-sm text-ink-800 dark:text-ink-100"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-400" />{t}</li>)}</ul>
          )}
        </div>
      ))}
    </div>
  );
}

/** Editable day for drafts. Shows the originally extracted wording beside any edited item. */
export function NolDayEditor({ day, onChange, onRestore, onDelete, readOnly }: { day: NolDay; onChange: (patch: Partial<NolDayContent>) => void; onRestore: () => void; onDelete: () => void; readOnly?: boolean }) {
  const [showOrig, setShowOrig] = useState(false);
  const o = day.original;
  const changed = o && JSON.stringify({ title: day.title, topics: day.topics, objectives: day.objectives, tasks: day.tasks }) !== JSON.stringify(o);
  const list = (k: 'topics' | 'objectives' | 'tasks') => {
    const items = day[k];
    const fixed = k === 'tasks';
    return (
      <div>
        <ol className="space-y-1.5">
          {items.map((t, i) => {
            const orig = o?.[k][i];
            const edited = o && orig !== t;
            return (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-2 w-5 shrink-0 text-right text-xs tabular-nums text-ink-400">{fixed ? `${i + 1}.` : '•'}</span>
                <div className="min-w-0 flex-1">
                  <Input aria-label={`${k} ${i + 1}`} value={t} disabled={readOnly} className={cx('h-8 text-sm', edited && 'border-amber-400', !t.trim() && 'border-red-400')} onChange={(e) => onChange({ [k]: items.map((x, j) => (j === i ? e.target.value : x)) })} />
                  {showOrig && edited && <div className="mt-0.5 text-xs text-ink-500">Original: {orig ?? <i>not in source</i>}</div>}
                </div>
                {!readOnly && !fixed && <button aria-label="Remove item" onClick={() => onChange({ [k]: items.filter((_, j) => j !== i) })} className="mt-1.5 text-ink-400 hover:text-red-500"><Trash2 size={14} /></button>}
              </li>
            );
          })}
        </ol>
        {!readOnly && !fixed && <Button size="sm" variant="ghost" className="mt-1" icon={<Plus size={13} />} onClick={() => onChange({ [k]: [...items, ''] })}>Add</Button>}
        {fixed && items.length !== 5 && <div className="mt-1 flex items-center gap-1 text-xs text-red-600"><AlertTriangle size={12} />{items.length} tasks; each day needs exactly 5.</div>}
        {fixed && !readOnly && items.length < 5 && <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => onChange({ tasks: [...items, ''] })}>Add task</Button>}
        {fixed && !readOnly && items.length > 5 && <Button size="sm" variant="ghost" onClick={() => onChange({ tasks: items.slice(0, 5) })}>Keep first five</Button>}
      </div>
    );
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 rounded-md bg-navy-700 px-2 py-1 text-xs font-bold text-white dark:bg-royal-600">Day {day.dayNumber}</span>
        <Input aria-label="Day title" value={day.title} disabled={readOnly} onChange={(e) => onChange({ title: e.target.value })} className="h-9 min-w-0 flex-1 font-medium" />
        {day.page && <Badge color="grey" dot={false}>PDF page {day.page}</Badge>}
        {changed && <Badge color="orange" dot={false}>Edited</Badge>}
      </div>
      {day.warnings.length > 0 && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{day.warnings.map((w) => <div key={w}>⚠ {w}</div>)}</div>}
      <div className="grid gap-4">
        {SECTIONS.map((s, si) => (
          <div key={s.key} className="min-w-0 rounded-xl border border-ink-200 p-3 dark:border-ink-800">
            <div className={cx('mb-2 flex items-center gap-1.5 text-xs font-bold', s.tone)}>{s.icon}{si + 1}. {s.title}</div>
            {list(s.key)}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          {o && <label className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-300"><input type="checkbox" className="accent-royal-600" checked={showOrig} onChange={(e) => setShowOrig(e.target.checked)} />Show original wording next to edits</label>}
          <span className="flex-1" />
          {changed && <Button size="sm" variant="secondary" icon={<RotateCcw size={13} />} onClick={onRestore}>Restore extracted content</Button>}
          <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={onDelete}>Remove day</Button>
        </div>
      )}
    </div>
  );
}
