import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from 'lucide-react';
import { cx, initials } from '../../utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'accent';
export function Button({ variant = 'primary', size = 'md', icon, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode }) {
  const v: Record<Variant, string> = {
    primary: 'bg-navy-700 text-white hover:bg-navy-800 dark:bg-royal-600 dark:hover:bg-royal-700',
    secondary: 'bg-white text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 dark:bg-ink-800 dark:text-ink-100 dark:ring-ink-700 dark:hover:bg-ink-700',
    ghost: 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700',
    accent: 'bg-violet2-600 text-white hover:bg-violet2-500',
  };
  return (
    <button
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm', v[variant], className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function Card({ className, children, title, action, subtitle, pad = true }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode; subtitle?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900 min-w-0', className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-ink-100 px-4 py-3 dark:border-ink-800">
          <div className="min-w-0">
            <h3 className="font-display text-[15px] font-bold text-ink-900 dark:text-ink-50">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{subtitle}</p>}
          </div>
          {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

const BADGE: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  orange: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  blue: 'bg-royal-50 text-royal-700 ring-royal-600/20 dark:bg-royal-500/10 dark:text-blue-300 dark:ring-blue-400/20',
  purple: 'bg-violet2-50 text-violet2-600 ring-violet2-600/20 dark:bg-violet2-500/10 dark:text-violet-300 dark:ring-violet-400/20',
  grey: 'bg-ink-100 text-ink-600 ring-ink-500/15 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-600/30',
  navy: 'bg-navy-50 text-navy-700 ring-navy-600/20 dark:bg-navy-600/20 dark:text-blue-200 dark:ring-blue-400/20',
};
const STATUS_COLOR: Record<string, keyof typeof BADGE> = {
  Active: 'green', Published: 'green', Approved: 'green', Completed: 'green', Submitted: 'blue', Present: 'green',
  Inactive: 'grey', Draft: 'grey', Archived: 'grey', Superseded: 'grey', Pending: 'orange', 'Partially Completed': 'orange', 'Under Review': 'purple',
  'Correction Requested': 'orange', Overdue: 'red', Rejected: 'red', Absent: 'red', Late: 'orange', Leave: 'blue', Upcoming: 'blue', 'On Hold': 'orange',
  'Not started': 'grey', Open: 'orange', Answered: 'green',
};
export function Badge({ children, color, dot = true }: { children: ReactNode; color?: keyof typeof BADGE; dot?: boolean }) {
  const c = color ?? STATUS_COLOR[String(children)] ?? 'grey';
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ring-1 ring-inset', BADGE[c])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}
export const Status = ({ s }: { s: string }) => <Badge>{s}</Badge>;

export function Progress({ value, tone = 'blue', size = 'md', label }: { value: number; tone?: 'blue' | 'green' | 'orange' | 'purple' | 'red'; size?: 'sm' | 'md'; label?: boolean }) {
  const t = { blue: 'bg-royal-600', green: 'bg-emerald-500', orange: 'bg-amber-500', purple: 'bg-violet2-500', red: 'bg-red-500' }[tone];
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className={cx('w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800', size === 'sm' ? 'h-1.5' : 'h-2')}>
        <div className={cx('h-full rounded-full transition-all', t)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {label && <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-ink-700 dark:text-ink-200">{value}%</span>}
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone = 'navy', onClick }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: 'navy' | 'blue' | 'purple' | 'green' | 'orange' | 'red'; onClick?: () => void }) {
  const t = {
    navy: 'bg-navy-50 text-navy-700 dark:bg-navy-600/25 dark:text-blue-200', blue: 'bg-royal-50 text-royal-600 dark:bg-royal-500/15 dark:text-blue-300',
    purple: 'bg-violet2-50 text-violet2-600 dark:bg-violet2-500/15 dark:text-violet-300', green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    orange: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  }[tone];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={cx('flex min-w-0 items-start gap-3 rounded-xl border border-ink-200 bg-white p-3.5 text-left dark:border-ink-800 dark:bg-ink-900', onClick && 'transition hover:border-royal-500/50 hover:shadow-sm')}>
      {icon && <div className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', t)}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink-500 dark:text-ink-400">{label}</div>
        <div className="mt-0.5 font-display text-[22px] font-extrabold leading-tight tabular-nums text-ink-900 dark:text-ink-50">{value}</div>
        {sub && <div className="mt-0.5 text-[11.5px] text-ink-500 dark:text-ink-400">{sub}</div>}
      </div>
    </Comp>
  );
}

export function PageHeader({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: () => void }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <button onClick={back} className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-royal-600 hover:underline dark:text-blue-300">
            <ChevronLeft size={14} /> Back
          </button>
        )}
        <h1 className="font-display text-[22px] font-extrabold tracking-tight text-ink-900 [text-wrap:balance] dark:text-ink-50 sm:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const fieldCls = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20 disabled:bg-ink-50 disabled:text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:disabled:bg-ink-800';
export function Field({ label, error, hint, children, required, className }: { label: string; error?: string; hint?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cx('block min-w-0', className)}>
      <span className="mb-1 block text-xs font-medium text-ink-700 dark:text-ink-300">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
}
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={cx(fieldCls, className)} {...p} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx(fieldCls, 'min-h-[72px]', className)} {...p} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select className={cx(fieldCls, 'pr-8', className)} {...p}>{children}</select>;

