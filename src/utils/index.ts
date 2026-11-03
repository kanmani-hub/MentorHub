export const uid = (p = 'x') => `${p}-${Math.random().toString(36).slice(2, 9)}`;

const pad = (n: number) => String(n).padStart(2, '0');
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());
export const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return toISODate(dt);
};
export const isWeekday = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return w !== 0 && w !== 6;
};
/** previous `n` weekdays before iso (most recent first) */
export const prevWeekdays = (iso: string, n: number) => {
  const out: string[] = [];
  let cur = iso;
  while (out.length < n) {
    cur = addDays(cur, -1);
    if (isWeekday(cur)) out.push(cur);
  }
  return out;
};
export const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};
export const fmtShort = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};
export const fmtDateTime = (isoTs?: string) => {
  if (!isoTs) return '—';
  const d = new Date(isoTs);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
};
export const fmtTime12 = (hhmm: string) => {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`;
};
export const minutesBetween = (a: string, b: string) => {
  if (!a || !b) return 0;
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return Math.max(0, bh * 60 + bm - (ah * 60 + am));
};
export const fmtMins = (m: number) => {
  if (!m) return '0m';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
};
export const fmtMinsLong = (m: number) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  const hs = h ? `${h} hour${h > 1 ? 's' : ''}` : '';
  const ms = r ? `${r} minute${r > 1 ? 's' : ''}` : '';
  return [hs, ms].filter(Boolean).join(' ') || '0 minutes';
};
export const pct = (num: number, den: number) => (den ? Math.round((num / den) * 100) : 0);
export const nowTs = () => new Date().toISOString();
/** ISO timestamp for a given local date + HH:MM */
export const tsAt = (iso: string, hhmm: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi).toISOString();
};
export const nowHHMM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
export const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
