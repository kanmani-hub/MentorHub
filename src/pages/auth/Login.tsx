import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, UserRound, GraduationCap } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import { DEMO_CREDENTIALS } from '../../data/seed';
import { Button, Modal, SimNote } from '../../components/common/ui';
import { cx } from '../../utils';

export default function Login() {
  const { login, raw } = useApp();
  const [email, setEmail] = useState('admin@trainerhub.com');
  const [password, setPassword] = useState('Admin@123');
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

  return (
    <div className="flex min-h-full flex-col bg-ink-50 dark:bg-[#0e121b] lg:flex-row">
      <div className="relative overflow-hidden bg-navy-950 py-8 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:py-12" style={{ paddingLeft: 'max(24px, env(safe-area-inset-left, 0px))', paddingRight: 24 }}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-royal-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-80 w-80 rounded-full bg-violet2-600/25 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-royal-500 to-violet2-600">
            <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M12 7v12M7 12h10" /></svg>
          </div>
          <div className="font-display text-lg font-extrabold">Trainer Hub</div>
        </div>
        <div className="relative mt-8 max-w-md lg:mt-0">
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight [text-wrap:balance] lg:text-[40px]">Every batch, every topic, every trainer's day in one place.</h1>
          <p className="mt-4 text-sm leading-relaxed text-blue-100/70">Plan lessons from structured syllabuses, mark attendance, track topic-wise progress and review one consolidated report per trainer each evening.</p>
          <div className="mt-8 hidden gap-3 sm:grid sm:grid-cols-3">
            {[['Syllabus', 'Module → Week → Day → Topic'], ['Daily report', 'One per trainer, per day'], ['Approvals', 'Versioned, never overwritten']].map(([a, b]) => (
              <div key={a} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs font-semibold text-white">{a}</div>
                <div className="mt-1 text-[11px] leading-snug text-blue-100/60">{b}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-8 hidden text-xs text-blue-100/50 lg:block">{raw.settings.instituteName} · Prototype build</div>
      </div>

      <div className="flex flex-1 items-center justify-center py-10" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        <div className="w-full max-w-[420px]">
          <h2 className="font-display text-2xl font-extrabold text-ink-900 dark:text-ink-50">Sign in</h2>
          <p className="mt-1 text-sm text-ink-500">Use your institute email to continue.</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Email address</span>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">Password</span>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-10 text-sm text-ink-900 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700" aria-label="Show password">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </label>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-600 dark:text-ink-300"><input id="login-remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-ink-300 accent-royal-600" /> Remember me</label>
              <button type="button" onClick={() => setForgot(true)} className="font-medium text-royal-600 hover:underline dark:text-blue-300">Forgot password?</button>
            </div>
            {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{err}</div>}
            <Button type="submit" className="h-11 w-full text-[15px]" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</Button>
          </form>

          <div className="mt-8">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400"><span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />Demo accounts<span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" /></div>
            <div className="grid gap-2">
              {DEMO_CREDENTIALS.map((c) => {
                const Icon = c.role === 'Admin' ? ShieldCheck : c.role === 'Trainer' ? UserRound : GraduationCap;
                return (
                  <button key={c.email} onClick={() => { setEmail(c.email); setPassword(c.password); submit(undefined, c.email, c.password); }}
                    className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left transition hover:border-royal-500/60 hover:shadow-sm dark:border-ink-800 dark:bg-ink-900">
                    <div className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', c.role === 'Admin' ? 'bg-navy-50 text-navy-700 dark:bg-navy-600/30 dark:text-blue-200' : c.role === 'Trainer' ? 'bg-royal-50 text-royal-600 dark:bg-royal-500/15 dark:text-blue-300' : 'bg-violet2-50 text-violet2-600 dark:bg-violet2-500/15 dark:text-violet-300')}><Icon size={17} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-900 dark:text-ink-100">{c.role} <span className="truncate font-normal text-ink-500">· {c.who}</span></div>
                      <div className="truncate font-mono text-[11px] text-ink-500">{c.email} / {c.password}</div>
                      <div className="truncate text-[11px] text-ink-400">{c.note}</div>
                    </div>
                    <ArrowRight size={15} className="shrink-0 text-ink-300" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <Modal open={forgot} onClose={() => setForgot(false)} title="Reset your password" size="sm" footer={<Button onClick={() => setForgot(false)}>Got it</Button>}>
        <p className="text-sm text-ink-600 dark:text-ink-300">In the live product, a reset link is emailed to your institute address. This prototype has no email service, so use one of the demo accounts on the sign-in page.</p>
        <div className="mt-3"><SimNote>Password reset emails need a backend mail service.</SimNote></div>
      </Modal>
    </div>
  );
}
