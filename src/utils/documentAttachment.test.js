import {
  isAudioAttachment,
  isDocumentAttachment,
  isImageAttachment,
} from './documentAttachment';

describe('documentAttachment utils', () => {
  it('recognizes Android voice-note mp4 files as audio even without audio mime', () => {
    const attachment = {
      mime: 'video/mp4',
      name: 'voice-note-123.mp4',
      url: '/uploads/voice-note-123.mp4',
    };

    expect(isAudioAttachment(attachment)).toBe(true);
    expect(isImageAttachment(attachment)).toBe(false);
    expect(isDocumentAttachment(attachment)).toBe(false);
  });

  it('keeps generic files classified as documents', () => {
    const attachment = {
      mime: 'application/pdf',
      name: 'guide.pdf',
      url: '/uploads/guide.pdf',
    };

    expect(isAudioAttachment(attachment)).toBe(false);
    expect(isDocumentAttachment(attachment)).toBe(true);
  });
});
