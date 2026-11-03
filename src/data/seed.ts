import type {
  AppState, AttMark, Batch, Course, DailyActivity, DailyReport, Notification, Student, TopicProgress, Trainer, User, VoiceNote, WorkLog,
} from '../types';
import { addDays, prevWeekdays, todayISO, tsAt } from '../utils';
import { SEED_NOTES } from './mockNotes';
import { PF_NOL_ID, buildPythonFoundations, seedSyllabi } from './mockSyllabus';
import { PYTHON_FOUNDATIONS_PDF_B64, PYTHON_FOUNDATIONS_PDF_NAME } from './pythonFoundationsPdf';
import { buildSnapshot, flatDays, syllabusOf } from '../store/selectors';

export const DEMO_CREDENTIALS = [
  { role: 'Admin', email: 'admin@trainerhub.com', password: 'Admin@123', who: 'Lakshmi Narayanan · Director', note: 'Full institute access, reviews reports' },
  { role: 'Trainer', email: 'trainer@trainerhub.com', password: 'Trainer@123', who: 'Arjun Mehta · 2 batches', note: 'Today: attendance incomplete, report not yet submitted' },
  { role: 'Trainer', email: 'priya@trainerhub.com', password: 'Trainer@123', who: 'Priya Raghavan · 2 batches', note: 'Today: report submitted, some topics pending' },
  { role: 'Trainer', email: 'rahul@trainerhub.com', password: 'Trainer@123', who: 'Rahul Iyer · 1 batch', note: 'Today: all topics completed, report approved' },
  { role: 'Student', email: 'student@trainerhub.com', password: 'Student@123', who: 'Aarav Sharma · Python Batch A', note: 'Optional student portal' },
];

const TRAINERS: Trainer[] = [
  { id: 'T01', name: 'Arjun Mehta', email: 'trainer@trainerhub.com', phone: '+91 98401 22314', designation: 'Senior Python Trainer', joiningDate: '2023-06-12', skills: ['Python', 'Django', 'REST APIs'], courseIds: ['C01', 'C05'], status: 'Active' },
  { id: 'T02', name: 'Priya Raghavan', email: 'priya@trainerhub.com', phone: '+91 98844 51027', designation: 'Full-Stack Trainer', joiningDate: '2022-11-03', skills: ['SQL', 'JavaScript', 'PostgreSQL'], courseIds: ['C02', 'C04'], status: 'Active' },
  { id: 'T03', name: 'Rahul Iyer', email: 'rahul@trainerhub.com', phone: '+91 90030 77812', designation: 'AI Trainer', joiningDate: '2024-02-19', skills: ['GenAI', 'Python', 'RAG'], courseIds: ['C07'], status: 'Active' },
  { id: 'T04', name: 'Sneha Kulkarni', email: 'sneha@trainerhub.com', phone: '+91 97910 66450', designation: 'Web Trainer', joiningDate: '2023-01-09', skills: ['HTML', 'CSS', 'FastAPI'], courseIds: ['C03', 'C06'], status: 'Active' },
  { id: 'T05', name: 'Vikram Nair', email: 'vikram@trainerhub.com', phone: '+91 99620 14873', designation: 'AI Engineering Trainer', joiningDate: '2024-07-01', skills: ['LangGraph', 'LangChain', 'Agents'], courseIds: ['C08', 'C07'], status: 'Active' },
  { id: 'T06', name: 'Ananya Das', email: 'ananya@trainerhub.com', phone: '+91 94440 39281', designation: 'Python Trainer', joiningDate: '2024-09-16', skills: ['Python', 'Data Analysis'], courseIds: ['C01'], status: 'Active' },
  { id: 'T07', name: 'Karthik Subramanian', email: 'karthik@trainerhub.com', phone: '+91 98410 55602', designation: 'Database Trainer', joiningDate: '2025-01-06', skills: ['SQL', 'Data Modelling'], courseIds: ['C02'], status: 'Active' },
  { id: 'T08', name: 'Fatima Sheikh', email: 'fatima@trainerhub.com', phone: '+91 90254 88130', designation: 'Junior Trainer', joiningDate: '2025-08-04', skills: ['HTML', 'JavaScript'], courseIds: [], status: 'Inactive' },
];

const COURSES: Course[] = [
  { id: 'C01', name: 'Python Foundations', description: 'Programming basics through conditionals, loops, collections and functions, taught from the institute\'s 25-day Notes of Lesson.', category: 'Programming', duration: '25 days', status: 'Published', createdAt: '2026-05-01' },
  { id: 'C02', name: 'SQL', description: 'Relational databases, querying, joins, aggregation and window functions on PostgreSQL.', category: 'Data', duration: '5 weeks', status: 'Published', createdAt: '2026-05-01' },
  { id: 'C03', name: 'HTML & CSS', description: 'Semantic HTML, modern CSS layout with Flexbox and Grid, and responsive design.', category: 'Web', duration: '4 weeks', status: 'Published', createdAt: '2026-05-01' },
  { id: 'C04', name: 'JavaScript', description: 'Language fundamentals, DOM manipulation and asynchronous JavaScript.', category: 'Web', duration: '6 weeks', status: 'Published', createdAt: '2026-05-01' },
  { id: 'C05', name: 'Django', description: 'Build database-backed web apps with Django models, views, templates, forms and auth.', category: 'Web Framework', duration: '6 weeks', status: 'Published', createdAt: '2026-05-10' },
  { id: 'C06', name: 'FastAPI', description: 'High-performance APIs with FastAPI, Pydantic, SQLAlchemy and JWT security.', category: 'Web Framework', duration: '4 weeks', status: 'Published', createdAt: '2026-06-02' },
  { id: 'C07', name: 'GenAI', description: 'LLMs, prompt engineering, embeddings and retrieval-augmented generation.', category: 'AI', duration: '4 weeks', status: 'Published', createdAt: '2026-07-14' },
  { id: 'C08', name: 'LangGraph', description: 'Stateful agent workflows with LangGraph: tools, memory and multi-agent patterns.', category: 'AI', duration: '3 weeks', status: 'Published', createdAt: '2026-08-20' },
];

