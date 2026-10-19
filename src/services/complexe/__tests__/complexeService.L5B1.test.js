import client from '@/services/client';

import * as service from '../complexeService';

// RESA-L5B-1 (20/10/2026) — les routes du gérant ajoutées par RESA-L2B (source qui fait foi : admin
// `origin/feat/RESA-admin`, `src/api/complexe/routes/protection-custom.ts`) : marquer « non
// honorée » et annuler le marquage (le corps n'est pas lu par le serveur). Les doublures suivent ce
// fichier de routes : corps `{ data }`.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

const mockClient = /** @type {any} */ (client);
const geste = (/** @type {string} */ nom) => /** @type {any} */ (service)[nom];

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.get.mockResolvedValue({ data: { data: { documentId: 'u-julien' } } });
  mockClient.post.mockResolvedValue({ data: { data: { documentId: 'r-1' } } });
});

describe('RESA-L5B-1 — « non honorée » (E-G04, E-G05)', () => {
  it('marquer : POST …/non-honoree, le corps de la réponse', async () => {
    const reponse = await geste('marquerNonHonoree')('cx-five', 'r-1');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/complexes/cx-five/reservations/r-1/non-honoree',
      {},
    );
    expect(reponse).toEqual({ data: { documentId: 'r-1' } });
  });

  it('annuler le marquage : POST …/non-honoree/annuler', async () => {
    await geste('annulerNonHonoree')('cx-five', 'r-1');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/complexes/cx-five/reservations/r-1/non-honoree/annuler',
      {},
    );
  });

  it('les identifiants sont encodés dans l’adresse', async () => {
    await geste('marquerNonHonoree')('cx five', 'r/1');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/complexes/cx%20five/reservations/r%2F1/non-honoree',
      {},
    );
  });
});