export function SearchBox({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cx(fieldCls, 'pl-8')} />
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md', sub }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; sub?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-ink-900 sm:rounded-2xl', w)} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink-900 dark:text-ink-50">{title}</h2>
            {sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-3 dark:border-ink-800">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ open, title, body, confirmLabel = 'Confirm', tone = 'danger', onConfirm, onClose, requireReason, reasonLabel = 'Reason' }:
  { open: boolean; title: string; body: ReactNode; confirmLabel?: string; tone?: Variant; onConfirm: (reason: string) => void; onClose: () => void; requireReason?: boolean; reasonLabel?: string }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setReason(''); setErr(''); } }, [open]);
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant={tone} onClick={() => {
        if (requireReason && reason.trim().length < 5) { setErr('Enter a reason of at least 5 characters.'); return; }
        onConfirm(reason.trim()); onClose();
      }}>{confirmLabel}</Button>
    </>}>
      <div className="flex gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/15"><AlertTriangle size={18} /></div>
        <div className="min-w-0 flex-1 text-sm text-ink-600 dark:text-ink-300">{body}</div>
      </div>
      {requireReason && (
        <Field label={reasonLabel} required error={err} className="mt-4">
          <Textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      )}
    </Modal>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-1 mb-4 overflow-x-auto">
      <div className="inline-flex min-w-full gap-1 border-b border-ink-200 px-1 dark:border-ink-800">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => onChange(t.id)} className={cx('-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === t.id ? 'border-royal-600 text-royal-700 dark:border-blue-400 dark:text-blue-300' : 'border-transparent text-ink-500 hover:text-ink-800 dark:hover:text-ink-200')}>
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-ink-100 px-1.5 text-[11px] tabular-nums text-ink-600 dark:bg-ink-800 dark:text-ink-300">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-ink-100 p-0.5 dark:bg-ink-800">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={cx('rounded-md px-2.5 py-1 text-xs font-medium', value === o.id ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500')}>{o.label}</button>
      ))}
    </div>
  );
}

export function Empty({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-ink-100 text-ink-400 dark:bg-ink-800">{icon ?? <Inbox size={20} />}</div>
      <div className="font-display text-sm font-bold text-ink-800 dark:text-ink-100">{title}</div>
      {body && <div className="mt-1 max-w-sm text-sm text-ink-500">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const Loading = ({ text = 'Loading…' }: { text?: string }) => (
  <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-500"><Loader2 size={16} className="animate-spin" /> {text}</div>
);

export function Table({ head, children, empty, minW = 720 }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode; minW?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth: minW }}>
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500 dark:border-ink-800 dark:bg-ink-800/40 dark:text-ink-400">
            {head.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2.5 first:pl-4 last:pr-4">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 dark:divide-ink-800 [&_td]:px-3 [&_td]:py-2.5 [&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_td]:align-middle [&_td]:text-ink-700 dark:[&_td]:text-ink-200">
          {children}
        </tbody>
      </table>
      {empty}
    </div>
  );
}

export function Pager({ page, pages, onPage, total }: { page: number; pages: number; onPage: (p: number) => void; total: number }) {
  if (pages <= 1) return <div className="px-4 py-2.5 text-xs text-ink-500">{total} record{total === 1 ? '' : 's'}</div>;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500 dark:border-ink-800">
      <span>{total} records · Page {page} of {pages}</span>
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={<ChevronLeft size={14} />}>Prev</Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next <ChevronRight size={14} /></Button>
      </div>
    </div>
  );
}
export const usePaged = <T,>(items: T[], size = 8) => {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const p = Math.min(page, pages);
  return { rows: items.slice((p - 1) * size, p * size), page: p, pages, setPage, total: items.length };
};

export function Avatar({ name, size = 32, tone = 0 }: { name: string; size?: number; tone?: number }) {
  const tones = ['bg-navy-100 text-navy-700', 'bg-violet2-100 text-violet2-600', 'bg-royal-100 text-royal-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800'];
  const t = tones[(tone || name.length) % tones.length];
  return <div className={cx('grid shrink-0 place-items-center rounded-full font-semibold', t)} style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</div>;
}

export function SimNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-violet2-500/40 bg-violet2-50/60 px-3 py-2 text-xs text-violet2-600 dark:bg-violet2-500/10 dark:text-violet-300">
      <span className="mt-px rounded bg-violet2-600 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-white">Prototype</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

export function Menu({ items }: { items: { label: string; onClick: () => void; danger?: boolean; hidden?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((o) => !o)} className="rounded-md px-2 py-1 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800" aria-label="Actions">•••</button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-48 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-700 dark:bg-ink-800">
            {items.filter((i) => !i.hidden).map((i) => (
              <button key={i.label} onClick={() => { setOpen(false); i.onClick(); }} className={cx('block w-full px-3 py-1.5 text-left text-sm hover:bg-ink-50 dark:hover:bg-ink-700', i.danger ? 'text-red-600' : 'text-ink-700 dark:text-ink-200')}>{i.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{k}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink-800 dark:text-ink-100">{v}</dd>
    </div>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-3 py-2">
      <span className="text-sm text-ink-700 dark:text-ink-200">{label}</span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-ink-300 transition peer-checked:bg-royal-600 peer-focus-visible:ring-2 peer-focus-visible:ring-royal-500 dark:bg-ink-600" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