const STUDENT_NAMES = [
  'Aarav Sharma', 'Diya Patel', 'Ishaan Reddy', 'Meera Pillai', 'Rohit Verma',
  'Sanjana Rao', 'Aditya Joshi', 'Nandini Gupta', 'Varun Menon', 'Kavya Srinivasan',
  'Harsh Agarwal', 'Pooja Nambiar', 'Siddharth Bose', 'Tanvi Desai', 'Nikhil Chandra',
  'Riya Malhotra', 'Arnav Kapoor', 'Sneha Balaji', 'Yash Thakur', 'Anjali Krishnan',
  'Kunal Saxena', 'Lavanya Raman', 'Manish Yadav', 'Divya Hegde', 'Pranav Kulkarni',
  'Shreya Ghosh', 'Gaurav Mishra', 'Aishwarya Iyer', 'Rahul Bhat', 'Neha Chauhan',
  'Abhinav Sethi', 'Swathi Murthy', 'Deepak Naidu', 'Priyanka Jain', 'Vivek Anand',
  'Keerthana Subbu', 'Akash Pandey', 'Bhavana Shetty', 'Suresh Kumar', 'Ritika Arora',
  'Mohit Bansal', 'Gayathri Venkat', 'Tarun Goyal', 'Shalini Prasad', 'Ajay Rathore',
  'Monica Fernandes', 'Rakesh Pillai', 'Ira Choudhury', 'Faizan Khan', 'Janani Sundar',
];

interface BatchSeed { b: Omit<Batch, 'syllabusVersionId'>; held: number; overrides?: Record<number, Record<number, [TopicProgress['status'], string]>> }

