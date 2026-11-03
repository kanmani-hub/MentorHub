// Build-time + test helper: extracts the Notes of Lesson PDF with pdf.js and the app's own parser.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parseNotesLines, itemsToLines, stripRunningLines, markdownToLines } from '../.tmp/nolParser.mjs';
const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const [pdfPath, mdPath, outJson] = process.argv.slice(2);
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data, disableFontFace: true }).promise;
const pages = [];
for (let i = 1; i <= doc.numPages; i++) {
  const p = await doc.getPage(i);
  const tc = await p.getTextContent();
  pages.push(itemsToLines(tc.items, i));
}
const parsed = parseNotesLines(stripRunningLines(pages));
console.log('title:', parsed.title, '| duration:', parsed.duration, '| days:', parsed.days.length, '| pages:', doc.numPages);
console.log('warnings:', parsed.warnings, 'unrecognised:', parsed.unrecognised.slice(0, 5));
const counts = parsed.days.map((d) => `${d.dayNumber}:${d.topics.length}/${d.objectives.length}/${d.tasks.length}`).join(' ');
console.log(counts);
if (mdPath) {
  const ref = parseNotesLines(markdownToLines(fs.readFileSync(mdPath, 'utf8')));
  let diffs = 0;
  ref.days.forEach((rd, i) => {
    const pd = parsed.days[i];
    for (const k of ['title', 'topics', 'objectives', 'tasks']) {
      const a = JSON.stringify(rd[k]), b = JSON.stringify(pd?.[k]);
      if (a !== b) { diffs++; if (diffs < 12) console.log(`DIFF day ${rd.dayNumber} ${k}\n  src: ${a}\n  pdf: ${b}`); }
    }
  });
  console.log('differences vs source text:', diffs, '| source days', ref.days.length);
}
if (outJson) fs.writeFileSync(outJson, JSON.stringify(parsed, null, 1));
