import { getCompositionPlayerAvatarUrl } from '../compositionPlayer';
import { getImageUrl } from '../imageUrl';
import { getImageUrl as getImageUrlWeb } from '../imageUrl.web';

// AE04 — FILET (E6) DU PLANTAGE DU TUNNEL DE CREATION D'UN MATCH.
//
// 🧨 LE CONSTAT D'ADEL (emulateur, 2026-08-22) : a l'etape Participants du
// tunnel, l'ecran meurt en « Render Error : url.startsWith is not a function
// (it is undefined) » des qu'UN joueur de l'equipe a une photo. Un joueur SANS
// photo passe. Le message ment sur la cause : `url` n'est pas `undefined` — la
// garde `if (!url)` l'aurait arrete —, c'est l'OBJET media de Strapi entier
// ({ url, formats, ... }), qui n'a pas de methode `startsWith`.
//
// 🕳️ POURQUOI CE FICHIER EXISTE : `imageUrl.js` n'avait AUCUN test, et 40
// fichiers importent ce module (mesure du 2026-08-22 ; le commentaire D49 en
// pied de `imageUrl.js` en annonce 21, chiffre devenu faux). Poser la garde a
// la FRONTIERE protege les 40 d'un coup — mais sans filet, personne ne verrait
// qu'on a change au passage le comportement des chemins existants.
//
// ⚠️ LE JUMEAU `imageUrl.web.js` a la MEME faille et n'avait pas de test non
// plus : le temoin 3 le charge PAR SON CHEMIN, parce que le preset
// react-native de Jest resout `../imageUrl` sur la variante native.
//
// Les origines sont injectees par ce mock, jamais via `process.env` :
// babel-plugin-inline-dotenv fige chaque lecture litterale et neutralise
// `delete process.env.X`. La chaine env -> origines est deja couverte par
// `src/config/runtimeUrls.shared.test.js`.
jest.mock('@/config/runtimeUrls', () => ({
  getPublicApiOrigin: jest.fn(() => ''),
}));

const { getPublicApiOrigin } = jest.requireMock('@/config/runtimeUrls');

/** L'objet media tel que Strapi 5 le rend sur `user.avatar`. */
const MEDIA_STRAPI = {
  formats: { thumbnail: { url: '/uploads/thumbnail_a.jpg', width: 156 } },
  id: 12,
  mime: 'image/jpeg',
  name: 'a.jpg',
  url: '/uploads/a.jpg',
};

beforeEach(() => {
  jest.clearAllMocks();
  getPublicApiOrigin.mockReturnValue('');
});

describe('AE04 · témoin 1 — les comportements actuels de imageUrl ne bougent pas', () => {
  it('rend `undefined` sur tout ce qui est vide', () => {
    expect(getImageUrl(undefined)).toBeUndefined();
    expect(getImageUrl(null)).toBeUndefined();
    expect(getImageUrl('')).toBeUndefined();
  });

  it("aligne `http://localhost` sur l'hôte du runtime, port compris", () => {
    getPublicApiOrigin.mockReturnValue('http://10.0.2.2:4444');
    expect(getImageUrl('http://localhost:4444/uploads/a.jpg'))
      .toBe('http://10.0.2.2:4444/uploads/a.jpg');
  });

  it('laisse `http://localhost` tel quel quand le runtime est déjà localhost', () => {
    getPublicApiOrigin.mockReturnValue('http://localhost:4444');
    expect(getImageUrl('http://localhost:4444/uploads/a.jpg'))
      .toBe('http://localhost:4444/uploads/a.jpg');
  });

  it("bascule `https://localhost` en http sur l'hôte du runtime", () => {
    getPublicApiOrigin.mockReturnValue('http://10.0.2.2:4444');
    expect(getImageUrl('https://localhost:4444/uploads/a.jpg'))
      .toBe('http://10.0.2.2:4444/uploads/a.jpg');
  });

  it("bascule `https://localhost` en http quand aucune origine n'est connue", () => {
    expect(getImageUrl('https://localhost:4444/uploads/a.jpg'))
      .toBe('http://localhost:4444/uploads/a.jpg');
  });

  it("préfixe une URL relative par l'origine de l'API", () => {
    getPublicApiOrigin.mockReturnValue('http://10.0.2.2:4444');
    expect(getImageUrl('/uploads/a.jpg')).toBe('http://10.0.2.2:4444/uploads/a.jpg');
  });

  it('rend une URL absolue distante telle quelle', () => {
    getPublicApiOrigin.mockReturnValue('http://10.0.2.2:4444');
    expect(getImageUrl('https://cdn.foundclub.fr/a.jpg')).toBe('https://cdn.foundclub.fr/a.jpg');
  });
});

