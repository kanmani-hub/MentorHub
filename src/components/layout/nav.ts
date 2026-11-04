import {
  BarChart3, KeyRound, BookOpen, BookText, CalendarCheck, ClipboardCheck, ClipboardList, Clock, FileCheck2, FileText, GraduationCap, History, LayoutDashboard,
  Mic, NotebookPen, Settings, ShieldCheck, TrendingUp, UserCircle, UserCog, Users, Layers, HelpCircle, Award, PenSquare,
} from 'lucide-react';
import type { Role } from '../../types';

export interface NavItem { id: string; label: string; icon: typeof Users; group?: string }

/** Admin Portal pages (13). The sidebar groups them into the 6 modules in ADMIN_SECTIONS; page ids and routes are unchanged. */
export const ADMIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, group: 'Dashboard' },
  { id: 'courses', label: 'Course Management', icon: BookOpen, group: 'Academics' },
  { id: 'syllabus', label: 'Syllabus Management', icon: Layers, group: 'Academics' },
  { id: 'trainers', label: 'Trainer Management', icon: UserCog, group: 'People Management' },
  { id: 'students', label: 'Student Management', icon: Users, group: 'People Management' },
  { id: 'batches', label: 'Batch Management', icon: GraduationCap, group: 'Batch & Attendance' },
  { id: 'attendance', label: 'Attendance Management', icon: CalendarCheck, group: 'Batch & Attendance' },
  { id: 'reports', label: 'Daily Reports Management', icon: FileText, group: 'Daily Operations' },
  { id: 'analytics', label: 'Trainer Performance & Analytics', icon: BarChart3, group: 'Reports & Administration' },
  { id: 'exports', label: 'Reports & Export', icon: FileCheck2, group: 'Reports & Administration' },
  { id: 'roles', label: 'User Roles & Permissions', icon: KeyRound, group: 'Reports & Administration' },
  { id: 'audit', label: 'Audit Logs', icon: ShieldCheck, group: 'Reports & Administration' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'Reports & Administration' },
];

export interface NavSection { id: string; label: string; icon: typeof Users; items: string[] }
/** Admin sidebar: exactly 6 main modules (accordion); each submenu item opens an existing page */
export const ADMIN_SECTIONS: NavSection[] = [
  { id: 'sec-dashboard', label: 'Dashboard', icon: LayoutDashboard, items: ['dashboard'] },
  { id: 'sec-academics', label: 'Academics', icon: BookOpen, items: ['courses', 'syllabus'] },
  { id: 'sec-people', label: 'People Management', icon: Users, items: ['trainers', 'students'] },
  { id: 'sec-batches', label: 'Batch & Attendance', icon: GraduationCap, items: ['batches', 'attendance'] },
  { id: 'sec-daily', label: 'Daily Operations', icon: ClipboardCheck, items: ['reports'] },
  { id: 'sec-admin', label: 'Reports & Administration', icon: BarChart3, items: ['analytics', 'exports', 'roles', 'audit', 'settings'] },
];
/** module (section) that contains a page */
export const sectionOf = (pageId: string) => ADMIN_SECTIONS.find((s) => s.items.includes(pageId));

/** Trainer Portal — 8 main modules */
export const TRAINER_NAV: NavItem[] = [
  { id: 't-dashboard', label: 'My Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 't-batches', label: 'My Batches', icon: GraduationCap, group: 'Teaching' },
  { id: 't-lesson', label: "Today's Lesson", icon: BookOpen, group: 'Teaching' },
  { id: 't-notes', label: 'Lesson Notes', icon: BookText, group: 'Teaching' },
  { id: 't-attendance', label: 'Attendance', icon: CalendarCheck, group: 'Teaching' },
  { id: 't-report', label: 'Daily Report', icon: ClipboardCheck, group: 'Reporting' },
  { id: 't-history', label: 'My Report History', icon: History, group: 'Reporting' },
  { id: 't-profile', label: 'My Profile', icon: UserCircle, group: 'Account' },
];

export const STUDENT_NAV: NavItem[] = [
  { id: 's-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 's-course', label: 'My Course', icon: BookOpen },
  { id: 's-notes', label: 'Lesson Notes', icon: BookText },
  { id: 's-homework', label: 'Homework', icon: PenSquare },
  { id: 's-assignments', label: 'Assignments', icon: ClipboardList },
  { id: 's-attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 's-assessments', label: 'Assessments', icon: Award },
  { id: 's-progress', label: 'My Progress', icon: TrendingUp },
  { id: 's-doubts', label: 'Doubts', icon: HelpCircle },
];

export const navFor = (r: Role) => (r === 'admin' ? ADMIN_NAV : r === 'trainer' ? TRAINER_NAV : STUDENT_NAV);

/** which role may open a page id — enforced by the router guard */
export const pageRole = (page: string): Role => (page.startsWith('t-') ? 'trainer' : page.startsWith('s-') ? 'student' : 'admin');

/** for detail pages, which nav entry should look active */
export const ACTIVE_PARENT: Record<string, string> = {
  trainer: 'trainers', course: 'courses', batch: 'batches', report: 'reports',
  // folded into Syllabus Management
  nol: 'syllabus', notes: 'syllabus', topic: 'syllabus',
  // folded into Daily Reports Management
  approvals: 'reports', activities: 'reports', voice: 'reports',
  // folded into the trainer's Daily Report module
  't-batch-report': 't-report', 't-voice': 't-report', 't-activities': 't-report',
  't-batch': 't-batches', 't-topic': 't-notes',
};

/** pages that no longer exist; old links fall back to the module that replaced them */
export const RETIRED: Record<string, string> = { assignments: 'batches', interviews: 'dashboard', 't-interviews': 't-dashboard', 't-progress': 't-lesson', 'syl-progress': 'reports', notifications: 'reports', hours: 'reports', 't-notifications': 't-dashboard', 't-hours': 't-report' };
