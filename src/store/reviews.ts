import type { AppState, DailyReport, ReviewAction, ReviewRecord, User } from '../types';

/** Admins a trainer may pick as reviewers: active users with the Admin role, read from state (never hardcoded). */
export const activeAdmins = (s: Pick<AppState, 'users'>): User[] => s.users.filter((u) => u.role === 'admin' && u.active);

/** Reviewers for the latest submitted version (falls back to the report's current selection). */
export const versionReviewerIds = (r: DailyReport): string[] => r.versions.at(-1)?.reviewerIds ?? r.selectedReviewerIds ?? [];

/** Review records for one version (default: latest). */
export const reviewsFor = (r: DailyReport, version = r.versions.length): ReviewRecord[] =>
  (r.reviewHistory ?? []).filter((x) => x.reportVersion === version);

export const isOpenForReview = (r: DailyReport) => r.status === 'Submitted' || r.status === 'Under Review';

/** "Admin Review: 1 of 2 Approved" */
export const reviewProgress = (r: DailyReport) => {
  const ids = versionReviewerIds(r);
  const recs = reviewsFor(r);
  const approved = ids.filter((id) => recs.some((x) => x.reviewerId === id && x.action === 'Approved')).length;
  return { total: ids.length, approved, label: `Admin Review: ${approved} of ${ids.length} Approved` };
};

/** Where the signed-in admin stands on a report. */
export const myReview = (r: DailyReport, userId?: string) => {
  const assigned = !!userId && versionReviewerIds(r).includes(userId);
  const mine = userId ? reviewsFor(r).find((x) => x.reviewerId === userId) : undefined;
  const canAct = assigned && !mine && isOpenForReview(r) && r.versions.length > 0;
  return { assigned, mine, canAct, awaiting: canAct };
};

/** Reports a given admin was selected to review (any version). */
export const assignedTo = (s: Pick<AppState, 'reports'>, userId: string) =>
  s.reports.filter((r) => r.versions.length && (r.versions.some((v) => v.reviewerIds?.includes(userId)) || (r.selectedReviewerIds ?? []).includes(userId)));

/** Status after a reviewer's decision: any correction or rejection decides at once; approval needs every reviewer. */
export const statusAfter = (r: DailyReport, action: ReviewAction, approvedSoFar: number) => {
  if (action === 'Rejected') return 'Rejected' as const;
  if (action === 'Correction Requested') return 'Correction Requested' as const;
  return approvedSoFar >= versionReviewerIds(r).length ? ('Approved' as const) : ('Under Review' as const);
};

/**
 * Fills the reviewer fields on reports saved before reviewer selection existed (seed data and older browser data).
 * Older reports were sent to every reviewing admin; where admins had already decided, those admins become the reviewers
 * so existing statuses stay valid. Nothing already recorded is removed.
 */
export function normalizeReports(s: AppState): AppState {
  const byName = (name: string) => s.users.find((u) => u.role === 'admin' && u.name === name);
  const defaults = s.users.filter((u) => u.role === 'admin' && u.active && u.canReview).map((u) => u.id);
  for (const r of s.reports) {
    r.currentVersion = r.versions.length;
    if (r.versions.length) r.submittedAt = r.versions.at(-1)!.submittedAt;
    if (!r.reviewHistory) {
      r.reviewHistory = [];
      let version = 0;
      for (const e of r.events) {
        const m = /^(Resubmitted|Submitted)\s*v?(\d+)?/.exec(e.action);
        if (m) { version = m[2] ? Number(m[2]) : version + 1; continue; }
        const action: ReviewAction | undefined = e.action.startsWith('Approved') ? 'Approved' : e.action === 'Correction requested' ? 'Correction Requested' : e.action === 'Rejected' ? 'Rejected' : undefined;
        const u = byName(e.by);
        if (action && u) r.reviewHistory.push({ reviewerId: u.id, reviewerName: u.name, action, remarks: e.reason ?? '', reviewedAt: e.at, reportVersion: Math.max(1, Math.min(version || 1, r.versions.length || 1)) });
      }
      if (r.status === 'Approved') r.approvedAt = r.approvedAt ?? r.reviewHistory.filter((x) => x.action === 'Approved').at(-1)?.reviewedAt;
    }
    if (!r.selectedReviewerIds) {
      const deciders = [...new Set(r.reviewHistory.map((x) => x.reviewerId))];
      r.selectedReviewerIds = deciders.length ? deciders : r.versions.length ? defaults : [];
    }
    for (const v of r.versions) {
      if (!v.reviewerIds) {
        const vd = [...new Set(r.reviewHistory.filter((x) => x.reportVersion === v.version).map((x) => x.reviewerId))];
        v.reviewerIds = vd.length ? vd : [...r.selectedReviewerIds];
      }
    }
  }
  return s;
}
