import * as XLSX from 'xlsx';
import { parseNotesLines, type ParsedNotes } from './nolParser';

/**
 * Reads a Notes of Lesson spreadsheet. Two layouts are accepted:
 *  - long:  Day | Day Title | Section | Item           (one row per topic / objective / task)
 *  - wide:  Day | Day Title | Topics to Cover | Learning Objectives | Student Tasks   (items separated by new lines or ";")
 */
export function extractNotesFromSheet(buf: ArrayBuffer, expectedTasks = 5): ParsedNotes & { layout: string; rows: number } {
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, raw: false }).map((r) => r.map((c) => String(c ?? '').trim()));
  const hi = rows.findIndex((r) => r.some((c) => /^day$/i.test(c) || /^day\s*(no|number|#)/i.test(c)));
  const warn: string[] = [];
  if (hi < 0) return { title: '', duration: '', days: [], warnings: ['No header row with a "Day" column was found.'], unrecognised: [], layout: 'unknown', rows: rows.length };
  const h = rows[hi].map((c) => c.toLowerCase());
  const col = (re: RegExp) => h.findIndex((c) => re.test(c));
  const cDay = col(/^day(\s*(no|number|#))?$/), cTitle = col(/title|lesson|name/), cSec = col(/section|type|category/), cItem = col(/^item|content|text|detail/);
  const cTop = col(/topic/), cObj = col(/objective/), cTask = col(/task/);
  const lines: { text: string; page: number }[] = [];
  const body = rows.slice(hi + 1).filter((r) => r.some(Boolean));
  const secName = (s: string) => (/topic/i.test(s) ? '1. Topics to Cover' : /objective/i.test(s) ? '2. Learning Objectives' : /task/i.test(s) ? '3. Student Tasks' : '');
  let layout = 'wide';
  if (cSec >= 0 && cItem >= 0) {
    layout = 'long';
    let curDay = '', curSec = '';
    body.forEach((r, i) => {
      const d = r[cDay] || curDay;
      if (!d) { warn.push(`Row ${hi + i + 2}: no day number.`); return; }
      if (d !== curDay) { lines.push({ text: `Day ${d.replace(/^day\s*/i, '')} – ${r[cTitle] ?? ''}`, page: 1 }); curDay = d; curSec = ''; }
      const sn = secName(r[cSec]);
      if (!sn) { warn.push(`Row ${hi + i + 2}: unknown section "${r[cSec]}".`); return; }
      if (sn !== curSec) { lines.push({ text: sn, page: 1 }); curSec = sn; }
      if (r[cItem]) lines.push({ text: `• ${r[cItem]}`, page: 1 }); else warn.push(`Row ${hi + i + 2}: empty item.`);
    });
  } else {
    body.forEach((r, i) => {
      if (!r[cDay]) { warn.push(`Row ${hi + i + 2}: no day number.`); return; }
      lines.push({ text: `Day ${r[cDay].replace(/^day\s*/i, '')} – ${cTitle >= 0 ? r[cTitle] ?? '' : ''}`, page: 1 });
      ([[cTop, '1. Topics to Cover'], [cObj, '2. Learning Objectives'], [cTask, '3. Student Tasks']] as [number, string][]).forEach(([c, name]) => {
        lines.push({ text: name, page: 1 });
        if (c < 0) return;
        (r[c] ?? '').split(/\r?\n|;|\|/).map((x) => x.replace(/^\s*(?:\d+[.)]|[-•])\s*/, '').trim()).filter(Boolean).forEach((x) => lines.push({ text: `• ${x}`, page: 1 }));
      });
    });
  }
  const parsed = parseNotesLines(lines, expectedTasks);
  parsed.title = wb.SheetNames[0];
  parsed.warnings.unshift(...warn);
  return { ...parsed, layout, rows: body.length };
}
