import * as XLSX from 'xlsx';
import type { Student } from '../types';

/**
 * Pulls people's names out of text copied from WhatsApp (chat export lines, group member lists,
 * plain name lists) or out of a spreadsheet, and matches them to the students of one batch.
 * Nothing here creates student records.
 */

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
const digits = (s: string) => s.replace(/\D/g, '').slice(-10);

/** one candidate name (or phone number) per entry, cleaned of WhatsApp decoration */
export function cleanEntry(raw: string): string {
  let t = raw.replace(/[‎‏‪-‮]/g, '').trim();
  // chat export: "[04/11/26, 9:15 am] Diya Patel: msg" or "04/11/2026, 09:15 - Diya Patel: msg"
  const chat = t.match(/^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:[ap]\.?m\.?)?\]?\s*(?:-\s*)?([^:]{1,60}):/i);
  if (chat) t = chat[1];
  t = t.replace(/^[-•*~\d.)\s]+(?=\D)/, '')       // bullets, numbering, "~" display-name marker
    .replace(/\((?:you|admin|group admin)\)/gi, '')
    .replace(/\b(?:voice note|audio|ptt|sent|update|omitted|<media omitted>)\b.*$/i, '')
    .replace(/[\u{1F000}-\u{1FFFF}☀-➿]/gu, '')
    .replace(/\s+/g, ' ').trim();
  return t;
}

export function namesFromText(text: string): string[] {
  const parts = text.split(/\r?\n|;|\t/).flatMap((l) => (l.includes(',') && !/^\[?\d{1,2}[/.-]/.test(l.trim()) ? l.split(',') : [l]));
  return dedupe(parts.map(cleanEntry).filter((x) => x.length >= 2 && !/^(name|student name|names|sl ?no|s\.?no)$/i.test(x)));
}

/** first sheet (or CSV): uses a "name"/"student" column when there is a header, otherwise the first column with text */
export function namesFromSheet(buf: ArrayBuffer): string[] {
  const wb = XLSX.read(buf, { type: 'array' });
  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, raw: false }).map((r) => r.map((c) => String(c ?? '').trim()));
  if (!rows.length) return [];
  const header = rows[0].map((c) => c.toLowerCase());
  let col = header.findIndex((c) => /name|student|sender|contact/.test(c));
  const body = col >= 0 ? rows.slice(1) : rows;
  if (col < 0) col = Math.max(0, rows[0].findIndex((c) => /[a-z]/i.test(c) && !/^\d/.test(c)));
  const phoneCol = header.findIndex((c) => /phone|mobile|number/.test(c));
  return dedupe(body.map((r) => cleanEntry(r[col] || (phoneCol >= 0 ? r[phoneCol] : '') || '')).filter((x) => x.length >= 2));
}

export function dedupe(names: string[]) {
  const seen = new Set<string>();
  return names.filter((n) => { const k = norm(n) || digits(n); if (!k || seen.has(k)) return false; seen.add(k); return true; });
}

export interface MatchResult { matched: { name: string; studentId: string; how: string }[]; unmatched: string[] }

export function matchNames(names: string[], students: Student[]): MatchResult {
  const out: MatchResult = { matched: [], unmatched: [] };
  const used = new Set<string>();
  for (const name of names) {
    const n = norm(name);
    const ph = digits(name);
    let st: Student | undefined; let how = '';
    if (ph.length === 10 && !n) { st = students.find((s) => digits(s.mobile) === ph); how = 'phone number'; }
    if (!st && n) { st = students.find((s) => norm(s.name) === n); how = 'exact name'; }
    if (!st && n) {
      // every word typed appears in exactly one student's name ("Diya", "patel diya", "Rohit V")
      const words = n.split(' ');
      const hits = students.filter((s) => { const sw = norm(s.name).split(' '); return words.every((w) => sw.some((x) => x === w || (w.length === 1 && x.startsWith(w)) || (w.length >= 3 && x.startsWith(w)))); });
      if (hits.length === 1) { st = hits[0]; how = 'partial name'; }
    }
    if (st && !used.has(st.id)) { used.add(st.id); out.matched.push({ name, studentId: st.id, how }); }
    else if (st) { /* same student listed twice: drop the duplicate */ }
    else out.unmatched.push(name);
  }
  return out;
}
