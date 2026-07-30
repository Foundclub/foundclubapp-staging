import { BOOT_REQUEST_BLOCKED_CODE } from '@/services/bootRequestGuard';

import { shouldRetryQuery } from './queryClient';

// L'intercepteur de réponse des clients HTTP (client.native.js:83, client.web.js:81)
// REJETTE la charge déballée `error.response.data.error`, pas l'erreur axios.
// Une erreur applicative Strapi arrive donc ici SANS `isAxiosError` et SANS
// `response` : seulement `{ status, name, message, details }`.
// Mesure du 2026-07-29 sur staging : chaque 401/403 partait 3 fois
// (1 appel + 2 retentatives espacées de 1,13 s et 2,07 s), exactement le
// retryDelay par défaut, parce que cette forme d'erreur retombait dans la
// branche « pas une erreur axios => on retente ».
const unwrappedStrapiError = (status, overrides = {}) => ({
  message: 'Forbidden',
  name: 'ForbiddenError',
  status,
  ...overrides,
});

const axiosError = (status, method = 'get') => ({
  config: { method, url: '/notifications/count-unread' },
  isAxiosError: true,
  response: { status },
});

describe('shouldRetryQuery', () => {
  test('ne retente JAMAIS une erreur applicative 4xx déballée par l\'intercepteur', () => {
    [400, 401, 403, 404, 409, 422, 429].forEach((status) => {
      expect(shouldRetryQuery(0, unwrappedStrapiError(status))).toBe(false);
    });
  });

  test('ne retente pas non plus ces mêmes 4xx sous forme d\'erreur axios brute', () => {
    [400, 401, 403, 404, 429].forEach((status) => {
      expect(shouldRetryQuery(0, axiosError(status))).toBe(false);
    });
  });

  test('retente les 408 / 425 et les 5xx, dans les deux formes', () => {
    expect(shouldRetryQuery(0, unwrappedStrapiError(408))).toBe(true);
    expect(shouldRetryQuery(0, unwrappedStrapiError(425))).toBe(true);
    expect(shouldRetryQuery(0, unwrappedStrapiError(500))).toBe(true);
    expect(shouldRetryQuery(0, unwrappedStrapiError(503))).toBe(true);
    expect(shouldRetryQuery(0, axiosError(500))).toBe(true);
  });

  test('retente une panne réseau (aucun status)', () => {
    expect(shouldRetryQuery(0, { message: 'Network Error' })).toBe(true);
    expect(shouldRetryQuery(0, 'Request timeout - please retry.')).toBe(true);
  });

  test('ne retente jamais un appel rejeté localement par le garde de démarrage', () => {
    // status 0 : sans ce cas, `!status` renvoie true et le garde serait
    // contourné 3 fois de suite au lieu d\'une.
    expect(shouldRetryQuery(0, {
      code: BOOT_REQUEST_BLOCKED_CODE,
      details: { retryAfterSeconds: 5 },
      status: 0,
    })).toBe(false);
  });

  test('ne retente jamais une mutation, quelle que soit la forme de l\'erreur', () => {
    expect(shouldRetryQuery(0, axiosError(500, 'post'))).toBe(false);
    expect(shouldRetryQuery(0, unwrappedStrapiError(500, {
      config: { method: 'post' },
    }))).toBe(false);
  });

  test('s\'arrête au bout de 2 échecs même sur une erreur retentable', () => {
    expect(shouldRetryQuery(1, unwrappedStrapiError(500))).toBe(true);
    expect(shouldRetryQuery(2, unwrappedStrapiError(500))).toBe(false);
  });
});
