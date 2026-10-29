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

describe('BH04 / P3-13 — légende « Pièce jointe » générée', () => {
  test('la phrase générée avec accent est reconnue', () => {
    // eslint-disable-next-line global-require
    const { isGeneratedDocumentFallbackText } = require('./documentAttachment');
    const piece = [{ mime: 'application/pdf', name: 'contrat.pdf' }];
    expect(isGeneratedDocumentFallbackText('Pièce jointe : contrat.pdf', piece)).toBe(true);
  });
});

describe('MSG-MEDIA — une vidéo de la galerie n est pas un document', () => {
  test('un .mov d iPhone est une vidéo, pas une carte document « MOV »', () => {
    // eslint-disable-next-line global-require
    const { isVideoAttachment } = require('./documentAttachment');
    const mov = { mime: 'video/quicktime', name: 'IMG_0042.MOV', url: '/uploads/IMG_0042.mov' };
    expect(isVideoAttachment(mov)).toBe(true);
    expect(isDocumentAttachment(mov)).toBe(false);
  });

  test('un mp4 porte le type vidéo ; un PDF ou une photo non', () => {
    // eslint-disable-next-line global-require
    const { isVideoAttachment } = require('./documentAttachment');
    expect(isVideoAttachment({ mime: 'video/mp4', name: 'clip.mp4' })).toBe(true);
    expect(isVideoAttachment({ mime: 'application/pdf', name: 'guide.pdf' })).toBe(false);
    expect(isVideoAttachment({ mime: 'image/jpeg', name: 'photo.jpg' })).toBe(false);
  });
});
