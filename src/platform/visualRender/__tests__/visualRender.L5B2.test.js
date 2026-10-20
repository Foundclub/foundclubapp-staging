// @ts-nocheck
/**
 * RESA-L5B-2 (20/10/2026) — l'affiche d'un COMPLEXE (E-G13) réutilise le moteur d'affiches de
 * l'app : sa route est la sienne (`POST /complexes/:id/affiche`, corps `{ data: { texte, … } }`,
 * serveur RESA-L4), pas `/visual-assets/render`. Deux paramètres FACULTATIFS, `path` et `body`,
 * la visent ; sans eux, la requête est exactement celle d'avant (les affiches de club et
 * d'événement ne changent pas).
 */

import ReactNativeBlobUtil from 'react-native-blob-util';

import { fetchRenderBase64 as natif } from '../visualRender.native';
import { fetchRenderBase64 as web } from '../visualRender.web';

jest.mock('react-native', () => ({
  PermissionsAndroid: { PERMISSIONS: {}, request: jest.fn(), RESULTS: {} },
  Platform: { OS: 'ios', Version: 34 },
  Share: { share: jest.fn() },
}));
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { fetch: jest.fn(), fs: { dirs: { CacheDir: '/data/cache' }, writeFile: jest.fn() } },
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn() },
}));
jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: () => ({ token: 'jeton' }) }));
jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: () => 'https://api.test.foundclub/api' }));

const AFFICHE = {
  body: {
    data: {
      apercu: true, format: 'post', style: 'ecusson', texte: 'neutre',
    },
  },
  path: '/complexes/cx-five/affiche',
};
const CLUB = {
  format: 'post', subjectId: 'club-1', subjectType: 'club', template: 'affiche-club',
};

beforeEach(() => {
  jest.clearAllMocks();
  ReactNativeBlobUtil.fetch.mockResolvedValue({
    base64: () => 'QUJD',
    info: () => ({ headers: { 'Content-Type': 'image/png' }, status: 200 }),
  });
  global.fetch = jest.fn().mockResolvedValue({
    blob: async () => ({}),
    headers: { get: () => 'image/png' },
    ok: true,
  });
  global.FileReader = class {
    readAsDataURL() {
      this.result = 'data:image/png;base64,QUJD';
      this.onloadend();
    }
  };
});

describe('RESA-L5B-2 — le moteur d’affiches vise la route de l’affiche du complexe', () => {
  it('natif : `path` et `body` donnés, la requête va à la route du complexe', async () => {
    await natif(AFFICHE);
    expect(ReactNativeBlobUtil.fetch).toHaveBeenCalledWith(
      'POST',
      'https://api.test.foundclub/api/complexes/cx-five/affiche',
      expect.objectContaining({ Authorization: 'Bearer jeton' }),
      JSON.stringify(AFFICHE.body),
    );
  });

  it('natif : sans eux, la requête d’avant (affiche de club)', async () => {
    await natif(CLUB);
    const [, adresse, , corps] = ReactNativeBlobUtil.fetch.mock.calls[0];
    expect(adresse).toBe('https://api.test.foundclub/api/visual-assets/render');
    expect(JSON.parse(corps)).toEqual({
      format: 'post', subjectId: 'club-1', subjectType: 'club', template: 'affiche-club',
    });
  });

  it('site : `path` et `body` donnés, la requête va à la route du complexe', async () => {
    await web(AFFICHE);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.test.foundclub/api/complexes/cx-five/affiche',
      expect.objectContaining({ body: JSON.stringify(AFFICHE.body), method: 'POST' }),
    );
  });

  it('site : sans eux, la requête d’avant (affiche de club)', async () => {
    await web(CLUB);
    const [adresse, options] = global.fetch.mock.calls[0];
    expect(adresse).toBe('https://api.test.foundclub/api/visual-assets/render');
    expect(JSON.parse(options.body)).toEqual({
      format: 'post', subjectId: 'club-1', subjectType: 'club', template: 'affiche-club',
    });
  });
});
