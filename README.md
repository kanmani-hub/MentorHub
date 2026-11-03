# Trainer Hub — Centralized Training Management (frontend prototype)

React 18 + TypeScript + Tailwind CSS + Lucide + Recharts, bundled with Vite into one HTML file.

    npm install
    npm run dev      # local dev server
    npm run build    # dist/index.html (single file)

Demo logins: admin@trainerhub.com / Admin@123 · trainer@trainerhub.com / Trainer@123
(also priya@, rahul@ with Trainer@123, and student@trainerhub.com / Student@123).

## Structure
- src/types — data model interfaces
- src/data — mock syllabus, lesson notes and the seed generator (dates are generated relative to today)
- src/store — AppStore (state, localStorage persistence, audit, notifications), selectors (all metrics derived from records, role-scoped data via scopeFor), actions (report workflow)
- src/components — layout (shell, nav), common UI kit, charts, report view, syllabus tree
- src/pages — auth, admin, trainer, student, shared

## Prototype vs production
Role restrictions are enforced in the router guard and in `scopeFor()` (trainer pages only ever receive their own records).
Production must enforce the same rules in backend APIs and database queries.
Simulated: PDF/Excel parsing, audio recording and speech-to-text, email/WhatsApp notifications, file storage, password reset.

## Daily Batch Report module
- Trainer → Batch Reports (`src/pages/trainer/BatchReport.tsx`): one report per trainer + batch + date covering topic progress (Completed / Partially Completed / Not Covered with reasons), attendance (absent/leave reasons, late arrival times), practicals, assignments, doubts, WhatsApp voice note names, project work and remarks. Save as draft, preview, submit.
- Data: `BatchReport` in `src/types`; topic status and attendance reuse the existing `TopicProgress` and `AttendanceSession` records so every other page stays consistent.
- Actions and validation: `useBatchReportActions` / `validateBatchForm` in `src/store/actions.ts` (ownership, date and lock checks run inside the action, not only in the form).
- Consolidated report requires every batch report to be submitted; duplicate consolidated submissions for the same trainer and date are blocked; corrections create a new version.

## Notes of Lesson (Syllabus Management → Notes of Lesson Management)
- `src/utils/nolParser.ts` turns document lines into day-wise records (Topics to Cover, Learning Objectives, Student Tasks) and flags anything missing instead of inventing it.
- `src/utils/pdfExtract.ts` reads PDFs in the browser with pdf.js (bundled, no network); `src/utils/nolExcel.ts` reads .xlsx/.xls/.csv with SheetJS.
- The seeded Python Foundations course, its syllabus v1 and the published Notes of Lesson were generated from `Python_Foundations_Notes_of_Lesson.pdf` with the same parser (`scripts/extract-nol.mjs` → `src/data/pythonFoundationsNol.json`); the PDF itself is embedded so it can be viewed.
- Publishing can generate a syllabus version from the notes; topics that keep their day and wording keep their recorded progress. Batches switch only when assigned.
- Trainer task checklists are stored per trainer, batch, lesson day and class date (`TaskCheck`).

## Portal structure
- Admin Portal: 15 modules — Admin Dashboard, Course Management, Syllabus Management (syllabus structure, Notes of Lesson, topic lesson notes), Trainer Management, Batch Management, Student Management, Trainer-Batch Assignment, Attendance Management, Daily Reports Management (reports, approvals, activities & project work, voice notes), Topic Progress Monitoring, Trainer Performance & Analytics, Reports & Export, User Roles & Permissions, Audit Logs, Settings.
- Trainer Portal: 9 modules — My Dashboard, My Batches, Today's Lesson, Lesson Notes, Attendance, Topic Progress, Daily Report (batch reports, consolidated report, voice notes, activity log), My Report History, My Profile.
- No notifications module and no working-hours module: report status shows on dashboards, sidebar badges and report pages; teaching time is derived from the classes held.

## Lesson day selection and carry-forward
- Today's Lesson: the trainer picks the batch, class date and lesson day. The choice is saved as a `LessonDaySelection` (batch + class date + syllabus day); nothing is inferred from the calendar.
- Pending topics = topics whose latest status before the class date is Partially Completed or Not Covered. They are listed with their original "Day N – Title", never duplicated with the selected day, and disappear once a later class marks them Completed. Every save is a new record for that class date, so history is kept.
- Topic records store trainer, batch, original syllabus day, topic and actual class date. Submitting a batch report requires the lesson day to be selected.

## WhatsApp Student Updates (Daily Report → WhatsApp Updates)
- Replaces the old voice-recording page: no microphone, audio upload or speech-to-text.
- Trainers paste names (plain lists or WhatsApp chat lines) or upload Excel/CSV/TXT; `src/utils/waNames.ts` extracts names, removes duplicates and matches them only against the selected batch's students (exact, partial or phone number). Unmatched names are listed for review and can be matched by hand; no student records are created.
- The ticked students are saved per trainer, batch and class date (`WhatsAppUpdate`), editable until the daily report is submitted, and appear in the report as "Students Who Sent WhatsApp Updates".
