import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getFacilityPlanning } from '@/services/facility/facilityService';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// COLL1D (29/09) — les restes du lot 1b (SPEC §7, ligne 1b ; §2 C) sur le planning d UNE
// installation :
//   - « une couleur par club » : chaque club recoit la sienne, la meme d un bloc a l autre ;
//   - le texte de capacite, ecrit pour un dirigeant (« depassements », « notifieront les
//     dirigeants »), a un pendant pour le MEMBRE (joueur, parent) : ce qui est libre.
// ROUGE avant le lot : tous les blocs prenaient la couleur de l installation, et le
// joueur lisait le texte du dirigeant.
//
// Harnais repris de COLL1B.planningInstallation.test.js (memes doublures), plus la
// session (`useAuth`, doublee : son vrai module charge les services).

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockTimelineProps = [];
/** @type {any} */
let mockAuth;

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
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
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const gabarit = (() => {
        if (typeof repli === 'string') return repli;
        if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
        if (repli && typeof repli.defaultValue_other === 'string') return repli.defaultValue_other;
        return cle;
      })();
      const variables = (repli && typeof repli === 'object') ? repli : (valeurs || {});
      return gabarit.replace(/\{\{(\w+)\}\}/g, (entier, nom) => (
        variables[nom] === undefined ? entier : String(variables[nom])
      ));
    },
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
      Images: {
        arrowLeft: 1, arrowRight: 2, close: 3,
      },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({
  children,
}) {
  return children;
});

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { accessibilityLabel: props.title, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

// La grille de la semaine est doublee : on regarde CE QU ELLE RECOIT (les blocs,
// et ce qu un appui en fait). Son libelle de bloc est calcule, plus bas, par la
// VRAIE fonction qu elle appelle (`resolvePlanningCardContent`).
jest.mock('@/components/organisms/planningWeekTimelineView', () => function TimelineMock(
  /** @type {any} */ props,
) {
  mockTimelineProps.push(props);
  return null;
});

jest.mock('@/utils/device/orientation', () => ({
  lockToLandscape: jest.fn(),
  lockToPortrait: jest.fn(),
}));

jest.mock('@/services/event/eventService', () => ({
  getClubPlanning: jest.fn(),
  getMyPlanning: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock('@/services/multisportClub/multisportClubService', () => ({
  getClubSharedPlanning: jest.fn(),
  getCMPlanning: jest.fn(),
}));

// PLANNING-PORTRAIT (01/10) : la fiche d un bloc (mairie) vit dans une feuille du bas.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});

// PLANNING-PORTRAIT (01/10) : l ecran demande si le compte GERE l installation (ici, non).
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteClubs: jest.fn(() => Promise.resolve({ data: [] })),
  getCollectiviteInstallations: jest.fn(() => Promise.resolve({ data: [] })),
  getMyCollectivites: jest.fn(() => Promise.resolve({ data: [] })),
}));

// COLL-C2B (02/10) : le planning d une installation a desormais 5 vues (Mois = le calendrier) et
// les gestes de la mairie (le service des creneaux) : deux doublures, sans effet sur ce temoin.
jest.mock(
  '@/components/organisms/planningCalendarView',
  () => function CalendarMock() { return null; },
);
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

// COLL-C4B-BIS (03/10) : le planning lit aussi les fermetures (panneau sur ordinateur, bandeau).
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(async () => ({ data: [], meta: {} })),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({
  getFacilityPlanning: jest.fn(),
}));

// Ce que rend la route du lot 1b pour un joueur du club A (liste blanche serveur).
const BLOC_DE_MON_CLUB = {
  club: { documentId: 'club-A', name: 'AS Ville A' },
  documentId: 'evt-A',
  endAt: '2026-10-05T17:30:00.000Z',
  endTime: '19:30:00.000',
  facility: { documentId: 'gym-ville', name: 'Gymnase de la Ville', planningColor: null },
  hasExplicitTime: true,
  isOwnClub: true,
  kind: 'event',
  leagueMatch: false,
  startAt: '2026-10-05T16:00:00.000Z',
  startTime: '18:00:00.000',
  team: { name: 'Seniors A' },
  title: 'AS Ville A · Seniors A',
};
const BLOC_D_UN_AUTRE_CLUB = {
  ...BLOC_DE_MON_CLUB,
  club: { documentId: 'club-B', name: 'US Ville B' },
  documentId: null,
  endTime: '20:00:00.000',
  isOwnClub: false,
  startAt: '2026-10-05T16:30:00.000Z',
  startTime: '18:30:00.000',
  team: { name: 'Seniors B' },
  title: 'US Ville B · Seniors B',
};

