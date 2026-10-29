// MSG-MEDIA (29/10) — la limite des vidéos de messagerie : une constante, un refus en français.
jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next,
}));

const {
  formatVideoDuration,
  readVideoMessageText,
  VIDEO_MAX_DURATION_SECONDS,
  videoDurationRefusal,
  videoMessageText,
} = require('../videoLimits');

describe('MSG-MEDIA — limites des vidéos', () => {
  test('la limite est d une minute, dans une seule constante', () => {
    expect(VIDEO_MAX_DURATION_SECONDS).toBe(60);
  });

  test('une vidéo de 61 s est refusée, avec un message en français qui dit la limite', () => {
    expect(videoDurationRefusal(61.2)).toBe(
      'Vidéo trop longue : 1 min maximum. Raccourcis-la dans ta galerie, puis renvoie-la.',
    );
    expect(videoDurationRefusal(75, 45)).toContain('45 s maximum');
  });

  test('une vidéo d une minute (arrondie par la galerie) passe ; une durée inconnue aussi', () => {
    expect(videoDurationRefusal(60.4)).toBe('');
    expect(videoDurationRefusal(42)).toBe('');
    expect(videoDurationRefusal(undefined)).toBe('');
    expect(videoDurationRefusal(0)).toBe('');
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
