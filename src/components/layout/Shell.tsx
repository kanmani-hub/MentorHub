import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Info, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, RotateCcw, Search, Sun, TriangleAlert, X, XCircle, Repeat } from 'lucide-react';
import { CommandPalette, Kbd } from './CommandPalette';
import { useApp } from '../../store/AppStore';
import { myReview } from '../../store/reviews';
import { ACTIVE_PARENT, ADMIN_SECTIONS, navFor, sectionOf } from './nav';
import { Avatar, Button, Confirm } from '../common/ui';
import { cx, todayISO } from '../../utils';
import { DEMO_CREDENTIALS } from '../../data/seed';

/** hidden while the sidebar is a collapsed icon rail, shown when it expands (hover / keyboard focus) */
const RAIL_TEXT = 'transition-opacity duration-150 lg:opacity-0 lg:group-hover/rail:opacity-100 lg:group-focus-within/rail:opacity-100';

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-royal-600 text-white">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M12 7v12M7 12h10" /></svg>
      </div>
      <div className={cx('whitespace-nowrap text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-50', compact && RAIL_TEXT)}>Trainer Hub</div>
    </div>
  );
}

const RAIL_KEY = 'trainerhub.sidebar';
const readRail = () => { try { return localStorage.getItem(RAIL_KEY) !== 'full'; } catch { return true; } };

