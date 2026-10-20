import renderer, { act } from 'react-test-renderer';

import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';

import { lisibles } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// RESA-L6B-1 (19/10/2026) — E-P07 dans le VOLET de E-P10 sur ordinateur (planche OR3, gabarit A :
// « Toucher une ligne remplit le volet au lieu de changer d'écran »). La fiche lit alors la
// réservation que la liste lui donne, pas les paramètres de la route, et ne pose pas son propre
// fond d'écran. Seule (téléphone, notification), elle ne change pas (EP07.maReservation.test.js).

let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), popToTop: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

const mockLue = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnulerMaReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexePublic: () => ({ data: null }),
  // RESA-L6B-2 : le groupe, la relation au complexe, les fils, le lien et l'annonce (aucun ici).
  useGroupeDeLaReservation: () => ({ data: null }),
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMaRelationAuComplexe: () => ({ data: null }),
  useMaReservation: (/** @type {string} */ id) => {
    mockLue(id);
    return {
      data: jest.requireActual('@/testSupport/temoinReserver').maReservation({ documentId: id }),
      error: null,
      isLoading: false,
    };
  },
  useOuvrirUnFil: () => ({ isPending: false, mutateAsync: jest.fn() }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRepondreALaPartie: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/platform/maps/externalMap', () => ({ openExternalMap: jest.fn() }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => true }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
const mockFond = jest.fn();
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    mockFond();
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockParams = { reservationId: 'r-de-la-route' };
});

afterEach(() => {
  jest.useRealTimers();
});

it('dans le volet : la réservation de la liste, sans fond d’écran à elle', async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverMaReservation dansUnVolet reservationId="r-2" />);
  });
  expect(mockLue).toHaveBeenLastCalledWith('r-2');
  expect(mockFond).not.toHaveBeenCalled();
  expect(lisibles(arbre)).toEqual(expect.arrayContaining(['MA RÉSERVATION', 'Confirmée']));
  expect(maReservation().documentId).toBe('r-1');
});

it('seule : la réservation de la route, dans son écran (comme avant)', async () => {
  await act(async () => {
    renderer.create(<ReserverMaReservation />);
  });
  expect(mockLue).toHaveBeenLastCalledWith('r-de-la-route');
  expect(mockFond).toHaveBeenCalled();
});
