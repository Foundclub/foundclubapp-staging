import client from '@/services/client';

import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  getSeasonSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
  restoreSeasonSlot,
  withdrawSeasonSlot,
} from '../seasonSlotService';

// COLL-C2B (02/10) — le service suit le CONTRAT C2A a la lettre (admin
// docs/CONTRAT_CRENEAUX_SAISON.md §4) : memes routes, memes corps `{ data }`, aucune route DELETE.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  /** @type {any} */ (client.get).mockResolvedValue({ data: { data: [] } });
  /** @type {any} */ (client.post).mockResolvedValue({ data: { data: {} } });
  /** @type {any} */ (client.put).mockResolvedValue({ data: { data: {} } });
});

describe('seasonSlotService — les routes du contrat C2A', () => {
  it('§4.1 lister, §4.2 la place libre, §4.4 un creneau', async () => {
    await listFacilitySeasonSlots('gym', { status: 'withdrawn' });
    expect(client.get).toHaveBeenLastCalledWith('/facilities/gym/season-slots', {
      params: { from: undefined, status: 'withdrawn' },
    });
    await previewFacilitySeasonSlot('gym', { endTime: '19:00', startTime: '17:30', weekday: 3 });
    expect(client.get).toHaveBeenLastCalledWith('/facilities/gym/season-slots/preview', {
      params: { endTime: '19:00', startTime: '17:30', weekday: 3 },
    });
    await getSeasonSlot('c1');
    expect(client.get).toHaveBeenLastCalledWith('/season-slots/c1');
  });

  it('§4.3 attribuer, §4.5 modifier, §4.6 retirer, §4.7 retablir : corps { data }', async () => {
    await attributeSeasonSlot('gym', { club: 'club-as', confirmOverCapacity: true });
    expect(client.post).toHaveBeenLastCalledWith('/facilities/gym/season-slots', {
      data: { club: 'club-as', confirmOverCapacity: true },
    });
    await modifySeasonSlot('c1', { effectiveFrom: '2026-10-05', startTime: '18:30' });
    expect(client.put).toHaveBeenLastCalledWith('/season-slots/c1', {
      data: { effectiveFrom: '2026-10-05', startTime: '18:30' },
    });
    await withdrawSeasonSlot('c1');
    expect(client.post).toHaveBeenLastCalledWith('/season-slots/c1/withdraw', { data: {} });
    await restoreSeasonSlot('c1', { confirmOverCapacity: true });
    expect(client.post).toHaveBeenLastCalledWith('/season-slots/c1/restore', {
      data: { confirmOverCapacity: true },
    });
  });

  it('les equipes d un club : leur nom et leur identifiant, rien d autre', async () => {
    /** @type {any} */ (client.get).mockResolvedValue({
      data: {
        data: [
          { documentId: 't1', name: 'U13', players: [{ firstname: 'Jeanne' }] },
          { documentId: 't2', name: '' },
        ],
      },
    });
    await expect(getClubTeamsForSlot('club-as'))
      .resolves.toEqual([{ documentId: 't1', name: 'U13' }]);
    expect(client.get).toHaveBeenLastCalledWith('/teams', {
      params: {
        fields: ['documentId', 'name'],
        filters: { club: { documentId: { $eq: 'club-as' } } },
        pagination: { page: 1, pageSize: 100 },
        sort: ['name:asc'],
      },
    });
  });
});
