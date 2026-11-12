/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ReserverCreneau from '@/views/reserverTerrain/ReserverCreneau';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { creneau, recapitulatif } from '@/testSupport/temoinReserver';

// REGLES-RESERVATION (12/11/2026, D47) — maquette DESIGN-RESA-JOUEUR, section 3 « Au-delà de N jours,
// si l'option est activée » : la bande de jours ne montre que les jours permis par le complexe
// (`rules.bookingDaysAhead`, 90 = « Sans limite » : les 14 jours d'avant) ; la case suivante, grisée
// avec un cadenas, dit « Pas encore ouvert » et le jour où celui-ci ouvrira.

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockPhotos = /** @type {string[]} */ ([]);
let mockRegles = /** @type {any} */ ({});
let mockNaissance = /** @type {string | null} */ ('1990-01-01');
let mockCreneauxParJour = /** @type {Record<string, any>} */ ({});
const mockRelire = jest.fn();
const mockApercu = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useApercuDeReservation: () => ({ isPending: false, mutateAsync: mockApercu }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic({ rules: mockRegles }),
  }),
  useCreneauxDuJour: (
    /** @type {any} */ _slug,
    /** @type {any} */ _terrain,
    /** @type {string} */ date,
  ) => mockCreneauxParJour[date] || {
    data: { date, slots: [] }, isLoading: false, refetch: mockRelire,
  },
  useTerrainsPublics: () => ({
    data: [
      jest.requireActual('@/testSupport/temoinReserver').terrainPublic({ photos: mockPhotos }),
      jest.requireActual('@/testSupport/temoinReserver').terrainPublic({
        bookingMode: 'telephone',
        documentId: 't-padel',
        name: 'Padel A',
        phone: { number: '+33639981234', text: 'Ce terrain ne peut être réservé que par appel au' },
        sport: { documentId: 'a-padel', name: 'Padel' },
      }),
    ],
  }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
// CORR-RESA (78 A) : l'écran lit le compte (l'âge) ; un adulte ici.
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
 * Les créneaux d'un jour, comme la route publique les rend.
 * @param {string} date - Le jour.
 * @param {any[]} slots - Les créneaux.
 * @param {Record<string, any>} [terrain] - Le terrain de la réponse.
 * @returns {any} La lecture.
 */
const jour = (date, slots, terrain = {}) => ({
  data: {
    date,
    slots,
    terrain: {
      bookingMode: 'automatique',
      capacity: 10,
      documentId: 't-1',
      name: 'Terrain 1',
      phone: null,
      ...terrain,
    },
  },
  isLoading: false,
  refetch: mockRelire,
});

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

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud pressable.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    noeud.props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') }); // mercredi 14/10, 10 h à Paris
  jest.clearAllMocks();
  mockParams = { slug: 'le-five-de-montrivage', terrainId: 't-1' };
  mockPhotos = [];
  mockNaissance = '1990-01-01';
  mockRegles = { cancellationDelayHours: 24, minAge: 16 };
  mockCreneauxParJour = {
    '2026-10-14': jour('2026-10-14', [creneau('18:00', '19:30')]),
  };
  mockApercu.mockResolvedValue(recapitulatif({ date: '2026-10-14' }));
});

afterEach(() => {
  jest.useRealTimers();
});

const joursDeLaBande = (/** @type {any} */ arbre) => [...new Set(arbre.root
  .findAll((/** @type {any} */ n) => typeof n.props?.testID === 'string' && /^jour-/.test(n.props.testID))
  .map((/** @type {any} */ n) => n.props.testID))];

describe('REGLES-RESERVATION — E-P03 : la bande de jours s’arrête aux jours permis', () => {
  it('sans réglage (ancien serveur) ou « Sans limite » (90) : les 14 jours, sans case fermée', async () => {
    const sansRegle = joursDeLaBande(await monter());
    expect(sansRegle).toHaveLength(14);
    expect(sansRegle.some((id) => id.startsWith('jour-pas-ouvert'))).toBe(false);
    mockRegles = { ...mockRegles, bookingDaysAhead: 90 };
    expect(joursDeLaBande(await monter())).toEqual(sansRegle);
  });

  it('4 jours à l’avance : aujourd’hui et les 4 jours suivants, puis une case « pas encore ouvert »', async () => {
    mockRegles = { ...mockRegles, bookingDaysAhead: 4 };
    expect(joursDeLaBande(await monter())).toEqual([
      'jour-2026-10-14', 'jour-2026-10-15', 'jour-2026-10-16', 'jour-2026-10-17', 'jour-2026-10-18',
      'jour-pas-ouvert-2026-10-19',
    ]);
  });

  it('la case fermée dit pourquoi, et quand le jour ouvrira ; « Revenir » ramène au dernier jour ouvert', async () => {
    mockRegles = { ...mockRegles, bookingDaysAhead: 4 };
    const arbre = await monter();
    await toucher(parRepere(arbre, 'jour-pas-ouvert-2026-10-19'));
    const vus = lisibles(arbre);
    expect(vus).toContain('Pas encore ouvert');
    expect(vus).toContain(
      'Le Five de Montrivage ouvre ses réservations 4 jours à l’avance. Le lundi 19 octobre sera réservable à partir du jeudi 15 octobre.',
    );
    await toucher(pressable(arbre, 'Revenir au dimanche 18 octobre'));
    expect(lisibles(arbre)).not.toContain('Pas encore ouvert');
    expect(parRepere(arbre, 'jour-2026-10-18').props.accessibilityState).toEqual({ selected: true });
  });
});
