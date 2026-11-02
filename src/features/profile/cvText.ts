import { strFromU8, unzipSync } from 'fflate';

// Reading a CV file on the device, with nothing from Expo in it so it runs in tests: which
// files go to the model as they are, which are opened here, and the text of a Word document.

export type CvFile = { name: string; mediaType: string; size: number; base64: string };
export type CvMaterial =
  | { kind: 'text'; text: string }
  | { kind: 'image'; image: { mediaType: string; dataBase64: string } }
  | { kind: 'document'; document: { mediaType: string; dataBase64: string } };

export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const IMAGES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const TEXTS = new Set(['text/plain', 'text/markdown', 'text/x-markdown', 'text/csv']);

export function typeFromName(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return { pdf: 'application/pdf', docx: DOCX, doc: 'application/msword', txt: 'text/plain', md: 'text/markdown', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic' }[ext] ?? '';
}

// What goes to the server for this file.
export function cvMaterial(file: CvFile): CvMaterial {
  if (file.size > CV_MAX_BYTES) throw new Error('That file is over 10 MB. A CV saved as a PDF is usually well under 1 MB.');
  if (file.mediaType === 'application/pdf') return { kind: 'document', document: { mediaType: 'application/pdf', dataBase64: file.base64 } };
  if (IMAGES.has(file.mediaType)) return { kind: 'image', image: { mediaType: file.mediaType, dataBase64: file.base64 } };
  if (file.mediaType === DOCX) {
    const text = docxText(file.base64);
    if (!text.trim()) throw new Error('That Word file has no text in it that could be read. Try saving it as a PDF.');
    return { kind: 'text', text };
  }
  if (TEXTS.has(file.mediaType)) return { kind: 'text', text: utf8(file.base64) };
  if (file.mediaType === 'image/heic' || file.mediaType === 'image/heif') throw new Error('That photo is in HEIC format. Save it as a JPEG or take a screenshot, then upload that.');
  if (file.mediaType === 'application/msword') throw new Error('That is an old Word format (.doc). Save it as a PDF or a .docx and upload that.');
  throw new Error('That file type is not one Ako can read. A PDF, a Word file (.docx), a plain text file or a photo all work.');
}

const bytes = (base64: string): Uint8Array => {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const utf8 = (base64: string): string => strFromU8(bytes(base64));

// The text of a Word document: its body, paragraph by paragraph, tabs kept, everything else dropped.
export function docxText(base64: string): string {
  const files = unzipSync(bytes(base64));
  const doc = files['word/document.xml'];
  if (!doc) throw new Error('That Word file could not be opened. Try saving it as a PDF.');
  return xmlText(strFromU8(doc));
}

export function xmlText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<w:p\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
