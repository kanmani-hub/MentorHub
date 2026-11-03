export type Role = 'admin' | 'trainer' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  title: string;
  trainerId?: string;
  studentId?: string;
  canReview?: boolean;
  active: boolean;
}

export type TrainerStatus = 'Active' | 'Inactive';
export interface Trainer {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  joiningDate: string;
  skills: string[];
  courseIds: string[];
  status: TrainerStatus;
}

export type CourseStatus = 'Draft' | 'Published' | 'Archived';
export interface Course {
  id: string;
  name: string;
  description: string;
  category: string;
  duration: string;
  status: CourseStatus;
  createdAt: string;
}

export interface LessonNote {
  definition: string;
  explanation: string;
  why: string;
  syntax: string;
  code: string;
  output: string;
  example: string;
  practical: string[];
  interview: string[];
  homework: string;
  attachments: { kind: 'PPT' | 'PDF' | 'Code'; name: string }[];
  updatedAt: string;
  updatedBy: string;
}

export interface SupplementalNote {
  id: string;
  topicKey: string;
  trainerId: string;
  batchId: string;
  text: string;
  at: string;
}

export interface Topic { id: string; key: string; title: string; source?: 'manual' | 'pdf' | 'excel' | 'seed' }
export interface Day { id: string; title: string; topics: Topic[] }
export interface Week { id: string; title: string; days: Day[] }
export interface Module { id: string; title: string; weeks: Week[] }

export type SyllabusStatus = 'Draft' | 'Published' | 'Superseded';
export interface SyllabusVersion {
  id: string;
  courseId: string;
  version: number;
  status: SyllabusStatus;
  createdAt: string;
  publishedAt?: string;
  changeNote: string;
  modules: Module[];
}

export type BatchStatus = 'Upcoming' | 'Active' | 'On Hold' | 'Completed';
export interface Batch {
  id: string;
  name: string;
  courseId: string;
  syllabusVersionId: string;
  trainerId: string;
  startDate: string;
  endDate: string;
  classDays: string;
  startTime: string;
  endTime: string;
  status: BatchStatus;
  /** Notes of Lesson version assigned to this batch */
  nolId?: string;
}

export type StudentStatus = 'Active' | 'Inactive';
export interface Student {
  id: string;
  name: string;
  email: string;
  mobile: string;
  batchId: string;
  joiningDate: string;
  status: StudentStatus;
}

export type AttMark = 'Present' | 'Absent' | 'Late' | 'Leave';
export interface AttendanceCorrection { at: string; by: string; reason: string; studentId: string; from: AttMark | '—'; to: AttMark }
export interface AttendanceSession {
  id: string;
  batchId: string;
  date: string;
  status: 'Draft' | 'Submitted';
  marks: Record<string, AttMark>;
  /** reason per student for Absent / Leave marks */
  reasons?: Record<string, string>;
  /** arrival time (HH:MM) per student marked Late */
  lateTimes?: Record<string, string>;
  submittedAt?: string;
  submittedBy?: string;
  corrections: AttendanceCorrection[];
}

export type TopicStatus = 'Completed' | 'Partially Completed' | 'Pending';
export interface TopicProgress {
  id: string;
  batchId: string;
  topicKey: string;
  date: string;
  status: TopicStatus;
  minutes: number;
  explanation: string;
  reason: string;
  practical: boolean;
  understanding: '' | 'Good' | 'Average' | 'Needs Support';
  doubts: string;
  updatedAt: string;
  /** trainer who saved this status (trainer + batch + topic + class date) */
  trainerId?: string;
  updatedBy?: string;
  /** the topic's original syllabus day */
  syllabusDayId?: string;
  dayNumber?: number;
}

/** Students who sent WhatsApp updates or voice notes for a batch on a class date (one record per batch + date). */
export interface WhatsAppUpdate {
  id: string;
  trainerId: string;
  batchId: string;
  date: string;
  studentIds: string[];
  /** names from the upload that matched no batch student, kept for reference only */
  unmatched: string[];
  source: 'paste' | 'excel' | 'csv' | 'txt' | 'manual';
  fileName?: string;
  savedAt: string;
  savedBy: string;
  history: { at: string; by: string; count: number }[];
}

