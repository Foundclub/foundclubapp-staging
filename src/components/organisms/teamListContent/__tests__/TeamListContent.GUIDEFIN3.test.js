import renderer, { act } from 'react-test-renderer';

// GUIDE-FINITIONS-3, R2-7 du rejeu 2 (capture R01) : sur Équipes d'un coach, la liste
// ne défilait pas alors que « Autres équipes du club » était coupée : le bas de la
// liste ne laissait de place au bouton « + » flottant qu'en mode ligue.
import '@/theme/strings';

import TeamListContent from '../TeamListContent';

jest.mock('@/domains/team/useParentTeams', () => ({
  __esModule: true,
  default: () => ({
    childrenByTeam: {}, error: null, isLoading: false, refetch: jest.fn(), teamIds: [],
  }),
}));

// Filet du lot L10-C (docs/STRATEGIE_PAYWALL_2026_08_01.md §2.3) : la carte
// « Nouvelle équipe » est un POINT D'ENTREE. Quand l'app sait deja que le quota
// gratuit est epuise, elle doit GRISER + ETIQUETER avant l'action, et l'appui
// doit ouvrir la feuille de vente — jamais laisser remplir le tunnel pour
// refuser a la fin. Ce fichier n'avait aucun test (regle E6) : les invariants
// sont poses ici en meme temps que le nouveau comportement.

jest.setTimeout(30000);

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ getState: () => ({ routeNames: [] }), navigate: mockNavigate }),
}));

// FlashList mesure sa fenetre avant de rendre quoi que ce soit : sans layout
// reel, ni l'en-tete ni le PIED (notre carte) n'apparaissent. On le remplace par
// une liste inerte qui rend les 3 zones — c'est le pied qu'on veut verifier.
jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    FlashList: ({
      contentContainerStyle,
      data,
      ListEmptyComponent,
      ListFooterComponent,
      ListHeaderComponent,
    }) => (
      <View style={contentContainerStyle} testID="liste-equipes">
        {typeof ListHeaderComponent === 'function' ? ListHeaderComponent() : ListHeaderComponent}
        {(data || []).length === 0 ? ListEmptyComponent : null}
        {typeof ListFooterComponent === 'function' ? ListFooterComponent() : ListFooterComponent}
      </View>
    ),
  };
});

jest.mock('@react-native-masked-view/masked-view', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

jest.mock('react-native-linear-gradient', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

const mockPaywallSheet = jest.fn();
jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: (/** @type {any} */ props) => {
    mockPaywallSheet(props);
    return null;
  },
}));

jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return { __esModule: true, default: () => <View testID="search-bar" /> };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => ({
  __esModule: true,
  default: (/** @type {any} */ props) => props.children,
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubInitials: () => 'FC' }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ teamFilters: {} }],
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 100, sceneBottomInset: 90 }),
}));

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingActionContainerStyle: () => ({}),
}));

jest.mock('@/services/team/teamQueries', () => ({
  // LOT EQUIPES (Q7) — la file de validation du dirigeant. Ce temoin ne la
  // regarde pas ; il doit juste fournir les deux crochets, sinon l ecran appelle
  // `undefined` et la SUITE tombe.
  useApproveTeamCreation: () => ({ isPending: false, mutate: jest.fn(), variables: undefined }),
  useGetTeams: () => ({
    data: { pages: [{ data: [] }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useTeamsAwaitingClubApproval: () => ({ data: [], error: null, isLoading: false }),
}));

jest.mock('@/services/leagueTeam/leagueTeamQueries', () => ({
  useGetLeagueTeamContext: () => ({
    data: null, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/views/search/searchRouteHelpers', () => ({ navigateToSearchHub: jest.fn() }));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));
jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : n'importe quelle cle rend un objet vide.
   * @returns {any}
   */
  const anyScale = () => new Proxy({}, {
    get: (/** @type {any} */ _target, /** @type {any} */ key) => (
      typeof key === 'symbol' ? undefined : anyScale()
    ),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: anyScale(),
      ApplicationStyle: anyScale(),
      Colors: {
        neutral00: 'encre-claire',
        neutral200: 'neutre-200',
        neutral400: 'neutre-400',
        neutral500: 'neutre-500',
        primary500: 'couleur-primaire',
        primary700: 'couleur-surface',
        transparent: 'transparent',
        violet500: 'couleur-club',
      },
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

const PRESIDENT = { documentId: 'u-1', role: { name: 'Dirigeant' } };

/**
 * Marge du bas de la liste rendue.
 * @param {{ hasFloatingAction?: boolean }} props - Props de la liste.
 * @returns {Promise<number>} paddingBottom.
 */
const paddingFor = async ({ hasFloatingAction = false }) => {
  mockUseAuth.mockReturnValue({
    canManageTeam: true, freeUsageSummary: [], subscriptionAccessLevel: 'FREE', userData: PRESIDENT,
  });
  let tree;
  await act(async () => {
    tree = renderer.create(<TeamListContent hasFloatingAction={hasFloatingAction} />);
  });
  const padding = tree.root.findByProps({ testID: 'liste-equipes' }).props.style?.paddingBottom;
  act(() => tree.unmount());
  return padding;
};

describe('R2-7 — la liste Équipes laisse la place au bouton flottant', () => {
  it('avec le bouton « + » : le bas de la liste passe au-dessus du bouton', async () => {
    expect(await paddingFor({ hasFloatingAction: true })).toBeGreaterThanOrEqual(100 + 92);
  });

  it('sans bouton (parent, joueur) : la marge de la barre seulement (témoin)', async () => {
    expect(await paddingFor({})).toBe(90);
  });
});
