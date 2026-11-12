import client from '@/services/client';

import { modifierMesOptions } from '../complexeJoueurService';

// RESA-OPTIONS-2 (12/11/2026) — « Modifier les options » : PUT /reservations-terrain/:id/options,
// la liste ENTIÈRE `{ data: { options: [{ id, quantity }] } }`
// (admin fix/RESA-OPTIONS-2-admin c9e15148).

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { put: jest.fn() },
}));

const mockClient = /** @type {any} */ (client);

it('PUT /reservations-terrain/:id/options avec la liste entière', async () => {
  mockClient.put.mockResolvedValue({ data: { data: { documentId: 'r 1', options: [] } } });
  const corps = await modifierMesOptions('r 1', [{ id: 'b2', quantity: 2 }]);
  expect(mockClient.put).toHaveBeenCalledWith('/reservations-terrain/r%201/options', {
    data: { options: [{ id: 'b2', quantity: 2 }] },
  });
  expect(corps).toEqual({ data: { documentId: 'r 1', options: [] } });
});
