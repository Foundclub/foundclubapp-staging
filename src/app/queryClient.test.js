import { QueryObserver } from '@tanstack/react-query';

import { BOOT_REQUEST_BLOCKED_CODE } from '@/services/bootRequestGuard';
import { buildRequestTimeoutAbandon } from '@/utils/errors/apiError';

import createFoundClubQueryClient, { shouldRetryQuery, shouldSkipMutationErrorAlert } from './queryClient';

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

  test('retente une panne réseau franche (aucun status)', () => {
    expect(shouldRetryQuery(0, { message: 'Network Error' })).toBe(true);
  });

  // PERF3 — TÉMOIN RETOURNÉ VOLONTAIREMENT (pas supprimé) : il exigeait le
  // comportement défaillant — retenter la chaîne nue de l'intercepteur comme une
  // panne réseau, soit 15+1+15+2+15 = 48 s et 3 requêtes par abandon. Un abandon
  // de 15 s ne se retente plus, sous AUCUNE de ses deux formes.
  test('ne retente JAMAIS un abandon de 15 s, objet de l\'intercepteur comme chaîne nue', () => {
    expect(shouldRetryQuery(
      0,
      buildRequestTimeoutAbandon({ code: 'ECONNABORTED' }),
    )).toBe(false);
    expect(shouldRetryQuery(0, 'Request timeout - please retry.')).toBe(false);
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

  // PERF3 — TÉMOIN RETOURNÉ VOLONTAIREMENT (conséquence de Q3, GO Adel 01/09) :
  // il exigeait DEUX reprises ; la politique n'en accorde plus qu'une.
  test('s\'arrête après UNE reprise même sur une erreur retentable', () => {
    expect(shouldRetryQuery(0, unwrappedStrapiError(500))).toBe(true);
    expect(shouldRetryQuery(1, unwrappedStrapiError(500))).toBe(false);
  });
});

/**
 * PERF3 — LE TÉMOIN QUI COMPTE LES APPELS RÉSEAU D'UNE LECTURE QUI ABANDONNE.
 *
 * La chaîne mesurée dans le code (2026-09-01) : l'intercepteur rejette un abandon
 * de 15 s SANS status exploitable, `getErrorStatus` rend `null`, et la politique
 * de reprise retente. Timeout 15 000 ms (client.native.js:26) + délais 1 s et 2 s
 * ⇒ 15+1+15+2+15 = 48 s d'attente et 3 requêtes, précisément quand le serveur
 * rame. Ce témoin monte la VRAIE politique (`createFoundClubQueryClient`) avec un
 * `queryFn` qui compte, comme queryRefreshOnReturn.test.js:211.
 */
describe('PERF3 — une lecture qui abandonne ne repart PAS au réseau', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Monte une lecture avec la politique de reprise RÉELLE de l'app et la fait
   * échouer avec l'erreur donnée. Rend le nombre d'appels réseau partis.
   * @param {unknown} abandonError L'erreur rejetée par le client HTTP.
   * @returns {Promise<number>} Le nombre d'invocations du queryFn.
   */
  const countNetworkCalls = async (abandonError) => {
    const queryClient = createFoundClubQueryClient();
    const queryFn = jest.fn().mockRejectedValue(abandonError);
    const observer = new QueryObserver(queryClient, {
      queryFn,
      queryKey: ['perf3', 'lecture-qui-abandonne'],
    });
    const unsubscribe = observer.subscribe(() => {});
    await jest.runAllTimersAsync();
    unsubscribe();
    queryClient.clear();
    return queryFn.mock.calls.length;
  };

  test('UN SEUL appel pour un abandon de 15 s (forme historique : la chaîne nue)', async () => {
    // La valeur que rejetaient client.native.js / client.web.js sur un timeout
    // avant ce lot : une chaîne, sans status, sans config, sans headers.
    expect(await countNetworkCalls('Request timeout - please retry.')).toBe(1);
  });

  test('UN SEUL appel pour un abandon de 15 s (forme actuelle : l\'objet de l\'intercepteur)', async () => {
    expect(await countNetworkCalls(
      buildRequestTimeoutAbandon({ code: 'ECONNABORTED' }),
    )).toBe(1);
  });

  test('DEUX appels — une seule reprise — pour une panne réseau franche', async () => {
    // Q3 (GO Adel 01/09) : 1 reprise au lieu de 2. Ce qu'on perd : une
    // micro-coupure passagère se rattrape moins souvent toute seule.
    expect(await countNetworkCalls({ message: 'Network Error' })).toBe(2);
  });
});

// Un seul message par geste. Mesuré le 2026-08-01 : 14 écrans / 22 mutations ouvrent la
// feuille de vente ET recevaient en plus l'alerte générique de ce filet global.
describe('shouldSkipMutationErrorAlert', () => {
  const mutationWithMeta = (meta) => ({ options: { meta } });

  const subscriptionDenial = {
    details: {
      code: 'SUBSCRIPTION_PERMISSION_DENIED',
      decision: {
        allowed: false,
        paywall: 'CLUB_ROLES_MANAGE_REQUIRED',
        reason: 'SUBSCRIPTION_REQUIRED',
        requiredPlan: ['CLUB'],
      },
    },
    message: 'Cette fonctionnalite necessite une offre FoundClub active.',
    status: 403,
  };

  test('se tait quand l\'erreur porte une décision d\'abonnement exploitable', () => {
    expect(shouldSkipMutationErrorAlert(
      subscriptionDenial,
      mutationWithMeta(undefined),
    )).toBe(true);
  });

  test('se tait aussi quand la décision est déjà remontée à plat par un service', () => {
    expect(shouldSkipMutationErrorAlert(
      { decision: subscriptionDenial.details.decision, message: 'Failed to create trainer' },
      mutationWithMeta(undefined),
    )).toBe(true);
  });

  test('parle toujours sur un 403 de DROITS, qui n\'a aucune décision à montrer', () => {
    expect(shouldSkipMutationErrorAlert(
      { details: {}, message: 'Forbidden', status: 403 },
      mutationWithMeta(undefined),
    )).toBe(false);
  });

  test('parle toujours sur une panne réseau', () => {
    expect(shouldSkipMutationErrorAlert(
      { message: 'Network Error' },
      mutationWithMeta(undefined),
    )).toBe(false);
  });

  test('respecte le drapeau existant meta.preventToastError', () => {
    expect(shouldSkipMutationErrorAlert(
      { message: 'Network Error' },
      mutationWithMeta({ preventToastError: true }),
    )).toBe(true);
  });
});