/** The syllabus day a trainer chose to teach for a batch on a class date. Never inferred from the calendar. */
export interface LessonDaySelection {
  id: string;
  batchId: string;
  date: string;
  syllabusDayId: string;
  trainerId: string;
  at: string;
}

export const VOICE_CATEGORIES = ['Class Update', 'Topics Covered', 'Student Doubts', 'Student Performance', 'Pending Work', 'Management Update'] as const;
export type VoiceCategory = (typeof VOICE_CATEGORIES)[number];
export interface VoiceNote {
  id: string;
  trainerId: string;
  batchId: string;
  date: string;
  category: VoiceCategory;
  description: string;
  seconds: number;
  transcript: string;
  transcriptConfirmed: boolean;
  fileName?: string;
  createdAt: string;
}

export const WORK_CATEGORIES = ['Lesson Preparation', 'Teaching', 'Notes Preparation', 'Student Support', 'Doubt Clearing', 'Administrative Work', 'Daily Reporting', 'Other Work'] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];
export interface WorkLog {
  id: string;
  trainerId: string;
  date: string;
  activity: WorkCategory;
  start: string;
  end: string;
  description: string;
  batchId?: string;
}

export const PRACTICAL_TYPES = ['Practical exercise', 'Coding activity', 'Hands-on activity', 'Lab exercise'] as const;
export const DOUBT_TYPES = ['Question asked', 'Difficult topic', 'Error / problem faced', 'Needs more explanation'] as const;
export const PROJECT_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;
export interface PracticalItem { id: string; type: (typeof PRACTICAL_TYPES)[number]; text: string }
export interface AssignmentItem { id: string; name: string; description: string; deadline: string }
export interface DoubtItem { id: string; type: (typeof DOUBT_TYPES)[number]; text: string }
export interface VoiceNameItem { id: string; text: string }
export interface ProjectItem { id: string; name: string; workDone: string; assigned: string; students: string; status: (typeof PROJECT_STATUSES)[number]; remarks: string }

/** One report per trainer + batch + date. Topic progress and attendance live in their own records. */
export interface BatchReport {
  id: string;
  trainerId: string;
  batchId: string;
  date: string;
  status: 'Draft' | 'Submitted';
  practicals: PracticalItem[];
  assignments: AssignmentItem[];
  doubts: DoubtItem[];
  voiceNames: VoiceNameItem[];
  projects: ProjectItem[];
  remarks: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  history: { at: string; by: string; action: string }[];
}

/* ---------- Notes of Lesson ---------- */
export interface NolDayContent { title: string; topics: string[]; objectives: string[]; tasks: string[] }
export interface NolDay extends NolDayContent {
  id: string;
  dayNumber: number;
  /** content exactly as extracted from the source file, kept for comparison and restore */
  original?: NolDayContent;
  warnings: string[];
  page?: number;
  /** the syllabus day generated from this lesson day */
  syllabusDayId?: string;
}
export interface NotesOfLesson {
  id: string;
  courseId: string;
  version: number;
  title: string;
  duration: string;
  status: 'Draft' | 'Published' | 'Superseded';
  sourceKind: 'pdf' | 'excel' | 'manual';
  sourceFileId?: string;
  days: NolDay[];
  warnings: string[];
  syllabusVersionId?: string;
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  publishedBy?: string;
  history: { at: string; by: string; action: string }[];
}
export interface StoredFile {
  id: string;
  name: string;
  size: number;
  mime: string;
  courseId: string;
  nolId?: string;
  pages?: number;
  uploadedAt: string;
  uploadedBy: string;
}
export interface TaskCheck {
  id: string;
  trainerId: string;
  batchId: string;
  nolId: string;
  dayNumber: number;
  date: string;
  taskIndex: number;
  status: 'Completed' | 'Not Completed';
  updatedAt: string;
}

export interface CheckIn { trainerId: string; date: string; in?: string; out?: string }

export interface DailyActivity {
  id: string;
  trainerId: string;
  batchId: string;
  date: string;
  practicals: string;
  assignments: string;
  homework: string;
  doubts: string;
  supportStudents: string;
  feedback: string;
  nextPlan: string;
}

export type ReportStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Correction Requested' | 'Approved' | 'Rejected';
export type DerivedReportStatus = ReportStatus | 'Pending' | 'Overdue';

