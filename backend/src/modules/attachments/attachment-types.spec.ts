import { detectAttachmentType } from './attachment-types';

const bytes = (hex: string, rest = '') =>
  Buffer.concat([Buffer.from(hex, 'hex'), Buffer.from(rest)]);

describe('detectAttachmentType', () => {
  it.each([
    ['JPEG', bytes('ffd8ffe000104a464946'), 'image/jpeg'],
    ['PNG', bytes('89504e470d0a1a0a0000000d49484452'), 'image/png'],
    ['GIF', Buffer.from('GIF89a\x01\x00\x01\x00'), 'image/gif'],
    ['WebP', Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 '), 'image/webp'],
    ['PDF', Buffer.from('%PDF-1.7\n%âãÏÓ'), 'application/pdf'],
  ])('recognises %s from its first bytes', (_label, content, expected) => {
    expect(detectAttachmentType(content)).toBe(expected);
  });

  it.each([
    ['an SVG image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['an HTML page renamed to .png', Buffer.from('<!doctype html><script>alert(1)</script>')],
    ['a Windows executable', Buffer.from('MZ\x90\x00\x03\x00')],
    ['a ZIP archive (also .docx)', bytes('504b0304')],
    ['an empty file', Buffer.alloc(0)],
  ])('rejects %s', (_label, content) => {
    expect(detectAttachmentType(content)).toBeNull();
  });
});
