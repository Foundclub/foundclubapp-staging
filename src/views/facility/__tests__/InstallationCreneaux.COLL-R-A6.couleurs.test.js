/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { listFacilitySeasonSlots } from '@/services/seasonSlot/seasonSlotService';

import { CLUB_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';

import InstallationCreneaux from '../InstallationCreneaux';

// 🎨 COLL-R-A6 (13/10/2026) — COL-019, décision d'Adel D13 = A (planche P7v4-couleur validée le
// 13/10 vers 02 h 22) : dans la semaine type d'une installation (« Créneaux »), chaque créneau
// prend la couleur de SON club — liseré et fond teinté —, la même que dans « Planning » : son rang
// dans la liste des clubs de la Ville. Une légende « couleur → club » au-delà de 2 clubs.
// ROUGE avant : tous les créneaux avaient le même liseré (Colors.primary500), au téléphone
// (InstallationCreneaux.js:310) comme sur le site (SeasonSlotWeekGrid.js:259).

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockNavigation;
let mockBureau = false;
/** @type {any[]} */
let mockCreneaux = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls' } }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 44,
  }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => mockBureau }));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  getSeasonSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  restoreSeasonSlot: jest.fn(),
  withdrawSeasonSlot: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  listFacilityClosures: jest.fn(() => Promise.resolve({ data: [], meta: {} })),
}));
// La liste des clubs de la Ville, dans l'ordre où le serveur la rend (par nom).
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({
    data: [
      { documentId: 'club-as', name: 'AS Montrivage' },
      { documentId: 'club-mb', name: 'Montrivage Basket' },
      { documentId: 'club-fc', name: 'Montrivage FC' },
    ],
  }),
  useCollectiviteInstallations: () => ({
    data: [{
      closingTime: '22:00:00.000',
      documentId: 'gym-tilleuls',
      maxSlots: 2,
      name: 'Gymnase des Tilleuls',
      openingTime: '08:00:00.000',
      type: 'Gymnase',
    }],
  }),
}));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => function SegmentedControlMock() {
  return null;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock() {
  return null;
});
jest.mock('@/components/organisms/seasonSlot/SeasonSlotForm', () => function SeasonSlotFormMock() {
  return null;
});

const creneau = (/** @type {any} */ champs) => ({
  attributedAt: '2026-09-01T08:00:00.000Z',
  club: { documentId: 'club-as', name: 'AS Montrivage' },
  facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
  plateau: null,
  source: 'attribution',
  status: 'active',
  team: { documentId: 'team-u15', name: 'U15' },
  validFrom: '2026-09-01',
  validUntil: '2027-06-30',
  ...champs,
});
const AS_MARDI = creneau({
  documentId: 'mar-u15', endTime: '19:00', startTime: '17:30', weekday: 2,
});
const MB_MERCREDI = creneau({
  club: { documentId: 'club-mb', name: 'Montrivage Basket' }, documentId: 'mer-basket', endTime: '20:30', startTime: '19:00', team: { documentId: 'team-sb', name: 'Seniors Basket' }, weekday: 3,
});
const FC_JEUDI = creneau({
  club: { documentId: 'club-fc', name: 'Montrivage FC' }, documentId: 'jeu-sb', endTime: '19:30', startTime: '18:00', team: { documentId: 'team-b', name: 'Senior B' }, weekday: 4,
});

// Les 3 premières couleurs des clubs : bleu, rouge, violet.
const [BLEU, ROUGE, VIOLET] = CLUB_PLANNING_PALETTE;

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textesDe = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());
const unTour = () => act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
const attendre = async () => {
  await unTour();
  await unTour();
  await unTour();
};

/**
 * Le liseré (bord gauche) du créneau `id` : celui de la carte (téléphone) ou du bloc (site).
 * @param {any} arbre - L'arbre rendu.
 * @param {string} id - Le documentId du créneau.
 * @returns {string | undefined} La couleur.
 */
const lisere = (arbre, id) => {
  const [touchable] = arbre.root.findAll((/** @type {any} */ n) => n.props.testID === `creneau-${id}`
    && typeof n.props.onPress === 'function');
  const avecLisere = [touchable, ...touchable.findAll(() => true)]
    .map((/** @type {any} */ n) => StyleSheet.flatten(n.props?.style) || {})
    .find((style) => style.borderLeftWidth === 3);
  return avecLisere?.borderLeftColor;
};