export function createSeed(): AppState {
  const today = todayISO();
  const created = '2026-05-01T09:00:00.000Z';
  const syllabi = seedSyllabi(created);

  const batchSeeds: BatchSeed[] = [
    { b: { id: 'B01', name: 'Python Batch A', courseId: 'C01', trainerId: 'T01', startDate: addDays(today, -9), endDate: addDays(today, 47), classDays: 'Mon–Fri', startTime: '09:00', endTime: '12:00', status: 'Active' }, held: 5,
      overrides: { 2: { 5: ['Pending', 'Ran out of time; exercises moved to next class'] }, 4: { 4: ['Partially Completed', 'Covered 3 of 6 practice problems'] } } },
    { b: { id: 'B02', name: 'Django Batch B', courseId: 'C05', trainerId: 'T01', startDate: addDays(today, -8), endDate: addDays(today, 34), classDays: 'Mon–Fri', startTime: '14:00', endTime: '16:00', status: 'Active' }, held: 4,
      overrides: { 3: { 3: ['Pending', 'Students needed more time on related objects'] } } },
    { b: { id: 'B03', name: 'SQL Batch C', courseId: 'C02', trainerId: 'T02', startDate: addDays(today, -7), endDate: addDays(today, 28), classDays: 'Mon–Fri', startTime: '09:30', endTime: '11:30', status: 'Active' }, held: 4 },
    { b: { id: 'B04', name: 'JavaScript Batch A', courseId: 'C04', trainerId: 'T02', startDate: addDays(today, -7), endDate: addDays(today, 35), classDays: 'Mon–Fri', startTime: '15:00', endTime: '17:00', status: 'Active' }, held: 4 },
    { b: { id: 'B05', name: 'GenAI Batch A', courseId: 'C07', trainerId: 'T03', startDate: addDays(today, -5), endDate: addDays(today, 23), classDays: 'Mon–Fri', startTime: '10:00', endTime: '13:00', status: 'Active' }, held: 3 },
    { b: { id: 'B06', name: 'HTML & CSS Batch A', courseId: 'C03', trainerId: 'T04', startDate: addDays(today, -4), endDate: addDays(today, 24), classDays: 'Mon–Fri', startTime: '09:00', endTime: '11:00', status: 'Active' }, held: 2 },
    { b: { id: 'B07', name: 'FastAPI Batch A', courseId: 'C06', trainerId: 'T04', startDate: addDays(today, -5), endDate: addDays(today, 23), classDays: 'Mon–Fri', startTime: '16:00', endTime: '18:00', status: 'Active' }, held: 3 },
    { b: { id: 'B08', name: 'LangGraph Batch A', courseId: 'C08', trainerId: 'T05', startDate: addDays(today, -4), endDate: addDays(today, 17), classDays: 'Mon–Fri', startTime: '11:00', endTime: '13:00', status: 'Active' }, held: 2 },
    { b: { id: 'B09', name: 'Python Batch B', courseId: 'C01', trainerId: 'T06', startDate: addDays(today, -5), endDate: addDays(today, 51), classDays: 'Mon–Fri', startTime: '14:00', endTime: '17:00', status: 'Active' }, held: 3 },
    { b: { id: 'B10', name: 'SQL Batch D', courseId: 'C02', trainerId: 'T07', startDate: addDays(today, -1), endDate: addDays(today, 34), classDays: 'Mon–Fri', startTime: '18:00', endTime: '20:00', status: 'Active' }, held: 1 },
  ];
  const batches: Batch[] = batchSeeds.map((s) => ({ ...s.b, syllabusVersionId: `${s.b.courseId}-v1`, nolId: s.b.courseId === 'C01' ? PF_NOL_ID : undefined }));

  const students: Student[] = STUDENT_NAMES.map((name, i) => {
    const b = batches[Math.floor(i / 5)];
    const [first, last] = name.toLowerCase().split(' ');
    return {
      id: `S${String(i + 1).padStart(3, '0')}`,
      name,
      email: `${first}.${last}@mail.com`,
      mobile: `+91 9${String(812340000 + i * 7919).slice(0, 4)} ${String(10000 + i * 373).slice(0, 5)}`,
      batchId: b.id,
      joiningDate: b.startDate,
      status: i === 23 ? 'Inactive' : 'Active',
    };
  });

  const users: User[] = [
    { id: 'U01', name: 'Lakshmi Narayanan', email: 'admin@trainerhub.com', password: 'Admin@123', role: 'admin', title: 'Director of Training', canReview: true, active: true },
    { id: 'U02', name: 'Rohan Kapoor', email: 'rohan.admin@trainerhub.com', password: 'Admin@123', role: 'admin', title: 'Academic Head', canReview: true, active: true },
    { id: 'U03', name: 'Deepa Menon', email: 'deepa.admin@trainerhub.com', password: 'Admin@123', role: 'admin', title: 'Operations Admin', canReview: false, active: true },
    ...TRAINERS.map((t, i) => ({ id: `U1${i}`, name: t.name, email: t.email, password: 'Trainer@123', role: 'trainer' as const, title: t.designation, trainerId: t.id, active: t.status === 'Active' })),
    { id: 'U30', name: 'Aarav Sharma', email: 'student@trainerhub.com', password: 'Student@123', role: 'student', title: 'Student', studentId: 'S001', active: true },
  ];

  const state: AppState = {
    users, trainers: TRAINERS, courses: COURSES, syllabi, notes: remapNotes(syllabi), supplemental: [], batches, students,
    attendance: [], progress: [], voice: [], work: [], checkins: [], activities: [], batchReports: [], reports: [],
    nols: [buildPythonFoundations(created).nol],
    files: [{ id: 'F-PF-1', name: PYTHON_FOUNDATIONS_PDF_NAME, size: Math.round((PYTHON_FOUNDATIONS_PDF_B64.length * 3) / 4), mime: 'application/pdf', courseId: 'C01', nolId: PF_NOL_ID, pages: 16, uploadedAt: created, uploadedBy: 'Lakshmi Narayanan' }],
    taskChecks: [], lessonDays: [], waUpdates: [], notifications: [], audit: [], assignments: [], doubts: [],
    settings: {
      instituteName: 'Brightpath Tech Academy', instituteAddress: '3rd Floor, Olympia Tech Park, Guindy, Chennai 600032', instituteEmail: 'office@brightpath.edu.in', institutePhone: '+91 44 4012 7788',
      reportDeadline: '19:30', allowException: true, requireVoiceNote: false, lateThresholdMin: 10, attendanceLockAfterSubmit: true,
      dayCompleteRule: 'all-completed', trainerSupplementalNotes: true, trainerUploadVoice: true, trainerEditWorkAfterSubmit: false,
      workCategories: ['Lesson Preparation', 'Teaching', 'Notes Preparation', 'Student Support', 'Doubt Clearing', 'Administrative Work', 'Daily Reporting', 'Other Work'],
      notifyInApp: true, notifyEmail: false, notifyWhatsApp: false, syllabusReviewRequired: true, syllabusMinTopicsPerDay: 3,
      holidays: [{ date: '2026-11-08', name: 'Deepavali' }, { date: '2026-12-25', name: 'Christmas' }, { date: '2027-01-15', name: 'Pongal' }],
      studentPortal: true,
    },
    seededFor: today,
  };

  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const markFor = (sid: string, date: string): AttMark => {
    const h = hash(sid + date) % 20;
    return h === 0 ? 'Absent' : h === 1 ? 'Late' : h === 2 ? 'Leave' : 'Present';
  };
  const studentIds = (bid: string) => students.filter((s) => s.batchId === bid && s.status === 'Active').map((s) => s.id);
  const fullMarks = (bid: string, date: string) => Object.fromEntries(studentIds(bid).map((sid) => [sid, markFor(sid, date)]));

  const ABSENT_REASONS = ['Unwell (fever), informed by parent', 'Family function out of town', 'No reason given; follow-up call made'];
  const LEAVE_REASONS = ['Pre-approved leave: university exam', 'Medical appointment', 'Pre-approved leave: sibling\'s wedding'];
  const addAttendance = (bid: string, date: string, b: Batch, status: 'Draft' | 'Submitted', marks: Record<string, AttMark> = fullMarks(bid, date)) => {
    const reasons: Record<string, string> = {};
    const lateTimes: Record<string, string> = {};
    if (status === 'Submitted') Object.entries(marks).forEach(([sid, m], i) => {
      if (m === 'Absent') reasons[sid] = ABSENT_REASONS[(hash(sid) + i) % 3];
      if (m === 'Leave') reasons[sid] = LEAVE_REASONS[(hash(sid) + i) % 3];
      if (m === 'Late') { const [h, mm] = b.startTime.split(':').map(Number); lateTimes[sid] = `${String(h).padStart(2, '0')}:${String(mm + 10 + (hash(sid) % 15)).padStart(2, '0')}`; }
    });
    state.attendance.push({ id: id('att'), batchId: bid, date, status, marks, reasons, lateTimes, submittedAt: status === 'Submitted' ? tsAt(date, b.startTime.replace(/:(\d\d)/, (_, m) => `:${String(Number(m) + 12).padStart(2, '0')}`)) : undefined, submittedBy: status === 'Submitted' ? trainerNameById(b.trainerId) : undefined, corrections: [] });
  };
  const trainerNameById = (tid: string) => TRAINERS.find((t) => t.id === tid)!.name;
  const addProg = (bid: string, key: string, date: string, status: TopicProgress['status'], reason = '', minutes = 30) => {
    state.progress.push({ id: id('tp'), batchId: bid, topicKey: key, date, status, minutes, explanation: status === 'Completed' ? 'Explained with live examples' : 'Started; continuing next class', reason, practical: status === 'Completed', understanding: status === 'Completed' ? 'Good' : 'Average', doubts: '', updatedAt: tsAt(date, '17:30') });
  };
  const addActivity = (tid: string, bid: string, date: string, extra: Partial<DailyActivity> = {}) => {
    state.activities.push({ id: id('act'), trainerId: tid, batchId: bid, date, practicals: 'Hands-on exercises on today\'s topics in pairs', assignments: 'Practice worksheet', homework: 'Complete remaining worksheet questions', doubts: 'Minor syntax doubts, clarified in class', supportStudents: '', feedback: 'Class engaged well', nextPlan: 'Continue with the next lesson as per syllabus', ...extra });
  };
  const addWork = (tid: string, date: string, entries: [WorkLog['activity'], string, string, string, string?][]) => {
    entries.forEach(([activity, start, end, description, batchId]) => state.work.push({ id: id('wl'), trainerId: tid, date, activity, start, end, description, batchId }));
  };

  // ---- Past sessions (attendance + progress + activities) ----
  for (const s of batchSeeds) {
    const b = batches.find((x) => x.id === s.b.id)!;
    const days = flatDays(syllabusOf(state, b));
    const dates = prevWeekdays(today, s.held).reverse();
    dates.forEach((date, di) => {
      addAttendance(b.id, date, b, 'Submitted');
      days[di].day.topics.forEach((t, ti) => {
        const ov = s.overrides?.[di]?.[ti];
        addProg(b.id, t.key, date, ov ? ov[0] : 'Completed', ov ? ov[1] : '');
      });
      addActivity(b.trainerId, b.id, date, { nextPlan: `Start "${days[di + 1]?.day.title ?? 'revision'}"` });
      state.lessonDays.push({ id: id('ld'), batchId: b.id, date, syllabusDayId: days[di].day.id, trainerId: b.trainerId, at: tsAt(date, b.startTime) });
    });
  }

  // ---- Past work logs ----
  const pastWork = (tid: string, date: string) => {
    const bs = batches.filter((b) => b.trainerId === tid && state.attendance.some((a) => a.batchId === b.id && a.date === date));
    if (!bs.length) return;
    addWork(tid, date, [
      ['Lesson Preparation', '08:15', '08:45', 'Reviewed slides and examples'],
      ...bs.map((b) => ['Teaching', b.startTime, b.endTime, `Class for ${b.name}`, b.id] as [WorkLog['activity'], string, string, string, string]),
      ['Notes Preparation', '12:30', '13:00', 'Updated class notes'],
      ['Student Support', '13:00', '13:30', 'Doubt clearing session'],
      ['Daily Reporting', bs.some((b) => b.endTime > '18:00') ? '20:05' : '18:00', bs.some((b) => b.endTime > '18:00') ? '20:20' : '18:15', 'Prepared daily report'],
    ]);
  };
  const pastDates = prevWeekdays(today, 5);
  TRAINERS.forEach((t) => pastDates.forEach((d) => pastWork(t.id, d)));

  // ---- TODAY scenarios ----
  const B = (bid: string) => batches.find((b) => b.id === bid)!;
  const planTopics = (bid: string) => {
    const b = B(bid);
    const days = flatDays(syllabusOf(state, b));
    const held = batchSeeds.find((s) => s.b.id === bid)!.held;
    return days[held].day.topics;
  };

  // lesson days chosen today by trainers who have already taught (Arjun has not chosen yet)
  ['B03', 'B04', 'B05', 'B06', 'B08', 'B09'].forEach((bid) => {
    const bb = B(bid);
    const held = batchSeeds.find((x) => x.b.id === bid)!.held;
    state.lessonDays.push({ id: id('ld'), batchId: bid, date: today, syllabusDayId: flatDays(syllabusOf(state, bb))[held].day.id, trainerId: bb.trainerId, at: tsAt(today, bb.startTime) });
  });

  // T01 Arjun — demo trainer: morning in progress; attendance draft partially marked; nothing else yet
  const b01Ids = studentIds('B01');
  addAttendance('B01', today, B('B01'), 'Draft', Object.fromEntries(b01Ids.slice(0, 3).map((sid) => [sid, 'Present' as AttMark])));
  addWork('T01', today, [['Lesson Preparation', '08:15', '08:45', 'Prepared loops examples and exercise sheet']]);
  state.checkins.push({ trainerId: 'T01', date: today, in: '08:10' });

  // T02 Priya — Trainer A scenario: attendance done, some topics pending, report submitted
  ['B03', 'B04'].forEach((bid) => addAttendance(bid, today, B(bid), 'Submitted'));
  planTopics('B03').forEach((t, i) => addProg('B03', t.key, today, i < 3 ? 'Completed' : i === 3 ? 'Partially Completed' : 'Pending', i === 3 ? 'Covered syntax; exercise pending' : i === 4 ? 'Not reached — moved to next class' : ''));
  planTopics('B04').forEach((t, i) => addProg('B04', t.key, today, i === 3 ? 'Pending' : 'Completed', i === 3 ? 'Mini project starts next class' : ''));
  addActivity('T02', 'B03', today, { practicals: 'INNER and LEFT JOIN on the college database', homework: 'Write 5 join queries on the HR schema', doubts: 'Difference between LEFT and RIGHT join', supportStudents: 'Rohit Verma', nextPlan: 'Finish Self Join and join exercises, then Subqueries' });
  addActivity('T02', 'B04', today, { practicals: 'Event listeners on a to-do list', homework: 'Build a counter with buttons', nextPlan: 'DOM mini project, then Async JS' });
  addWork('T02', today, [
    ['Lesson Preparation', '08:30', '09:15', 'Join diagrams and dataset prep'],
    ['Teaching', '09:30', '11:30', 'SQL Batch C class', 'B03'],
    ['Notes Preparation', '12:00', '12:45', 'Updated join notes'],
    ['Teaching', '15:00', '17:00', 'JavaScript Batch A class', 'B04'],
    ['Student Support', '17:00', '17:40', 'Helped 3 students with DOM errors', 'B04'],
    ['Daily Reporting', '17:50', '18:05', 'Daily report'],
  ]);
  state.checkins.push({ trainerId: 'T02', date: today, in: '08:25', out: '18:10' });

  // T03 Rahul — Trainer B scenario: one batch, all completed, report approved
  addAttendance('B05', today, B('B05'), 'Submitted');
  planTopics('B05').forEach((t) => addProg('B05', t.key, today, 'Completed', '', 40));
  addActivity('T03', 'B05', today, { practicals: 'Built a small RAG pipeline over course PDFs', homework: 'Try two chunk sizes and compare answers', nextPlan: 'Evaluation & Safety' });
  addWork('T03', today, [
    ['Lesson Preparation', '09:00', '09:45', 'Vector DB demo setup'],
    ['Teaching', '10:00', '13:00', 'GenAI Batch A class', 'B05'],
    ['Doubt Clearing', '14:00', '14:30', 'Embedding questions', 'B05'],
    ['Notes Preparation', '14:30', '15:15', 'RAG notes'],
    ['Daily Reporting', '15:20', '15:35', 'Daily report'],
  ]);

  // T04 Sneha — Trainer C scenario: two batches, attendance incomplete, yesterday's report overdue
  addAttendance('B07', today, B('B07'), 'Draft', Object.fromEntries(studentIds('B07').slice(0, 2).map((sid) => [sid, 'Present' as AttMark])));
  planTopics('B06').slice(0, 2).forEach((t) => addProg('B06', t.key, today, 'Completed'));
  addWork('T04', today, [['Teaching', '09:00', '11:00', 'HTML & CSS Batch A class', 'B06']]);

  // T05 Vikram — today's report returned for correction
  addAttendance('B08', today, B('B08'), 'Submitted');
  planTopics('B08').forEach((t, i) => addProg('B08', t.key, today, i === 3 ? 'Partially Completed' : 'Completed', i === 3 ? 'Exercises half done' : ''));
  addActivity('T05', 'B08', today, { practicals: 'Wrote a weather tool and bound it to the model', homework: '', nextPlan: 'Memory & Persistence' });
  addWork('T05', today, [['Teaching', '11:00', '13:00', 'LangGraph Batch A class', 'B08'], ['Daily Reporting', '16:00', '16:10', 'Daily report']]);

  // T06 Ananya — submitted, under review
  addAttendance('B09', today, B('B09'), 'Submitted');
  planTopics('B09').forEach((t) => addProg('B09', t.key, today, 'Completed'));
  addActivity('T06', 'B09', today, { practicals: 'Operator precedence quiz', homework: 'Calculator script', nextPlan: 'Conditional Statements' });
  addWork('T06', today, [['Lesson Preparation', '12:30', '13:30', 'Quiz prep'], ['Teaching', '14:00', '17:00', 'Python Batch B class', 'B09'], ['Daily Reporting', '17:15', '17:30', 'Daily report']]);

  // T07 Karthik — evening batch, draft saved
  addWork('T07', today, [['Lesson Preparation', '16:30', '17:30', 'Basic query examples']]);

  // ---- Voice notes ----
  const vn = (tid: string, bid: string, date: string, category: VoiceNote['category'], description: string, seconds: number, transcript: string, confirmed = true) =>
    state.voice.push({ id: id('vn'), trainerId: tid, batchId: bid, date, category, description, seconds, transcript, transcriptConfirmed: confirmed, createdAt: tsAt(date, '17:40') });
  vn('T02', 'B03', today, 'Student Doubts', 'Join confusion in batch', 74, 'Most students are clear on inner join. Four of them are mixing up left and right join, so I will start tomorrow with a ten minute recap using the Venn diagram before self joins.');
  vn('T02', 'B04', today, 'Pending Work', 'Mini project deferred', 41, 'The DOM mini project did not start today. We will begin it in the first hour tomorrow.');
  vn('T03', 'B05', today, 'Class Update', 'RAG pipeline done', 58, 'All four topics completed. Every student got the RAG pipeline running on their own laptop.');
  vn('T01', 'B01', pastDates[0], 'Topics Covered', 'Conditionals recap', 63, 'We covered if, elif and nested conditions. The practice set is partially done, three problems are left for tomorrow.');
  vn('T05', 'B08', today, 'Student Performance', 'Two students behind', 37, 'Two students are behind on tool calling. I have shared extra examples with them.');

  // ---- Student task checklists (Notes of Lesson) for past Python Foundations classes ----
  for (const bid of ['B01', 'B09']) {
    const b = B(bid);
    const held = batchSeeds.find((x) => x.b.id === bid)!.held;
    prevWeekdays(today, held).reverse().forEach((date, di) => {
      const nd = state.nols[0].days[di];
      nd.tasks.forEach((_, ti) => {
        const notDone = (bid === 'B01' && di === held - 1 && ti >= 3) || (bid === 'B01' && di === 2 && ti === 4);
        state.taskChecks.push({ id: id('tc'), trainerId: b.trainerId, batchId: bid, nolId: PF_NOL_ID, dayNumber: nd.dayNumber, date, taskIndex: ti, status: notDone ? 'Not Completed' : 'Completed', updatedAt: tsAt(date, b.endTime) });
      });
    });
  }

  // ---- Batch reports (one per trainer + batch + date) for every day whose report was or will be submitted ----
  const PRACTICALS: Record<string, [string, string][]> = {
    C01: [['Practical exercise', 'Pair programming on today\'s examples'], ['Coding activity', 'Solved 5 problems from the exercise sheet']],
    C02: [['Lab exercise', 'Queries on the college database (students, courses, marks)'], ['Practical exercise', 'Wrote joins on the HR schema']],
    C03: [['Hands-on activity', 'Built a profile page with semantic tags'], ['Practical exercise', 'Styled a card layout with Flexbox']],
    C04: [['Coding activity', 'To-do list with event listeners'], ['Practical exercise', 'Array methods drill (map, filter, reduce)']],
    C05: [['Hands-on activity', 'Created models and ran migrations'], ['Lab exercise', 'Admin panel registration for the Course model']],
    C06: [['Coding activity', 'CRUD endpoints with Pydantic models'], ['Practical exercise', 'Tested endpoints in Swagger UI']],
    C07: [['Hands-on activity', 'Prompted the API with few-shot examples'], ['Lab exercise', 'RAG pipeline over course PDFs']],
    C08: [['Coding activity', 'Graph with conditional edges'], ['Hands-on activity', 'Bound a weather tool to the model']],
  };
  const seedBatchReport = (tid: string, b: Batch, date: string, dayTitle: string) => {
    const pr = PRACTICALS[b.courseId] ?? PRACTICALS.C01;
    state.batchReports.push({
      id: id('br'), trainerId: tid, batchId: b.id, date, status: 'Submitted',
      practicals: pr.map(([type, text]) => ({ id: id('pi'), type: type as 'Practical exercise', text })),
      assignments: [{ id: id('ai'), name: `${dayTitle} worksheet`, description: `Complete the remaining questions on ${dayTitle.toLowerCase()}`, deadline: addDays(date, 1) }],
      doubts: [{ id: id('di'), type: 'Question asked', text: `Clarification on ${dayTitle.toLowerCase()} examples` }, { id: id('di'), type: 'Difficult topic', text: `Last topic of ${dayTitle}` }],
      voiceNames: [{ id: id('vi'), text: `${dayTitle} – Class Explanation` }, { id: id('vi'), text: `${dayTitle} – Practical Walkthrough` }],
      projects: b.courseId === 'C03' || b.courseId === 'C05' || b.courseId === 'C04'
        ? [{ id: id('pj'), name: b.courseId === 'C03' ? 'Portfolio Website' : b.courseId === 'C05' ? 'Course Catalogue App' : 'Quiz App', workDone: 'Explained the folder structure and first milestone', assigned: 'Milestone 1: layout and navigation', students: 'Team A, Team B', status: 'In Progress', remarks: '' }]
        : [],
      remarks: '', createdAt: tsAt(date, b.endTime), updatedAt: tsAt(date, b.endTime), submittedAt: tsAt(date, b.endTime),
      history: [{ at: tsAt(date, b.endTime), by: trainerNameById(tid), action: 'Batch report submitted' }],
    });
  };
  for (const sd of batchSeeds) {
    const b = batches.find((x) => x.id === sd.b.id)!;
    const days = flatDays(syllabusOf(state, b));
    prevWeekdays(today, sd.held).reverse().forEach((date, di) => {
      if (b.trainerId === 'T04' && date === pastDates[0]) return; // Sneha never reported yesterday
      seedBatchReport(b.trainerId, b, date, days[di].day.title);
    });
  }
  (['B03', 'B04', 'B05', 'B08', 'B09'] as const).forEach((bid) => {
    const b = B(bid);
    const held = batchSeeds.find((x) => x.b.id === bid)!.held;
    seedBatchReport(b.trainerId, b, today, flatDays(syllabusOf(state, b))[held].day.title);
  });
  // Vikram's report was returned because homework was blank — leave his assignments empty
  state.batchReports.filter((r) => r.batchId === 'B08' && r.date === today).forEach((r) => { r.assignments = []; });
  // Karthik saved a draft batch report before his evening class
  state.batchReports.push({ id: id('br'), trainerId: 'T07', batchId: 'B10', date: today, status: 'Draft', practicals: [], assignments: [], doubts: [], voiceNames: [{ id: id('vi'), text: 'SQL Day 2 – Filtering Intro' }], projects: [], remarks: 'Class at 6 PM', createdAt: tsAt(today, '17:35'), updatedAt: tsAt(today, '17:35'), history: [{ at: tsAt(today, '17:35'), by: 'Karthik Subramanian', action: 'Draft saved' }] });

  // ---- WhatsApp student updates: who sent updates / voice notes (sample selections for days already reported) ----
  for (const br of state.batchReports.filter((r) => r.status === 'Submitted')) {
    const ids = studentIds(br.batchId).filter((sid, i) => (hash(sid + br.date) + i) % 3 !== 0);
    if (!ids.length) continue;
    state.waUpdates.push({ id: id('wa'), trainerId: br.trainerId, batchId: br.batchId, date: br.date, studentIds: ids, unmatched: [], source: 'paste', savedAt: br.submittedAt ?? br.updatedAt, savedBy: trainerNameById(br.trainerId), history: [{ at: br.updatedAt, by: trainerNameById(br.trainerId), count: ids.length }] });
  }

  // ---- Activities for T01 past already added; reports ----
  const mkReport = (tid: string, date: string, status: DailyReport['status'], submitAt: string, extra: Partial<DailyReport> = {}): DailyReport => {
    const snap = buildSnapshot(state, tid, date);
    const late = submitAt > state.settings.reportDeadline;
    const r: DailyReport = {
      id: id('rep'), trainerId: tid, date, status, draftRemarks: '',
      versions: status === 'Draft' ? [] : [{ version: 1, submittedAt: tsAt(date, submitAt), late, snapshot: snap }],
      events: status === 'Draft' ? [{ at: tsAt(date, submitAt), by: trainerNameById(tid), action: 'Draft saved' }] : [{ at: tsAt(date, submitAt), by: trainerNameById(tid), action: late ? 'Submitted (late)' : 'Submitted' }],
      adminRemarks: [],
      ...extra,
    };
    return r;
  };
  const approve = (r: DailyReport, by: string, time: string) => { r.events.push({ at: tsAt(r.date, time), by, action: 'Approved' }); return r; };

  // past reports for every trainer with sessions
  for (const t of TRAINERS) {
    pastDates.forEach((d, i) => {
      if (!state.attendance.some((a) => a.date === d && batches.find((b) => b.id === a.batchId)?.trainerId === t.id)) return;
      if (t.id === 'T04' && i === 0) return; // Sneha: yesterday's report never submitted → overdue
      if (t.id === 'T07' && i === 0) {
        const r = mkReport(t.id, d, 'Rejected', '20:40');
        r.events.push({ at: tsAt(d, '21:30'), by: 'Rohan Kapoor', action: 'Rejected', reason: 'Report submitted for wrong batch timing; attendance count does not match register. Please raise a fresh correction with the office.' });
        state.reports.push(r);
        return;
      }
      const r = mkReport(t.id, d, 'Approved', t.id === 'T04' ? '19:52' : '18:10');
      state.reports.push(approve(r, i % 2 ? 'Rohan Kapoor' : 'Lakshmi Narayanan', '20:00'));
    });
  }
  // today
  state.reports.push(mkReport('T02', today, 'Submitted', '18:10'));
  state.reports.push(approve(mkReport('T03', today, 'Approved', '15:40'), 'Lakshmi Narayanan', '16:05'));
  const vik = mkReport('T05', today, 'Correction Requested', '16:12');
  vik.events.push({ at: tsAt(today, '16:30'), by: 'Rohan Kapoor', action: 'Opened for review' });
  vik.events.push({ at: tsAt(today, '16:45'), by: 'Rohan Kapoor', action: 'Correction requested', reason: 'Homework is blank for LangGraph Batch A and Lesson Preparation time is missing. Please add both and resubmit.' });
  state.reports.push(vik);
  const ana = mkReport('T06', today, 'Under Review', '17:32');
  ana.events.push({ at: tsAt(today, '17:50'), by: 'Lakshmi Narayanan', action: 'Opened for review' });
  state.reports.push(ana);
  const kar = mkReport('T07', today, 'Draft', '17:35');
  kar.draftRemarks = 'Class starts at 6 PM; will complete after class.';
  state.reports.push(kar);

  // ---- Notifications ----
  const note = (userId: string, type: Notification['type'], title: string, body: string, at: string, read = false, link?: Notification['link']) =>
    state.notifications.push({ id: id('n'), userId, type, title, body, at, read, link });
  const repOf = (tid: string) => state.reports.find((r) => r.trainerId === tid && r.date === today)!;
  ['U01', 'U02'].forEach((u) => {
    note(u, 'report-submitted', 'Daily report submitted', `Priya Raghavan submitted the report for ${today}.`, tsAt(today, '18:10'), false, { page: 'report', id: repOf('T02').id });
    note(u, 'report-submitted', 'Daily report submitted', 'Ananya Das submitted the report for today.', tsAt(today, '17:32'), u === 'U01', { page: 'report', id: repOf('T06').id });
    note(u, 'overdue', 'Overdue report', `Sneha Kulkarni has not submitted the report for ${pastDates[0]}.`, tsAt(today, '09:00'), false, { page: 'reports' });
    note(u, 'report-submitted', 'Daily report submitted', 'Rahul Iyer submitted the report for today.', tsAt(today, '15:40'), true, { page: 'report', id: repOf('T03').id });
  });
  note('U14', 'correction', 'Correction requested', 'Rohan Kapoor asked you to correct today\'s report: homework blank, lesson preparation missing.', tsAt(today, '16:45'), false, { page: 't-report' });
  note('U12', 'approved', 'Report approved', 'Your daily report for today was approved by Lakshmi Narayanan.', tsAt(today, '16:05'), false, { page: 't-history' });
  note('U10', 'system', 'Reminder', `Submit today's report before ${state.settings.reportDeadline}.`, tsAt(today, '08:00'), false, { page: 't-report' });
  note('U10', 'approved', 'Report approved', `Your report for ${pastDates[0]} was approved.`, tsAt(pastDates[0], '20:00'), true, { page: 't-history' });
  note('U13', 'overdue', 'Report overdue', `Your report for ${pastDates[0]} is overdue.`, tsAt(today, '09:00'), false, { page: 't-report' });

  // ---- Assignments history ----
  batches.forEach((b, i) => state.assignments.push({ id: id('as'), trainerId: b.trainerId, batchId: b.id, courseId: b.courseId, syllabusVersionId: b.syllabusVersionId, start: b.startDate, end: b.endDate, schedule: `${b.classDays} · ${b.startTime}–${b.endTime}`, at: tsAt(addDays(b.startDate, -3), '11:00'), by: i % 3 ? 'Rohan Kapoor' : 'Lakshmi Narayanan' }));
  state.assignments.push({ id: id('as'), trainerId: 'T06', prevTrainerId: 'T08', batchId: 'B09', courseId: 'C01', syllabusVersionId: 'C01-v1', start: addDays(today, -5), end: addDays(today, 51), schedule: 'Mon–Fri · 14:00–17:00', at: tsAt(addDays(today, -6), '15:20'), by: 'Lakshmi Narayanan' });

  // ---- Audit ----
  const audit = (at: string, user: string, action: string, entity: string, prev: string, next: string, reason = '') => state.audit.push({ id: id('au'), at, user, action, entity, prev, next, reason });
  audit(tsAt(addDays(today, -6), '15:20'), 'Lakshmi Narayanan', 'Trainer reassigned', 'Batch B09 · Python Batch B', 'Fatima Sheikh', 'Ananya Das', 'Fatima moved to inactive status');
  audit(tsAt(addDays(today, -2), '11:05'), 'Rohan Kapoor', 'Syllabus draft created', 'Python Programming v2', '—', 'Draft (2 changes)', 'Add OOP module before batch reaches week 5');
  audit(tsAt(pastDates[1], '10:20'), 'Arjun Mehta', 'Attendance corrected', 'Python Batch A · Diya Patel', 'Absent', 'Late', 'Student arrived 15 minutes late; marked absent by mistake');
  audit(tsAt(today, '11:40'), 'Priya Raghavan', 'Topic status updated', 'SQL Batch C · LEFT JOIN', 'Pending', 'Completed', '');
  audit(tsAt(today, '12:46'), 'Priya Raghavan', 'Working hours added', 'Notes Preparation 12:00–12:45', '—', '45 min', '');
  audit(tsAt(today, '15:40'), 'Rahul Iyer', 'Report submitted', `Daily report ${today}`, 'Draft', 'Submitted v1', '');
  audit(tsAt(today, '16:05'), 'Lakshmi Narayanan', 'Report approved', `Rahul Iyer · ${today}`, 'Submitted', 'Approved', '');
  audit(tsAt(today, '16:45'), 'Rohan Kapoor', 'Correction requested', `Vikram Nair · ${today}`, 'Under Review', 'Correction Requested', 'Homework blank; lesson preparation missing');
  audit(tsAt(today, '18:10'), 'Priya Raghavan', 'Report submitted', `Daily report ${today}`, 'Draft', 'Submitted v1', '');
  audit(tsAt(pastDates[0], '21:30'), 'Rohan Kapoor', 'Report rejected', `Karthik Subramanian · ${pastDates[0]}`, 'Submitted', 'Rejected', 'Attendance count does not match register');
  audit(created, 'Lakshmi Narayanan', 'Notes of Lesson uploaded', 'Python Foundations', '—', `${PYTHON_FOUNDATIONS_PDF_NAME} · 25 days extracted`, '');
  audit(created, 'Lakshmi Narayanan', 'Notes of Lesson published', 'Python Foundations v1', 'Draft', 'Published · syllabus v1 generated', '');
  audit(created, 'Lakshmi Narayanan', 'Notes of Lesson assigned', 'Python Foundations v1', '—', 'Python Batch A, Python Batch B', '');
  state.audit.sort((a, b) => b.at.localeCompare(a.at));

  // Student doubts
  state.doubts.push({ id: id('d'), studentId: 'S001', topic: 'Data Types', text: 'Why does int("3.5") give an error but float("3.5") works?', at: tsAt(pastDates[2], '19:00'), status: 'Answered', answer: 'int() only parses whole-number strings. Convert with int(float("3.5")) if you want 3.' });

  // every topic record carries its trainer and original syllabus day
  state.progress.forEach((p) => {
    const bb = batches.find((x) => x.id === p.batchId)!;
    const fd = flatDays(syllabusOf(state, bb)).find((f) => f.day.topics.some((t) => t.key === p.topicKey));
    p.trainerId = bb.trainerId; p.updatedBy = trainerNameById(bb.trainerId);
    if (fd) { p.syllabusDayId = fd.day.id; p.dayNumber = fd.index + 1; }
  });
  return state;
}

/** master topic notes were written against topic titles; attach them to the matching Python Foundations topics */
function remapNotes(syllabi: ReturnType<typeof seedSyllabi>) {
  const py = syllabi.find((v) => v.id === 'C01-v1')!;
  const topics = py.modules.flatMap((m) => m.weeks.flatMap((w) => w.days.flatMap((d) => d.topics)));
  const find = (title: string) => topics.find((t) => t.title.toLowerCase() === title.toLowerCase())?.key;
  const map: Record<string, string> = { 'C01-t6': 'What is a variable?', 'C01-t28': 'for loop', 'C01-t29': 'What is a while loop?', 'C01-t30': 'range() function', 'C01-t31': 'break statement', 'C01-t32': 'Nested loops' };
  const out: Record<string, (typeof SEED_NOTES)[string]> = {};
  Object.entries(SEED_NOTES).forEach(([k, n]) => {
    if (!k.startsWith('C01-')) { out[k] = n; return; }
    const target = map[k] && find(map[k]);
    if (target) out[target] = n;
  });
  return out;
}
