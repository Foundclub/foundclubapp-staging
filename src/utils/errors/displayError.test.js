const mockExists = jest.fn();
const mockTranslate = jest.fn();

jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    exists: (...args) => mockExists(...args),
    t: (...args) => mockTranslate(...args),
  },
}));

const { getErrorMessage } = require('./displayError');

describe('displayError', () => {
  beforeEach(() => {
    const knownKeys = new Set([
      'APIerrors.AUTHENTICATION_FAILED',
      'APIerrors.FORBIDDEN',
      'APIerrors.generic',
      'APIerrors.INTERNAL_SERVER_ERROR',
      'APIerrors.OTP_ERROR',
      'APIerrors.Request failed with status code 404',
      'APIerrors.schemaMismatch',
      'APIerrors.SUBSCRIPTION_PERMISSION_DENIED',
      'APIerrors.UNAUTHORIZED',
    ]);

    mockExists.mockImplementation((key) => knownKeys.has(key));
    mockTranslate.mockImplementation((key) => `translated:${key}`);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('uses translated error code when present in details', () => {
    const result = getErrorMessage({
      details: { code: 'AUTHENTICATION_FAILED' },
      message: 'Firebase authentication failed',
    });

    expect(result).toBe('translated:APIerrors.AUTHENTICATION_FAILED');
  });

  test('maps 403 transport errors to forbidden', () => {
    const result = getErrorMessage('Request failed with status code 403');

    expect(result).toBe('translated:APIerrors.FORBIDDEN');
  });

  test('maps known raw backend permission errors to forbidden', () => {
    const result = getErrorMessage('Only club managers can process facility override requests');

    expect(result).toBe('translated:APIerrors.FORBIDDEN');
  });

  test('extracts nested detail errors without losing status mapping', () => {
    const result = getErrorMessage({
      response: {
        data: {
          details: {
            error: 'Only club managers can process facility override requests',
          },
        },
        status: 403,
      },
    });

    expect(result).toBe('translated:APIerrors.FORBIDDEN');
  });

  // Le filet global court-circuitait sur le STATUT : tout 403 devenait « Accès refusé. »
  // avant même que le code du serveur soit lu. Un refus payant perdait donc son motif, et
  // l'utilisateur ne pouvait pas comprendre qu'il s'agissait d'un abonnement, pas d'un droit.
  test('un code explicite du serveur bat le statut HTTP 403', () => {
    const result = getErrorMessage({
      details: {
        code: 'SUBSCRIPTION_PERMISSION_DENIED',
        decision: { paywall: 'CLUB_ROLES_MANAGE_REQUIRED', requiredPlan: ['CLUB'] },
      },
      message: 'Cette fonctionnalite necessite une offre FoundClub active.',
      status: 403,
    });

    expect(result).toBe('translated:APIerrors.SUBSCRIPTION_PERMISSION_DENIED');
  });

  test('un 403 sans code connu reste « accès refusé »', () => {
    const result = getErrorMessage({
      details: { code: 'UNKNOWN_SERVER_CODE' },
      message: 'Forbidden',
      status: 403,
    });

    expect(result).toBe('translated:APIerrors.FORBIDDEN');
  });

  test('falls back to generic message for technical unknown errors', () => {
    const result = getErrorMessage('Cannot read properties of undefined (reading \'message\')');

    expect(result).toBe('translated:APIerrors.generic');
  });
});
