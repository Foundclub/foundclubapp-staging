/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import {
  getCollectiviteClubs,
  getCollectiviteInstallations,
  getMyCollectivites,
} from '@/services/collectivite/collectiviteService';
import { getFacilityPlanning } from '@/services/facility/facilityService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// 🎨 COLL-FIX-PLANNING (02/10/2026), defaut de la tournee T9 (capture T9_C29_2) — cote ECRAN :
// dans la semaine tenue droite, deux seances qui se chevauchent deviennent une seule carte
// (PlanningWeekTimelineViewV2, temoin PlanningWeekTimelineView.COLL-FIX-PLANNING.grappe). Son
// appui doit mener quelque part : le planning d une installation passe alors en vue JOUR, ou les
// seances se lisent cote a cote. Telephone tourne, la semaine est imposee : rien a ouvrir.
// ROUGE avant le correctif : la grille ne recevait aucun « onSummaryPress ».
// Harnais repris du temoin COLL-FIX-PLANNING.G4.fenetresHorsNavigation (les memes doublures).

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

const PORTRAIT = { height: 844, width: 390 };

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockTimelineProps = [];
/** @type {any} */
let mockAuth;
/** @type {any} */
let mockDimensions = PORTRAIT;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));
const mockDansLaFenetre = require('react').createContext(false);

jest.mock('@react-navigation/native', () => {
  const horsNavigation = (/** @type {string} */ quoi) => {
    if (jest.requireActual('react').useContext(mockDansLaFenetre)) {
      throw new Error(`Couldn't find a ${quoi} object. Is your component inside NavigationContainer?`);
    }
  };
  return {
    useFocusEffect: () => horsNavigation('navigation'),
    useIsFocused: () => { horsNavigation('navigation'); return true; },
    useNavigation: () => { horsNavigation('navigation'); return mockNavigation; },
    useRoute: () => { horsNavigation('route'); return mockRoute; },
  };
});
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
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  if (!isVisible) return null;
  return jest.requireActual('react').createElement(mockDansLaFenetre.Provider, { value: true }, children);
});
jest.mock('@/components/organisms/planningWeekTimelineView', () => function TimelineMock(
  /** @type {any} */ props,
) {
  mockTimelineProps.push(props);
  return null;
});
/** @type {any[]} */
const mockCalendarProps = [];
jest.mock('@/components/organisms/planningCalendarView', () => function CalendarMock(
  /** @type {any} */ props,
) {
  mockCalendarProps.push(props);
  return null;
});
/** @type {any} */
let mockVueRetenue;
const mockSetItem = jest.fn();
jest.mock('@/platform/storage', () => ({
  ...jest.requireActual('@/platform/storage'),
  getItem: () => mockVueRetenue,
  setItem: (/** @type {any[]} */ ...args) => mockSetItem(...args),
}));
/** @type {any[]} */
const mockInputProps = [];
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: PressableRN,
  } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/utils/device/orientation', () => ({
  lockToLandscape: jest.fn(),
  lockToPortrait: jest.fn(),
  unlockAllOrientations: jest.fn(),
}));
jest.mock('@/services/event/eventService', () => ({
  getClubPlanning: jest.fn(),
  getMyPlanning: jest.fn(),
}));
jest.mock('@/services/multisportClub/multisportClubService', () => ({
  getClubSharedPlanning: jest.fn(),
  getCMPlanning: jest.fn(),
}));
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

const mockOuvrir = jest.fn();
jest.mock('@/services/collectivite/collectiviteCanauxService', () => ({
  ouvrirConversationAvecLeClub: (/** @type {any} */ args) => mockOuvrir(args),
}));

// Des secrets semes : si l un s affiche, la mairie lirait une personne.
const SECRETS = ['Jeanne', 'SECRET-NOM', 'jeanne.secret@exemple.fr'];
const PERSONNE = { email: SECRETS[2], firstname: SECRETS[0], lastname: SECRETS[1] };

