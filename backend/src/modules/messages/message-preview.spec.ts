import { Types } from 'mongoose';
import {
  buildMessagePreview,
  DELETED_MESSAGE_PREVIEW,
  PREVIEW_MAX_LENGTH,
} from './message-preview';

const base = { type: 'text' as const, text: '', attachment: null, deletedAt: null };
const pdf = {
  fileId: new Types.ObjectId(),
  name: 'formula-sheet.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  width: null,
  height: null,
};

describe('buildMessagePreview', () => {
  it('collapses whitespace in text messages', () => {
    expect(buildMessagePreview({ ...base, text: '  Mock test\n\non   Saturday ' })).toBe(
      'Mock test on Saturday',
    );
  });

  it('truncates long text to the preview limit', () => {
    const preview = buildMessagePreview({ ...base, text: 'a'.repeat(500) });

    expect(preview).toHaveLength(PREVIEW_MAX_LENGTH);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('describes images without a caption as a photo', () => {
    expect(buildMessagePreview({ ...base, type: 'image' })).toBe('Photo');
  });

  it('uses the caption for images that have one', () => {
    expect(buildMessagePreview({ ...base, type: 'image', text: 'Week 1 schedule' })).toBe(
      'Week 1 schedule',
    );
  });

  it('falls back to the file name for documents without a caption', () => {
    expect(buildMessagePreview({ ...base, type: 'file', attachment: pdf })).toBe(
      'formula-sheet.pdf',
    );
  });

  it('hides the content of deleted messages', () => {
    expect(buildMessagePreview({ ...base, text: 'secret', deletedAt: new Date() })).toBe(
      DELETED_MESSAGE_PREVIEW,
    );
  });
});
