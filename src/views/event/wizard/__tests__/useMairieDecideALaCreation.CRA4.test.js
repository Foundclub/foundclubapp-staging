/* eslint-disable max-len -- des phrases et des appels entiers, compares tels quels */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { useManagingCollectiviteId } from '@/services/collectivite/collectiviteQueries';
import { previewFacilitySeasonSlot } from '@/services/seasonSlot/seasonSlotService';

import useMairieDecideALaCreation from '../useMairieDecideALaCreation';

// 🏛️ COLL-R-APP-CREATION (13/10/2026, COL-003, décision d'Adel « D2- A ») — À LA CRÉATION D'UN
// ÉVÉNEMENT, l'étape 4 et le récapitulatif doivent savoir AVANT « Créer » si la séance part à la
// mairie. Le crochet pose la question de « Demander un créneau » (aperçu COLL-FIX2, au nom du club
// et de l'équipe) ; il ne promet jamais rien sans réponse du serveur. Les vraies requêtes
// react-query, les services doublés (le client HTTP exige API_URL). ROUGE avant le lot.

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
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteChiffres: jest.fn(),
  useManagingCollectiviteId: jest.fn(() => null),
}));
// Les installations de la Ville du club : le gymnase ; « terrain-club » n'en est pas.
jest.mock('@/services/facility/facilityService', () => ({
  getClubCollectiviteFacilities: jest.fn(() => Promise.resolve({
    data: [{ collectivite: { documentId: 'v-montrivage', name: 'Ville de Montrivage' }, documentId: 'gym' }],
  })),
  getFacilityPlanning: jest.fn(),
}));

// Samedi 18 mai 2030, 18:00 – 19:30, U13 du club A.
const TUNNEL = {
  date: new Date(2030, 4, 18),
  endTime: new Date(2030, 4, 18, 19, 30),
  isRecurrent: false,
  recurrenceEndDate: null,
  startTime: new Date(2030, 4, 18, 18, 0),
  team: { club: { documentId: 'club-A' }, documentId: 'u13' },
};

/** @type {any[]} */
const montes = [];
const lire = async (/** @type {any} */ etat, /** @type {string | null} */ installation) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /**
   * Le crochet, tel que l'étape 4 l'appelle ; il écrit sa réponse.
   * @returns {import('react').ReactElement} La réponse, en texte.
   */
  function Sonde() {
    return createElement(Text, null, JSON.stringify(useMairieDecideALaCreation(etat, installation)));
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
  return JSON.parse(arbre.root.findByType(Text).props.children);
};

beforeEach(() => {
  jest.clearAllMocks();
  /** @type {any} */ (useManagingCollectiviteId).mockReturnValue(null);
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('COLL-R-APP-CREATION — à la création, la mairie décidera-t-elle ?', () => {
  it('hors du créneau du club, le serveur dit « mairie » : oui, la Ville est nommée, et la question est celle de « Demander un créneau »', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { decision: { inClubSlot: false, outcome: 'mairie' }, remaining: 1 } });
    expect(await lire(TUNNEL, 'gym')).toEqual({
      complet: false, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage',
    });
    expect(previewFacilitySeasonSlot).toHaveBeenCalledWith('gym', {
      club: 'club-A',
      endTime: '19:30',
      startTime: '18:00',
      team: 'u13',
      validFrom: '2030-05-18',
      validUntil: '2030-05-18',
      weekday: 6,
    });
  });

  it('une série « chaque semaine » : la question porte jusqu à la fin de la série', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { decision: { inClubSlot: false, outcome: 'mairie' }, remaining: 1 } });
    await lire({ ...TUNNEL, isRecurrent: true, recurrenceEndDate: new Date(2030, 5, 29) }, 'gym');
    expect(previewFacilitySeasonSlot).toHaveBeenCalledWith('gym', expect.objectContaining({
      validFrom: '2030-05-18', validUntil: '2030-06-29',
    }));
  });

  it('au complet : la mairie décide quand même, et on le sait', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { decision: { inClubSlot: false, outcome: 'mairie' }, remaining: 0 } });
    expect(await lire(TUNNEL, 'gym')).toEqual(expect.objectContaining({ complet: true, mairie: true }));
  });

  it('le compte gère aussi la Ville (compte mixte) : il acceptera lui-même sa demande', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { decision: { inClubSlot: false, outcome: 'mairie' }, remaining: 1 } });
    /** @type {any} */ (useManagingCollectiviteId).mockReturnValue('v-montrivage');
    expect(await lire(TUNNEL, 'gym')).toEqual(expect.objectContaining({ mairie: true, tuAcceptes: true }));
    expect(useManagingCollectiviteId).toHaveBeenLastCalledWith('gym', { enabled: true });
  });

  it('dans le créneau du club (posée tout de suite) : non, mais l installation reste de la Ville', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { decision: { inClubSlot: true, outcome: 'direct' }, remaining: 1 } });
    expect(await lire(TUNNEL, 'gym')).toEqual({
      complet: false, deLaVille: true, mairie: false, tuAcceptes: false, ville: 'Ville de Montrivage',
    });
    expect(useManagingCollectiviteId).toHaveBeenLastCalledWith('gym', { enabled: false });
  });

  it('une installation du club, pas de la Ville : aucune question, non', async () => {
    expect(await lire(TUNNEL, 'terrain-club')).toEqual({
      complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
    });
    expect(previewFacilitySeasonSlot).not.toHaveBeenCalled();
  });

  it('aucune installation (adresse extérieure) ou heures illisibles : aucune question, non', async () => {
    expect(await lire(TUNNEL, null)).toEqual(expect.objectContaining({ mairie: false }));
    expect(await lire({ ...TUNNEL, startTime: null }, 'gym')).toEqual(expect.objectContaining({ mairie: false }));
    expect(previewFacilitySeasonSlot).not.toHaveBeenCalled();
  });

  it('un serveur ancien (pas de « decision ») ou en panne : non, jamais une promesse fausse', async () => {
    /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: {} });
    expect(await lire(TUNNEL, 'gym')).toEqual(expect.objectContaining({ mairie: false }));
    /** @type {any} */ (previewFacilitySeasonSlot).mockRejectedValue(new Error('hors ligne'));
    expect(await lire({ ...TUNNEL, date: new Date(2030, 4, 25) }, 'gym')).toEqual(expect.objectContaining({ mairie: false }));
  });
});
