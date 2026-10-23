import renderer, { act } from 'react-test-renderer';

import ComplexeClient from '@/views/complexe/ComplexeClient';

import { RouteNames } from '@/navigation/routeNames';

import {
  lisibles, parRepere, pressable, textes,
} from '@/testSupport/temoinComplexe';

// RESA-L5B-2 (20/10/2026) — E-G15, CE QUE LA FICHE D'UN CLIENT ATTENDAIT DE RESA-L4 (planche EG15
// état 2 ; plan :970-1010) : « Client depuis le 02/09 », les parties jouées et la fidélité « 8/10 »
// parmi les chiffres, l'« Historique » de ses réservations ICI (toucher une ligne ouvre sa fiche,
// E-G05), et « Écrire » SEULEMENT s'il a une réservation à venir (AT-04 : la conversation de cette
// réservation, `POST /complexes/:id/reservations/:reservationId/conversation`, RESA-L3).
// Doublures : `GET …/clients/:joueurId` (RESA-L2B), `GET …/clients/:joueurId/historique` et la
// liste `GET …/clients?recherche=<son nom>` (sa fidélité, RESA-L4).

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockHistorique = /** @type {any} */ ({});
let mockListe = /** @type {any} */ ({});
/** @type {any[]} */
const mockRecherches = [];
const mockEcrire = jest.fn();
/** RESA-FIN-APP-3 : ce que le serveur ajoute (`noShowsSinceLift`, RESA-FIN-SERVEUR 9/11). */
let mockClientEnPlus = /** @type {Record<string, any>} */ ({});
jest.mock('@/services/complexe/complexeQueries', () => ({
  useBannir: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useClientDuComplexe: () => ({
    data: {
      ban: null,
      documentId: 'u-julien',
      firstname: 'Julien',
      lastname: 'Marchal',
      lateCancellations: 0,
      noShows: 1,
      upcoming: 1,
      ...mockClientEnPlus,
    },
    isLoading: false,
  }),
  useClientsDuComplexe: (/** @type {any} */ _id, /** @type {any} */ filtres, options = {}) => {
    mockRecherches.push({ ...filtres, ...options });
    return mockListe;
  },
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => ({ data: { rules: { autoBanNoShows: 3 } } }),
  useDebannir: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useEcrireAuReserveur: () => ({ isPending: false, mutateAsync: mockEcrire }),
  useHistoriqueClient: () => mockHistorique,
  // RESA-FIN-APP : la fidélité du complexe (« Valider la partie offerte » depuis la fiche).
  useFideliteDuComplexe: () => ({ data: null, isLoading: false }),
  useReservationGeree: () => ({ data: null, isLoading: false }),
  useValiderRecompense: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const DEMAIN = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeClient />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRecherches.length = 0;
  mockClientEnPlus = {};
  mockParams = { complexeId: 'cx-five', joueurId: 'u-julien' };
  mockHistorique = {
    data: {
      documentId: 'u-julien',
      parties: 12,
      reservations: [
        {
          documentId: 'r-demain',
          endsAt: DEMAIN,
          lateCancellation: false,
          noShow: false,
          startsAt: DEMAIN,
          status: 'confirmee',
          terrain: { documentId: 't-1', name: 'Terrain 1' },
        },
        {
          documentId: 'r-11',
          endsAt: '2026-10-11T18:00:00.000Z',
          lateCancellation: false,
          noShow: true,
          startsAt: '2026-10-11T17:00:00.000Z',
          status: 'confirmee',
          terrain: { documentId: 't-1', name: 'Terrain 1' },
        },
        {
          documentId: 'r-02',
          endsAt: '2026-09-02T18:00:00.000Z',
          lateCancellation: false,
          noShow: false,
          startsAt: '2026-09-02T17:00:00.000Z',
          status: 'confirmee',
          terrain: { documentId: 't-1', name: 'Terrain 1' },
        },
      ],
    },
    isLoading: false,
  };
  mockListe = {
    data: {
      pages: [{
        items: [{
          documentId: 'u-julien',
          fidelite: { count: 8, threshold: 10 },
          firstname: 'Julien',
          lastname: 'Marchal',
          parties: 12,
        }],
      }],
    },
    isLoading: false,
  };
});

describe('E-G15 — la fiche d’un client, avec RESA-L4', () => {
  it('« Client depuis le 02/09 », 12 parties jouées et la fidélité 8/10', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('Client depuis le 02/09');
    expect(parRepere(arbre, 'client-chiffre-parties')).not.toBeNull();
    expect(vus).toContain('parties jouées');
    expect(vus).toContain('12');
    expect(parRepere(arbre, 'client-chiffre-fidelite')).not.toBeNull();
    expect(vus).toContain('8/10');
    // Sa fidélité vient de la liste, cherchée par SON nom.
    expect(mockRecherches[0]).toMatchObject({ onglet: 'tous', recherche: 'Julien Marchal' });
  });

  it('sans programme de fidélité, pas de chiffre « fidélité »', async () => {
    mockListe.data.pages[0].items[0].fidelite = null;
    const arbre = await monter();
    expect(parRepere(arbre, 'client-chiffre-fidelite')).toBeNull();
  });

  it('l’« Historique » : une ligne par réservation et son état ; toucher l’ouvre', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain('HISTORIQUE');
    expect(vus.some((texte) => /11\/10 · 19 h · Terrain 1$/.test(texte))).toBe(true);
    expect(vus).toContain('Non honorée');
    expect(vus).toContain('Jouée');
    await act(async () => {
      parRepere(arbre, 'client-historique-r-11').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeReservation, {
      complexeId: 'cx-five', reservationId: 'r-11',
    });
  });

  it('« Écrire » ouvre la conversation de sa réservation à venir', async () => {
    mockEcrire.mockResolvedValue({ data: { chat: 'chat-r-demain' } });
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Écrire').props.onPress();
    });
    expect(mockEcrire).toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-demain' });
    // RESA-FIN-APP-3 : la conversation garde l'espace du complexe (barre du gérant, tournée 3).
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.Conversation, {
      chatId: 'chat-r-demain', espace: 'complexe',
    });
  });

  it('sans réservation à venir, pas de « Écrire » (AT-04)', async () => {
    mockHistorique.data.reservations = mockHistorique.data.reservations.slice(1);
    const arbre = await monter();
    expect(() => pressable(arbre, 'Écrire')).toThrow();
  });
});