export function Shell({ children }: { children: ReactNode }) {
  const { user, route, go, logout, dark, setDark, raw, mutate, toasts, dismiss, reset, login, storageOk } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [rail, setRailState] = useState<boolean>(readRail);
  const [search, setSearch] = useState(false);
  // admin modules work as an accordion: one open at a time; the module holding the current page opens automatically
  const [openSecs, setOpenSecs] = useState<Set<string>>(() => new Set());
  const toggleSec = (id: string) => setOpenSecs((o) => (o.has(id) ? new Set<string>() : new Set([id])));
  const closeSearch = useCallback(() => setSearch(false), []);
  const setRail = (v: boolean) => { setRailState(v); try { localStorage.setItem(RAIL_KEY, v ? 'rail' : 'full'); } catch { /* ignore */ } };
  // Ctrl/⌘ K opens quick search from anywhere
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch((o) => !o); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const activePage = ACTIVE_PARENT[route.page] ?? route.page;
  useEffect(() => {
    const sec = sectionOf(activePage);
    if (sec && sec.items.length > 1) setOpenSecs((o) => (o.has(sec.id) && o.size === 1 ? o : new Set([sec.id])));
  }, [activePage]);
  if (!user) return null;
  const nav = navFor(user.role);
  const active = ACTIVE_PARENT[route.page] ?? route.page;
  // report status shown where the work happens: admins see reports awaiting review, trainers see returned reports
  const navBadge: Record<string, number> = user.role === 'admin'
    ? { reports: raw.reports.filter((r) => myReview(r, user.id).awaiting).length }
    : user.role === 'trainer' ? { 't-report': raw.reports.filter((r) => r.trainerId === user.trainerId && r.status === 'Correction Requested').length } : {};
  const groups = [...new Set(nav.map((n) => n.group ?? ''))];

  const switchTo = (email: string, password: string) => { setUserOpen(false); logout(); setTimeout(() => login(email, password, true), 0); };

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const sidebar = (c: boolean) => (
    <nav className="flex h-full flex-col border-r border-ink-200/80 bg-white text-ink-600 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300">
      <div className="flex h-14 shrink-0 items-center justify-between px-[18px]"><Logo compact={c} /><button className="rounded-md p-1 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className={cx('whitespace-nowrap px-[18px] pb-2 text-xs text-ink-500 dark:text-ink-400', c && RAIL_TEXT)}>
        <span className="font-medium text-ink-700 dark:text-ink-200">{user.role === 'admin' ? 'Admin' : user.role === 'trainer' ? 'Trainer' : 'Student'}</span> · <span>{raw.settings.instituteName}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {user.role === 'admin' ? (
          <ul className="mt-2 space-y-0.5">
            {ADMIN_SECTIONS.map((sec) => {
              const SecIcon = sec.icon;
              const single = sec.items.length === 1;
              const hasActive = sec.items.includes(active);
              const expanded = !single && openSecs.has(sec.id);
              const secBadge = sec.items.reduce((n, id) => n + (navBadge[id] ?? 0), 0);
              const items = sec.items.map((id) => nav.find((n) => n.id === id)!).filter(Boolean);
              return (
                <li key={sec.id}>
                  <button
                    onClick={() => { if (single) { go(sec.items[0]); setMobileOpen(false); } else toggleSec(sec.id); }}
                    aria-expanded={single ? undefined : expanded} aria-current={single && hasActive ? 'page' : undefined} data-section={sec.label} title={c ? sec.label : undefined}
                    className={cx('group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors',
                      single && hasActive ? 'bg-royal-50 font-medium text-royal-700 dark:bg-royal-400/10 dark:text-royal-200'
                        : hasActive ? 'font-medium text-ink-900 hover:bg-ink-50 dark:text-ink-50 dark:hover:bg-ink-800/60'
                        : 'hover:bg-ink-50 hover:text-ink-900 dark:hover:bg-ink-800/60 dark:hover:text-ink-100')}>
                    <SecIcon size={18} className={cx('shrink-0', hasActive ? 'text-royal-600 dark:text-royal-300' : 'text-ink-400 group-hover:text-ink-600 dark:text-ink-500 dark:group-hover:text-ink-300')} />
                    <span className={cx('min-w-0 flex-1 leading-snug', c && cx('whitespace-nowrap', RAIL_TEXT))}>{sec.label}</span>
                    {secBadge > 0 && !expanded && <span className={cx('grid h-[18px] min-w-[18px] place-items-center rounded-full bg-royal-600 px-1 text-[11px] font-medium leading-none tabular-nums text-white dark:bg-royal-500', c && RAIL_TEXT)}>{secBadge}</span>}
                    {!single && <ChevronRight size={15} className={cx('shrink-0 text-ink-400 transition-transform', expanded && 'rotate-90', c && RAIL_TEXT)} aria-hidden />}
                    {secBadge > 0 && c && <span className="absolute left-[30px] top-1.5 hidden h-2 w-2 rounded-full bg-royal-500 ring-2 ring-white dark:ring-ink-900 lg:block lg:group-hover/rail:hidden" aria-hidden />}
                  </button>
                  {expanded && (
                    <ul className={cx('relative mb-1 ml-[21px] mt-0.5 space-y-0.5 border-l border-ink-200 pl-3 dark:border-ink-800', c && 'lg:hidden lg:group-hover/rail:block lg:group-focus-within/rail:block')}>
                      {items.map((n) => {
                        const on = active === n.id;
                        const badge = navBadge[n.id] ?? 0;
                        return (
                          <li key={n.id}>
                            <button onClick={() => { go(n.id); setMobileOpen(false); }} aria-current={on ? 'page' : undefined}
                              className={cx('relative flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
                                on ? 'bg-royal-50 font-medium text-royal-700 dark:bg-royal-400/10 dark:text-royal-200' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800/60 dark:hover:text-ink-100')}>
                              {on && <span className="absolute -left-[13px] top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-royal-500 dark:bg-royal-300" aria-hidden />}
                              <span className="min-w-0 flex-1 leading-snug">{n.label}</span>
                              {badge > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-royal-600 px-1 text-[11px] font-medium leading-none tabular-nums text-white dark:bg-royal-500" title="Reports awaiting your review">{badge}</span>}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        ) : groups.map((g) => (
          <div key={g} className="mt-4 first:mt-2">
            {g && <div className={cx('whitespace-nowrap px-2.5 pb-1.5 text-xs font-medium text-ink-400 dark:text-ink-500', c && RAIL_TEXT)}>{g.charAt(0) + g.slice(1).toLowerCase()}</div>}
            <div className="space-y-0.5">
              {nav.filter((n) => (n.group ?? '') === g).map((n) => {
                const Icon = n.icon;
                const on = active === n.id;
                const badge = navBadge[n.id] ?? 0;
                return (
                  <button key={n.id} onClick={() => { go(n.id); setMobileOpen(false); }} aria-current={on ? 'page' : undefined} title={c ? n.label : undefined}
                    className={cx('group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors',
                      on ? 'bg-royal-50 font-medium text-royal-700 dark:bg-royal-400/10 dark:text-royal-200' : 'hover:bg-ink-50 hover:text-ink-900 dark:hover:bg-ink-800/60 dark:hover:text-ink-100')}>
                    <Icon size={18} className={cx('shrink-0', on ? 'text-royal-600 dark:text-royal-300' : 'text-ink-400 group-hover:text-ink-600 dark:text-ink-500 dark:group-hover:text-ink-300')} />
                    <span className={cx('min-w-0 flex-1 leading-snug', c && cx('whitespace-nowrap', RAIL_TEXT))}>{n.label}</span>
                    {badge > 0 && <span className={cx('rounded-full bg-royal-600 px-1.5 text-xs font-medium tabular-nums text-white dark:bg-royal-500', c && RAIL_TEXT)} title={user.role === 'admin' ? 'Reports awaiting your review' : 'Reports returned for correction'}>{badge}</span>}
                    {badge > 0 && c && <span className="absolute left-[30px] top-1.5 hidden h-2 w-2 rounded-full bg-royal-500 ring-2 ring-white dark:ring-ink-900 lg:block lg:group-hover/rail:hidden" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-0.5 border-t border-ink-100 p-3 dark:border-ink-800">
        <button onClick={() => setRail(!rail)} className="hidden w-full items-center gap-3 whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] text-ink-500 hover:bg-ink-50 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800/60 dark:hover:text-ink-200 lg:flex" aria-label={rail ? 'Keep sidebar open' : 'Collapse sidebar to icons'}>
          {rail ? <PanelLeftOpen size={18} className="shrink-0" /> : <PanelLeftClose size={18} className="shrink-0" />}<span className={cx(c && RAIL_TEXT)}>{rail ? 'Keep sidebar open' : 'Collapse to icons'}</span>
        </button>
        <button onClick={() => setConfirmReset(true)} className="flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] text-ink-500 hover:bg-ink-50 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800/60 dark:hover:text-ink-200"><RotateCcw size={18} className="shrink-0" /><span className={cx(c && RAIL_TEXT)}>Reset demo data</span></button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-full min-h-0 bg-ink-50 dark:bg-ink-950">
      {rail ? (
        // icon rail: 68px wide; expands over the page on hover or keyboard focus
        <aside className="relative hidden w-[68px] shrink-0 border-r border-ink-200/80 bg-white dark:border-ink-800 dark:bg-ink-900 lg:block">
          <div className="group/rail absolute inset-y-0 left-0 z-30 w-[68px] overflow-hidden transition-[width,box-shadow] duration-200 ease-out hover:w-72 hover:shadow-xl focus-within:w-72 focus-within:shadow-xl">
            <div className="h-full w-72">{sidebar(true)}</div>
          </div>
        </aside>
      ) : <aside className="hidden w-64 shrink-0 lg:block">{sidebar(false)}</aside>}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40 dark:bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-2xl dark:bg-ink-900" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>{sidebar(false)}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-ink-200/80 bg-white px-3 dark:border-ink-800 dark:bg-ink-900 sm:px-6">
          <button className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <div className="min-w-0 flex-1">
            <button id="open-search" onClick={() => setSearch(true)} aria-label="Search" className="hidden h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-ink-200 bg-ink-50 px-3 text-left text-sm text-ink-500 transition-colors hover:border-ink-300 hover:bg-white dark:border-ink-700 dark:bg-ink-950/60 dark:text-ink-400 dark:hover:border-ink-600 sm:flex">
              <Search size={16} className="shrink-0 text-ink-400" />
              <span className="min-w-0 flex-1 truncate">Search pages, batches, students…</span>
              <span className="hidden shrink-0 gap-1 md:flex"><Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd><Kbd>K</Kbd></span>
            </button>
          </div>
          <button onClick={() => setSearch(true)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800 sm:hidden" aria-label="Search"><Search size={18} /></button>
          <button onClick={() => setDark(!dark)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <div className="relative">
            <button onClick={() => setUserOpen((o) => !o)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-ink-100 dark:hover:bg-ink-800">
              <Avatar name={user.name} size={30} />
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[13px] font-medium text-ink-900 dark:text-ink-100">{user.name}</span>
                <span className="block text-xs capitalize text-ink-500">{user.role}</span>
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
                  <div className="px-4 pb-1 pt-2 text-xs font-semibold text-ink-400">Switch demo account</div>
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
          <div className="mx-auto max-w-[1320px] py-5 sm:py-7" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
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
          const c = { success: 'text-emerald-500 dark:text-emerald-300', error: 'text-red-500 dark:text-red-300', info: 'text-royal-500 dark:text-royal-300', warning: 'text-amber-500 dark:text-amber-300' }[t.kind];
          return (
            <div key={t.id} role="status" className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-sm shadow-lg dark:border-ink-700 dark:bg-ink-800 dark:shadow-black/30">
              <Icon size={18} className={cx('mt-px shrink-0', c)} />
              <span className="min-w-0 flex-1 text-ink-800 dark:text-ink-100">{t.text}</span>
              <button onClick={() => dismiss(t.id)} className="text-ink-400 hover:text-ink-700" aria-label="Dismiss"><X size={15} /></button>
            </div>
          );
        })}
      </div>
      <CommandPalette open={search} onClose={closeSearch} />
      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset demo data?" confirmLabel="Reset data" tone="danger"
        body="All changes you made in this browser (attendance, reports, new trainers, syllabus edits) are replaced with fresh sample records dated today." onConfirm={() => reset()} />
    </div>
  );
}
