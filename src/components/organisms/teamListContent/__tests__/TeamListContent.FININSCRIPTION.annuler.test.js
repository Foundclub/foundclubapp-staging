/**
 * FIN-INSCRIPTION p3 (02/11, Adel « 3a oui ») — une demande d'équipe se retire depuis sa carte.
 * Hugo avait deux demandes « EN ATTENTE » et aucun bouton pour les retirer. La route existe
 * (POST /team-membership-requests/:id/cancel, le contrôleur vérifie que la demande est la sienne).
 * Une invitation reçue et une demande de club n'ont pas ce bouton : ce ne sont pas ses demandes
 * d'équipe.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamListContent from '../TeamListContent';

const mockAnnuler = jest.fn();
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  deleteTeamMembershipRequest: (/** @type {string} */ id) => mockAnnuler(id),
  getTeamMembershipRequests: jest.fn(),
}));

jest.mock('@/domains/team/useParentTeams', () => ({
  __esModule: true,
  default: () => ({
    childrenByTeam: {}, error: null, isLoading: false, refetch: jest.fn(), teamIds: [],
  }),
}));

jest.setTimeout(30000);

const mockUseAuth = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useIsFocused: () => true,
  useNavigation: () => ({ getState: () => ({ routeNames: [] }), navigate: mockNavigate }),
}));

// Le double de FlashList : voir l'en-tete de fichier. Il ne dessine pas une
// liste, il rejoue la DETECTION DE BORD de flash-list v2 — c'est elle, et elle
// seule, qui transforme une page vide en rappel de la page suivante.
jest.mock('@shopify/flash-list', () => {
  // eslint-disable-next-line global-require
  const React = require('react');
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  /**
   * Rend une zone de liste, qu'elle arrive comme element ou comme fabrique.
   * @param {any} component - Element ou fabrique d'element.
   * @returns {any} - Element rendu.
   */
  const resolve = (component) => (typeof component === 'function' ? component() : component);

  /**
   * Liste simulee : elle ne dessine pas, elle rejoue la detection de bord.
   * @param {any} props - Les props passees par l'ecran.
   * @returns {any} - La liste simulee.
   */
  function FlashList({
    data,
    keyExtractor,
    ListEmptyComponent,
    ListFooterComponent,
    ListHeaderComponent,
    onEndReached,
    renderItem,
  }) {
    const derniereData = React.useRef(null);

    React.useEffect(() => {
      // useBoundDetection.ts:149-154 — l'identite de `data` change ⇒ le verrou
      // saute. useBoundDetection.ts:92-94 — liste vide ⇒ on est deja au bout.
      if (derniereData.current === data) return;
      derniereData.current = data;
      if ((data || []).length === 0) onEndReached?.();
    });

    return (
      <View>
        {resolve(ListHeaderComponent)}
        {(data || []).length === 0
          ? resolve(ListEmptyComponent)
          : (data || []).map((item, index) => (
            <View key={keyExtractor ? keyExtractor(item, index) : index}>
              {renderItem({ index, item })}
            </View>
          ))}
        {resolve(ListFooterComponent)}
      </View>
    );
  }

  return { FlashList };
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

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
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

jest.mock('@/views/search/searchRouteHelpers', () => ({ navigateToSearchHub: jest.fn() }));

jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (/** @type {any} */ url) => url }));

jest.mock('@/theme/colors', () => ({ withAlpha: (/** @type {any} */ color) => color }));

jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : n'importe quelle cle rend un objet vide.
   * @returns {any} - L'echelle.
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
        gold500: 'couleur-or',
        neutral00: 'encre-claire',
        neutral100: 'neutre-100',
        neutral200: 'neutre-200',
        neutral300: 'neutre-300',
        neutral400: 'neutre-400',
        neutral500: 'neutre-500',
        primary100: 'primaire-100',
        primary200: 'primaire-200',
        primary500: 'couleur-primaire',
        primary700: 'couleur-surface',
        primary900: 'couleur-fond',
        success500: 'couleur-succes',
        transparent: 'transparent',
        violet500: 'couleur-club',
        warning500: 'couleur-alerte',
      },
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

jest.mock('@/services/leagueTeam/leagueTeamQueries', () => {
  const contexteFige = {
    data: null, error: null, isLoading: false, refetch: () => {},
  };
  return { useGetLeagueTeamContext: () => contexteFige };
});

// ————————————————————————————————————————————————————————————————————
// LE SERVEUR FICTIF — il ne sert AUCUNE equipe. Les cartes mesurees ici
// viennent toutes de `userData.teamMembershipRequests`, c est-a-dire du
// bootstrap : c est exactement le chemin que P10 emprunte.
// ————————————————————————————————————————————————————————————————————

