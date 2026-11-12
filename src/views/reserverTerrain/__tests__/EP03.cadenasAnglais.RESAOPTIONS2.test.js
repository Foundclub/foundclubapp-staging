/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ReserverCreneau from '@/views/reserverTerrain/ReserverCreneau';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { creneau, recapitulatif } from '@/testSupport/temoinReserver';

// RESA-OPTIONS-2 (12/11/2026, D79) — maquette DESIGN-RESA-JOUEUR, section 3 « Au-delà de N jours » :
// le cadenas (icône `lockShut` du jeu de l'app, aucune dépendance) sur la case « pas encore ouvert »
// et au-dessus de « Pas encore ouvert » ; EN ANGLAIS, le jour garde sa majuscule (« Monday 19
// October can be booked… », pas « monday 19 october ») — le français reste en minuscule
// (témoin EP03.REGLESRESERVATION).

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
// L'app en ANGLAIS : le texte de en.js, le pluriel anglais (1 = singulier), `i18n.language` = 'en'.
jest.mock('react-i18next', () => {
  const en = jest.requireActual('@/theme/strings/translations/en').default;
  const lire = (/** @type {string} */ clef) => {
    const valeur = clef.split('.').reduce((/** @type {any} */ noeud, segment) => (noeud == null ? undefined : noeud[segment]), en);
    return typeof valeur === 'string' ? valeur : undefined;
  };
  const t = (/** @type {string} */ clef, /** @type {any} */ repliOuOptions, /** @type {any} */ options) => {
    const opts = repliOuOptions && typeof repliOuOptions === 'object' ? repliOuOptions : (options || {});
    const repli = typeof repliOuOptions === 'string' ? repliOuOptions : undefined;
    let texte;
    if (typeof opts.count === 'number') {
      const suffixe = opts.count === 1 ? '_one' : '_other';
      texte = lire(`${clef}${suffixe}`) ?? opts[`defaultValue${suffixe}`];
    }
    texte = texte ?? lire(clef) ?? repli ?? opts.defaultValue ?? clef;
    return String(texte).replace(/\{\{\s*(\w+)\s*\}\}/g, (/** @type {string} */ jeton, /** @type {string} */ nom) => (
      opts[nom] === undefined ? jeton : String(opts[nom])
    ));
  };
  const i18n = { language: 'en', t };
  return { Trans: (/** @type {any} */ { children }) => children, useTranslation: () => ({ i18n, t }) };
});
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

describe('RESA-OPTIONS-2 (D79) — E-P03, « Not open yet »', () => {
  it('le cadenas sur la case fermée et au-dessus de « Not open yet » (icône du thème)', async () => {
    mockRegles = { ...mockRegles, bookingDaysAhead: 4 };
    const arbre = await monter();
    expect(parRepere(arbre, 'cadenas-du-jour-pas-ouvert')).toBeTruthy();
    await toucher(parRepere(arbre, 'jour-pas-ouvert-2026-10-19'));
    expect(parRepere(arbre, 'creneau-pas-encore-ouvert-cadenas')).toBeTruthy();
    expect(parRepere(arbre, 'creneau-pas-encore-ouvert-cadenas').findAll((/** @type {any} */ n) => n.props?.name === 'lockShut')).not.toHaveLength(0);
    expect(parRepere(arbre, 'cadenas-du-jour-pas-ouvert').findAll((/** @type {any} */ n) => n.props?.name === 'lockShut')).not.toHaveLength(0);
  });

  it('en anglais, le jour garde sa majuscule : « Monday 19 October can be booked from Thursday 15 October. », « Back to Sunday 18 October »', async () => {
    mockRegles = { ...mockRegles, bookingDaysAhead: 4 };
    const arbre = await monter();
    await toucher(parRepere(arbre, 'jour-pas-ouvert-2026-10-19'));
    const vus = lisibles(arbre);
    expect(vus).toContain('Not open yet');
    expect(vus).toContain('Le Five de Montrivage opens bookings 4 days ahead. Monday 19 October can be booked from Thursday 15 October.');
    expect(pressable(arbre, 'Back to Sunday 18 October')).toBeTruthy();
  });
});