// RESA-FIN-APP (20/10/2026) — tournées de recette 1 et 2 (Android 16) : « jeu. 22/10 · 20 h · Terrain 2 »
// s'affichait « … · Terrain » (le dernier mot passe sur une ligne invisible). La ligne de
// l'historique est dessinée en un seul « mot » (espaces insécables, `texteInsecable`).
describe('RESA-FIN-APP (1) E-G15 — les lignes de l’historique ne perdent plus leur terrain', () => {
  it('chaque ligne « jour · heure · terrain » est dessinée sans espace ordinaire', async () => {
    const arbre = await monter();
    const lignes = textes(arbre).filter((texte) => /\d\d\/\d\d/.test(texte) && /Terrain/.test(texte));
    expect(lignes).toHaveLength(3);
    lignes.forEach((ligne) => expect(ligne).not.toMatch(/ /));
  });
});

// RESA-FIN-APP-3 (23/10/2026, tournée 3 du site) — « 3 non honorées · Non banni · ban
// automatique au bout de 3 » était trompeur : le compteur du ban automatique repart de la levée
// du dernier ban (`noShowsSinceLift`, RESA-FIN-SERVEUR 9/11). L'écran dit le total ET le compte
// depuis la levée.
describe('RESA-FIN-APP-3 E-G15 — les non honorées depuis la levée du ban', () => {
  it('3 au total, 0 depuis la levée : les deux ; le ban auto repart de la levée', async () => {
    mockClientEnPlus = { noShows: 3, noShowsSinceLift: 0 };
    const vus = lisibles(await monter());
    expect(vus).toEqual(expect.arrayContaining([
      '3', 'non honorées', '0 depuis la levée du ban',
      'Bannissement automatique au bout de 3 non honorées.',
      'Le compteur repart de la levée du ban : 0 sur 3.',
    ]));
  });

  it('jamais banni (autant depuis la levée qu’au total) : rien de plus', async () => {
    mockClientEnPlus = { noShows: 1, noShowsSinceLift: 1 };
    const vus = lisibles(await monter());
    expect(vus.some((texte) => /depuis la levée|repart de la levée/.test(texte))).toBe(false);
  });
});
