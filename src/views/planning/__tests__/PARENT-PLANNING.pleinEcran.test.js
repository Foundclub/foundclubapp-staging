import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { getMyPlanning } from '@/services/event/eventService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// PARENT-PLANNING (06/10/2026, « calendrier B » du chef d orchestre) — LE CALENDRIER PLEIN ECRAN D
// UN
// PARENT. Le calendrier du planning ouvre cet ecran (« Mon planning » en grand) : il doit demander,
// lui
// aussi, les creneaux des enfants (`withChildren`, recu en parametre) et ecrire le prenom de l
// enfant sur
// chaque creneau qui le concerne. Sans le parametre, la demande ne change pas.
// Harnais repris du temoin COLL-FIX-PLANNING.G4 (les memes doublures).

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
/** @type {any[]} */
const mockTimelineProps = [];

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ height: 844, width: 390 }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'paul', role: { name: 'Parent', type: 'parent' } } }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useIsFocused: () => true,
  useNavigation: () => ({
    addListener: () => () => {},
    goBack: () => {},
    navigate: () => {},
    setOptions: () => {},
    setParams: () => {},
  }),
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
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});
jest.mock('@/components/organisms/planningWeekTimelineView', () => function TimelineMock(
  /** @type {any} */ props,
) {
  mockTimelineProps.push(props);
  return null;
});
jest.mock('@/components/organisms/planningCalendarView', () => function CalendarMock() {
  return null;
});
jest.mock('@/platform/storage', () => ({
  ...jest.requireActual('@/platform/storage'),
  getItem: () => undefined,
  setItem: () => {},
}));
jest.mock('@/components/molecules/input/Input', () => function InputMock() { return null; });
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock() { return null; },
);
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
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(async () => ({ data: [], meta: {} })),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteClubs: jest.fn(async () => ({ data: [] })),
  getCollectiviteInstallations: jest.fn(async () => ({ data: [] })),
  getMyCollectivites: jest.fn(async () => ({ data: [] })),
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
jest.mock('@/services/collectivite/collectiviteCanauxService', () => ({
  ecrireLePremierMessageAuClub: jest.fn(),
  trouverConversationAvecLeClub: jest.fn(),
}));

const CRENEAU_DE_HUGO = {
  documentId: 'e1',
  endAt: '2026-03-04T18:30:00.000Z',
  hasExplicitTime: true,
  kind: 'training',
  startAt: '2026-03-04T17:00:00.000Z',
  title: 'Entrainement U15',
  viewerChildren: [{ documentId: 'hugo', firstname: 'Hugo' }],
  viewerChildrenOnly: true,
};

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
  montes.push({ arbre, client });
  return arbre;
};
const titres = () => (mockTimelineProps[mockTimelineProps.length - 1]?.events || [])
  .map((/** @type {any} */ creneau) => creneau.title);

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
  mockRoute = { params: { date: '2026-03-04T10:00:00.000Z', sourceType: 'personal' } };
  /** @type {any} */ (getMyPlanning).mockResolvedValue({
    data: [CRENEAU_DE_HUGO], meta: { total: 1 },
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

describe('PARENT-PLANNING / calendrier plein ecran d un parent', () => {
  test('ROUGE-AVANT — avec `withChildren` en parametre, la demande porte le drapeau', async () => {
    mockRoute.params.withChildren = true;
    await rendre();
    expect(getMyPlanning).toHaveBeenCalled();
    expect(/** @type {any} */ (getMyPlanning).mock.calls[0][0].withChildren).toBe(true);
  });

  test('ROUGE-AVANT — le creneau de Hugo porte son prenom', async () => {
    mockRoute.params.withChildren = true;
    await rendre();
    expect(titres()).toContain('Hugo · Entrainement U15');
  });

  test('PROTEGE — sans le parametre, la demande ne porte pas le drapeau', async () => {
    await rendre();
    expect(getMyPlanning).toHaveBeenCalled();
    expect(/** @type {any} */ (getMyPlanning).mock.calls[0][0].withChildren).toBeUndefined();
  });
});
