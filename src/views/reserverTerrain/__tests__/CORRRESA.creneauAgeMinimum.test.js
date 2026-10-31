import renderer, { act } from 'react-test-renderer';

import ReserverCreneau from '@/views/reserverTerrain/ReserverCreneau';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { complexePublic, creneau, terrainPublic } from '@/testSupport/temoinReserver';

// CORR-RESA (78 A) — E-P03 : un joueur plus jeune que l'âge minimum du complexe le lit AVANT de
// choisir un créneau (« Réservé aux 16 ans et plus. »). Un adulte, ou un compte sans date de
// naissance, ne voit rien. Doublures d'EP03.creneau.test.js ; le compte doublé comme dans
// EP09.annonce.L6B2.test.js (la date de naissance varie).

let mockNaissance = /** @type {string | null} */ (null);
let mockComplexe = /** @type {any} */ (null);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: { slug: 'le-five-de-montrivage', terrainId: 't-1' } }),
}));

jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useApercuDeReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexePublic: () => ({ data: mockComplexe }),
  useCreneauxDuJour: (
    /** @type {any} */ _slug,
    /** @type {any} */ _terrain,
    /** @type {string} */ date,
  ) => ({
    data: {
      date,
      slots: date === '2026-10-14' ? [mockCreneau('17:00', '18:00')] : [],
      terrain: {
        bookingMode: 'automatique', capacity: 10, documentId: 't-1', name: 'Terrain 1', phone: null,
      },
    },
    isLoading: false,
    refetch: jest.fn(),
  }),
  useTerrainsPublics: () => ({ data: [mockTerrain()] }),
}));
const mockCreneau = (/** @type {string} */ de, /** @type {string} */ a) => creneau(de, a);
const mockTerrain = () => terrainPublic();

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: mockNaissance, documentId: 'u-1' } }),
}));
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  },
);
jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
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
    arbre = renderer.create(<ReserverCreneau />);
  });
  return arbre;
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  mockComplexe = complexePublic({ rules: { cancellationDelayHours: 24, minAge: 16 } });
  mockNaissance = null;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CORR-RESA (78 A) — E-P03, l’âge minimum du complexe', () => {
  it('un joueur de 15 ans lit « Réservé aux 16 ans et plus. »', async () => {
    mockNaissance = '2011-06-01';
    const arbre = await monter();
    expect(parRepere(arbre, 'creneau-age-minimum')).not.toBeNull();
    expect(lisibles(arbre)).toContain('Réservé aux 16 ans et plus.');
  });

  it('un adulte ne voit rien', async () => {
    mockNaissance = '1990-01-01';
    const arbre = await monter();
    expect(parRepere(arbre, 'creneau-age-minimum')).toBeNull();
    expect(lisibles(arbre)).not.toContain('Réservé aux 16 ans et plus.');
  });

  it('sans date de naissance : rien', async () => {
    mockNaissance = null;
    const arbre = await monter();
    expect(parRepere(arbre, 'creneau-age-minimum')).toBeNull();
    expect(lisibles(arbre)).not.toContain('Réservé aux 16 ans et plus.');
  });
});
