import { cleanFileName, contentDisposition } from './attachment-name';

describe('cleanFileName', () => {
  it('keeps an ordinary name', () => {
    expect(cleanFileName('Mock test 3 - answers.pdf', 'application/pdf')).toBe(
      'Mock test 3 - answers.pdf',
    );
  });

  it('drops folders that some browsers include', () => {
    expect(cleanFileName('C:\\Users\\rahul\\Desktop\\doubt.png', 'image/png')).toBe('doubt.png');
    expect(cleanFileName('../../etc/passwd.pdf', 'application/pdf')).toBe('passwd.pdf');
  });

  it('removes control and reserved characters', () => {
    expect(cleanFileName('a\u0000b<c>:"d|e?*\n.jpg', 'image/jpeg')).toBe('abcde.jpg');
  });

  it('adds the extension of the real type when the name does not match it', () => {
    expect(cleanFileName('notes.html', 'application/pdf')).toBe('notes.html.pdf');
    expect(cleanFileName('screenshot', 'image/png')).toBe('screenshot.png');
    expect(cleanFileName('photo.JPEG', 'image/jpeg')).toBe('photo.jpeg');
  });

  it('falls back to a generic name and caps the length', () => {
    expect(cleanFileName('???.pdf', 'application/pdf')).toBe('file.pdf');
    expect(cleanFileName(`${'x'.repeat(300)}.pdf`, 'application/pdf')).toHaveLength(104);
  });

  it('keeps non-English names', () => {
    expect(cleanFileName('सवाल.png', 'image/png')).toBe('सवाल.png');
  });
});

describe('contentDisposition', () => {
  it('sends an ASCII fallback and the exact UTF-8 name', () => {
    expect(contentDisposition('attachment', 'सवाल "1".pdf')).toBe(
      `attachment; filename="____ _1_.pdf"; filename*=UTF-8''%E0%A4%B8%E0%A4%B5%E0%A4%BE%E0%A4%B2%20%221%22.pdf`,
    );
  });

  it('marks images for inline display', () => {
    expect(contentDisposition('inline', 'doubt.png')).toBe(
      `inline; filename="doubt.png"; filename*=UTF-8''doubt.png`,
    );
  });
});
