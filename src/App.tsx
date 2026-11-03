import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AppProvider, useApp } from './store/AppStore';
import { Shell } from './components/layout/Shell';
import { RETIRED, pageRole } from './components/layout/nav';
import { AdminReportsModule, TrainerReportModule } from './components/layout/ModuleTabs';
import Exports from './pages/admin/Exports';
import Roles from './pages/admin/Roles';
import { Button, Card, Empty } from './components/common/ui';
import Login from './pages/auth/Login';
import AdminDashboard from './pages/admin/Dashboard';
import Trainers, { TrainerDetail } from './pages/admin/Trainers';
import Courses, { CourseDetail } from './pages/admin/Courses';
import Syllabus from './pages/admin/Syllabus';
import NotesOfLessonPage, { SyllabusSwitch } from './pages/admin/NotesOfLesson';
import Batches, { AdminBatchDetail } from './pages/admin/Batches';
import Students from './pages/admin/Students';
import Assignments from './pages/admin/Assignments';
import { AdminActivities, AdminAttendance, AdminSyllabusProgress, AuditLogs } from './pages/admin/Monitoring';
import { AdminWhatsAppUpdates, WhatsAppUpdatesPage } from './pages/trainer/WhatsApp';
import Reports, { ReportDetail } from './pages/admin/Reports';
import Analytics from './pages/admin/Analytics';
import Settings from './pages/admin/Settings';
import { NotesIndex, TopicDetail } from './pages/shared/Notes';
import { WorkDateProvider, useWorkDate } from './pages/trainer/common';
import { MyBatches, MyProfile, TrainerBatchDetail, TrainerDashboard } from './pages/trainer/TrainerHome';
import { AttendancePage, TopicProgressPage } from './pages/trainer/Teaching';
import { TodaysLesson } from './pages/trainer/Lesson';
import { DailyActivitiesPage } from './pages/trainer/DailyLog';
import { DailyReportPage, ReportHistory } from './pages/trainer/Report';
import { BatchReportPage } from './pages/trainer/BatchReport';
import { TrainerLessonNotes } from './pages/trainer/NolTrainer';
import { StudentAssessments, StudentAttendance, StudentCourse, StudentDashboard, StudentDoubts, StudentHomework, StudentNotes, StudentProgress } from './pages/student/Student';

function Denied() {
  const { user, go } = useApp();
  return (
    <Card><Empty icon={<ShieldAlert size={20} />} title="You don't have access to this page" body={`This page belongs to another portal. Signed in as ${user?.role}; access is checked on every route.`}
      action={<Button onClick={() => go(user!.role === 'admin' ? 'dashboard' : user!.role === 'trainer' ? 't-dashboard' : 's-dashboard')}>Go to my dashboard</Button>} /></Card>
  );
}

function Router() {
  const { user, route } = useApp();
  const { setDate } = useWorkDate();
  const { go } = useApp();
  useEffect(() => { if (route.page === 't-report' && route.id && /^\d{4}-\d{2}-\d{2}$/.test(route.id)) setDate(route.id); }, [route, setDate]);
  // retired pages (notifications, working hours) send old links to the module that replaced them
  useEffect(() => { if (RETIRED[route.page]) go(RETIRED[route.page]); }, [route.page, go]);
  if (!user) return null;
  // route guard: page role must match the signed-in role
  if (pageRole(route.page) !== user.role) return <Denied />;
  const { page, id, tab } = route;
  switch (page) {
    case 'dashboard': return <AdminDashboard />;
    case 'trainers': return <Trainers />;
    case 'trainer': return <TrainerDetail key={id} id={id!} tab={tab} />;
    case 'courses': return <Courses />;
    case 'course': return <CourseDetail id={id!} />;
    case 'syllabus': return <Syllabus key={id} courseId={id} />;
    case 'nol': return <NotesOfLessonPage key={id} courseId={id} />;
    case 'notes': return <><SyllabusSwitch value="notes" /><NotesIndex detailPage="topic" /></>;
    case 'topic': return <TopicDetail key={id} k={id!} backTo="notes" />;
    case 'batches': return <Batches />;
    case 'batch': return <AdminBatchDetail key={id} id={id!} />;
    case 'students': return <Students />;
    case 'assignments': return <Assignments key={`${id}${tab}`} trainerId={id} batchId={tab} />;
    case 'attendance': return <AdminAttendance />;
    case 'syl-progress': return <AdminSyllabusProgress />;
    case 'voice': return <AdminReportsModule value="voice"><AdminWhatsAppUpdates /></AdminReportsModule>;
    case 'activities': return <AdminReportsModule value="activities"><AdminActivities /></AdminReportsModule>;
    case 'reports': return <AdminReportsModule value="reports"><Reports key="r" /></AdminReportsModule>;
    case 'approvals': return <AdminReportsModule value="approvals"><Reports key="a" approvals /></AdminReportsModule>;
    case 'exports': return <Exports />;
    case 'roles': return <Roles />;
    case 'report': return <ReportDetail key={id} id={id!} />;
    case 'analytics': return <Analytics />;
    case 'audit': return <AuditLogs />;
    case 'settings': return <Settings />;
    case 't-dashboard': return <TrainerDashboard />;
    case 't-batches': return <MyBatches />;
    case 't-batch': return <TrainerBatchDetail key={id} id={id!} />;
    case 't-lesson': return <TodaysLesson key={id} batchId={id} />;
    case 't-notes': return <TrainerLessonNotes />;
    case 't-topic': return <TopicDetail key={id} k={id!} backTo="t-notes" />;
    case 't-attendance': return <AttendancePage key={id} batchId={id} />;
    case 't-progress': return <TopicProgressPage key={id} batchId={id} />;
    case 't-voice': return <TrainerReportModule value="t-voice"><WhatsAppUpdatesPage /></TrainerReportModule>;
    case 't-activities': return <TrainerReportModule value="t-activities"><DailyActivitiesPage key={id} batchId={id} /></TrainerReportModule>;
    case 't-report': return <TrainerReportModule value="t-report"><DailyReportPage /></TrainerReportModule>;
    case 't-batch-report': return <TrainerReportModule value="t-batch-report"><BatchReportPage key={id} batchId={id} /></TrainerReportModule>;
    case 't-history': return <ReportHistory key={id} openId={id} />;
    case 't-profile': return <MyProfile />;
    case 's-dashboard': return <StudentDashboard />;
    case 's-course': return <StudentCourse />;
    case 's-notes': return <StudentNotes />;
    case 's-topic': return <TopicDetail key={id} k={id!} backTo="s-notes" />;
    case 's-homework': return <StudentHomework />;
    case 's-assignments': return <StudentHomework assignments />;
    case 's-attendance': return <StudentAttendance />;
    case 's-assessments': return <StudentAssessments />;
    case 's-progress': return <StudentProgress />;
    case 's-doubts': return <StudentDoubts />;
    default: return <Card><Empty title="Page not found" /></Card>;
  }
}

function Root() {
  const { user } = useApp();
  if (!user) return <Login />;
  return (
    <WorkDateProvider key={user.id}>
      <Shell><Router /></Shell>
    </WorkDateProvider>
  );
}

export default function App() {
  return <AppProvider><Root /></AppProvider>;
}
