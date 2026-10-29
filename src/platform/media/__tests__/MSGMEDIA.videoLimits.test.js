// MSG-MEDIA (29/10) — la limite des vidéos de messagerie : une constante, un refus en français.
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next,
}));

const {
  formatVideoDuration,
  readVideoMessageText,
  VIDEO_MAX_BYTES,
  videoMessageText,
  videoSizeRefusal,
} = require('../videoLimits');

const MO = 1024 * 1024;

describe('MSG-MEDIA — limites des vidéos', () => {
  test('la limite est une TAILLE, de 150 Mo, dans une seule constante (décision d Adel)', () => {
    expect(VIDEO_MAX_BYTES).toBe(150 * MO);
  });

  test('une vidéo de 151 Mo est refusée, avec un message en français qui dit la limite', () => {
    expect(videoSizeRefusal(151 * MO)).toBe('Vidéo trop lourde : 150 Mo maximum.');
    expect(videoSizeRefusal(101 * MO, 100 * MO)).toBe('Vidéo trop lourde : 100 Mo maximum.');
  });

  test('une vidéo de 150 Mo pile passe ; une taille inconnue aussi ; la durée ne refuse rien', () => {
    expect(videoSizeRefusal(150 * MO)).toBe('');
    expect(videoSizeRefusal(9 * MO)).toBe('');
    expect(videoSizeRefusal(undefined)).toBe('');
    expect(videoSizeRefusal(0)).toBe('');
  });

  test('la durée s affiche en minutes:secondes', () => {
    expect(formatVideoDuration(42)).toBe('0:42');
    expect(formatVideoDuration(60)).toBe('1:00');
    expect(formatVideoDuration(725)).toBe('12:05');
    expect(formatVideoDuration(0)).toBe('');
  });

  test('une vidéo part avec le texte « Vidéo · 0:42 » ; une photo ne change rien', () => {
    expect(videoMessageText('video/mp4', 42.4)).toBe('Vidéo · 0:42');
    expect(videoMessageText('video/quicktime', undefined)).toBe('Vidéo');
    expect(videoMessageText('image/jpeg', 12)).toBe('');
  });

  test('la bulle relit la durée du texte ; une vraie légende reste une légende', () => {
    expect(readVideoMessageText('Vidéo · 0:42')).toEqual({ auto: true, durationSeconds: 42 });
    expect(readVideoMessageText('Video · 1:00')).toEqual({ auto: true, durationSeconds: 60 });
    expect(readVideoMessageText('Vidéo')).toEqual({ auto: true });
    expect(readVideoMessageText('')).toEqual({ auto: true });
    expect(readVideoMessageText('Le but de Karim')).toEqual({ auto: false });
  });
});
