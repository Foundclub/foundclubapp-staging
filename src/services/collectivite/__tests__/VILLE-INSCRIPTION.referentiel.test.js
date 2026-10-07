import {
  nomOfficielDIntercommunalite,
  readCollectiviteCreateForm,
} from '@/domains/collectivite/collectiviteDisplay';

import { getCollectiviteReferentiel } from '../collectiviteService';

// 🏛️ VILLE-INSCRIPTION (07/10/2026) — l'étape 1 de « Je représente une collectivité » lit la
// LISTE COMPLÈTE d'un type (référentiel de l'État, lu par le serveur : admin `listReferentiel`).
// ROUGE avant le lot : `getCollectiviteReferentiel` et `nomOfficielDIntercommunalite` n'existaient
// pas.

const mockGet = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockGet(...args) },
}));

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue({ data: { data: [] } });
});

describe('VILLE-INSCRIPTION — la lecture de la liste', () => {
  it('la MÊME route que la recherche, avec `referentiel` (aucun droit neuf)', async () => {
    await getCollectiviteReferentiel('region');
    expect(mockGet).toHaveBeenCalledWith('/collectivite-manager-requests/collectivites', {
      params: { referentiel: 'region' },
    });
  });

  it('les communes D UN département', async () => {
    await getCollectiviteReferentiel('commune', '14');
    expect(mockGet).toHaveBeenCalledWith('/collectivite-manager-requests/collectivites', {
      params: { departement: '14', referentiel: 'commune' },
    });
  });
});

describe('VILLE-INSCRIPTION — le nom officiel d une intercommunalité du référentiel (D59)', () => {
  it.each([
    ['CC Faucigny - Glières', 'Communauté de communes Faucigny - Glières'],
    ['CC de la Plaine Dijonnaise', 'Communauté de communes de la Plaine Dijonnaise'],
    ['CA du Grand Annecy', 'Communauté d’agglomération du Grand Annecy'],
    ['CU Caen la Mer', 'Communauté urbaine Caen la Mer'],
    ['Métropole du Grand Paris', 'Métropole du Grand Paris'],
  ])('%s → %s, accepté par le contrôle de forme officielle', (abrege, attendu) => {
    expect(nomOfficielDIntercommunalite(abrege)).toBe(attendu);
    expect(readCollectiviteCreateForm({
      name: attendu, siren: '200000172', type: 'intercommunalite',
    }).errors).toEqual([]);
  });

  it('un nom déjà complet ou sans abréviation connue reste tel quel', () => {
    expect(nomOfficielDIntercommunalite('Metz Métropole')).toBe('Metz Métropole');
    expect(nomOfficielDIntercommunalite('CCAS de Caen')).toBe('CCAS de Caen');
    expect(nomOfficielDIntercommunalite('')).toBe('');
  });
});
