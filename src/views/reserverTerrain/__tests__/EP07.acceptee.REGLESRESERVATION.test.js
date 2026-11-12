/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { groupe, maReservation } from '@/testSupport/temoinReserver';

// REGLES-RESERVATION (12/11/2026) — le petit point laissé par ACCEPTER-CONSTRUCTION : l'en-tête de
// « Ma réservation » d'une réservation en construction ACCEPTÉE par le complexe porte, à côté de son
// état, la pastille « Acceptée » (verte, coche) de la maquette DESIGN-RESA-JOUEUR (« Après
// « Accepter » ») ; sans acceptation, l'en-tête ne change pas.

// Un écran entier monté : sous charge (suite complète, PC occupé), le premier cas paie le
// chargement des modules et dépassait les 5 s par défaut (motif de COLL-CONSOLE, 02/10).
jest.setTimeout(30000);

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, popToTop: jest.fn(), replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));

let mockLecture = /** @type {any} */ ({});
let mockGroupe = /** @type {any} */ ({});
let mockRelation = /** @type {any} */ ({});
const mockAnnuler = jest.fn();
const mockRepondre = jest.fn();
const mockFil = jest.fn();
const mockLien = jest.fn();
const mockPublier = jest.fn();
const mockConstruire = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnulerMaReservation: () => ({ isPending: false, mutateAsync: mockAnnuler }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic(),
  }),
  useConstruireLaReservation: () => ({ isPending: false, mutateAsync: mockConstruire }),
  useGroupeDeLaReservation: () => mockGroupe,
  useLienDInvitation: () => ({ isPending: false, mutateAsync: mockLien }),
  useMaRelationAuComplexe: () => mockRelation,
  useMaReservation: () => mockLecture,
  useOuvrirUnFil: () => ({ isPending: false, mutateAsync: mockFil }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: mockPublier }),
  useRepondreALaPartie: () => ({ isPending: false, mutateAsync: mockRepondre }),
}));
jest.mock('@/platform/maps/externalMap', () => ({ openExternalMap: jest.fn() }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
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

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverMaReservation />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return arbre;
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockParams = { reservationId: 'r-1' };
  mockLecture = { data: maReservation(), isLoading: false };
  mockGroupe = { data: groupe(), isLoading: false };
  mockRelation = { data: { canal: { membre: true, membres: 214 }, favori: null, fidelite: null } };
  mockFil.mockResolvedValue({ chat: 'chat-1' });
  mockLien.mockResolvedValue({
    actif: true, code: 'K7Q2M9', url: 'https://foundclub.app/r/K7Q2M9',
  });
  mockRepondre.mockResolvedValue(groupe({ myResponse: 'present', role: 'participant' }));
});

afterEach(() => {
  jest.useRealTimers();
});

const collecte = (/** @type {Record<string, any>} */ autres = {}) => ({
  collectDeadline: '2026-10-15T16:00:00.000Z',
  failure: null,
  presents: 7,
  quorum: 10,
  reachedAt: null,
  ...autres,
});

describe('REGLES-RESERVATION — E-P07 : l’en-tête « Acceptée »', () => {
  beforeEach(() => {
    mockLecture = { data: maReservation({ canCancel: false, status: 'en_collecte' }) };
  });

  it('acceptée par le complexe : « Acceptée » à côté de « En construction · 7/10 »', async () => {
    mockGroupe = {
      data: groupe({
        collecte: collecte({ acceptedAt: '2026-10-14T15:24:00.000Z' }),
        counts: { absents: 1, presents: 7, sansReponse: 2 },
        status: 'en_collecte',
      }),
    };
    const arbre = await monter();
    expect(parRepere(arbre, 'pastille-etat-acceptee')).toBeTruthy();
    // RESA-OPTIONS-2 (fusion) : RESA-JOUEUR-2 Q2 dit « En construction » (au lieu de « En collecte ») côté joueur.
    expect(lisibles(arbre)).toEqual(expect.arrayContaining(['Acceptée', 'En construction · 7/10']));
  });

  it('pas encore acceptée : pas de pastille « Acceptée »', async () => {
    mockGroupe = {
      data: groupe({
        collecte: collecte(),
        counts: { absents: 1, presents: 7, sansReponse: 2 },
        status: 'en_collecte',
      }),
    };
    const arbre = await monter();
    expect(parRepere(arbre, 'pastille-etat-acceptee')).toBeNull();
    expect(lisibles(arbre)).not.toContain('Acceptée');
  });
});
