import renderer, { act } from 'react-test-renderer';

import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';

import { formatEuros } from '@/domains/complexe/complexeTerrain';
import { lisibles, textes } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// CORR-RESA (84 A) — E-P07 : un prix « par joueur » se lit « 7 € par joueur, à régler sur
// place », comme sur le résultat et le récapitulatif. Doublures d'EP07.maReservation.test.js.

let mockLecture = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), popToTop: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ params: { reservationId: 'r-1' } }),
}));
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnulerMaReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic(),
  }),
  useGroupeDeLaReservation: () => ({ data: null }),
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMaRelationAuComplexe: () => ({ data: null }),
  useMaReservation: () => mockLecture,
  useOuvrirUnFil: () => ({ isPending: false, mutateAsync: jest.fn() }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRepondreALaPartie: () => ({ isPending: false, mutateAsync: jest.fn() }),
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
  return arbre;
};

const lue = (/** @type {Record<string, any>} */ autres = {}) => ({
  data: maReservation(autres), error: null, isLoading: false, refetch: jest.fn(),
});

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CORR-RESA (84 A) — E-P07, le prix par joueur', () => {
  it('« 7 € par joueur, à régler sur place »', async () => {
    mockLecture = lue({ price: { amount: 7, unit: 'joueur' } });
    const arbre = await monter();
    // formatEuros pose une espace insécable entre 7 et € : le texte dessiné la garde.
    expect(formatEuros(7)).toBe(`7${String.fromCharCode(160)}€`);
    expect(textes(arbre)).toContain(`${formatEuros(7)} par joueur, à régler sur place`);
    expect(lisibles(arbre)).toContain('7 € par joueur, à régler sur place');
  });

  it('un prix par créneau reste « 60 €, à régler sur place »', async () => {
    mockLecture = lue({ price: { amount: 60, unit: 'creneau' } });
    const vus = lisibles(await monter());
    expect(vus).toContain('60 €, à régler sur place');
    expect(vus.join('|')).not.toContain('par joueur, à régler sur place');
  });
});
