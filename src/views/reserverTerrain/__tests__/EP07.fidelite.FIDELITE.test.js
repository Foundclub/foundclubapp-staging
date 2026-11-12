/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { groupe, maReservation } from '@/testSupport/temoinReserver';

// FIDELITE-2 (12/11/2026, maquette 237 validée) — E-P07 « Ma réservation, avec son bonus » : la
// pastille « Partie offerte · ta part » (ou « Réduction de 20 % · le terrain entier ») dans l'en-tête,
// à côté de l'état, tant que la réservation porte une remise figée (`loyalty`) ; sans remise, l'en-tête
// d'avant. Caractérise aussi ce qui existait sans témoin : « − 15 € », 150 € barré puis 135 €, et
// « Si tu annules, ton bonus fidélité te revient. ».

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
  // DT-3 : les créneaux publics du jour (« · 2 h » si plusieurs durées) ; aucun ici.
  useCreneauxDuJour: () => ({ data: undefined }),
  useGroupeDeLaReservation: () => mockGroupe,
  useLienDInvitation: () => ({ isPending: false, mutateAsync: mockLien }),
  useMaRelationAuComplexe: () => mockRelation,
  useMaReservation: () => mockLecture,
  // RESA-OPTIONS-2 (12/11) : « Modifier les options », le terrain public (photo, options).
  useModifierMesOptions: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useOuvrirUnFil: () => ({ isPending: false, mutateAsync: mockFil }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: mockPublier }),
  useRepondreALaPartie: () => ({ isPending: false, mutateAsync: mockRepondre }),
  useTerrainsPublics: () => ({ data: [] }),
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

const remisee = (/** @type {Record<string, any>} */ loyalty) => ({
  data: maReservation({
    loyalty: {
      amount: 15, base: 15, percent: null, rewardType: 'partie', scope: 'joueur', ...loyalty,
    },
    players: 10,
    price: { amount: 150, currency: 'EUR', unit: 'creneau' },
  }),
  isLoading: false,
});

describe('FIDELITE-2 — E-P07 : la pastille du bonus dans l’en-tête', () => {
  it('partie offerte, ta part : « Partie offerte · ta part » à côté de « Confirmée »', async () => {
    mockLecture = remisee({});
    const arbre = await monter();
    expect(parRepere(arbre, 'ma-resa-pastille-fidelite')).toBeTruthy();
    const vus = lisibles(arbre);
    expect(vus.indexOf('Partie offerte · ta part')).toBe(vus.indexOf('Confirmée') + 1);
  });

  it('réduction de 20 %, le terrain entier : « Réduction de 20 % · le terrain entier »', async () => {
    mockLecture = remisee({
      amount: 30, base: 150, percent: 20, rewardType: 'remise', scope: 'terrain',
    });
    expect(lisibles(await monter())).toContain('Réduction de 20 % · le terrain entier');
  });

  it('sans remise : pas de pastille (l’en-tête d’avant)', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'ma-resa-pastille-fidelite')).toBeNull();
    expect(lisibles(arbre)).not.toContain('Si tu annules, ton bonus fidélité te revient.');
  });

  it('caractérisant (existant) : « Si tu annules, ton bonus fidélité te revient. » et la ligne de remise', async () => {
    mockLecture = remisee({});
    const vus = lisibles(await monter());
    expect(vus).toEqual(expect.arrayContaining([
      'Si tu annules, ton bonus fidélité te revient.', 'Partie offerte (ta part)',
    ]));
  });
});