export interface BatchSummary {
  batchId: string;
  batchName: string;
  course: string;
  timing: string;
  present: number;
  late: number;
  absent: number;
  leave: number;
  total: number;
  attendanceSubmitted: boolean;
  absentees?: { name: string; reason: string }[];
  onLeave?: { name: string; reason: string }[];
  lateList?: { name: string; time: string }[];
  batchReportStatus?: 'Draft' | 'Submitted' | 'Not started';
  practicalList?: PracticalItem[];
  assignmentList?: AssignmentItem[];
  doubtList?: DoubtItem[];
  voiceNames?: string[];
  projects?: ProjectItem[];
  studentTasks?: { text: string; status: 'Completed' | 'Not Completed' | 'Not marked' }[];
  whatsappStudents?: string[];
  batchRemarks?: string;
  completed: string[];
  partial: { title: string; note: string }[];
  pending: { title: string; note: string }[];
  practicals: string;
  homework: string;
  assignments: string;
  doubts: string;
  supportStudents: string;
  nextPlan: string;
  voice: { category: string; description: string; seconds: number }[];
}
export interface ReportSnapshot {
  trainerName: string;
  date: string;
  totalBatches: number;
  totalClasses: number;
  teachingMinutes: number;
  workingMinutes: number;
  work: Record<string, number>;
  batches: BatchSummary[];
  remarks: string;
  exception?: string;
}
export interface ReportVersion { version: number; submittedAt: string; late: boolean; snapshot: ReportSnapshot }
export interface ReportEvent { at: string; by: string; action: string; reason?: string }
export interface DailyReport {
  id: string;
  trainerId: string;
  date: string;
  status: ReportStatus;
  draftRemarks: string;
  exception?: string;
  versions: ReportVersion[];
  events: ReportEvent[];
  adminRemarks: { at: string; by: string; text: string }[];
}

export interface Notification {
  id: string;
  userId: string;
  type: 'report-submitted' | 'correction' | 'approved' | 'rejected' | 'overdue' | 'assignment' | 'system';
  title: string;
  body: string;
  at: string;
  read: boolean;
  link?: Route;
}

export interface AuditLog {
  id: string;
  at: string;
  user: string;
  action: string;
  entity: string;
  prev: string;
  next: string;
  reason: string;
}

export interface Assignment {
  id: string;
  trainerId: string;
  prevTrainerId?: string;
  batchId: string;
  courseId: string;
  syllabusVersionId: string;
  start: string;
  end: string;
  schedule: string;
  at: string;
  by: string;
}

export interface StudentDoubt { id: string; studentId: string; topic: string; text: string; at: string; status: 'Open' | 'Answered'; answer?: string }

export interface Settings {
  instituteName: string;
  instituteAddress: string;
  instituteEmail: string;
  institutePhone: string;
  reportDeadline: string;
  allowException: boolean;
  requireVoiceNote: boolean;
  lateThresholdMin: number;
  attendanceLockAfterSubmit: boolean;
  dayCompleteRule: 'all-completed' | 'reviewed';
  trainerSupplementalNotes: boolean;
  trainerUploadVoice: boolean;
  trainerEditWorkAfterSubmit: boolean;
  workCategories: string[];
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifyWhatsApp: boolean;
  syllabusReviewRequired: boolean;
  syllabusMinTopicsPerDay: number;
  holidays: { date: string; name: string }[];
  studentPortal: boolean;
}

export interface Route { page: string; id?: string; tab?: string }

export interface AppState {
  users: User[];
  trainers: Trainer[];
  courses: Course[];
  syllabi: SyllabusVersion[];
  notes: Record<string, LessonNote>;
  supplemental: SupplementalNote[];
  batches: Batch[];
  students: Student[];
  attendance: AttendanceSession[];
  progress: TopicProgress[];
  voice: VoiceNote[];
  work: WorkLog[];
  checkins: CheckIn[];
  activities: DailyActivity[];
  batchReports: BatchReport[];
  nols: NotesOfLesson[];
  files: StoredFile[];
  taskChecks: TaskCheck[];
  lessonDays: LessonDaySelection[];
  waUpdates: WhatsAppUpdate[];
  reports: DailyReport[];
  notifications: Notification[];
  audit: AuditLog[];
  assignments: Assignment[];
  doubts: StudentDoubt[];
  settings: Settings;
  seededFor: string;
}
