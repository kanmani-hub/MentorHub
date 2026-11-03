/**
 * Notes of Lesson parser.
 * Input: the document's text as lines (from a PDF via pdf.js, or plain text).
 * Output: day-wise records with Topics to Cover, Learning Objectives and Student Tasks,
 * keeping the source wording. Nothing is invented: anything missing becomes a warning.
 */
export interface ParsedDay {
  dayNumber: number;
  title: string;
  topics: string[];
  objectives: string[];
  tasks: string[];
  warnings: string[];
  page?: number;
}
export interface ParsedNotes {
  title: string;
  duration: string;
  days: ParsedDay[];
  warnings: string[];
  unrecognised: string[];
}
export interface Line { text: string; page: number }

const DAY_RE = /^Day\s*(\d+)\s*(?:[–—:-]\s*(.*))?$/i;
const SEC_RE: [RegExp, 'topics' | 'objectives' | 'tasks'][] = [
  [/^(?:\d+\s*[.)]\s*)?topics?\s+to\s+cover:?$/i, 'topics'],
  [/^(?:\d+\s*[.)]\s*)?learning\s+objectives?:?$/i, 'objectives'],
  [/^(?:\d+\s*[.)]\s*)?student\s+tasks?(?:\s*[–—-].*)?:?$/i, 'tasks'],
];
const BULLET_RE = /^[•●▪◦\-*–]\s*/;
const NUM_RE = /^(\d{1,2})\s*[.)]\s+/;
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/\s+([.,;:?!)])(?=\s|$)/g, '$1').replace(/\(\s+/g, '(').trim();

export function parseNotesLines(lines: Line[], expectedTasks = 5): ParsedNotes {
  const out: ParsedNotes = { title: '', duration: '', days: [], warnings: [], unrecognised: [] };
  let day: ParsedDay | null = null;
  let sec: 'topics' | 'objectives' | 'tasks' | null = null;
  let lastList: string[] | null = null;
  const titleParts: string[] = [];
  let ended = false;

  for (const { text: raw, page } of lines) {
    const t = tidy(raw);
    if (!t) continue;
    if (/^\*{0,2}end of\b/i.test(t)) { ended = true; continue; }
    if (ended) continue;
    const dur = t.match(/^\*{0,2}duration:?\*{0,2}\s*:?\s*(.+)$/i);
    if (dur && !day) { out.duration = tidy(dur[1]); continue; }
    const dm = t.match(DAY_RE);
    if (dm) {
      day = { dayNumber: Number(dm[1]), title: tidy(dm[2] ?? ''), topics: [], objectives: [], tasks: [], warnings: [], page };
      out.days.push(day);
      sec = null; lastList = null;
      continue;
    }
    if (!day) { titleParts.push(t.replace(/^#+\s*/, '')); continue; }
    const sm = SEC_RE.find(([re]) => re.test(t));
    if (sm) { sec = sm[1]; lastList = day[sec]; continue; }
    if (!sec) {
      // a wrapped day heading continues on the next line
      if (day.topics.length + day.objectives.length + day.tasks.length === 0 && day.title && !BULLET_RE.test(t)) { day.title = tidy(`${day.title} ${t}`); continue; }
      out.unrecognised.push(`Day ${day.dayNumber}: "${t}"`);
      continue;
    }
    const list = day[sec];
    if (BULLET_RE.test(t)) { list.push(tidy(t.replace(BULLET_RE, ''))); lastList = list; continue; }
    const nm = t.match(NUM_RE);
    if (nm) { list.push(tidy(t.replace(NUM_RE, ''))); lastList = list; continue; }
    // continuation of a wrapped item
    if (lastList && lastList.length) { lastList[lastList.length - 1] = tidy(`${lastList[lastList.length - 1]} ${t}`); continue; }
    list.push(t);
    lastList = list;
  }

  out.title = tidy(titleParts.join(' '));
  // per-day checks
  const seen = new Map<number, number>();
  out.days.forEach((d, i) => {
    if (!d.title) d.warnings.push('Day title not found.');
    if (!d.topics.length) d.warnings.push('No "Topics to Cover" found.');
    if (!d.objectives.length) d.warnings.push('No "Learning Objectives" found.');
    if (!d.tasks.length) d.warnings.push('No "Student Tasks" found.');
    else if (d.tasks.length !== expectedTasks) d.warnings.push(`Found ${d.tasks.length} student tasks; expected ${expectedTasks}.`);
    const dupT = d.topics.filter((x, j) => d.topics.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== j);
    if (dupT.length) d.warnings.push(`Repeated topic(s): ${dupT.join(', ')}`);
    seen.set(d.dayNumber, (seen.get(d.dayNumber) ?? 0) + 1);
    if (i > 0 && d.dayNumber !== out.days[i - 1].dayNumber + 1) out.warnings.push(`Day ${d.dayNumber} follows Day ${out.days[i - 1].dayNumber}; day numbers are not consecutive.`);
  });
  seen.forEach((n, k) => n > 1 && out.warnings.push(`Day ${k} appears ${n} times. Review before publishing.`));
  if (!out.days.length) out.warnings.push('No "Day N – Title" headings were found, so nothing could be organised day-wise.');
  const durN = Number(out.duration.match(/\d+/)?.[0]);
  if (durN && out.days.length && durN !== out.days.length) out.warnings.push(`The document states ${out.duration} but ${out.days.length} days were found.`);
  if (out.unrecognised.length) out.warnings.push(`${out.unrecognised.length} line(s) were outside any section and were not imported.`);
  return out;
}

/* ---------- PDF text → lines (pdf.js text content) ---------- */
interface TextItemLike { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean }

export function itemsToLines(items: TextItemLike[], page: number): Line[] {
  const rows: { y: number; items: TextItemLike[] }[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < Math.max(2, (it.height || 10) * 0.4));
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push(it);
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => {
    r.items.sort((a, b) => a.transform[4] - b.transform[4]);
    let s = '';
    let prevEnd = -Infinity;
    for (const it of r.items) {
      const x = it.transform[4];
      const gap = x - prevEnd;
      if (s && !s.endsWith(' ') && !it.str.startsWith(' ') && gap > Math.max(1.2, (it.height || 10) * 0.18)) s += ' ';
      s += it.str;
      prevEnd = x + it.width;
    }
    return { text: s, page };
  });
}

/** removes running headers/footers: page numbers, and lines repeated at the top or bottom of most pages */
export function stripRunningLines(pages: Line[][]): Line[] {
  const key = (t: string) => t.trim().replace(/\d+/g, '#');
  const structural = (t: string) => DAY_RE.test(tidy(t)) || SEC_RE.some(([re]) => re.test(tidy(t)));
  const edge = (ls: Line[]) => [ls[0], ls[1], ls[ls.length - 1], ls[ls.length - 2]].filter((l) => l && !structural(l.text)).map((l) => key(l.text));
  const counts = new Map<string, number>();
  pages.forEach((ls) => new Set(edge(ls)).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  const minRepeat = Math.max(2, Math.ceil(pages.length * 0.6));
  return pages.flatMap((ls) => {
    const e = new Set(edge(ls));
    return ls.filter((l) => {
      const t = l.text.trim();
      if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(t) || /^\d+$/.test(t)) return false;
      const k = key(t);
      return !(e.has(k) && (counts.get(k) ?? 0) >= minRepeat && pages.length > 1);
    });
  });
}

export const markdownToLines = (text: string): Line[] =>
  text.split(/\r?\n/).map((l) => ({ text: l.replace(/^#{1,6}\s*/, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/`/g, '').replace(/^###?\s*/, ''), page: 1 })).filter((l) => l.text.trim() !== '---');
