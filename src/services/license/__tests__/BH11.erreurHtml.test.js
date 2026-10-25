import { submitLicenseDocument } from '@/services/license/licenseService';

jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: () => ({ token: 't' }) }));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));
jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: () => 'https://api.test' }));

/**
 * BH11 P2-20 — une page HTML d'erreur (413 / 502) ne doit pas remonter une
 * SyntaxError : l'utilisateur doit voir le code HTTP.
 */
describe('BH11 P2-20 — envoi d un document de licence', () => {
  test('une réponse HTML 413 donne une erreur avec le code HTTP', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 413,
      text: async () => '<html><body>Request Entity Too Large</body></html>',
    });
    await expect(submitLicenseDocument('a1', {})).rejects.toThrow('413');
  });
});
