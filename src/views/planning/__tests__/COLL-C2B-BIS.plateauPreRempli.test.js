/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getMyCollectivites,
} from '@/services/collectivite/collectiviteService';
import { getFacilityPlanning } from '@/services/facility/facilityService';
import {
  listFacilitySeasonSlots,
  previewFacilitySeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// 📐 COLL-C2B-BIS (03/10) — planches 24 et 29 : TOUCHER UNE HEURE LIBRE PRÉ-REMPLIT SON PLATEAU
// (design HY521H1, P4v3-plateaux écran 3 et P5v2-vues écran 5). En vue Jour, le planning d une
// installation à plateaux nommés a une colonne par plateau (D66) ; la mairie touche une heure libre
// dans la colonne du « Plateau B » ⇒ « Attribuer pour la saison » s ouvre avec CE plateau et cette
// heure (la carte de place parle du plateau). Dans la colonne « Indifférent » : aucun plateau.
// Un dirigeant qui demande un créneau ne choisit pas de plateau (la mairie l attribue).
// ROUGE avant le lot : le geste ne disait que le jour et l heure ; le plateau restait « Indifférent ».

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockTimelineProps = [];
/** @type {any[]} */
const mockFormProps = [];

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ height: 844, width: 390 }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { role: { name: 'Authenticated', type: 'authenticated' } } }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
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
      Images: { arrowLeft: 1, arrowRight: 2, close: 3 },
      Spaces: espaces,
    }),
  };
});
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) { return children; });
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(/** @type {any} */ { children, isVisible }) {
  return isVisible ? children : null;
});
jest.mock('@/components/organisms/planningWeekTimelineView', () => function TimelineMock(/** @type {any} */ props) {
  mockTimelineProps.push(props);
  return null;
});
jest.mock('@/components/organisms/planningCalendarView', () => function CalendarMock() { return null; });
jest.mock('@/platform/storage', () => ({
  ...jest.requireActual('@/platform/storage'),
  getItem: () => undefined,
  setItem: jest.fn(),
}));
// Le formulaire a ses propres témoins : ici, on lit ce qu il reçoit.
jest.mock('@/components/organisms/seasonSlot/SeasonSlotForm', () => function SeasonSlotFormMock(/** @type {any} */ props) {
  mockFormProps.push(props);
  return null;
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(PressableRN, { disabled: props.disabled, onPress: props.onPress }, reactActuel.createElement(TexteRN, null, props.title));
  };
});
jest.mock('@/utils/device/orientation', () => ({
  lockToLandscape: jest.fn(),
  lockToPortrait: jest.fn(),
  unlockAllOrientations: jest.fn(),
}));
jest.mock('@/services/event/eventService', () => ({ getClubPlanning: jest.fn(), getMyPlanning: jest.fn() }));
jest.mock('@/services/multisportClub/multisportClubService', () => ({ getClubSharedPlanning: jest.fn(), getCMPlanning: jest.fn() }));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteClubs: jest.fn(),
  getCollectiviteInstallations: jest.fn(),
  getMyCollectivites: jest.fn(),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  getSeasonSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
  restoreSeasonSlot: jest.fn(),
  withdrawSeasonSlot: jest.fn(),
}));

