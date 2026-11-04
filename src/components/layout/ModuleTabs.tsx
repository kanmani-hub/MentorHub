import type { ReactNode } from 'react';
import { useApp } from '../../store/AppStore';
import { myReview } from '../../store/reviews';
import { cx } from '../../utils';

/** Sub-page switcher inside one main module (keeps the sidebar at its fixed module count). */
export function ModuleTabs({ value, tabs }: { value: string; tabs: { id: string; label: string; badge?: number }[] }) {
  const { go } = useApp();
  return (
    <div className="mb-4 -mx-1 overflow-x-auto px-1">
      <div className="inline-flex gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => go(t.id)} aria-current={value === t.id ? 'page' : undefined}
            className={cx('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium', value === t.id ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 hover:text-ink-800 dark:hover:text-ink-200')}>
            {t.label}{!!t.badge && <span className="rounded-full bg-violet2-500 px-1.5 text-[10px] font-semibold text-white">{t.badge}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminReportsModule({ value, children }: { value: string; children: ReactNode }) {
  const { raw, user } = useApp();
  const awaiting = raw.reports.filter((r) => myReview(r, user?.id).awaiting).length;
  return <><ModuleTabs value={value} tabs={[{ id: 'reports', label: 'Daily Trainer Reports' }, { id: 'approvals', label: 'Reports Assigned to Me', badge: awaiting }, { id: 'activities', label: 'Activities & Project Work' }, { id: 'voice', label: 'Student Voice Notes' }]} />{children}</>;
}

export function TrainerReportModule({ value, children }: { value: string; children: ReactNode }) {
  const { raw, user } = useApp();
  const corr = raw.reports.filter((r) => r.trainerId === user?.trainerId && r.status === 'Correction Requested').length;
  return <><ModuleTabs value={value} tabs={[{ id: 't-batch-report', label: 'Batch Reports' }, { id: 't-report', label: 'Consolidated Report', badge: corr }, { id: 't-voice', label: 'Student Voice Notes' }, { id: 't-activities', label: 'Activity Log' }]} />{children}</>;
}
