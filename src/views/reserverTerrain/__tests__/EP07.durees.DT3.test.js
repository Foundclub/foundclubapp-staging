import renderer, { act } from 'react-test-renderer';

import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';

import { lisibles } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// DT-3 (DUREES-TARIFS, 12/11/2026) — maquette validée par Adel le 12/11, écran J3 : « Ma
// réservation » écrit « · 2 h » après les heures, SEULEMENT quand le terrain propose plusieurs
// durées ce jour-là. La réservation du serveur ne le dit pas : l'écran relit les créneaux publics
// de ce jour (`offers`, DT-1). Une seule durée, ou une lecture absente : l'écran d'aujourd'hui.

let mockLecture = /** @type {any} */ ({});
let mockCreneaux = /** @type {any} */ ({ data: undefined });
const mockLuPour = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), popToTop: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ params: { reservationId: 'r-1' } }),
}));
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnulerMaReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexePublic: () => ({ data: null }),
  useCreneauxDuJour: (/** @type {any[]} */ ...args) => {
    mockLuPour(...args);
    return mockCreneaux;
  },
  useGroupeDeLaReservation: () => ({ data: null }),
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMaRelationAuComplexe: () => ({ data: null }),
  useMaReservation: () => mockLecture,
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

const DEUX_HEURES = { endsAt: '2026-10-16T18:00:00.000Z', to: '20:00' };

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockLecture = {
    data: maReservation(DEUX_HEURES), error: null, isLoading: false, refetch: jest.fn(),
  };
  mockCreneaux = { data: undefined };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('DT-3 — E-P07, une seule durée : comme aujourd’hui (caractérisant)', () => {
  it('sans `offers` ce jour-là : les heures, sans durée', async () => {
    mockCreneaux = { data: { date: '2026-10-16', slots: [] } };
    const vus = lisibles(await monter());
    expect(vus).toContain('Vendredi 16 octobre · 18 h – 20 h');
    expect(vus).not.toContain(' · 2 h');
  });

  it('lecture absente (ou refusée) : les heures, sans durée', async () => {
    const vus = lisibles(await monter());
    expect(vus).toContain('Vendredi 16 octobre · 18 h – 20 h');
    expect(vus).not.toContain(' · 2 h');
  });
});

describe('DT-3 — J3 : la durée dans Ma réservation', () => {
  it('le terrain propose plusieurs durées ce jour-là : « · 2 h » suit les heures', async () => {
    mockCreneaux = {
      data: {
        date: '2026-10-16',
        offers: [{ durationMinutes: 60, slots: [] }, { durationMinutes: 120, slots: [] }],
        slots: [],
      },
    };
    const vus = lisibles(await monter());
    expect(mockLuPour).toHaveBeenCalledWith('le-five-de-montrivage', 't-1', '2026-10-16');
    // « · 2 h » est dans la ligne (en couleur), comme sur la maquette.
    expect(vus).toContain('Vendredi 16 octobre · 18 h – 20 h · 2 h');
    expect(vus).toContain(' · 2 h');
  });
});