// Un créneau d un autre club sur le Plateau B, mercredi 4 mars 2026.
const BLOC_PLATEAU_B = {
  club: { documentId: 'club-B', name: 'US Ville B' },
  documentId: null,
  endAt: '2026-03-04T19:00:00.000Z',
  endTime: '20:00:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  isOwnClub: false,
  kind: 'slot',
  leagueMatch: false,
  origin: 'slot',
  pending: false,
  plateau: { name: 'Plateau B', number: 2 },
  slot: {
    documentId: 'slot-B', source: 'attribution', validFrom: '2025-09-01', validUntil: '2026-06-30', weekday: 3,
  },
  startAt: '2026-03-04T17:30:00.000Z',
  startTime: '18:30:00.000',
  team: { name: 'Seniors B' },
  title: 'US Ville B · Seniors B',
};
const BLOC_SANS_PLATEAU = {
  ...BLOC_PLATEAU_B, club: { documentId: 'club-A', name: 'AS Ville A' }, plateau: null, slot: { ...BLOC_PLATEAU_B.slot, documentId: 'slot-A' }, title: 'AS Ville A · U15',
};
const PLATEAUX = ['Plateau A', 'Plateau B'];

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const grille = () => mockTimelineProps[mockTimelineProps.length - 1];
const attendre = async () => {
  for (let tour = 0; tour < 3; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 20); }); });
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
        <PlanningWeekFullscreen />
      </QueryClientProvider>,
    );
  });
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};
const toucher = async (/** @type {number} */ heure, /** @type {number | undefined} */ voie) => {
  await act(async () => { grille().onFreeSlotPress(new Date(2026, 2, 4), heure, voie); });
  await attendre();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
  mockFormProps.length = 0;
  mockNavigation = {
    goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(), setParams: jest.fn(),
  };
  mockRoute = {
    params: {
      contextDetailLabel: 'Gymnase de la Ville', date: '2026-03-04T10:00:00.000Z', facilityId: 'gym-ville', sourceType: 'facility',
    },
  };
  /** @type {any} */ (getFacilityPlanning).mockResolvedValue({
    data: [BLOC_PLATEAU_B, BLOC_SANS_PLATEAU],
    meta: {
      facility: {
        capacityConflictMode: 'pending_validation', documentId: 'gym-ville', maxSlots: 2, name: 'Gymnase de la Ville', plateaux: PLATEAUX,
      },
    },
  });
  // La mairie de la Ville propriétaire.
  /** @type {any} */ (getMyCollectivites).mockResolvedValue({ data: [{ documentId: 'ville-1', name: 'Ville de Montrivage' }] });
  /** @type {any} */ (getCollectiviteInstallations).mockResolvedValue({ data: [{ documentId: 'gym-ville', maxSlots: 2, name: 'Gymnase de la Ville' }] });
  /** @type {any} */ (getCollectiviteClubs).mockResolvedValue({ data: [{ documentId: 'club-B', name: 'US Ville B' }] });
  /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
    data: [],
    meta: { canManage: true, facility: { maxSlots: 2, name: 'Gymnase de la Ville', plateaux: PLATEAUX }, season: { validFrom: '2025-09-01', validUntil: '2026-06-30' } },
  });
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({ data: { capacity: 2, needsConfirmation: false, occupants: [] } });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('COLL-C2B-BIS — planches 24 et 29 : l heure libre d un plateau pré-remplit ce plateau', () => {
  it('la colonne du « Plateau B » ⇒ « Attribuer » avec le plateau 2 et l heure touchée', async () => {
    const arbre = await rendre();
    expect(grille().lanes.map((/** @type {any} */ colonne) => colonne.label)).toEqual(['Plateau A', 'Plateau B', 'Indifférent']);
    await toucher(18, 1);
    expect(textes(arbre)).toContain('Mercredi 18:00 – 19:30');
    expect(mockFormProps.at(-1)?.initial).toEqual({
      endTime: '19:30', plateau: 2, startTime: '18:00', weekday: 3,
    });
  });

  it('la colonne du « Plateau A » ⇒ le plateau 1', async () => {
    await rendre();
    await toucher(9, 0);
    expect(mockFormProps.at(-1)?.initial).toEqual(expect.objectContaining({ plateau: 1, startTime: '09:00' }));
  });

  it('la colonne « Indifférent », ou sans colonne : aucun plateau', async () => {
    await rendre();
    await toucher(18, 2);
    expect(mockFormProps.at(-1)?.initial?.plateau ?? null).toBeNull();
    await toucher(18, undefined);
    expect(mockFormProps.at(-1)?.initial?.plateau ?? null).toBeNull();
  });
});
