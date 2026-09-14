import { getUserCurrentLicense } from '@/services/license/licenseService';

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: jest.fn() }));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));
jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: () => 'https://api.test' }));

// eslint-disable-next-line import/first -- le mock doit etre pose AVANT l import du client.
import client from '@/services/client';

/**
 * LICENCE404 — « aucune licence » est un ÉTAT, pas une panne.
 *
 * Constat (lot VA1, 14/09) : 7 événements Sentry `404 licenses/users/:id/current`
 * sur la fiche d'une personne. Le serveur répond 404 quand la personne n'a pas de
 * licence : le lot SENTRY4 l'a volontairement gardé en 404 (un 200 vide aurait
 * affiché une carte « Licence » vide). Côté app, la requête passait alors en
 * erreur et partait à Sentry, alors que l'écran (`UserDetails.js`) n'affiche
 * simplement pas de carte.
 *
 * ⇒ Même motif que le carnet d'entraînement (`trainingService.js`) : le service
 * connaît le contrat, un 404 devient « pas de licence » (`null`). Une panne réseau
 * ou un 500 continuent de remonter.
 */
describe('La licence courante d une personne qui n en a pas', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  test('un 404 « License assignment not found » rend null, sans erreur', async () => {
    client.get.mockRejectedValue({
      response: {
        data: { error: { message: 'License assignment not found', status: 404 } },
        status: 404,
      },
      status: 404,
    });

    await expect(getUserCurrentLicense('u1')).resolves.toBeNull();
  });

  test('un 404 déballé par l intercepteur (status à la racine seulement) rend null', async () => {
    client.get.mockRejectedValue({ status: 404 });

    await expect(getUserCurrentLicense('u1')).resolves.toBeNull();
  });

  test('un 500 continue de remonter', async () => {
    const panne = { response: { status: 500 }, status: 500 };
    client.get.mockRejectedValue(panne);

    await expect(getUserCurrentLicense('u1')).rejects.toBe(panne);
  });

  test('une licence existante est rendue telle quelle', async () => {
    client.get.mockResolvedValue({ data: { data: { documentId: 'lic-1' } } });

    await expect(getUserCurrentLicense('u1')).resolves.toEqual({ documentId: 'lic-1' });
  });
});
