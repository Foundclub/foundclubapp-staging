/**
 * P10 (D10) — UNE INVITATION RECUE N EST PAS UNE DEMANDE ENVOYEE.
 *
 * 🔴 LE DEFAUT QUE CE FILET GARDE, et il etait a UNE LIGNE : `TeamListContent`
 * transformait TOUTE ligne `state: pending` en carte « demande envoyee »
 * (rangee dans `pendingTeams`, badge « EN ATTENTE », bandeau « Ta demande pour
 * rejoindre cette equipe »). Une invitation ENVOYEE PAR LE STAFF serait donc
 * apparue au joueur comme une demande QU IL AURAIT FAITE — le sens exactement
 * inverse, et aucune porte ne l aurait vu.
 *
 * ✅ CE QUI TRANCHE : le champ `direction`, qui traverse desormais les trois
 * filtres du bootstrap (requete serveur, sanitizer serveur, sanitizer app).
 *   'invite'            -> section « Invitations reçues », badge INVITATION
 *   'request' / '' / null -> section « Demandes en attente », badge EN ATTENTE
 *
 * ⚠️ `null` est le cas MAJORITAIRE et il est definitif : la colonne est ajoutee
 * nullable au boot, donc TOUTES les lignes d avant le lot le portent. Un temoin
 * lui est dedie.
 *
 * 🧱 P10 n ajoute NI section, NI ecran, NI route : la section « Invitations
 * recues » existait deja pour les equipes de ligue, elle est reutilisee.
 */

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamListContent from '../TeamListContent';

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

const EQUIPE_QUI_INVITE = {
  activities: [{ name: 'Football' }],
  category: { name: 'U15' },
  club: CLUB,
  documentId: 'equipe-qui-invite',
  name: 'LES INVITANTS',
  players: [],
  trainers: [],
};

const EQUIPE_DEMANDEE = {
  activities: [{ name: 'Football' }],
  category: { name: 'U17' },
  club: CLUB,
  documentId: 'equipe-demandee',
  name: 'LES DEMANDES',
  players: [],
  trainers: [],
};

const utilisateurAvec = (/** @type {any[]} */ demandes) => ({
  clubMembershipRequests: [],
  documentId: 'moi',
  myTeams: [],
  role: { name: 'Joueur' },
  teamMembershipRequests: demandes,
  trainedTeams: [],
});

const AUTH = (/** @type {any[]} */ demandes) => ({
  canManageTeam: false,
  entitlementsSummary: [],
  USER_ROLES: { admin: 'Dirigeant', coach: 'Entraineur', player: 'Joueur' },
  userData: utilisateurAvec(demandes),
});

/**
 * Rend l ecran et rend tous les textes affiches, a plat.
 * @param {any[]} demandes - Les lignes portees par le bootstrap.
 * @returns {Promise<string[]>} - Les textes rendus.
 */
const textesAffiches = async (demandes) => {
  mockUseAuth.mockReturnValue(AUTH(demandes));
  let arbre;
  await act(async () => {
    arbre = renderer.create(<TeamListContent showOnlyMyTeams={false} />);
  });
  await act(async () => {});
  const textes = arbre.root.findAllByType(Text)
    .flatMap((noeud) => noeud.props.children)
    .filter((enfant) => typeof enfant === 'string');
  arbre.unmount();
  return textes;
};

describe('P10 — une invitation recue ne se confond pas avec une demande envoyee', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('🔴 temoin 1 — `direction: invite` va dans « Invitations reçues »', async () => {
    const textes = await textesAffiches([
      {
        direction: 'invite',
        documentId: 'tmr-1',
        state: 'pending',
        team: EQUIPE_QUI_INVITE,
      },
    ]);

    expect(textes).toContain('Invitations reçues');
    expect(textes).toContain('LES INVITANTS');
    expect(textes).not.toContain('Demandes en attente');
    // Le bandeau doit dire OU repondre : « t invite » sans mode d emploi ne
    // sert a rien.
    expect(textes.some((texte) => /accepter ou refuser/i.test(texte))).toBe(true);
  });

  test('temoin 2 — une ligne `direction: request` reste une demande envoyee', async () => {
    const textes = await textesAffiches([
      {
        direction: 'request',
        documentId: 'tmr-2',
        state: 'pending',
        team: EQUIPE_DEMANDEE,
      },
    ]);

    expect(textes).toContain('Demandes en attente');
    expect(textes).toContain('LES DEMANDES');
    expect(textes).not.toContain('Invitations reçues');
  });

  test('🔒 temoin 3 — une ligne HERITEE (`direction` absente) reste une demande', async () => {
    // Le cas MAJORITAIRE et definitif : la colonne est ajoutee nullable au boot.
    // Si `null` basculait du cote invitation, toutes les demandes historiques
    // changeraient de sens d un coup.
    const textes = await textesAffiches([
      { documentId: 'tmr-3', state: 'pending', team: EQUIPE_DEMANDEE },
    ]);

    expect(textes).toContain('Demandes en attente');
    expect(textes).not.toContain('Invitations reçues');
  });

  test('temoin 4 — les deux sens cohabitent, chacun dans sa section', async () => {
    const textes = await textesAffiches([
      {
        direction: 'invite',
        documentId: 'tmr-4',
        state: 'pending',
        team: EQUIPE_QUI_INVITE,
      },
      {
        direction: null, documentId: 'tmr-5', state: 'pending', team: EQUIPE_DEMANDEE,
      },
    ]);

    expect(textes).toContain('Invitations reçues');
    expect(textes).toContain('Demandes en attente');
    expect(textes).toContain('LES INVITANTS');
    expect(textes).toContain('LES DEMANDES');
  });
});
