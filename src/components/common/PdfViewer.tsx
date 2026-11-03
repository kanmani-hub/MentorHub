import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileWarning, Loader2 } from 'lucide-react';
import { getFile } from '../../utils/fileStore';
import { renderPdfPage } from '../../utils/pdfExtract';
import { Button, Modal } from './ui';

/** Renders pages of a stored original PDF with pdf.js. */
export function PdfPages({ fileId, page: initial = 1, onPage }: { fileId: string; page?: number; onPage?: (p: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(initial);
  const [pages, setPages] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading');
  useEffect(() => setPage(initial), [initial]);
  useEffect(() => {
    const bytes = getFile(fileId);
    if (!bytes) { setState('missing'); return; }
    let cancelled = false;
    setState('loading');
    const width = Math.min(760, (box.current?.clientWidth ?? 600) - 2);
    renderPdfPage(bytes, page, canvas.current!, width).then((n) => { if (!cancelled) { setPages(n); setState('ok'); } }).catch(() => !cancelled && setState('error'));
    return () => { cancelled = true; };
  }, [fileId, page]);
  const go = (p: number) => { setPage(p); onPage?.(p); };
  return (
    <div ref={box} className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-ink-500">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => go(page - 1)} icon={<ChevronLeft size={14} />}>Prev</Button>
        <span className="tabular-nums">Page {page}{pages ? ` of ${pages}` : ''}</span>
        <Button size="sm" variant="secondary" disabled={!pages || page >= pages} onClick={() => go(page + 1)}>Next <ChevronRight size={14} /></Button>
      </div>
      <div className="relative overflow-auto rounded-lg border border-ink-200 bg-ink-100 p-1 dark:border-ink-700 dark:bg-ink-950">
        {state === 'loading' && <div className="absolute inset-0 grid place-items-center"><Loader2 className="animate-spin text-ink-400" /></div>}
        {state === 'missing' && <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-ink-500"><FileWarning />The original file is not available in this browser.</div>}
        {state === 'error' && <div className="py-16 text-center text-sm text-red-600">This file could not be rendered.</div>}
        <canvas ref={canvas} className={state === 'ok' ? 'mx-auto block bg-white shadow' : 'hidden'} />
      </div>
    </div>
  );
}

export function PdfViewerModal({ fileId, name, page, onClose }: { fileId: string; name: string; page?: number; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} size="lg" title={name} sub="Original uploaded file">
      <PdfPages fileId={fileId} page={page} />
      <p className="mt-2 text-xs text-ink-500">Viewing works here. Downloading the original needs the backend file store; this prototype keeps the file in your browser.</p>
    </Modal>
  );
}
