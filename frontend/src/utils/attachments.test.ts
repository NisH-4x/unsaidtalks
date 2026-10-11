import { describe, expect, it } from 'vitest';
import { attachmentProblem, formatFileSize, messageSummary } from './attachments';

const file = (size: number, type: string, name = 'file') =>
  new File([new Uint8Array(size)], name, { type });

describe('attachmentProblem', () => {
  it('accepts images and PDFs up to 5 MB', () => {
    expect(attachmentProblem(file(1024, 'image/png'))).toBeNull();
    expect(attachmentProblem(file(5 * 1024 * 1024, 'application/pdf'))).toBeNull();
  });

  it('explains what is wrong with other files', () => {
    expect(attachmentProblem(file(10, 'image/svg+xml'))).toMatch(/Only images/);
    expect(attachmentProblem(file(10, 'application/zip'))).toMatch(/Only images/);
    expect(attachmentProblem(file(5 * 1024 * 1024 + 1, 'image/jpeg'))).toBe(
      'Files can be at most 5 MB.',
    );
    expect(attachmentProblem(file(0, 'image/png'))).toBe('This file is empty.');
  });

  it('leaves files without a reported type for the server to check', () => {
    expect(attachmentProblem(file(10, ''))).toBeNull();
  });
});

describe('formatFileSize', () => {
  it('uses the largest sensible unit', () => {
    expect(formatFileSize(900)).toBe('900 B');
    expect(formatFileSize(240 * 1024)).toBe('240 KB');
    expect(formatFileSize(1.25 * 1024 * 1024)).toBe('1.3 MB');
  });
});

describe('messageSummary', () => {
  const attachment = {
    name: 'sheet.pdf',
    mimeType: 'application/pdf',
    size: 1,
    width: null,
    height: null,
  };

  it('prefers the text, then describes the attachment', () => {
    expect(messageSummary({ type: 'image', text: 'See Q4', attachment })).toBe('See Q4');
    expect(messageSummary({ type: 'image', text: '', attachment })).toBe('Photo');
    expect(messageSummary({ type: 'file', text: '', attachment })).toBe('sheet.pdf');
  });
});
