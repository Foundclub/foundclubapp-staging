import client from '@/services/client';

import { lireMesReservations, repondreALaVeille } from '../complexeJoueurService';

// RESA-L6B-1 (19/10/2026) — les deux routes du joueur que le serveur RESA-L2B sert déjà
// (admin `origin/feat/RESA-admin` 28b8490f, `src/api/complexe/routes/reservation-custom.ts`,
// `protection-custom.ts`) : « Mes réservations » (E-P10) par période, et la réponse à la question
// de la veille (E-P14, N-20).

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const mockClient = /** @type {any} */ (client);

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.get.mockResolvedValue({ data: { data: [] } });
  mockClient.post.mockResolvedValue({ data: { data: { documentId: 'r-1' } } });
});

describe('RESA-L6B-1 — E-P10 et E-P14, côté service', () => {
  it('mes réservations : GET /reservations-terrain/mine?periode=…', async () => {
    const corps = await lireMesReservations('passees');
    expect(mockClient.get).toHaveBeenCalledWith('/reservations-terrain/mine', {
      params: { periode: 'passees' },
    });
    expect(corps).toEqual({ data: [] });
  });

  it('la veille : POST /reservations-terrain/:id/veille { data: { reponse } }', async () => {
    await repondreALaVeille('r 1', 'confirme');
    expect(mockClient.post).toHaveBeenCalledWith(
      '/reservations-terrain/r%201/veille',
      { data: { reponse: 'confirme' } },
      undefined,
    );
  });

  it('depuis le bouton d’une notification : le jeton du compte visé part aussi', async () => {
    await repondreALaVeille('r-1', 'annule', { jeton: 'jeton-du-compte' });
    expect(mockClient.post).toHaveBeenCalledWith(
      '/reservations-terrain/r-1/veille',
      { data: { reponse: 'annule' } },
      { headers: { Authorization: 'Bearer jeton-du-compte' } },
    );
  });
});
