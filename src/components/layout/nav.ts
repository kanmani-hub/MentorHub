import {
  BarChart3, KeyRound, BookOpen, BookText, CalendarCheck, ClipboardCheck, ClipboardList, Clock, FileCheck2, FileText, GraduationCap, History, LayoutDashboard,
  ListChecks, Mic, NotebookPen, Settings, ShieldCheck, TrendingUp, UserCircle, UserCog, Users, Layers, HelpCircle, Award, PenSquare,
} from 'lucide-react';
import type { Role } from '../../types';

export interface NavItem { id: string; label: string; icon: typeof Users; group?: string }

/** Admin Portal — exactly 15 main modules (sub-pages open as tabs inside them) */
export const ADMIN_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 'courses', label: 'Course Management', icon: BookOpen, group: 'Academics' },
  { id: 'syllabus', label: 'Syllabus Management', icon: Layers, group: 'Academics' },
  { id: 'trainers', label: 'Trainer Management', icon: UserCog, group: 'Academics' },
  { id: 'batches', label: 'Batch Management', icon: GraduationCap, group: 'Academics' },
  { id: 'students', label: 'Student Management', icon: Users, group: 'Academics' },
  { id: 'assignments', label: 'Trainer-Batch Assignment', icon: ClipboardList, group: 'Academics' },
  { id: 'attendance', label: 'Attendance Management', icon: CalendarCheck, group: 'Daily Work' },
  { id: 'reports', label: 'Daily Reports Management', icon: FileText, group: 'Daily Work' },
  { id: 'syl-progress', label: 'Topic Progress Monitoring', icon: TrendingUp, group: 'Daily Work' },
  { id: 'analytics', label: 'Trainer Performance & Analytics', icon: BarChart3, group: 'Insights' },
  { id: 'exports', label: 'Reports & Export', icon: FileCheck2, group: 'Insights' },
  { id: 'roles', label: 'User Roles & Permissions', icon: KeyRound, group: 'System' },
  { id: 'audit', label: 'Audit Logs', icon: ShieldCheck, group: 'System' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'System' },
];

/** Trainer Portal — exactly 9 main modules */
export const TRAINER_NAV: NavItem[] = [
  { id: 't-dashboard', label: 'My Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { id: 't-batches', label: 'My Batches', icon: GraduationCap, group: 'Teaching' },
  { id: 't-lesson', label: "Today's Lesson", icon: BookOpen, group: 'Teaching' },
  { id: 't-notes', label: 'Lesson Notes', icon: BookText, group: 'Teaching' },
  { id: 't-attendance', label: 'Attendance', icon: CalendarCheck, group: 'Teaching' },
  { id: 't-progress', label: 'Topic Progress', icon: ListChecks, group: 'Teaching' },
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
export const RETIRED: Record<string, string> = { notifications: 'reports', hours: 'reports', 't-notifications': 't-dashboard', 't-hours': 't-report' };