/** @type {any[]} */
const montes = [];
const rendre = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <InstallationCreneaux />
      </QueryClientProvider>,
    );
  });
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBureau = false;
  mockCreneaux = [AS_MARDI, MB_MERCREDI, FC_JEUDI];
  mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() };
  /** @type {any} */ (listFacilitySeasonSlots).mockImplementation(
    (/** @type {string} */ _id, /** @type {any} */ { status }) => Promise.resolve({
      data: status === 'withdrawn' ? [] : mockCreneaux,
      meta: {
        canManage: true,
        facility: {
          documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', plateaux: [],
        },
        season: { validFrom: '2026-09-01', validUntil: '2027-06-30' },
      },
    }),
  );
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('COL-019 — téléphone : la liste des créneaux, un liseré par club', () => {
  it('chaque club a la couleur de son rang dans la liste de la Ville', async () => {
    const arbre = await rendre();
    expect(lisere(arbre, 'mar-u15')).toBe(BLEU);
    expect(lisere(arbre, 'mer-basket')).toBe(ROUGE);
    expect(lisere(arbre, 'jeu-sb')).toBe(VIOLET);
  });

  it('Montrivage FC SEUL sur l’installation garde SA couleur (pas la 1re)', async () => {
    mockCreneaux = [FC_JEUDI];
    const arbre = await rendre();
    expect(lisere(arbre, 'jeu-sb')).toBe(VIOLET);
  });

  it('au-delà de 2 clubs, une légende « couleur → club » ; à 2 clubs, aucune', async () => {
    const arbre = await rendre();
    const [legende] = arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'creneaux-legende');
    expect(legende).toBeDefined();
    expect(legende.props.accessibilityLabel).toBe('Couleurs des clubs');
    expect(textesDe(legende)).toEqual(['AS Montrivage', 'Montrivage Basket', 'Montrivage FC']);

    mockCreneaux = [AS_MARDI, FC_JEUDI];
    const deux = await rendre();
    expect(deux.root.findAll((/** @type {any} */ n) => n.props.testID === 'creneaux-legende')).toHaveLength(0);
  });
});

describe('COL-019 — site : la semaine type, chaque bloc à la couleur de son club', () => {
  it('liseré du club, le nom en entier (deux lignes au besoin), et la légende', async () => {
    mockBureau = true;
    const arbre = await rendre();
    expect(lisere(arbre, 'mar-u15')).toBe(BLEU);
    expect(lisere(arbre, 'mer-basket')).toBe(ROUGE);
    expect(lisere(arbre, 'jeu-sb')).toBe(VIOLET);
    const [bloc] = arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'creneau-mer-basket'
      && typeof n.props.onPress === 'function');
    const [nom] = bloc.findAllByType(Text);
    expect(aplatir(nom.props.children)).toBe('Montrivage Basket');
    expect(nom.props.numberOfLines).toBe(2);
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'creneaux-legende').length)
      .toBeGreaterThan(0);
  });
});

// ➕ COLL-R-A6 (13/10/2026) — COL-004, reste du lot A1 : « Attribuer un créneau » porte l'icône
// « + » de la planche validée P4v2-creneaux-tel (l.28), avant le texte. Le correctif de taille de
// texte du lot A1 (Button.js) n'est pas retouché : un bouton à icône y passe déjà. ROUGE avant.
describe('COL-004 — « + Attribuer un créneau » (planche P4v2-creneaux-tel)', () => {
  it('le bouton porte l’icône « plus », au téléphone comme sur le site', async () => {
    const bouton = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props.title === 'Attribuer un créneau'
      && typeof n.props.onPress === 'function')[0];
    const telephone = bouton(await rendre());
    expect(telephone.props.icon).toBe('plus');
    expect(telephone.props.iconPosition).toBe('before');
    mockBureau = true;
    expect(bouton(await rendre()).props.icon).toBe('plus');
  });
});

jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonMock({ children }) { return children; },
);
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));
