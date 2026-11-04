import { useState } from 'react';
import { ArrowRight, BarChart3, ClipboardCheck, Eye, EyeOff, GraduationCap, Layers, Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { DEMO_CREDENTIALS } from '../../data/seed';
import { Button, Modal, SimNote } from '../../components/common/ui';
import { cx } from '../../utils';
import heroUrl from '../../assets/login-hero.svg';

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
    <div className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-royal-500 to-violet2-600 text-white shadow-lg shadow-royal-600/30" style={{ width: size, height: size }}>
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
    { c: byRole('Admin'), icon: ShieldCheck, label: 'Admin', desc: 'Institute-wide access and report approvals', tone: 'from-navy-600 to-royal-600' },
    { c: byRole('Trainer'), icon: UserRound, label: 'Trainer', desc: 'Lessons, attendance and daily reports', tone: 'from-royal-500 to-violet2-500' },
    ...(raw.settings.studentPortal ? [{ c: byRole('Student'), icon: GraduationCap, label: 'Student', desc: 'Own course, attendance and progress', tone: 'from-violet2-500 to-fuchsia-500' }] : []),
  ];
  const moreTrainers = DEMO_CREDENTIALS.filter((c) => c.role === 'Trainer' && c !== byRole('Trainer'));

  return (
    <div className="flex min-h-full flex-col bg-[#f4f6fb] dark:bg-[#0a1020] lg:h-full lg:flex-row">
      {/* ---------- Left: brand + illustration ---------- */}
      <section className="relative overflow-hidden bg-[#070f22] text-white lg:flex lg:w-[54%] lg:flex-col lg:overflow-y-auto" style={{ paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))', paddingRight: 20 }}>
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-royal-600/30 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-violet2-600/25 blur-[120px]" />
        <div className="relative mx-auto flex w-full max-w-[680px] flex-1 flex-col py-6 lg:py-9">
          <div className="flex items-center gap-2.5">
            <Logo size={36} />
            <div>
              <div className="font-display text-lg font-extrabold leading-none tracking-tight">Trainer Hub</div>
              <div className="mt-1 text-[11px] text-blue-100/55">Centralized Training Management</div>
            </div>
          </div>

          <div className="relative mt-5 lg:mt-6">
            <img src={heroUrl} alt="A trainer teaching students on laptops, connected to a learning dashboard with syllabus, attendance, topic progress and daily report panels" className="mx-auto w-full max-w-[340px] select-none sm:max-w-[560px]" style={{ WebkitMaskImage: 'radial-gradient(ellipse 72% 70% at 50% 48%, #000 62%, transparent 100%)', maskImage: 'radial-gradient(ellipse 72% 70% at 50% 48%, #000 62%, transparent 100%)' }} draggable={false} />
          </div>

          <div className="mt-4 lg:mt-5">
            <h1 className="max-w-xl font-display text-[26px] font-extrabold leading-[1.15] tracking-tight [text-wrap:balance] sm:text-3xl xl:text-[34px]">
              Every batch, every topic, every <span className="bg-gradient-to-r from-blue-300 to-violet-300 bg-clip-text text-transparent">trainer's day</span> in one place.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-blue-100/70">Manage lessons, track attendance, monitor teaching progress and simplify daily reporting with Trainer Hub.</p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm sm:flex-col sm:gap-2">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-royal-500/30 to-violet2-500/30 text-blue-200 ring-1 ring-inset ring-white/10"><Icon size={16} /></div>
                  <div>
                    <div className="text-[13px] font-semibold text-white">{title}</div>
                    <div className="mt-0.5 text-[11.5px] leading-snug text-blue-100/60">{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 hidden text-[11px] text-blue-100/40 lg:block">{raw.settings.instituteName}</div>
        </div>
      </section>

      {/* ---------- Right: sign-in ---------- */}
      <section className="flex flex-1 items-center justify-center py-10 lg:overflow-y-auto" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-ink-200/80 bg-white p-6 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.25)] sm:p-8 dark:border-white/10 dark:bg-[#0f172d] dark:shadow-none">
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
              <Button type="submit" className="h-11 w-full bg-gradient-to-r from-royal-600 to-violet2-600 text-[15px] shadow-lg shadow-royal-600/25 hover:opacity-95" disabled={busy}>{busy ? 'Signing in…' : <>Sign In <ArrowRight size={16} /></>}</Button>
            </form>
          </div>

          {SHOW_DEMO_ACCOUNTS && (
            <div className="mt-6">
              <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400"><span className="h-px flex-1 bg-ink-200 dark:bg-white/10" />Demo access · prototype only<span className="h-px flex-1 bg-ink-200 dark:bg-white/10" /></div>
              <div className={cx('grid gap-2.5', primary.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                {primary.map(({ c, icon: Icon, label, desc, tone }) => (
                  <button key={label} type="button" data-demo={c.email} disabled={busy} onClick={() => demo(c)} title={desc}
                    className="group flex flex-col items-start rounded-xl border border-ink-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-royal-500/60 hover:shadow-md disabled:opacity-60 dark:border-white/10 dark:bg-[#0f172d] dark:hover:border-royal-400/50">
                    <div className={cx('grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-white', tone)}><Icon size={16} /></div>
                    <div className="mt-2 text-[13px] font-semibold text-ink-900 dark:text-ink-50">{label}</div>
                    <div className="mt-0.5 hidden text-[11px] leading-snug text-ink-500 sm:block dark:text-ink-400">{desc}</div>
                    <div className="mt-2 flex items-center gap-1 text-[11.5px] font-medium text-royal-600 dark:text-blue-300">Try demo <ArrowRight size={12} className="transition group-hover:translate-x-0.5" /></div>
                  </button>
                ))}
              </div>
              {moreTrainers.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11.5px] text-ink-500 dark:text-ink-400">
                  <span>Other trainer scenarios:</span>
                  {moreTrainers.map((c) => <button key={c.email} type="button" data-demo={c.email} disabled={busy} onClick={() => demo(c)} title={c.note} className="font-medium text-royal-600 hover:underline dark:text-blue-300">{c.who.split(' · ')[0]}</button>)}
                </div>
              )}
              <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-400">Demo buttons sign in with sample accounts and are hidden in production.</p>
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
