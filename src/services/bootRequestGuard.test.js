import {
  assertBootRequestAllowed,
  BOOT_REQUEST_BLOCKED_CODE,
  getBootRequestGuardSnapshot,
  getRetryAfterSeconds,
  recordBootRequestFailure,
  recordBootRequestSuccess,
  resetBootRequestGuard,
} from './bootRequestGuard';

const BOOT_PATH = '/app/bootstrap';
const ME_PATH = '/firebase-auth/me';

const networkFailure = (url, overrides = {}) => ({
  config: { method: 'get', url },
  message: 'Network Error',
  ...overrides,
});

const failNTimes = (url, count) => {
  for (let index = 0; index < count; index += 1) {
    recordBootRequestFailure(networkFailure(url));
  }
};

describe('bootRequestGuard', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-07-20T10:00:00Z') });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    resetBootRequestGuard();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('laisse passer les requêtes tant que le circuit est fermé', () => {
    expect(() => assertBootRequestAllowed({ method: 'get', url: BOOT_PATH })).not.toThrow();
    failNTimes(BOOT_PATH, 4);
    expect(() => assertBootRequestAllowed({ method: 'get', url: BOOT_PATH })).not.toThrow();
  });

  test('ouvre le circuit après 5 échecs réseau dans la fenêtre', () => {
    failNTimes(BOOT_PATH, 5);

    let thrown;
    try {
      assertBootRequestAllowed({ method: 'get', url: BOOT_PATH });
    } catch (error) {
      thrown = error;
    }

    expect(thrown?.isBootRequestBlocked).toBe(true);
    expect(thrown?.response?.data?.error?.code).toBe(BOOT_REQUEST_BLOCKED_CODE);
    expect(thrown?.response?.data?.error?.details?.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('le circuit ne bloque que le chemin en rafale, pas l\'autre endpoint', () => {
    failNTimes(BOOT_PATH, 5);
    expect(() => assertBootRequestAllowed({ method: 'get', url: ME_PATH })).not.toThrow();
  });

  test('se referme après le délai puis double le délai à la réouverture (plafonné)', () => {
    failNTimes(BOOT_PATH, 5);
    const firstOpenUntil = getBootRequestGuardSnapshot()[BOOT_PATH].openUntil;
    expect(firstOpenUntil - Date.now()).toBe(5000);

    jest.setSystemTime(firstOpenUntil + 1);
    expect(() => assertBootRequestAllowed({ method: 'get', url: BOOT_PATH })).not.toThrow();

    failNTimes(BOOT_PATH, 5);
    const secondOpenUntil = getBootRequestGuardSnapshot()[BOOT_PATH].openUntil;
    expect(secondOpenUntil - Date.now()).toBe(10000);
  });

  test('respecte le retryAfterSeconds du serveur quand il dépasse le backoff local', () => {
    for (let index = 0; index < 5; index += 1) {
      recordBootRequestFailure({
        config: { method: 'get', url: BOOT_PATH },
        response: {
          data: { error: { details: { retryAfterSeconds: 120 } } },
          status: 429,
        },
      });
    }

    const { openUntil } = getBootRequestGuardSnapshot()[BOOT_PATH];
    expect(openUntil - Date.now()).toBe(120000);
  });

  test('les échecs hors fenêtre de 10s ne comptent plus', () => {
    failNTimes(BOOT_PATH, 4);
    jest.setSystemTime(Date.now() + 11000);
    failNTimes(BOOT_PATH, 4);
    expect(() => assertBootRequestAllowed({ method: 'get', url: BOOT_PATH })).not.toThrow();
  });

  test('ignore les erreurs applicatives (4xx hors 429) et les autres endpoints', () => {
    for (let index = 0; index < 10; index += 1) {
      recordBootRequestFailure({
        config: { method: 'get', url: BOOT_PATH },
        response: { status: 404 },
      });
      recordBootRequestFailure(networkFailure('/firebase-auth/me/pending-match-stats'));
      recordBootRequestFailure(networkFailure('/notifications/count-unread'));
    }

    expect(() => assertBootRequestAllowed({ method: 'get', url: BOOT_PATH })).not.toThrow();
    expect(() => assertBootRequestAllowed({ method: 'get', url: ME_PATH })).not.toThrow();
  });

  test('ne compte pas ses propres rejets de circuit comme des échecs', () => {
    failNTimes(BOOT_PATH, 5);
    let thrown;
    try {
      assertBootRequestAllowed({ method: 'get', url: BOOT_PATH });
    } catch (error) {
      thrown = error;
    }
    recordBootRequestFailure(thrown);

    const { failureCount, openCount } = getBootRequestGuardSnapshot()[BOOT_PATH];
    expect(openCount).toBe(1);
    expect(failureCount).toBe(0);
  });

  test('un succès réarme complètement le circuit', () => {
    failNTimes(BOOT_PATH, 5);
    const { openUntil } = getBootRequestGuardSnapshot()[BOOT_PATH];
    jest.setSystemTime(openUntil + 1);

    recordBootRequestSuccess({ method: 'get', url: BOOT_PATH });
    failNTimes(BOOT_PATH, 5);
    // openCount repart de zéro : le nouveau délai est le délai de base.
    const reopened = getBootRequestGuardSnapshot()[BOOT_PATH];
    expect(reopened.openUntil - Date.now()).toBe(5000);
  });

  test('ne confond pas les URLs absolues préfixées /api avec les chemins du client', () => {
    for (let index = 0; index < 5; index += 1) {
      recordBootRequestFailure(
        networkFailure('https://api-staging.foundclubpro.com/api/app/bootstrap?platform=web'),
      );
    }

    // Le chemin gardé est normalisé sans l'origine ni la query — mais le
    // baseURL /api n'est pas retiré : ce cas ne doit PAS être bloqué ici
    // puisque le client app envoie des URLs relatives ('/app/bootstrap').
    expect(getBootRequestGuardSnapshot()['/api/app/bootstrap']).toBeUndefined();
    expect(() => assertBootRequestAllowed({ method: 'get', url: BOOT_PATH })).not.toThrow();
  });

  test('getRetryAfterSeconds lit les deux formes d\'erreur', () => {
    expect(getRetryAfterSeconds({ details: { retryAfterSeconds: 42 } })).toBe(42);
    expect(getRetryAfterSeconds({
      response: { data: { error: { details: { retryAfterSeconds: 7 } } } },
    })).toBe(7);
    expect(getRetryAfterSeconds({ details: { retryAfterSeconds: 'abc' } })).toBe(0);
    expect(getRetryAfterSeconds(undefined)).toBe(0);
  });
});
