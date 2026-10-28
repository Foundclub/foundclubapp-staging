import {
  buildYoutubeEmbedPage,
  buildYoutubeThumbnailUrl,
  parseYoutubeUrl,
  YOUTUBE_PLAYER_ORIGIN,
} from '../youtubeUrl';

// VIDEOCV (28/10, planche validée par Adel) — la même table d'exemples que le serveur
// (`admin/src/api/firebase-auth/services/youtube-url.ts`). Le serveur reste seul juge :
// l'app ne s'en sert que pour l'erreur sous le champ et pour trouver l'ID.

const CANONIQUE = 'https://www.youtube.com/watch?v=k3Lm9QpX2aE';

describe('VIDEOCV — parseYoutubeUrl', () => {
  test.each([
    'https://www.youtube.com/watch?v=k3Lm9QpX2aE',
    'https://youtube.com/watch?v=k3Lm9QpX2aE&t=42s',
    'https://m.youtube.com/watch?feature=share&v=k3Lm9QpX2aE',
    'http://WWW.YouTube.com/watch?v=k3Lm9QpX2aE',
    'https://youtu.be/k3Lm9QpX2aE?si=suivi123',
    'https://www.youtube.com/shorts/k3Lm9QpX2aE?feature=share',
    '  youtu.be/k3Lm9QpX2aE  ',
  ])('%s donne la forme canonique', (lien) => {
    expect(parseYoutubeUrl(lien)).toEqual({ canonicalUrl: CANONIQUE, videoId: 'k3Lm9QpX2aE' });
  });

  test.each([
    ['https://vimeo.com/812345678', 'host'],
    ['https://youtube.com.exemple.fr/watch?v=k3Lm9QpX2aE', 'host'],
    ['https://faux-youtube.com/watch?v=k3Lm9QpX2aE', 'host'],
    ['https://www.youtube-nocookie.com/embed/k3Lm9QpX2aE', 'host'],
    ['https://music.youtube.com/watch?v=k3Lm9QpX2aE', 'host'],
    ['https://youtube.com@exemple.fr/watch?v=k3Lm9QpX2aE', 'host'],
    ['https://user:pw@www.youtube.com/watch?v=k3Lm9QpX2aE', 'host'],
    ['https://www.youtube.com:8443/watch?v=k3Lm9QpX2aE', 'host'],
    [['javascript', 'alert(1)'].join(':'), 'host'],
    ['ftp://youtube.com/watch?v=k3Lm9QpX2aE', 'host'],
    ['https://www.youtube.com/watch?v=k3Lm9QpX2a', 'incomplete'],
    ['https://www.youtube.com/watch?v=k3Lm9QpX2aEE', 'incomplete'],
    ['https://www.youtube.com/watch', 'incomplete'],
    ['https://youtu.be/', 'incomplete'],
    ['https://www.youtube.com/channel/UCabc', 'incomplete'],
    [`https://youtu.be/k3Lm9QpX2aE?x=${'a'.repeat(200)}`, 'host'],
  ])('%s est refusé (%s)', (lien, raison) => {
    expect(parseYoutubeUrl(lien)).toEqual({ error: raison });
  });

  test('vide ou null : pas de vidéo, pas d erreur', () => {
    expect(parseYoutubeUrl('')).toEqual({ empty: true });
    expect(parseYoutubeUrl('   ')).toEqual({ empty: true });
    expect(parseYoutubeUrl(null)).toEqual({ empty: true });
  });
});

describe('VIDEOCV — miniature et page du lecteur', () => {
  test('la miniature vient de i.ytimg.com (décision 1- A)', () => {
    expect(buildYoutubeThumbnailUrl('k3Lm9QpX2aE')).toBe('https://i.ytimg.com/vi/k3Lm9QpX2aE/hqdefault.jpg');
  });

  test('la page du lecteur vise youtube-nocookie et porte l origine FoundClub', () => {
    const page = buildYoutubeEmbedPage('k3Lm9QpX2aE');
    expect(YOUTUBE_PLAYER_ORIGIN).toBe('https://foundclub.app');
    expect(page).toContain("host: 'https://www.youtube-nocookie.com'");
    expect(page).toContain("videoId: 'k3Lm9QpX2aE'");
    expect(page).toContain("origin: 'https://foundclub.app'");
    expect(page).toContain('onError');
  });

  test('un ID hors forme ne s injecte jamais dans la page', () => {
    expect(() => buildYoutubeEmbedPage("x');alert(1);//")).toThrow();
  });
});
