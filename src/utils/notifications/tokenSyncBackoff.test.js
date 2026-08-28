import {
  classifyTokenSyncError,
  getBackoffDelayMs,
  getRetryAfterMs,
  TOKEN_SYNC_MAX_DELAY_MS,
} from './tokenSyncBackoff';

// FCMSTORM — la regle pure, controlee sans monter React.
// Elle tient en trois questions : de quelle nature est ce refus, le serveur
// a-t-il dit combien de temps attendre, et combien de temps attend-on.

/**
 * Erreur HTTP telle que la rend le client de l'app.
 * @param {number} status - Code HTTP.
 * @param {Record<string, any>} [headers] - En-tetes de la reponse.
 * @returns {any} - Erreur portant `status` et `response`.
 */
const erreurHttp = (status, headers = {}) => ({
  message: `HTTP ${status}`,
  response: { headers, status },
  status,
});

describe('classifyTokenSyncError — de quelle nature est ce refus', () => {
  it('401 et 403 sont des refus de DROIT : definitifs', () => {
    expect(classifyTokenSyncError(erreurHttp(401))).toBe('denied');
    expect(classifyTokenSyncError(erreurHttp(403))).toBe('denied');
  });

  it('429 est un « tu tapes trop vite » : on espace', () => {
    expect(classifyTokenSyncError(erreurHttp(429))).toBe('throttled');
  });

  it('une coupure reseau ou une panne serveur se reessaie', () => {
    expect(classifyTokenSyncError({ message: 'Network request failed' })).toBe('retryable');
    expect(classifyTokenSyncError(erreurHttp(502))).toBe('retryable');
    expect(classifyTokenSyncError(undefined)).toBe('retryable');
  });
});

describe('getRetryAfterMs — quand le serveur dit combien de temps attendre', () => {
  it('lit un Retry-After en secondes', () => {
    expect(getRetryAfterMs(erreurHttp(429, { 'retry-after': '30' }))).toBe(30000);
  });

  it('lit aussi la forme capitalisee, celle que renvoient certains proxys', () => {
    expect(getRetryAfterMs(erreurHttp(429, { 'Retry-After': '5' }))).toBe(5000);
  });

  it('lit un Retry-After ecrit en date HTTP', () => {
    const maintenant = Date.parse('2026-08-28T06:35:53.000Z');
    const dansDeuxMinutes = 'Fri, 28 Aug 2026 06:37:53 GMT';

    expect(getRetryAfterMs(erreurHttp(429, { 'retry-after': dansDeuxMinutes }), maintenant))
      .toBe(120000);
  });

  it('rend null quand le serveur n\'a rien dit', () => {
    expect(getRetryAfterMs(erreurHttp(429))).toBeNull();
    expect(getRetryAfterMs(erreurHttp(429, { 'retry-after': 'plus tard' }))).toBeNull();
  });
});

describe('getBackoffDelayMs — combien de temps se taire', () => {
  it('l\'attente DOUBLE a chaque essai', () => {
    expect(getBackoffDelayMs(1)).toBe(1000);
    expect(getBackoffDelayMs(2)).toBe(2000);
    expect(getBackoffDelayMs(3)).toBe(4000);
    expect(getBackoffDelayMs(4)).toBe(8000);
  });

  it('elle reste PLAFONNEE : doubler indefiniment ne sert personne', () => {
    expect(getBackoffDelayMs(30)).toBe(TOKEN_SYNC_MAX_DELAY_MS);
  });

  it('un Retry-After du serveur l\'emporte sur notre calcul', () => {
    expect(getBackoffDelayMs(1, 45000)).toBe(45000);
  });

  it('mais un Retry-After demesure est plafonne lui aussi', () => {
    expect(getBackoffDelayMs(1, 3600000)).toBe(TOKEN_SYNC_MAX_DELAY_MS);
  });
});