const bloc = (/** @type {any} */ champs) => ({
  createdBy: PERSONNE,
  endAt: '2026-03-04T18:30:00.000Z',
  endTime: '19:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  kind: 'event',
  leagueMatch: false,
  origin: 'club',
  pending: false,
  plateau: null,
  slot: null,
  startAt: '2026-03-04T17:00:00.000Z',
  startTime: '18:00:00.000',
  ...champs,
});
const BLOC_DE_MON_CLUB = bloc({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: 'evt-A',
  isOwnClub: true,
  team: { name: 'Seniors A', trainers: [PERSONNE] },
  title: 'AS Ville A · Seniors A',
});
const BLOC_D_UN_AUTRE_CLUB = bloc({
  club: { documentId: 'club-B', name: 'US Ville B', president: PERSONNE },
  documentId: null,
  endAt: '2026-03-04T19:00:00.000Z',
  endTime: '20:00:00.000',
  isOwnClub: false,
  kind: 'slot',
  origin: 'slot',
  slot: {
    documentId: 'slot-B',
    source: 'attribution',
    validFrom: '2025-09-01',
    validUntil: '2026-06-30',
    weekday: 3,
  },
  startAt: '2026-03-04T17:30:00.000Z',
  startTime: '18:30:00.000',
  team: { name: 'Seniors B' },
  title: 'US Ville B · Seniors B',
});
const BLOC_EN_ATTENTE = bloc({
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: null,
  isOwnClub: false,
  origin: 'request',
  pending: true,
  team: { name: 'U13' },
  title: 'AS Ville A · U13',
});

const reponse = (/** @type {any[]} */ blocs) => ({
  data: blocs,
  meta: {
    facility: {
      capacityConflictMode: 'pending_validation',
      documentId: 'gym-ville',
      maxSlots: 2,
      name: 'Gymnase de la Ville',
      plateaux: [],
    },
  },
});

const JOUEUR = { userData: { role: { name: 'Joueur', type: 'joueur' } } };
/** @type {any[]} */
const montes = [];
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 20); }); });
};
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
  await attendre();
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};
const grille = () => mockTimelineProps[mockTimelineProps.length - 1];

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
  mockCalendarProps.length = 0;
  mockInputProps.length = 0;
  mockVueRetenue = undefined;
  mockDimensions = PORTRAIT;
  mockAuth = JOUEUR;
  mockNavigation = {
    addListener: jest.fn(() => jest.fn()),
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
  };
  mockRoute = {
    params: {
      contextDetailLabel: 'Gymnase de la Ville',
      date: '2026-03-04T10:00:00.000Z',
      facilityId: 'gym-ville',
      sourceType: 'facility',
    },
  };
  /** @type {any} */ (getFacilityPlanning).mockResolvedValue(
    reponse([BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB, BLOC_EN_ATTENTE]),
  );
  /** @type {any} */ (getMyCollectivites).mockResolvedValue({ data: [] });
  /** @type {any} */ (getCollectiviteInstallations).mockResolvedValue({ data: [] });
  /** @type {any} */ (getCollectiviteClubs).mockResolvedValue({
    data: [{ documentId: 'club-B', email: 'contact@usvilleb.fr', name: 'US Ville B' }],
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

describe('COLL-FIX-PLANNING 3 — la grappe de la semaine ouvre la vue Jour', () => {
  it('telephone tenu droit, semaine retenue : l appui sur une grappe passe en vue Jour', async () => {
    mockVueRetenue = 'week';
    await rendre();
    expect(grille().mode).toBe('week');
    expect(typeof grille().onSummaryPress).toBe('function');
    await act(async () => { grille().onSummaryPress(); });
    await attendre();
    expect(grille().mode).toBe('day');
  });

  it('telephone tourne : la semaine est imposee, rien a ouvrir', async () => {
    mockVueRetenue = 'week';
    mockDimensions = { height: 390, width: 844 };
    await rendre();
    expect(grille().mode).toBe('week');
    expect(grille().onSummaryPress).toBeUndefined();
  });
});
