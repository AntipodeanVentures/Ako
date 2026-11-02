import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { cvMaterial, docxText, xmlText, type CvFile } from '../cvText';

const b64 = (u8: Uint8Array) => Buffer.from(u8).toString('base64');
const docx = (bodyXml: string) =>
  b64(zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(`<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${bodyXml}</w:body></w:document>`) }));

describe('a CV as a file', () => {
  it('reads the text of a Word document, paragraph by paragraph', () => {
    const xml = '<w:p><w:r><w:t>Stuart Pearson</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Commercial pilot</w:t><w:tab/><w:t>2010 &amp; 2011</w:t></w:r></w:p><w:p/><w:p><w:r><w:t>Brown belt</w:t><w:br/><w:t>jiu-jitsu</w:t></w:r></w:p>';
    expect(docxText(docx(xml))).toBe('Stuart Pearson\nCommercial pilot\t2010 & 2011\n\nBrown belt\njiu-jitsu');
  });

  it('sends a PDF as a document, a photo as an image, a Word or text file as words', () => {
    const pdf: CvFile = { name: 'cv.pdf', mediaType: 'application/pdf', size: 1000, base64: 'AAAA' };
    expect(cvMaterial(pdf)).toEqual({ kind: 'document', document: { mediaType: 'application/pdf', dataBase64: 'AAAA' } });
    const jpg: CvFile = { name: 'cv.jpg', mediaType: 'image/jpeg', size: 1000, base64: 'AAAA' };
    expect(cvMaterial(jpg)).toEqual({ kind: 'image', image: { mediaType: 'image/jpeg', dataBase64: 'AAAA' } });
    const word: CvFile = { name: 'cv.docx', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 1000, base64: docx('<w:p><w:r><w:t>Hello</w:t></w:r></w:p>') };
    expect(cvMaterial(word)).toEqual({ kind: 'text', text: 'Hello' });
    const txt: CvFile = { name: 'cv.txt', mediaType: 'text/plain', size: 10, base64: Buffer.from('Plain words', 'utf8').toString('base64') };
    expect(cvMaterial(txt)).toEqual({ kind: 'text', text: 'Plain words' });
  });

  it('says plainly what to do with a file it cannot read', () => {
    expect(() => cvMaterial({ name: 'cv.doc', mediaType: 'application/msword', size: 10, base64: 'AA' })).toThrow(/\.docx/);
    expect(() => cvMaterial({ name: 'cv.heic', mediaType: 'image/heic', size: 10, base64: 'AA' })).toThrow(/JPEG/);
    expect(() => cvMaterial({ name: 'cv.pages', mediaType: 'application/x-iwork-pages', size: 10, base64: 'AA' })).toThrow(/PDF/);
    expect(() => cvMaterial({ name: 'cv.pdf', mediaType: 'application/pdf', size: 11 * 1024 * 1024, base64: 'AA' })).toThrow(/10 MB/);
  });

  it('strips tags and entities from document XML', () => {
    expect(xmlText('<w:p><w:r><w:t>&lt;b&gt; &quot;q&quot; &#233;</w:t></w:r></w:p>')).toBe('<b> "q" é');
  });
});
