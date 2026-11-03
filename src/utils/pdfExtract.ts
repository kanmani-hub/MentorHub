import * as pdfjs from 'pdfjs-dist';
// Run pdf.js in-process (no separate worker file): the artifact sandbox cannot load worker scripts from other origins.
import * as workerModule from 'pdfjs-dist/build/pdf.worker.js';
import { itemsToLines, parseNotesLines, stripRunningLines, type ParsedNotes } from './nolParser';

const wm = workerModule as unknown as { WorkerMessageHandler?: unknown; default?: { WorkerMessageHandler?: unknown } };
(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = wm.WorkerMessageHandler ? wm : wm.default;

export const b64ToBytes = (b64: string) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
export const bytesToB64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

export async function openPdf(bytes: Uint8Array) {
  return pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: false }).promise;
}

export async function extractNotesFromPdf(bytes: Uint8Array, onProgress?: (page: number, total: number) => void): Promise<ParsedNotes & { pages: number }> {
  const doc = await openPdf(bytes);
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(itemsToLines(tc.items as never, i));
    onProgress?.(i, doc.numPages);
  }
  const parsed = parseNotesLines(stripRunningLines(pages));
  if (pages.every((p) => p.length === 0)) parsed.warnings.unshift('This PDF has no selectable text (it may be a scanned image). OCR is needed before it can be extracted.');
  return { ...parsed, pages: doc.numPages };
}

export async function renderPdfPage(bytes: Uint8Array, pageNo: number, canvas: HTMLCanvasElement, width: number) {
  const doc = await openPdf(bytes);
  const page = await doc.getPage(Math.min(Math.max(1, pageNo), doc.numPages));
  const base = page.getViewport({ scale: 1 });
  const scale = width / base.width;
  const vp = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
  canvas.width = vp.width; canvas.height = vp.height;
  canvas.style.width = `${width}px`; canvas.style.height = `${(vp.height / vp.width) * width}px`;
  await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
  return doc.numPages;
}
