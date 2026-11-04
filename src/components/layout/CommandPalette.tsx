import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, CornerDownLeft, GraduationCap, Moon, Search, Sun, User, UserCog, X } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { navFor } from './nav';
import type { Route } from '../../types';
import { cx } from '../../utils';

interface Item { id: string; group: string; label: string; sub?: string; icon: ReactNode; run: () => void; keywords?: string }

/** extra destinations that live as tabs inside a module, so they are reachable by name */
const EXTRA: Record<string, { label: string; route: Route | string; sub: string }[]> = {
  admin: [
    { label: 'Reports Assigned to Me', route: 'approvals', sub: 'Daily Reports Management' },
    { label: 'Student Voice Notes', route: 'voice', sub: 'Daily Reports Management' },
    { label: 'Activities & Project Work', route: 'activities', sub: 'Daily Reports Management' },
    { label: 'Notes of Lesson', route: 'nol', sub: 'Syllabus Management' },
  ],
  trainer: [
    { label: 'Batch Reports', route: 't-batch-report', sub: 'Daily Report' },
    { label: 'Consolidated Report', route: 't-report', sub: 'Daily Report' },
    { label: 'Student Voice Notes', route: 't-voice', sub: 'Daily Report' },
    { label: 'Activity Log', route: 't-activities', sub: 'Daily Report' },
  ],
  student: [],
};

/**
 * Quick search (Ctrl/⌘ K): jump to any page, batch, student, trainer or course.
 * Reads the role-scoped state, so it only ever lists records the signed-in user may open.
 */
export function CommandPalette({ open, onClose: closeParent }: { open: boolean; onClose: () => void }) {
  const { state: s, user, go, dark, setDark } = useApp();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  // every way of closing clears the query, so reopening always starts fresh
  const onClose = useCallback(() => { setQ(''); setSel(0); closeParent(); }, [closeParent]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) { setQ(''); setSel(0); } }, [open]);

  const items = useMemo<Item[]>(() => {
    if (!user) return [];
    const role = user.role;
    const close = (r: Route | string) => () => { go(r); onClose(); };
    const out: Item[] = [];
    navFor(role).forEach((n) => { const I = n.icon; out.push({ id: `p-${n.id}`, group: 'Pages', label: n.label, sub: n.group, icon: <I size={16} />, run: close(n.id) }); });
    (EXTRA[role] ?? []).forEach((e) => out.push({ id: `x-${e.label}`, group: 'Pages', label: e.label, sub: e.sub, icon: <ArrowRight size={16} />, run: close(e.route) }));
    if (role !== 'student') {
      const batchPage = role === 'admin' ? 'batch' : 't-batch';
      s.batches.forEach((b) => out.push({ id: `b-${b.id}`, group: 'Batches', label: b.name, sub: `${s.courses.find((c) => c.id === b.courseId)?.name ?? ''} · ${b.startTime}–${b.endTime}`, icon: <GraduationCap size={16} />, run: close({ page: batchPage, id: b.id }), keywords: b.id }));
      s.students.forEach((st) => {
        const b = s.batches.find((x) => x.id === st.batchId);
        out.push({ id: `s-${st.id}`, group: 'Students', label: st.name, sub: `${st.id}${b ? ` · ${b.name}` : ''}`, icon: <User size={16} />, run: close(b ? { page: batchPage, id: b.id } : role === 'admin' ? 'students' : 't-batches'), keywords: `${st.email ?? ''}` });
      });
    }
    if (role === 'admin') {
      s.trainers.forEach((t) => out.push({ id: `t-${t.id}`, group: 'Trainers', label: t.name, sub: t.designation, icon: <UserCog size={16} />, run: close({ page: 'trainer', id: t.id }), keywords: t.email }));
      s.courses.forEach((c) => out.push({ id: `c-${c.id}`, group: 'Courses', label: c.name, sub: c.category, icon: <BookOpen size={16} />, run: close({ page: 'course', id: c.id }), keywords: c.id }));
    }
    out.push({ id: 'a-theme', group: 'Actions', label: dark ? 'Switch to light theme' : 'Switch to dark theme', icon: dark ? <Sun size={16} /> : <Moon size={16} />, run: () => { setDark(!dark); onClose(); }, keywords: 'theme dark light mode' });
    return out;
  }, [s, user, go, onClose, dark, setDark]);

  const results = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return items.filter((i) => i.group === 'Pages' || i.group === 'Actions');
    const hay = (i: Item) => `${i.label} ${i.sub ?? ''} ${i.keywords ?? ''}`.toLowerCase();
    const match = items.filter((i) => terms.every((t) => hay(i).includes(t)));
    // best matches first: label starts with the query, then everything else; at most 6 per group
    const starts = (i: Item) => (i.label.toLowerCase().startsWith(terms[0]) ? 0 : 1);
    const groups = new Map<string, Item[]>();
    match.sort((a, b) => starts(a) - starts(b)).forEach((i) => { const g = groups.get(i.group) ?? []; if (g.length < 6) g.push(i); groups.set(i.group, g); });
    return ['Pages', 'Batches', 'Students', 'Trainers', 'Courses', 'Actions'].flatMap((g) => groups.get(g) ?? []);
  }, [items, q]);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  if (!open) return null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(results.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); results[sel]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };
  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-ink-950/40 px-3 pt-[12vh] backdrop-blur-[1px] dark:bg-black/50" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Quick search" className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl dark:border-ink-700 dark:bg-ink-900" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-4 dark:border-ink-800">
          <Search size={18} className="shrink-0 text-ink-400" />
          <input ref={inputRef} id="command-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} role="combobox" aria-expanded="true" aria-controls="command-results"
            aria-activedescendant={results[sel] ? `cmd-${results[sel].id}` : undefined}
            placeholder={user?.role === 'admin' ? 'Search pages, batches, students, trainers, courses…' : 'Search pages, batches, students…'}
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none dark:text-ink-50 dark:placeholder:text-ink-500" />
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200" aria-label="Close search"><X size={16} /></button>
        </div>
        <div ref={listRef} id="command-results" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.length === 0 && <div className="px-3 py-10 text-center text-sm text-ink-500 dark:text-ink-400">No matches for “{q}”</div>}
          {results.map((i, idx) => {
            const head = i.group !== lastGroup; lastGroup = i.group;
            return (
              <div key={i.id}>
                {head && <div className="px-3 pb-1 pt-2.5 text-xs font-medium text-ink-400 dark:text-ink-500">{i.group}</div>}
                <button id={`cmd-${i.id}`} data-idx={idx} role="option" aria-selected={idx === sel} onMouseMove={() => setSel(idx)} onClick={i.run}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', idx === sel ? 'bg-royal-50 dark:bg-royal-400/10' : '')}>
                  <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', idx === sel ? 'bg-white text-royal-600 shadow-sm dark:bg-ink-800 dark:text-royal-300' : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400')}>{i.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block truncate text-sm', idx === sel ? 'font-medium text-royal-700 dark:text-royal-200' : 'text-ink-800 dark:text-ink-100')}>{i.label}</span>
                    {i.sub && <span className="block truncate text-xs text-ink-500 dark:text-ink-400">{i.sub}</span>}
                  </span>
                  {idx === sel && <CornerDownLeft size={14} className="shrink-0 text-ink-400" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="hidden items-center gap-4 border-t border-ink-100 px-4 py-2 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400 sm:flex">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> move</span><span><Kbd>Enter</Kbd> open</span><span><Kbd>Esc</Kbd> close</span>
        </div>
      </div>
    </div>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-px font-sans text-[11.5px] font-medium text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400">{children}</kbd>
);
