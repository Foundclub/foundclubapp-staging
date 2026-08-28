import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamListContent from '../TeamListContent';

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
      data,
      ListEmptyComponent,
      ListFooterComponent,
      ListHeaderComponent,
    }) => (
      <View>
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
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
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
 * Compteur gratuit d'equipes tel que le bootstrap le renvoie.
 * @param {{ limit: number; used: number }} quota
 * @returns {any[]}
 */
const freeTeamUsage = ({ limit, used }) => [{
  limit, quotaType: 'FREE_TEAM', remaining: Math.max(0, limit - used), used,
}];

/** @type {any} */
let mountedTree = null;

/**
 * Monte la liste pour un etat d'abonnement donne.
 * @param {any} auth
 * @param {boolean} [isLeagueMode]
 * @returns {Promise<any>}
 */
const renderFor = async (auth, isLeagueMode = false) => {
  mockUseAuth.mockReturnValue({
    canManageTeam: true,
    freeUsageSummary: [],
    subscriptionAccessLevel: 'FREE',
    userData: PRESIDENT,
    ...auth,
  });
  await act(async () => {
    mountedTree = renderer.create(<TeamListContent isLeagueMode={isLeagueMode} />);
  });
  return mountedTree;
};

/**
 * Tous les textes d'un arbre rendu, aplatis.
 * @param {any} node
 * @returns {string[]}
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible du rendu, en une seule chaine cherchable.
 * @param {any} tree
 * @returns {string}
 */
const allText = (tree) => collectText(tree.toJSON()).join(' | ');

/**
 * Aplatit un style RN (tableau imbrique, entrees `false`) en un seul objet.
 * @param {any} style
 * @returns {any}
 */
const flattenStyle = (style) => (Array.isArray(style)
  ? style.reduce((merged, entry) => Object.assign(merged, flattenStyle(entry)), {})
  : (style || {}));

/**
 * La carte « Nouvelle équipe » telle qu'elle est rendue (le pied de liste).
 * Reperee par son texte et non par un testID : le filet doit tenir avant comme
 * apres le lot, sans dependre d'un attribut que le lot ajoute lui-meme.
 * @param {any} tree
 * @returns {any}
 */
const findNewTeamCard = (tree) => tree.root.findAllByType(TouchableOpacity).find(
  (/** @type {any} */ node) => node.findAllByType(Text)
    .some((/** @type {any} */ text) => text.props.children === 'Nouvelle équipe'),
);

describe('TeamListContent — la carte « Nouvelle équipe » (L10-C)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // La liste arme un debounce de 300 ms sur la recherche : sans demontage, il
  // se declenche apres la fin de la suite et Jest tombe sur un import
  // post-teardown. On rend la main proprement.
  afterEach(async () => {
    if (!mountedTree) return;
    await act(async () => { mountedTree.unmount(); });
    mountedTree = null;
  });

  describe('invariants — ce que le lot ne doit pas casser', () => {
    it("ne s'affiche pas a qui ne gere aucune equipe", async () => {
      const tree = await renderFor({ canManageTeam: false });

      expect(allText(tree)).not.toContain('Nouvelle équipe');
    });

    it("ne s'affiche pas en mode LEAGUE", async () => {
      const tree = await renderFor(
        { freeUsageSummary: freeTeamUsage({ limit: 1, used: 1 }) },
        true,
      );

      expect(allText(tree)).not.toContain('Nouvelle équipe');
    });

    it('laisse passer un FREE qui a ENCORE sa creation gratuite', async () => {
      const tree = await renderFor({ freeUsageSummary: freeTeamUsage({ limit: 1, used: 0 }) });

      expect(allText(tree)).toContain('Il te reste 1 création gratuite');
      await act(async () => { findNewTeamCard(tree).props.onPress(); });

      expect(mockNavigate).toHaveBeenCalledWith('TeamStack', expect.objectContaining({
        screen: 'TeamWizardName',
      }));
      expect(mockPaywallSheet).not.toHaveBeenCalledWith(
        expect.objectContaining({ isVisible: true }),
      );
    });

    it('laisse passer un abonne EQUIPE (aucun compteur, aucun grisage)', async () => {
      const tree = await renderFor({
        freeUsageSummary: freeTeamUsage({ limit: 1, used: 1 }),
        subscriptionAccessLevel: 'TEAM',
      });

      expect(allText(tree)).toContain('Crée une équipe pour ton club.');
      await act(async () => { findNewTeamCard(tree).props.onPress(); });

      expect(mockNavigate).toHaveBeenCalledWith('TeamStack', expect.objectContaining({
        screen: 'TeamWizardName',
      }));
    });
  });

  describe('quota epuise — prevenir AVANT au lieu de refuser apres', () => {
    it('grise, etiquette « Offre Équipe » et n\'entre plus dans le tunnel', async () => {
      const tree = await renderFor({ freeUsageSummary: freeTeamUsage({ limit: 1, used: 1 }) });
      const rendered = allText(tree);

      // L'etiquette est obligatoire : griser en silence est interdit (§2.3).
      expect(rendered).toContain('Offre Équipe');
      expect(rendered).toContain("Ta création gratuite est utilisée — débloque l'offre Équipe");

      const card = findNewTeamCard(tree);
      // Grisee visuellement, mais annoncee comme un bouton actif : elle mene a
      // la vente. Dire « disabled » a un lecteur d'ecran serait faux.
      expect(flattenStyle(card.props.style).opacity).toBe(0.55);
      expect(card.props.accessibilityHint)
        .toBe("Ta création gratuite est utilisée — débloque l'offre Équipe");

      await act(async () => { card.props.onPress(); });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('ouvre la feuille de vente sur l\'appui, avec la decision TEAM_LIMIT', async () => {
      const tree = await renderFor({ freeUsageSummary: freeTeamUsage({ limit: 1, used: 1 }) });

      await act(async () => { findNewTeamCard(tree).props.onPress(); });

      expect(mockPaywallSheet).toHaveBeenCalledWith(expect.objectContaining({
        decision: expect.objectContaining({
          allowed: false,
          paywall: 'TEAM_LIMIT',
          requiredPlan: ['TEAM'],
        }),
        isVisible: true,
      }));
    });
  });
});
