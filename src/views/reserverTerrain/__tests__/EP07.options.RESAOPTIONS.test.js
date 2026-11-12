/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// RESA-OPTIONS (12/11/2026) — E-P07 « Ma réservation » (D61, maquette section 4 bis) : les options
// choisies s'ajoutent au bloc du prix — « À régler sur place », le terrain, une ligne par option,
// le total. Sans option : rien de plus. (« Modifier les options » : hors de ce lot.)

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), popToTop: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ params: { reservationId: 'r-1' } }),
}));
let mockLecture = /** @type {any} */ ({});
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnulerMaReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexePublic: () => ({ data: jest.requireActual('@/testSupport/temoinReserver').complexePublic() }),
  useGroupeDeLaReservation: () => ({ data: null }),
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMaRelationAuComplexe: () => ({ data: null }),
  useMaReservation: () => mockLecture,
  // RESA-OPTIONS-2 (12/11) : « Modifier les options », le terrain public (photo, options).
  useModifierMesOptions: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useOuvrirUnFil: () => ({ isPending: false, mutateAsync: jest.fn() }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRepondreALaPartie: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useTerrainsPublics: () => ({ data: [] }),
}));
jest.mock('@/platform/maps/externalMap', () => ({ openExternalMap: jest.fn() }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/templates/ScreenContainer', () => function FauxConteneur(/** @type {any} */ { children }) {
  return children;
});
jest.mock('react-i18next', () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next);
jest.mock('@/theme/themeContext', () => jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin());

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

describe('RESA-OPTIONS — E-P07, les options choisies', () => {
  it('« À régler sur place » : le terrain (10 joueurs × 15 €), chasubles × 1, ballon × 2, total 161 €', async () => {
    mockLecture = lue({
      options: [
        {
          id: 'o-chas', name: 'Location de chasubles', price: 5, quantity: 1, unit: 'reservation',
        },
        {
          id: 'o-ball', name: 'Ballon de match', price: 3, quantity: 2, unit: 'unite',
        },
      ],
      players: 10,
      price: { amount: 15, perPlayer: 15, unit: 'joueur' },
    });
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'À RÉGLER SUR PLACE', 'Terrain · 10 joueurs', '150 €', 'Location de chasubles × 1', '5 €',
      'Ballon de match × 2', '6 €', 'Total', '161 €',
    ]));
  });

  it('SANS option : pas de bloc de plus (la réservation se lit comme avant)', async () => {
    mockLecture = lue({ options: [] });
    expect(parRepere(await monter(), 'bloc-regler-sur-place')).toBeNull();
    mockLecture = lue();
    expect(parRepere(await monter(), 'bloc-regler-sur-place')).toBeNull();
  });
});
