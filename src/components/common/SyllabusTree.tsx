import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, CircleDot, CircleDashed, FileText } from 'lucide-react';
import type { SyllabusVersion, TopicStatus } from '../../types';
import { cx } from '../../utils';

export function SyllabusTree({ v, statusOf, onTopic, hasNotes, defaultOpen = 1 }: {
  v: SyllabusVersion; statusOf?: (key: string) => TopicStatus | undefined; onTopic?: (key: string) => void; hasNotes?: (key: string) => boolean; defaultOpen?: number;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(v.modules.slice(0, defaultOpen).map((m) => [m.id, true])));
  const tog = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  let dayNo = 0;
  return (
    <div className="space-y-2">
      {v.modules.map((m, mi) => {
        const days = m.weeks.flatMap((w) => w.days);
        const topics = days.flatMap((d) => d.topics);
        const done = statusOf ? topics.filter((t) => statusOf(t.key) === 'Completed').length : 0;
        const startDay = dayNo;
        dayNo += days.length;
        let localDay = startDay;
        return (
          <div key={m.id} className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
            <button onClick={() => tog(m.id)} className="flex w-full items-center gap-2 bg-ink-50 px-3 py-2.5 text-left dark:bg-ink-800/50">
              {open[m.id] ? <ChevronDown size={16} className="text-ink-400" /> : <ChevronRight size={16} className="text-ink-400" />}
              <span className="text-[11px] font-semibold uppercase tracking-wider text-violet2-600 dark:text-violet-300">Module {mi + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium text-ink-900 dark:text-ink-50">{m.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-500">{m.weeks.length}w · {days.length}d · {topics.length} topics{statusOf ? ` · ${done} done` : ''}</span>
            </button>
            {open[m.id] && (
              <div className="divide-y divide-ink-100 dark:divide-ink-800">
                {m.weeks.map((w) => (
                  <div key={w.id} className="px-3 py-2">
                    <div className="mb-1 text-xs font-semibold text-royal-700 dark:text-blue-300">{w.title}</div>
                    <div className="space-y-2">
                      {w.days.map((d) => {
                        localDay += 1;
                        return (
                          <div key={d.id} className="rounded-lg border border-ink-100 p-2.5 dark:border-ink-800">
                            <div className="flex items-baseline gap-2"><span className="text-[11px] font-semibold tabular-nums text-ink-400">DAY {localDay}</span><span className="text-sm font-medium text-ink-900 dark:text-ink-100">{d.title}</span><span className="text-xs text-ink-400">{d.topics.length} topics</span></div>
                            <ol className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                              {d.topics.map((t, ti) => {
                                const st = statusOf?.(t.key);
                                const Icon = st === 'Completed' ? CheckCircle2 : st === 'Partially Completed' ? CircleDot : CircleDashed;
                                const c = st === 'Completed' ? 'text-emerald-500' : st === 'Partially Completed' ? 'text-amber-500' : st === 'Pending' ? 'text-red-400' : 'text-ink-300 dark:text-ink-600';
                                return (
                                  <li key={t.id} className="flex min-w-0 items-center gap-1.5 text-[13px]">
                                    {statusOf ? <Icon size={14} className={cx('shrink-0', c)} /> : <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-ink-400">{ti + 1}.</span>}
                                    {onTopic ? <button onClick={() => onTopic(t.key)} className="truncate text-left text-ink-700 hover:text-royal-600 hover:underline dark:text-ink-200">{t.title}</button> : <span className="truncate text-ink-700 dark:text-ink-200">{t.title}</span>}
                                    {hasNotes?.(t.key) && <FileText size={12} className="shrink-0 text-royal-500" aria-label="Has lesson notes" />}
                                  </li>
                                );
                              })}
                              {d.topics.length === 0 && <li className="text-xs text-red-500">No topics — needs review</li>}
                            </ol>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