/** @type {any[]} */
const arbres = [];

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
  // React Query notifie par un setTimeout(0) : on laisse passer un tour de minuterie.
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 20); });
  });
  arbres.push({ arbre, client });
  return arbre;
};

const texte = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''))
  .join(' | ');

beforeEach(() => {
  jest.clearAllMocks();
  mockTimelineProps.length = 0;
  mockAuth = { userData: { role: { name: 'Joueur', type: 'joueur' } } };
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockRoute = {
    params: {
      contextDetailLabel: 'Gymnase de la Ville',
      date: '2026-10-07T10:00:00.000Z',
      facilityId: 'gym-ville',
      sourceType: 'facility',
    },
  };
  getFacilityPlanning.mockResolvedValue({
    data: [BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB],
    meta: {
      facility: {
        capacityConflictMode: 'pending_validation',
        documentId: 'gym-ville',
        maxSlots: 2,
        name: 'Gymnase de la Ville',
        planningColor: null,
      },
      from: '2026-10-05',
      to: '2026-10-11',
      total: 2,
    },
  });
});

afterEach(() => {
  act(() => {
    arbres.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

const couleurDe = (/** @type {any} */ bloc) => bloc.displayColor;

describe('COLL1D — planning d une installation : couleur par club, texte du membre', () => {
  test('2 clubs = 2 couleurs ; deux blocs du meme club = la meme couleur', async () => {
    const DEUXIEME_BLOC_DE_B = {
      ...BLOC_D_UN_AUTRE_CLUB,
      endTime: '21:00:00.000',
      startAt: '2026-10-07T17:00:00.000Z',
      startTime: '19:00:00.000',
    };
    getFacilityPlanning.mockResolvedValue({
      data: [BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB, DEUXIEME_BLOC_DE_B],
      meta: { facility: { documentId: 'gym-ville', maxSlots: 2, name: 'Gymnase de la Ville' } },
    });
    await rendre();
    const { events } = mockTimelineProps[mockTimelineProps.length - 1];
    const [a, b, bBis] = events.map(couleurDe);

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
    expect(bBis).toBe(b);
  });

  test('un MEMBRE (joueur) : ni « dirigeants », ni « dépassements », ni « slots »', async () => {
    mockAuth = { userData: { role: { name: 'Joueur', type: 'joueur' } } };
    const lu = texte(await rendre());

    // COLL-C2B (02/10, design P5-jour, RETIRE) : un membre n a plus de bloc capacite, « ses
    // phrases ne le concernent pas » ; il lit son club en couleur, les autres en gris.
    expect(lu).not.toMatch(/équipes? à la fois|place libre|complet/i);
    expect(lu).not.toMatch(/dirigeant|dépassement|slot/i);
  });

  test('complet, vu par un membre : « Complet » dit simplement', async () => {
    mockAuth = { userData: { role: { name: 'Joueur', type: 'joueur' } } };
    getFacilityPlanning.mockResolvedValue({
      data: [BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB],
      meta: { facility: { documentId: 'gym-ville', maxSlots: 1, name: 'Gymnase de la Ville' } },
    });
    const lu = texte(await rendre());

    // COLL-C2B (02/10, design P5-jour, RETIRE) : plus aucune phrase de capacite pour un membre.
    expect(lu).not.toMatch(/complet|équipes? à la fois/i);
    expect(lu).not.toMatch(/dirigeant|dépassement|demande en attente/i);
  });

  test('un DIRIGEANT garde le texte qui lui parle de ses demandes', async () => {
    mockAuth = { userData: { role: { name: 'Dirigeant', type: 'president' } } };
    getFacilityPlanning.mockResolvedValue({
      data: [BLOC_DE_MON_CLUB, BLOC_D_UN_AUTRE_CLUB],
      meta: {
        facility: {
          capacityConflictMode: 'pending_validation',
          documentId: 'gym-ville',
          maxSlots: 1,
          name: 'Gymnase de la Ville',
        },
      },
    });
    const lu = texte(await rendre());

    expect(lu).toContain('demande en attente');
  });
});
