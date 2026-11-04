import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../store/AppStore';
import type { Settings as S } from '../../types';
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Select, SimNote, Table, Tabs, Toggle } from '../../components/common/ui';
import { fmtDate, uid } from '../../utils';

export default function Settings() {
  const { raw, mutate, toast } = useApp();
  const [tab, setTab] = useState<'institute' | 'reports' | 'attendance' | 'syllabus' | 'calendar'>('institute');
  const [f, setF] = useState<S>(raw.settings);
  const [newCat, setNewCat] = useState('');
  const [hol, setHol] = useState({ date: '', name: '' });
  const [admin, setAdmin] = useState({ name: '', email: '' });
  const set = <K extends keyof S>(k: K, v: S[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    const changed = (Object.keys(f) as (keyof S)[]).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(raw.settings[k]));
    mutate((d) => { d.settings = f; }, { action: 'Settings updated', entity: 'Institute settings', prev: changed.map((k) => `${k}: ${JSON.stringify(raw.settings[k])}`).join('; ').slice(0, 160) || '—', next: changed.map((k) => `${k}: ${JSON.stringify(f[k])}`).join('; ').slice(0, 160) || 'No change', reason: '' });
    toast('Settings saved');
  };
  const admins = raw.users.filter((u) => u.role === 'admin');
  return (
    <div>
      <PageHeader title="Settings" actions={<Button onClick={save}>Save settings</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'institute', label: 'Institute' }, { id: 'reports', label: 'Report deadline' }, { id: 'attendance', label: 'Attendance rules' }, { id: 'syllabus', label: 'Syllabus publishing' }, { id: 'calendar', label: 'Academic calendar' }]} />
      <Card className="max-w-3xl">
        {tab === 'institute' && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Institute name" className="sm:col-span-2"><Input id="st-name" value={f.instituteName} onChange={(e) => set('instituteName', e.target.value)} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input id="st-addr" value={f.instituteAddress} onChange={(e) => set('instituteAddress', e.target.value)} /></Field>
          <Field label="Office email"><Input id="st-email" value={f.instituteEmail} onChange={(e) => set('instituteEmail', e.target.value)} /></Field>
          <Field label="Office phone"><Input id="st-phone" value={f.institutePhone} onChange={(e) => set('institutePhone', e.target.value)} /></Field>
          <p className="text-xs text-ink-500 sm:col-span-2">Users, admin review rights and trainer options are managed in User Roles & Permissions.</p>
        </div>}
        {tab === 'reports' && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Daily report deadline" hint="Reports submitted after this time are marked late; missing ones become overdue"><Input id="rp-deadline" type="time" value={f.reportDeadline} onChange={(e) => set('reportDeadline', e.target.value)} /></Field>
          <Field label="Lesson day complete when"><Select id="rp-rule" value={f.dayCompleteRule} onChange={(e) => set('dayCompleteRule', e.target.value as S['dayCompleteRule'])}><option value="all-completed">Every topic is marked Completed</option><option value="reviewed">Every topic has a status and a reason</option></Select></Field>
          <div className="sm:col-span-2 divide-y divide-ink-100 dark:divide-ink-800">
            <Toggle id="rp-exc" checked={f.allowException} onChange={(v) => set('allowException', v)} label="Allow trainers to record an exception reason to submit with missing items" />
            <Toggle id="rp-voice" checked={f.requireVoiceNote} onChange={(v) => set('requireVoiceNote', v)} label="Require at least one student voice note in each batch report" />
          </div>
        </div>}
        {tab === 'attendance' && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mark late after (minutes)"><Input id="at-late" type="number" min={0} value={f.lateThresholdMin} onChange={(e) => set('lateThresholdMin', Number(e.target.value))} /></Field>
          <div className="sm:col-span-2"><Toggle id="at-lock" checked={f.attendanceLockAfterSubmit} onChange={(v) => set('attendanceLockAfterSubmit', v)} label="Lock attendance after submission (changes need a correction with reason)" /></div>
        </div>}
        {tab === 'syllabus' && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum topics per day" hint="Days with fewer topics are flagged for review"><Input id="sy-min" type="number" min={1} value={f.syllabusMinTopicsPerDay} onChange={(e) => set('syllabusMinTopicsPerDay', Number(e.target.value))} /></Field>
          <div className="sm:col-span-2"><Toggle id="sy-review" checked={f.syllabusReviewRequired} onChange={(v) => set('syllabusReviewRequired', v)} label="Require explicit review confirmation before publishing a syllabus version" /></div>
        </div>}
        {tab === 'calendar' && <div>
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">{[...f.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => <li key={h.date + h.name} className="flex items-center justify-between py-2 text-sm"><span className="text-ink-800 dark:text-ink-100">{fmtDate(h.date)} · {h.name}</span><button onClick={() => set('holidays', f.holidays.filter((x) => x !== h))} className="text-ink-400 hover:text-red-500" aria-label="Remove"><Trash2 size={15} /></button></li>)}</ul>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input id="hol-date" type="date" value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} /><Input id="hol-name" placeholder="Holiday name" value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} /><Button variant="secondary" onClick={() => { if (hol.date && hol.name) { set('holidays', [...f.holidays, hol]); setHol({ date: '', name: '' }); } }}>Add holiday</Button></div>
        </div>}
        <div className="mt-5 flex justify-end border-t border-ink-100 pt-4 dark:border-ink-800"><Button onClick={save}>Save settings</Button></div>
      </Card>
    </div>
  );
}
