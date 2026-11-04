import { useState } from 'react';
import { ArrowRight, BarChart3, ClipboardCheck, Eye, EyeOff, GraduationCap, Layers, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { DEMO_CREDENTIALS } from '../../data/seed';
import { Button, Modal, SimNote } from '../../components/common/ui';
import { cx } from '../../utils';

/**
 * Demo sign-in cards exist only for this prototype. A production build must set this to false
 * (or drive it from an environment flag) so that no demo or real credentials appear on the page.
 */
const SHOW_DEMO_ACCOUNTS = true;

const FEATURES = [
  { icon: Layers, title: 'Syllabus', body: 'Module → Week → Day → Topic' },
  { icon: ClipboardCheck, title: 'Daily Reports', body: 'One report per trainer, per day' },
  { icon: BarChart3, title: 'Progress Tracking', body: 'Monitor every batch and topic' },
];

function Logo({ size = 36 }: { size?: number }) {
  return (
    <div className="grid shrink-0 place-items-center rounded-xl bg-royal-600 text-white" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.52} height={size * 0.52} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M12 7v12M7 12h10" /></svg>
    </div>
  );
}

export default function Login() {
  const { login, raw } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);

  const submit = (e?: React.FormEvent, em = email, pw = password) => {
    e?.preventDefault();
    setErr('');
    if (!em.includes('@')) return setErr('Enter a valid email address.');
    if (!pw) return setErr('Enter your password.');
    setBusy(true);
    setTimeout(() => { const r = login(em, pw, remember); if (r) { setErr(r); setBusy(false); } }, 450);
  };

  const demo = (c: (typeof DEMO_CREDENTIALS)[number]) => { setEmail(c.email); setPassword(c.password); submit(undefined, c.email, c.password); };
  const byRole = (r: string) => DEMO_CREDENTIALS.find((c) => c.role === r)!;
  const primary = [
    { c: byRole('Admin'), icon: ShieldCheck, label: 'Admin', desc: 'Institute-wide access and report approvals', tone: 'bg-royal-50 text-royal-600 dark:bg-royal-400/10 dark:text-royal-300' },
    { c: byRole('Trainer'), icon: UserRound, label: 'Trainer', desc: 'Lessons, attendance and daily reports', tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300' },
    ...(raw.settings.studentPortal ? [{ c: byRole('Student'), icon: GraduationCap, label: 'Student', desc: 'Own course, attendance and progress', tone: 'bg-violet2-50 text-violet2-600 dark:bg-violet-400/10 dark:text-violet-300' }] : []),
  ];
  const moreTrainers = DEMO_CREDENTIALS.filter((c) => c.role === 'Trainer' && c !== byRole('Trainer'));

  return (
    <div className="flex min-h-full flex-col bg-ink-50 dark:bg-ink-950">
      {/* ---------- Sign-in ---------- */}
      <section className="flex flex-1 items-center justify-center py-10" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-md sm:p-8 dark:border-white/10 dark:bg-ink-900 dark:shadow-none">
            <div className="flex items-center gap-2.5">
              <Logo size={34} />
              <div className="font-display text-base font-extrabold text-ink-900 dark:text-ink-50">Trainer Hub</div>
            </div>
            <h2 className="mt-6 font-display text-[26px] font-extrabold tracking-tight text-ink-900 dark:text-ink-50">Sign In</h2>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Welcome back. Use your institute email to continue.</p>

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-700 dark:text-ink-300">Email Address</span>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input id="login-email" type="email" autoComplete="username" placeholder="you@institute.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-lg border border-ink-200 bg-ink-50/50 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-royal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-royal-500/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-ink-100 dark:focus:bg-white/[0.05]" />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-700 dark:text-ink-300">Password</span>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-lg border border-ink-200 bg-ink-50/50 pl-9 pr-10 text-sm text-ink-900 placeholder:text-ink-400 focus:border-royal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-royal-500/15 dark:border-white/10 dark:bg-white/[0.03] dark:text-ink-100 dark:focus:bg-white/[0.05]" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </label>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-ink-600 dark:text-ink-300"><input id="login-remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-ink-300 accent-royal-600" /> Remember me</label>
                <button type="button" onClick={() => setForgot(true)} className="font-medium text-royal-600 hover:underline dark:text-blue-300">Forgot password?</button>
              </div>
              {err && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</div>}
              <Button type="submit" className="h-11 w-full text-[15px]" disabled={busy}>{busy ? 'Signing in…' : <>Sign In <ArrowRight size={16} /></>}</Button>
            </form>
          </div>

          {SHOW_DEMO_ACCOUNTS && (
            <div className="mt-6">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-ink-400"><span className="h-px flex-1 bg-ink-200 dark:bg-white/10" />Demo access · prototype only<span className="h-px flex-1 bg-ink-200 dark:bg-white/10" /></div>
              <div className={cx('grid gap-2.5', primary.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                {primary.map(({ c, icon: Icon, label, desc, tone }) => (
                  <button key={label} type="button" data-demo={c.email} disabled={busy} onClick={() => demo(c)} title={desc}
                    className="group flex flex-col items-start rounded-xl border border-ink-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-royal-500/60 hover:shadow-md disabled:opacity-60 dark:border-white/10 dark:bg-ink-900 dark:hover:border-royal-400/50">
                    <div className={cx('grid h-8 w-8 place-items-center rounded-lg', tone)}><Icon size={16} /></div>
                    <div className="mt-2 text-[13px] font-semibold text-ink-900 dark:text-ink-50">{label}</div>
                    <div className="mt-0.5 hidden text-xs leading-snug text-ink-500 sm:block dark:text-ink-400">{desc}</div>
                    <div className="mt-2 flex items-center gap-1 text-xs font-medium text-royal-600 dark:text-blue-300">Try demo <ArrowRight size={12} className="transition group-hover:translate-x-0.5" /></div>
                  </button>
                ))}
              </div>
              {moreTrainers.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
                  <span>Other trainer scenarios:</span>
                  {moreTrainers.map((c) => <button key={c.email} type="button" data-demo={c.email} disabled={busy} onClick={() => demo(c)} title={c.note} className="font-medium text-royal-600 hover:underline dark:text-blue-300">{c.who.split(' · ')[0]}</button>)}
                </div>
              )}
              <p className="mt-3 text-center text-xs leading-relaxed text-ink-400">Demo buttons sign in with sample accounts and are hidden in production.</p>
            </div>
          )}
        </div>
      </section>

      <Modal open={forgot} onClose={() => setForgot(false)} title="Reset your password" size="sm" footer={<Button onClick={() => setForgot(false)}>Got it</Button>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">In the live product, a reset link is emailed to your institute address. This prototype has no email service, so use one of the demo accounts on the sign-in page.</p>
        <div className="mt-3"><SimNote>Password reset emails need a backend mail service.</SimNote></div>
      </Modal>
    </div>
  );
}
