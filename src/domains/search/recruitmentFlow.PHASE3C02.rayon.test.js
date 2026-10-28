// PHASE3C02 (27/10/2026) — Q2-04 côté profils : « ville · N km » n'envoyait que la case de
// geohash, que /search/profiles applique en `$startsWith` : des profils DANS le rayon sortaient.
// Ce serveur filtre déjà à la vraie distance quand il reçoit `lat`, `lon` et `radius`
// (bornes du cercle, puis distance de chaque profil) ; il faut les lui envoyer, sans la case.
import client from '@/services/client';
import { searchProfiles } from '@/services/search/searchService';

import { parametresDeRechercheDeProfils } from './recruitmentFlow';

jest.mock('@/domains/auth/authUseCases', () => ({ getUserRoleKey: jest.fn() }));
jest.mock('@/services/client', () => ({ __esModule: true, default: { get: jest.fn() } }));

const MARSEILLE = { label: 'Marseille', value: '5.3698|43.2965' };

describe('Q2-04 — les paramètres de la liste des profils', () => {
  it('garde les critères d\'avant (sport, section, poste, case, tri)', () => {
    expect(parametresDeRechercheDeProfils({
      activity: ['a1'],
      activityNames: ['Football'],
      category: ['c1'],
      geohash: 'spey',
      position: ['p1'],
      positions: ['p1'],
      sectionIds: ['s1'],
    }, '')).toEqual(expect.objectContaining({
      activity: ['Football'],
      category: ['s1'],
      geohash: 'spey',
      position: ['p1'],
      sort: 'date',
    }));
    expect(parametresDeRechercheDeProfils({}, ' ab ')).toEqual(expect.objectContaining({
      q: 'ab', sort: 'relevance',
    }));
  });

  it('une ville choisie donne le point et le rayon', () => {
    expect(parametresDeRechercheDeProfils({ city: MARSEILLE, geohash: 'spey', radius: 30 }, ''))
      .toEqual(expect.objectContaining({ lat: 43.2965, lon: 5.3698, radius: 30 }));
  });

  it('sans ville : ni point ni rayon', () => {
    const params = parametresDeRechercheDeProfils({
      city: { label: '', value: '' }, radius: 30,
    }, '');
    expect(params.lat).toBeUndefined();
    expect(params.radius).toBeUndefined();
  });
});

describe('Q2-04 — ce que searchProfiles envoie', () => {
  /**
   * Les paramètres envoyés à /search/profiles.
   * @param {Record<string, any>} params - Les paramètres de la liste.
   * @returns {Promise<Record<string, any>>} Les paramètres de la requête /search/profiles.
   */
  const envoyes = async (params) => {
    jest.mocked(client.get).mockReset();
    jest.mocked(client.get).mockResolvedValue({ data: { data: [], meta: {} } });
    await searchProfiles(params);
    expect(client.get).toHaveBeenCalledTimes(1);
    return jest.mocked(client.get).mock.calls[0][1]?.params;
  };

  it('avec un point et un rayon : la vraie distance, sans la case', async () => {
    const params = await envoyes(parametresDeRechercheDeProfils({
      city: MARSEILLE, geohash: 'spey', radius: 30,
    }, ''));
    expect(params).toMatchObject({ lat: 43.2965, lon: 5.3698, radius: 30 });
    expect(params.geohash).toBeUndefined();
  });

  it('sans point : la case, comme avant', async () => {
    expect((await envoyes({ geohash: 'spey' })).geohash).toBe('spey');
  });
});
