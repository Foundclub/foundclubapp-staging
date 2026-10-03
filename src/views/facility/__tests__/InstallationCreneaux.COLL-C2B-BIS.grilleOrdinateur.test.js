/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  getSeasonSlot,
  listFacilitySeasonSlots,
} from '@/services/seasonSlot/seasonSlotService';

import InstallationCreneaux from '../InstallationCreneaux';

// 📐 COLL-C2B-BIS (03/10) — planche 23, ORDINATEUR : « l échelle d heures » (design HY521H1,
// P4v2-creneaux-ordi, état A). La semaine type de l installation en 7 colonnes À L ÉCHELLE DES
// HEURES : la colonne des heures à gauche, chaque créneau à sa hauteur, deux créneaux de la même
// heure côte à côte, le moment complet teinté, les heures sans créneau repliées. Une case vide se
// clique : « Attribuer », déjà rempli du jour ET de l heure.
//
// ROUGE avant le lot : sur ordinateur, 7 colonnes de cartes empilées, sans aucune heure ; le
// « + Attribuer » d une colonne ne remplissait que le jour.

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
/** @type {any[]} */
const mockFormProps = [];

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
// L ordinateur.
jest.mock('@/responsive', () => ({ useIsDesktop: () => true }));
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
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({ data: [{ documentId: 'club-as', name: 'AS Montrivage' }] }),
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
// Le formulaire d attribution a ses propres témoins : ici, on lit ce qu il reçoit.
jest.mock('@/components/organisms/seasonSlot/SeasonSlotForm', () => function SeasonSlotFormMock(
  /** @type {any} */ props,
) {
  mockFormProps.push(props);
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
const CRENEAUX = [
  creneau({
    documentId: 'mar-u15', endTime: '19:00', startTime: '17:30', weekday: 2,
  }),
  creneau({
    documentId: 'jeu-u15', endTime: '19:30', startTime: '18:00', weekday: 4,
  }),
  creneau({
    club: { documentId: 'club-fc', name: 'Montrivage FC' },
    documentId: 'jeu-sb',
    endTime: '19:30',
    startTime: '18:00',
    team: { documentId: 'team-sb', name: 'Senior B' },
    weekday: 4,
  }),
];
/** @type {boolean} */
let mockGere = true;

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const touchable = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props.testID === id
    && typeof noeud.props.onPress === 'function')[0];
const attendre = async () => {
  for (let tour = 0; tour < 3; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 0); }); });
  }
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
  mockFormProps.length = 0;
  mockGere = true;
  mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() };
  /** @type {any} */ (listFacilitySeasonSlots).mockImplementation(
    (/** @type {string} */ _id, /** @type {any} */ { status }) => Promise.resolve({
      data: status === 'withdrawn' ? [] : CRENEAUX,
      meta: {
        canManage: mockGere,
        facility: {
          documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', plateaux: [],
        },
        season: { validFrom: '2026-09-01', validUntil: '2027-06-30' },
      },
    }),
  );
  /** @type {any} */ (getSeasonSlot).mockResolvedValue({
    data: { ...CRENEAUX[2], sessionsCount: 3 }, meta: { canManage: true },
  });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('COLL-C2B-BIS — planche 23, ordinateur : la semaine type à l échelle des heures', () => {
  it('la colonne des heures, la bande à l échelle, les heures repliées', async () => {
    const arbre = await rendre();
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'semaine-type-grille').length)
      .toBeGreaterThan(0);
    const lus = textes(arbre);
    expect(lus).toEqual(expect.arrayContaining(['17:30', '18:00', '19:00']));
    expect(lus).toContain('Aucun créneau de 08:00 à 17:30');
    expect(lus).toContain('Aucun créneau de 19:30 à 22:00');
    // 17:30 – 19:30 : 120 minutes, à raison d un point par minute.
    const [bande] = arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'grille-bande-17:30');
    expect(bande.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ height: 120 })]));
  });

  it('le jeudi complet : deux blocs côte à côte, teinté, et dit sous la grille', async () => {
    const arbre = await rendre();
    const u15 = touchable(arbre, 'creneau-jeu-u15');
    const sb = touchable(arbre, 'creneau-jeu-sb');
    expect([u15.props.style.left, u15.props.style.width]).toEqual(['0%', '50%']);
    expect([sb.props.style.left, sb.props.style.width]).toEqual(['50%', '50%']);
    // Un créneau seul garde toute la largeur ; 30 minutes sous le haut de la bande (17:30 → 18:00).
    const mardi = touchable(arbre, 'creneau-mar-u15');
    expect(mardi.props.style.width).toBe('100%');
    expect(u15.props.style.top).toBe(31);
    expect(textes(arbre)).toContain('Jeudi teinté : complet de 18:00 à 19:30.');
  });

  it('une case vide ouvre « Attribuer », déjà rempli du jour ET de l heure', async () => {
    const arbre = await rendre();
    const caseVide = touchable(arbre, 'case-vide-3-17:30');
    expect(caseVide.props.accessibilityLabel).toBe('Attribuer le mercredi à 17:30');
    await act(async () => { caseVide.props.onPress(); });
    await attendre();
    expect(textes(arbre)).toContain('Attribuer un créneau');
    expect(mockFormProps.at(-1)?.initial).toEqual({ endTime: '19:00', startTime: '17:30', weekday: 3 });
  });

  it('un bloc ouvre sa fiche (gérer)', async () => {
    const arbre = await rendre();
    await act(async () => { touchable(arbre, 'creneau-jeu-sb').props.onPress(); });
    await attendre();
    expect(textes(arbre)).toContain('Montrivage FC · Senior B');
  });

  it('un lecteur qui ne gère pas : aucune case à cliquer', async () => {
    mockGere = false;
    const arbre = await rendre();
    expect(touchable(arbre, 'case-vide-3-17:30')).toBeUndefined();
    expect(textes(arbre)).toEqual(expect.arrayContaining(['17:30', '18:00']));
  });
});