jest.mock('@/services/team/teamQueries', () => ({
  // LOT EQUIPES (Q7) — la file de validation du dirigeant. Ce temoin ne la
  // regarde pas ; il doit juste fournir les deux crochets, sinon l ecran appelle
  // `undefined` et la SUITE tombe.
  useApproveTeamCreation: () => ({ isPending: false, mutate: jest.fn(), variables: undefined }),
  useGetTeams: () => ({
    data: {
      pages: [{
        data: [],
        meta: {
          pagination: {
            page: 1, pageCount: 1, pageSize: 10, total: 0,
          },
        },
      }],
    },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useTeamsAwaitingClubApproval: () => ({ data: [], error: null, isLoading: false }),
}));

const CLUB = { documentId: 'club-1', name: 'FC Test', sponsor: [] };
const EQUIPE = {
  activities: [{ name: 'Football' }],
  category: { name: 'U15' },
  club: CLUB,
  documentId: 'equipe-1',
  name: 'RIVELAC U15',
  players: [],
  trainers: [],
};

const utilisateur = (/** @type {any} */ champs) => ({
  clubMembershipRequests: [],
  documentId: 'moi',
  myTeams: [],
  role: { name: 'Joueur' },
  teamMembershipRequests: [],
  trainedTeams: [],
  ...champs,
});

/**
 * Rend la liste pour ce profil.
 * @param {any} champs - Les demandes du profil.
 * @returns {Promise<{ arbre: any, client: QueryClient }>} L'arbre et le cache.
 */
const rendre = async (champs) => {
  mockUseAuth.mockReturnValue({
    canManageTeam: false,
    entitlementsSummary: [],
    USER_ROLES: { admin: 'Dirigeant', coach: 'Entraineur', player: 'Joueur' },
    userData: utilisateur(champs),
  });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <TeamListContent showOnlyMyTeams={false} />
      </QueryClientProvider>,
    );
  });
  await act(async () => {});
  return { arbre: /** @type {any} */ (arbre), client };
};

const boutonAnnuler = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => String(n.props.accessibilityLabel || '').startsWith('Annuler ma demande')
    && typeof n.props.onPress === 'function',
)[0];

describe('TeamListContent - FIN-INSCRIPTION, annuler ma demande', () => {
  /** @type {jest.SpyInstance} */
  let alerte;

  beforeEach(() => {
    mockAnnuler.mockReset();
    alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => alerte.mockRestore());

  const DEMANDE = {
    direction: 'request', documentId: 'demande-1', state: 'pending', team: EQUIPE,
  };

  it('la carte EN ATTENTE d une demande d équipe propose « Annuler ma demande »', async () => {
    const { arbre } = await rendre({ teamMembershipRequests: [DEMANDE] });
    expect(boutonAnnuler(arbre)).toBeDefined();
    expect(JSON.stringify(arbre.toJSON())).toContain('Annuler ma demande');
  });

  it('le bouton demande confirmation, et rien ne part sans le oui', async () => {
    const { arbre } = await rendre({ teamMembershipRequests: [DEMANDE] });
    await act(async () => boutonAnnuler(arbre).props.onPress());
    expect(alerte).toHaveBeenCalledTimes(1);
    expect(mockAnnuler).not.toHaveBeenCalled();
    const [titre, message, boutons] = alerte.mock.calls[0];
    expect(titre).toBe('Annuler ta demande ?');
    // Le nom de l'équipe s'interpole sur le vrai site (capture paire-p3-3) ; le double de t ne le
    // fait pas.
    expect(message).toContain('Ta demande pour rejoindre');
    expect(boutons.find((/** @type {any} */ b) => b.style === 'cancel').text)
      .toBe('Garder ma demande');
  });

  it('le oui annule CETTE demande et relit le profil', async () => {
    mockAnnuler.mockResolvedValue({});
    const { arbre, client } = await rendre({ teamMembershipRequests: [DEMANDE] });
    const relire = jest.spyOn(client, 'invalidateQueries');
    await act(async () => boutonAnnuler(arbre).props.onPress());
    const oui = alerte.mock.calls[0][2].find((/** @type {any} */ b) => b.style === 'destructive');
    await act(async () => oui.onPress());
    expect(mockAnnuler).toHaveBeenCalledWith('demande-1');
    expect(relire.mock.calls.map(([f]) => /** @type {any} */ (f).queryKey[0]))
      .toEqual(expect.arrayContaining(['get-me', 'app-bootstrap', 'teamMembershipRequests']));
  });

  it('un refus du serveur le dit en français', async () => {
    mockAnnuler.mockRejectedValue(new Error('Forbidden'));
    const { arbre } = await rendre({ teamMembershipRequests: [DEMANDE] });
    await act(async () => boutonAnnuler(arbre).props.onPress());
    const oui = alerte.mock.calls[0][2].find((/** @type {any} */ b) => b.style === 'destructive');
    await act(async () => oui.onPress());
    expect(alerte).toHaveBeenCalledTimes(2);
    expect(alerte.mock.calls[1].join(' ')).toContain('Impossible d\'annuler ta demande');
    expect(alerte.mock.calls[1].join(' ')).not.toContain('Forbidden');
  });

  it('une invitation reçue et une demande de club n ont pas ce bouton', async () => {
    const { arbre } = await rendre({
      clubMembershipRequests: [{
        club: CLUB, documentId: 'club-demande', requestType: 'join', state: 'pending',
      }],
      teamMembershipRequests: [{
        direction: 'invite', documentId: 'invitation-1', state: 'pending', team: EQUIPE,
      }],
    });
    expect(boutonAnnuler(arbre)).toBeUndefined();
  });
});
