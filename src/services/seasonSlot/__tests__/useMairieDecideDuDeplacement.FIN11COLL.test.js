/* eslint-disable max-len -- des phrases et des appels entiers, compares tels quels */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { previewFacilitySeasonSlot } from '@/services/seasonSlot/seasonSlotService';

import { useMairieDecideDuDeplacement } from '../seasonSlotQueries';

// 🧪 FINITIONS11-COLL (03/10/2026), point 7 — « deplacer A » : le crochet que les deux écrans de
// modification (téléphone et site) lisent. Il pose la question de l'aperçu (COLL-FIX2) pour une
// séance DÉPLACÉE et dit si la MAIRIE décidera. Les vraies requêtes react-query, le service doublé
// (le client HTTP exige API_URL, absent des copies de travail). ROUGE avant le lot.

jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  getSeasonSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
  restoreSeasonSlot: jest.fn(),
  withdrawSeasonSlot: jest.fn(),
}));
// Les installations des Villes du club (COLL-C3B) : le gymnase et le dojo ; « terrain-club » n'en est pas.
jest.mock('@/services/facility/facilityService', () => ({
  getClubCollectiviteFacilities: jest.fn(() => Promise.resolve({
    data: [{ documentId: 'gym' }, { documentId: 'dojo' }],
  })),
  getFacilityPlanning: jest.fn(),
}));

const SEANCE = {
  club: { documentId: 'club-A' },
  date: new Date(2030, 4, 15, 18, 30),
  documentId: 'ev-1',
  endTime: '20:00:00.000',
  facility: { documentId: 'gym' },
  startTime: '18:30:00.000',
  team: { documentId: 'u15' },
};
const PAREIL = {
  debut: '18:30', facilityId: 'gym', fin: '20:00', jour: '2030-05-15',
};

/** @type {any[]} */
const montes = [];
const lire = async (/** @type {any} */ saisie) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /**
   * Le crochet, tel qu'un écran l'appelle ; il écrit sa réponse.
   * @returns {import('react').ReactElement} La réponse, en texte.
   */
  function Sonde() {
    return createElement(Text, null, String(useMairieDecideDuDeplacement(SEANCE, saisie)));
  }
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(createElement(QueryClientProvider, { client }, createElement(Sonde)));
  });
  for (let tour = 0; tour < 5; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
  montes.push({ arbre, client });
  return arbre.root.findByType(Text).props.children;
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('FINITIONS11-COLL (7) — la mairie décidera-t-elle du déplacement ?', () => {
  it('déplacée hors du créneau, le serveur dit « mairie » : oui, et la question est la bonne', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { decision: { inClubSlot: false, outcome: 'mairie' } } });
    expect(await lire({ ...PAREIL, facilityId: 'dojo', jour: '2030-05-16' })).toBe('true');
    expect(previewFacilitySeasonSlot).toHaveBeenCalledWith('dojo', {
      club: 'club-A',
      endTime: '20:00',
      startTime: '18:30',
      team: 'u15',
      validFrom: '2030-05-16',
      validUntil: '2030-05-16',
      weekday: 4,
    });
  });

  it('le serveur dit qu elle est posée tout de suite (créneau du club) : non', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { decision: { inClubSlot: true, outcome: 'direct' } } });
    expect(await lire({ ...PAREIL, jour: '2030-05-16' })).toBe('false');
  });

  it('sur le terrain du club, pas une installation de la Ville : aucune question, non', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { decision: { inClubSlot: false, outcome: 'mairie' } } });
    expect(await lire({ ...PAREIL, facilityId: 'terrain-club', jour: '2030-05-16' })).toBe('false');
    expect(previewFacilitySeasonSlot).not.toHaveBeenCalled();
  });

  it('rien n a bougé : aucune question, non', async () => {
    expect(await lire(PAREIL)).toBe('false');
    expect(previewFacilitySeasonSlot).not.toHaveBeenCalled();
  });

  it('un serveur ancien (pas de « decision ») ou en panne : non, jamais une promesse fausse', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: {} });
    expect(await lire({ ...PAREIL, jour: '2030-05-16' })).toBe('false');
    /** @type {any} */ (previewFacilitySeasonSlot).mockRejectedValue(new Error('hors ligne'));
    expect(await lire({ ...PAREIL, jour: '2030-05-22' })).toBe('false');
  });
});
