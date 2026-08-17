// @ts-nocheck
/**
 * app/src/platform/visualRender/__tests__/visualRender.web.test.js
 *
 * T04 (E6) — `visualRender.web.js` n'avait AUCUN test, et c'est le fichier le
 * plus dangereux du lot : il est compilé par VITE, pas par Metro. Une erreur
 * ici ne casse RIEN dans `app` — aucune porte de `app` ne la verrait — et
 * tombe seulement sur le site en ligne.
 *
 * Ce qui est mocké : la frontière plateforme uniquement (jeton, URL d'API, le
 * `document` du navigateur). Le vrai chemin base64 → Blob → <a download> est
 * donc réellement exécuté.
 */

import { downloadAndShareRender } from '../visualRender.web';

jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: () => ({ token: 'jeton' }) }));

jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: () => 'https://api.test.foundclub/api' }));

const PARAMS = {
  format: 'post',
  subjectId: 'club-1',
  subjectType: 'club',
  template: 'affiche-club',
  variant: 'ecusson',
};

/** « ABCDEFGHIJ » en base64 : 10 octets une fois décodés. */
const OCTETS_B64 = 'QUJDREVGR0hJSg==';

/** @type {any} */
let lienCree = null;

beforeEach(() => {
  jest.clearAllMocks();
  lienCree = null;
  global.fetch = jest.fn();
  global.URL.createObjectURL = jest.fn(() => 'blob:objet-1');
  global.URL.revokeObjectURL = jest.fn();
  global.document = {
    body: { appendChild: jest.fn(), removeChild: jest.fn() },
    createElement: () => {
      lienCree = { click: jest.fn() };
      return lienCree;
    },
  };
});

afterEach(() => { delete global.document; });

describe('T04 — sur le web aussi, les octets déjà à l écran ne sont pas redemandés', () => {
  it('🔒 avec l affiche déjà en main, AUCUN appel au serveur', async () => {
    await downloadAndShareRender({
      ...PARAMS, cachedBase64: OCTETS_B64, cachedContentType: 'image/png',
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(lienCree.click).toHaveBeenCalledTimes(1);
  });

  // 🧨 LE PIÈGE DE CETTE VERSION : sur le web, il faut RECONSTRUIRE un Blob
  // depuis le base64. Se tromper produit un fichier vide ou corrompu, et le
  // navigateur le télécharge quand même — sans la moindre erreur.
  it('🔒 le fichier téléchargé porte les VRAIS octets, et le bon type', async () => {
    await downloadAndShareRender({
      ...PARAMS, cachedBase64: OCTETS_B64, cachedContentType: 'image/png',
    });

    const blob = global.URL.createObjectURL.mock.calls[0][0];
    expect(blob.size).toBe(10);
    expect(blob.type).toBe('image/png');
    expect(await blob.text()).toBe('ABCDEFGHIJ');
  });

  it('le nom du fichier suit le type des octets tendus (pdf, pas png)', async () => {
    await downloadAndShareRender({
      ...PARAMS, cachedBase64: 'JVBERi0=', cachedContentType: 'application/pdf', format: 'a4',
    });

    expect(lienCree.download).toBe('foundclub-affiche-club-ecusson-a4-club-1.pdf');
  });

  // 🔒 LE PENDANT INDISPENSABLE : sans octets tendus, le serveur est appelé.
  // Sans ce témoin, une régression qui avalerait `cachedBase64` à tort ferait
  // télécharger un fichier VIDE, en silence.
  it('🔒 sans octets en main, le serveur est appelé comme avant', async () => {
    global.fetch.mockResolvedValue({
      blob: async () => new Blob(['png'], { type: 'image/png' }),
      headers: { get: () => 'image/png' },
      ok: true,
    });

    await downloadAndShareRender(PARAMS);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0])
      .toBe('https://api.test.foundclub/api/visual-assets/render');
  });
});
