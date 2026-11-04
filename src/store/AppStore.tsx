import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState, AuditLog, Notification, Route, User } from '../types';
import { createSeed } from '../data/seed';
import { nowTs, uid } from '../utils';
import { scopeFor } from './selectors';
import { normalizeReports } from './reviews';

const KEY = 'trainerhub.state.v7';
const SESSION_KEY = 'trainerhub.session.v7';
const ROUTE_KEY = 'trainerhub.route';

const load = (): AppState => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeReports(JSON.parse(raw) as AppState);
  } catch (e) { console.error('[TrainerHub] could not load saved data, starting from sample data', e); }
  return createSeed();
};

export interface Toast { id: string; kind: 'success' | 'error' | 'info' | 'warning'; text: string }

interface Ctx {
  raw: AppState;
  /** role-scoped state — the only state pages should read */
  state: AppState;
  user: User | null;
  route: Route;
  go: (r: Route | string) => void;
  mutate: (fn: (d: AppState) => void, audit?: Omit<AuditLog, 'id' | 'at' | 'user'>) => void;
  notify: (userIds: string[], n: Omit<Notification, 'id' | 'userId' | 'at' | 'read'>) => void;
  login: (email: string, password: string, remember: boolean) => string | null;
  logout: () => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  toasts: Toast[];
  dismiss: (id: string) => void;
  reset: () => void;
  dark: boolean;
  setDark: (v: boolean) => void;
  storageOk: boolean;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<AppState>(load);
  const [userId, setUserId] = useState<string | null>(() => {
    try { return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY); } catch { return null; }
  });
  // the open page is remembered per browser tab, so a refresh returns to it (the router's role guard still applies)
  const [route, setRoute] = useState<Route>(() => {
    try {
      const signedIn = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
      const saved = signedIn ? sessionStorage.getItem(ROUTE_KEY) : null;
      if (saved) { const r = JSON.parse(saved) as Route; if (r && typeof r.page === 'string') return r; }
    } catch { /* ignore */ }
    return { page: 'dashboard' };
  });
  useEffect(() => { try { sessionStorage.setItem(ROUTE_KEY, JSON.stringify(route)); } catch { /* ignore */ } }, [route]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [storageOk, setStorageOk] = useState(true);
  const [dark, setDarkState] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('trainerhub.theme');
      if (v) return v === 'dark';
    } catch { /* ignore */ }
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('light', !dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);
  // follow the host's theme switch unless the viewer picked a theme inside the app
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      let manual = false;
      try { manual = !!localStorage.getItem('trainerhub.theme'); } catch { /* ignore */ }
      const t = el.getAttribute('data-theme');
      if (!manual && t) setDarkState(t === 'dark');
    });
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  const setDark = (v: boolean) => {
    setDarkState(v);
    try { localStorage.setItem('trainerhub.theme', v ? 'dark' : 'light'); } catch { /* ignore */ }
  };

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try { localStorage.setItem(KEY, JSON.stringify(raw)); setStorageOk(true); } catch (e) { console.error('[TrainerHub] could not save data in this browser', e); setStorageOk(false); }
  }, [raw]);

  const user = useMemo(() => raw.users.find((u) => u.id === userId) ?? null, [raw.users, userId]);
  const state = useMemo(() => (user ? scopeFor(raw, user) : raw), [raw, user]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'success') => {
    const id = uid('t');
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const mutate: Ctx['mutate'] = useCallback((fn, audit) => {
    setRaw((prev) => {
      const draft: AppState = structuredClone(prev);
      fn(draft);
      if (audit) {
        const actor = draft.users.find((u) => u.id === userIdRef.current)?.name ?? 'System';
        draft.audit.unshift({ id: uid('au'), at: nowTs(), user: actor, ...audit });
      }
      return draft;
    });
  }, []);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const notify: Ctx['notify'] = useCallback((userIds, n) => {
    setRaw((prev) => {
      const draft: AppState = structuredClone(prev);
      userIds.forEach((u) => draft.notifications.unshift({ id: uid('n'), userId: u, at: nowTs(), read: false, ...n }));
      return draft;
    });
  }, []);

  const login: Ctx['login'] = (email, password, remember) => {
    const u = raw.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.password !== password) return 'Email or password is incorrect. Use one of the demo accounts below.';
    if (!u.active) return 'This account is inactive. Ask an admin to reactivate it.';
    if (u.role === 'student' && !raw.settings.studentPortal) return 'The student portal is switched off in Settings.';
    setUserId(u.id);
    try {
      localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, u.id);
    } catch { /* ignore */ }
    setRoute({ page: u.role === 'admin' ? 'dashboard' : u.role === 'trainer' ? 't-dashboard' : 's-dashboard' });
    toast(`Signed in as ${u.name}`);
    return null;
  };
  const logout = () => {
    setUserId(null);
    try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(ROUTE_KEY); } catch { /* ignore */ }
    setRoute({ page: 'dashboard' });
  };
  const go = (r: Route | string) => {
    setRoute(typeof r === 'string' ? { page: r } : r);
    document.getElementById('main-scroll')?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  };
  const reset = () => {
    const fresh = createSeed();
    setRaw(fresh);
    toast('Demo data reset to the original sample records', 'info');
  };

  useEffect(() => {
    if (user && route.page === 'dashboard' && user.role !== 'admin') setRoute({ page: user.role === 'trainer' ? 't-dashboard' : 's-dashboard' });
  }, [user, route.page]);

  return (
    <AppCtx.Provider value={{ raw, state, user, route, go, mutate, notify, login, logout, toast, toasts, dismiss, reset, dark, setDark, storageOk }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside provider');
  return c;
};
