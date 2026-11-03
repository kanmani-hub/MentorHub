import { PYTHON_FOUNDATIONS_PDF_B64 } from '../data/pythonFoundationsPdf';
import { b64ToBytes, bytesToB64 } from './pdfExtract';

/**
 * Original uploaded files. Metadata lives in app state (StoredFile); the bytes live here.
 * In production these go to object storage behind an authorised download URL.
 */
const EMBEDDED: Record<string, string> = { 'F-PF-1': PYTHON_FOUNDATIONS_PDF_B64 };
const mem: Record<string, Uint8Array> = {};
const key = (id: string) => `trainerhub.file.${id}`;

export function putFile(id: string, bytes: Uint8Array): boolean {
  mem[id] = bytes;
  try { localStorage.setItem(key(id), bytesToB64(bytes)); return true; } catch { return false; }
}
export function getFile(id: string): Uint8Array | null {
  if (mem[id]) return mem[id];
  if (EMBEDDED[id]) return (mem[id] = b64ToBytes(EMBEDDED[id]));
  try { const b = localStorage.getItem(key(id)); if (b) return (mem[id] = b64ToBytes(b)); } catch { /* ignore */ }
  return null;
}
