import client from '@/services/client';

import { getFriendlyMatchAds } from '../friendlyMatchService';

// FIN-EVENEMENTS 2 — annonces passées toujours listées. Le ménage du serveur passe une fois
// par heure, et il est coupé sur la recette (`STAGING_CRON_ENABLED`, faux par défaut) : la liste
// ne doit pas en dépendre. Filtrer sur le serveur garde une pagination juste.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: { data: [], meta: {} } })) },
}));

describe('getFriendlyMatchAds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-11-02T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('🐞 ne demande que les annonces dont la dernière date n’est pas passée', async () => {
    await getFriendlyMatchAds();

    const { filters } = /** @type {any} */ (client.get).mock.calls[0][1].params;
    expect(filters.lastCandidateDate).toEqual({ $gte: '2026-11-02T10:00:00.000Z' });
    expect(filters.status).toBe('open');
    expect(filters.isActive).toBe(true);
  });
});
