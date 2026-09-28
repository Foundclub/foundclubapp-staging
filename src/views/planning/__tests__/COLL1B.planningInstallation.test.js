import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getFacilityPlanning } from '@/services/facility/facilityService';

import { resolvePlanningCardContent } from '@/utils/planning/planningSlots';

import PlanningWeekFullscreen from '../PersonalPlanningWeekFullscreen';

// COLL1B (29/09) — lot 1b du chantier Collectivites (SPEC D2, §2 C, §3).
// « Un membre ouvre son club -> une installation -> son planning de la semaine.
//   Il voit ce qui est occupe et donc ce qui est libre. Lecture seule. »
//
// L ecran n est PAS neuf : c est le planning « semaine » plein ecran qui existe
// deja (route PlanningWeekFullscreen, declaree aussi sur le site a /planning/week).
// Il gagne une source de plus, `facility`, qui lit la route du lot 1b.
//
// Ce que ce fichier fige :
//   - l ecran demande LA semaine affichee, pour CETTE installation (jamais « tout ») ;
//   - chaque bloc s annonce « club · equipe » (le serveur n envoie aucun titre) ;
//   - le bloc d un AUTRE club ne s ouvre pas ; celui de mon club s ouvre comme avant ;
//   - aucun bouton d ecriture : on navigue dans les semaines, on ferme, c est tout.
// ROUGE avant le lot : la source `facility` n existait pas (l ecran retombait sur
// « Mon planning »), ni `getFacilityPlanning`.

/** @type {any} */
let mockRoute;
/** @type {any} */
let mockNavigation;
/** @type {any[]} */
const mockTimelineProps = [];

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

jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) {
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
        capacityConflictMode: 'pending_validation', documentId: 'gym-ville', maxSlots: 2, name: 'Gymnase de la Ville', planningColor: null,
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

describe('COLL1B — le planning d une installation, lu par un membre', () => {
  test('l ecran demande LA semaine affichee pour CETTE installation, a la route du lot 1b', async () => {
    await rendre();

    expect(getFacilityPlanning).toHaveBeenCalledTimes(1);
    expect(getFacilityPlanning).toHaveBeenCalledWith('gym-ville', { from: '2026-10-05', to: '2026-10-11' });
  });

  test('chaque bloc s annonce « club · equipe », jamais autre chose', async () => {
    await rendre();

    const derniers = mockTimelineProps[mockTimelineProps.length - 1];
    expect(derniers.mode).toBe('week');
    expect(derniers.events.map((bloc) => resolvePlanningCardContent(bloc).primaryLabel)).toEqual([
      'AS Ville A · Seniors A',
      'US Ville B · Seniors B',
    ]);
  });

  test('l entete dit de quelle installation il s agit', async () => {
    const arbre = await rendre();

    expect(texte(arbre)).toContain('Gymnase de la Ville');
    expect(texte(arbre)).toContain('Planning de l’installation');
  });

  test('le bloc d un AUTRE club ne s ouvre pas ; celui de MON club s ouvre comme avant', async () => {
    await rendre();
    const { events, onEventPress } = mockTimelineProps[mockTimelineProps.length - 1];

    act(() => {
      onEventPress(events[1]);
    });
    expect(mockNavigation.navigate).not.toHaveBeenCalled();

    act(() => {
      onEventPress(events[0]);
    });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'evt-A' },
      screen: 'EventDetails',
    });
  });

  test('lecture seule : on change de semaine, on ferme — aucun geste d ecriture', async () => {
    const arbre = await rendre();

    const gestes = arbre.root.findAllByType(TouchableOpacity)
      .map((/** @type {any} */ noeud) => noeud.props.accessibilityLabel || texte({ root: noeud }))
      .filter(Boolean);
    expect(gestes.length).toBeGreaterThan(0);
    gestes.forEach((geste) => {
      expect(geste).not.toMatch(/cr[ée]er|modifier|supprimer|r[ée]server|demander|ajouter|inscri/i);
    });
  });
});
