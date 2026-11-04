import { useState, type ReactNode } from 'react';
import { Bell, CheckCircle2, ChevronDown, Info, LogOut, Menu, Moon, RotateCcw, Sun, TriangleAlert, X, XCircle, Repeat } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { myReview } from '../../store/reviews';
import { ACTIVE_PARENT, navFor } from './nav';
import { Avatar, Button, Confirm } from '../common/ui';
import { cx, fmtDateTime, fmtDay, todayISO } from '../../utils';
import { DEMO_CREDENTIALS } from '../../data/seed';

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-royal-500 to-violet2-600 text-white">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M12 7v12M7 12h10" /></svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-[15px] font-extrabold tracking-tight text-white">Trainer Hub</div>
          <div className="text-[10.5px] text-blue-200/70">Training Management</div>
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user, route, go, logout, dark, setDark, raw, mutate, toasts, dismiss, reset, login, storageOk } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  if (!user) return null;
  const nav = navFor(user.role);
  const active = ACTIVE_PARENT[route.page] ?? route.page;
  // report status shown where the work happens: admins see reports awaiting review, trainers see returned reports
  const navBadge: Record<string, number> = user.role === 'admin'
    ? { reports: raw.reports.filter((r) => myReview(r, user.id).awaiting).length }
    : user.role === 'trainer' ? { 't-report': raw.reports.filter((r) => r.trainerId === user.trainerId && r.status === 'Correction Requested').length } : {};
  const groups = [...new Set(nav.map((n) => n.group ?? ''))];

  const switchTo = (email: string, password: string) => { setUserOpen(false); logout(); setTimeout(() => login(email, password, true), 0); };

  const sidebar = (
    <nav className="flex h-full flex-col bg-navy-950 text-blue-100/80">
      <div className="flex h-16 items-center justify-between px-4"><Logo /><button className="text-blue-200 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="mx-3 mb-2 rounded-lg bg-white/5 px-3 py-2 text-[11px]">
        <div className="text-blue-200/60">{user.role === 'admin' ? 'Admin Portal' : user.role === 'trainer' ? 'Trainer Portal' : 'Student Portal'}</div>
        <div className="truncate font-medium text-white">{raw.settings.instituteName}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {groups.map((g) => (
          <div key={g} className="mt-3">
            {g && <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-200/40">{g}</div>}
            {nav.filter((n) => (n.group ?? '') === g).map((n) => {
              const Icon = n.icon;
              const on = active === n.id;
              return (
                <button key={n.id} onClick={() => { go(n.id); setMobileOpen(false); }}
                  className={cx('group flex w-full items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] transition-colors', on ? 'bg-royal-600 font-medium text-white' : 'hover:bg-white/5 hover:text-white')}>
                  <Icon size={16} className={on ? 'text-white' : 'text-blue-200/50 group-hover:text-blue-100'} />
                  <span className={cx('w-4 shrink-0 text-right text-[11px] tabular-nums', on ? 'text-white/80' : 'text-blue-200/40')}>{nav.indexOf(n) + 1}</span>
                  <span className="text-left leading-tight">{n.label}</span>
                  {navBadge[n.id] > 0 && <span className="ml-auto rounded-full bg-violet2-500 px-1.5 text-[10px] font-semibold text-white" title={user.role === 'admin' ? 'Reports awaiting review' : 'Reports returned for correction'}>{navBadge[n.id]}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 p-3">
        <button onClick={() => setConfirmReset(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-blue-200/60 hover:bg-white/5 hover:text-white"><RotateCcw size={14} /> Reset demo data</button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-full min-h-0 bg-ink-50 dark:bg-[#0e121b]">
      <aside className="hidden w-64 shrink-0 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', background: '#070f22' }}>{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-ink-200 bg-white/90 px-3 backdrop-blur dark:border-ink-800 dark:bg-ink-900/90 sm:px-5">
          <button className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-ink-500 dark:text-ink-400">{fmtDay(todayISO())}</div>
          </div>
          <button onClick={() => setDark(!dark)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800" aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="relative">
            <button onClick={() => setUserOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-ink-100 dark:hover:bg-ink-800">
              <Avatar name={user.name} size={30} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[13px] font-medium text-ink-900 dark:text-ink-100">{user.name}</span>
                <span className="block text-[11px] capitalize text-ink-500">{user.role}</span>
              </span>
              <ChevronDown size={14} className="text-ink-400" />
            </button>
            {userOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserOpen(false)} />
                <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-xl dark:border-ink-700 dark:bg-ink-900">
                  <div className="border-b border-ink-100 px-4 py-2.5 dark:border-ink-800">
                    <div className="text-sm font-medium text-ink-900 dark:text-ink-100">{user.name}</div>
                    <div className="text-xs text-ink-500">{user.email} · {user.title}</div>
                  </div>
                  <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">Switch demo account</div>
                  {DEMO_CREDENTIALS.filter((c) => c.email !== user.email).map((c) => (
                    <button key={c.email} onClick={() => switchTo(c.email, c.password)} className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-[13px] text-ink-700 hover:bg-ink-50 dark:text-ink-200 dark:hover:bg-ink-800">
                      <Repeat size={13} className="shrink-0 text-ink-400" /><span className="truncate">{c.role}: {c.who}</span>
                    </button>
                  ))}
                  <div className="my-1 border-t border-ink-100 dark:border-ink-800" />
                  <button onClick={() => { setUserOpen(false); logout(); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-ink-50 dark:hover:bg-ink-800"><LogOut size={15} /> Log out</button>
                </div>
              </>
            )}
          </div>
        </header>
        <main id="main-scroll" className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] py-5 sm:py-6" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
            {!storageOk && <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Browser storage is unavailable, so changes will be lost on refresh.</div>}
            {raw.seededFor !== todayISO() && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <span>The sample records were generated for an earlier day, so "today" has no classes recorded yet.</span>
                <Button size="sm" variant="secondary" onClick={() => setConfirmReset(true)}>Regenerate for today</Button>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)', marginRight: 'env(safe-area-inset-right, 0px)' }}>
        {toasts.map((t) => {
          const Icon = { success: CheckCircle2, error: XCircle, info: Info, warning: TriangleAlert }[t.kind];
          const c = { success: 'text-emerald-500', error: 'text-red-500', info: 'text-royal-500', warning: 'text-amber-500' }[t.kind];
          return (
            <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm shadow-lg dark:border-ink-700 dark:bg-ink-800">
              <Icon size={18} className={cx('mt-px shrink-0', c)} />
              <span className="min-w-0 flex-1 text-ink-800 dark:text-ink-100">{t.text}</span>
              <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-700" aria-label="Dismiss"><X size={15} /></button>
            </div>
          );
        })}
      </div>
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset demo data?" confirmLabel="Reset data" tone="danger"
        body="All changes you made in this browser (attendance, reports, new trainers, syllabus edits) are replaced with fresh sample records dated today." onConfirm={() => reset()} />
    </div>
  );
}