describe('AE04 · témoin 2 — un objet media ne fait plus planter imageUrl', () => {
  it("ne jette pas sur l'objet media de Strapi — c'est LE plantage du tunnel", () => {
    expect(() => getImageUrl(MEDIA_STRAPI)).not.toThrow();
    expect(getImageUrl(MEDIA_STRAPI)).toBeUndefined();
  });

  it('ne jette pas sur un objet media réduit à son `url`', () => {
    expect(() => getImageUrl({ url: '/uploads/a.jpg' })).not.toThrow();
    expect(getImageUrl({ url: '/uploads/a.jpg' })).toBeUndefined();
  });

  it('ne jette pas sur un nombre', () => {
    expect(() => getImageUrl(42)).not.toThrow();
    expect(getImageUrl(42)).toBeUndefined();
  });

  it('ne jette pas sur un tableau', () => {
    expect(() => getImageUrl(['/uploads/a.jpg'])).not.toThrow();
    expect(getImageUrl(['/uploads/a.jpg'])).toBeUndefined();
  });
});

describe('AE04 · témoin 3 — le jumeau web tient la même garde', () => {
  it('rend `undefined` sur tout ce qui est vide', () => {
    expect(getImageUrlWeb(undefined)).toBeUndefined();
    expect(getImageUrlWeb(null)).toBeUndefined();
    expect(getImageUrlWeb('')).toBeUndefined();
  });

  it('rend toute URL http(s) telle quelle — y compris localhost', () => {
    getPublicApiOrigin.mockReturnValue('https://api.foundclub.fr');
    expect(getImageUrlWeb('https://cdn.foundclub.fr/a.jpg')).toBe('https://cdn.foundclub.fr/a.jpg');
    expect(getImageUrlWeb('http://localhost:4444/uploads/a.jpg'))
      .toBe('http://localhost:4444/uploads/a.jpg');
  });

  it("préfixe une URL relative par l'origine de l'API", () => {
    getPublicApiOrigin.mockReturnValue('https://api.foundclub.fr');
    expect(getImageUrlWeb('/uploads/a.jpg')).toBe('https://api.foundclub.fr/uploads/a.jpg');
  });

  it("rend telle quelle une valeur qui n'est ni http ni relative", () => {
    expect(getImageUrlWeb('a.jpg')).toBe('a.jpg');
  });

  it('ne jette pas sur un objet media, un nombre ou un tableau', () => {
    expect(() => getImageUrlWeb(MEDIA_STRAPI)).not.toThrow();
    expect(getImageUrlWeb(MEDIA_STRAPI)).toBeUndefined();
    expect(() => getImageUrlWeb(42)).not.toThrow();
    expect(getImageUrlWeb(42)).toBeUndefined();
    expect(() => getImageUrlWeb(['/uploads/a.jpg'])).not.toThrow();
    expect(getImageUrlWeb(['/uploads/a.jpg'])).toBeUndefined();
  });
});

describe("AE04 · témoin 4 — l'avatar d'un joueur de compo, string ou objet", () => {
  it("rend la string telle quelle — la forme « instantané » d'une compo", () => {
    expect(getCompositionPlayerAvatarUrl({ avatar: '/uploads/a.jpg' })).toBe('/uploads/a.jpg');
  });

  it('extrait `.url` de l\'objet media — la forme rendue par le serveur', () => {
    expect(getCompositionPlayerAvatarUrl({ avatar: MEDIA_STRAPI })).toBe('/uploads/a.jpg');
  });

  it("rend `undefined` quand le joueur n'a pas de photo", () => {
    expect(getCompositionPlayerAvatarUrl({ avatar: null })).toBeUndefined();
    expect(getCompositionPlayerAvatarUrl({})).toBeUndefined();
    expect(getCompositionPlayerAvatarUrl(null)).toBeUndefined();
    expect(getCompositionPlayerAvatarUrl(undefined)).toBeUndefined();
  });

  it("rend `undefined` quand l'objet media n'a pas d'`url`", () => {
    expect(getCompositionPlayerAvatarUrl({ avatar: { formats: {} } })).toBeUndefined();
    expect(getCompositionPlayerAvatarUrl({ avatar: 42 })).toBeUndefined();
  });
});
