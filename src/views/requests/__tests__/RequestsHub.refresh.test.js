import { QueryClient } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import {
  acceptTeamMembershipRequest,
} from '@/services/teamMembershipRequest/teamMembershipRequestService';

import RequestsHub from '../RequestsHub';

/**
 * U05 — LE FILET DU BRANCHEMENT DE « DEMANDES ».
 *
 * Ce qu il verrouille, et c est le defaut qu Adel decrit :
 * accepter quelqu un rafraichissait NEUF rubriques et en oubliait QUATRE
 * (`teams`, `team`, `planning`, `home-summary`). La demande disparaissait bien
 * de la liste — mais l equipe rejointe n apparaissait nulle part.
 *
 * Le `queryClient` est un VRAI client : on lit le cache, pas un espion. Un
 * espion aurait confirme l intention ; seul le cache dit ce qui devient perime.
 */

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  CLUB_INTEREST_RESPONSE_PRESETS: [{ key: 'thanks', label: 'Merci' }],
  respondClubInterestRequest: jest.fn(),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  acceptClubMembershipRequest: jest.fn(),
  rejectClubMembershipRequest: jest.fn(),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  cancelEvent: jest.fn(),
  rejectFeatured: jest.fn(),
  updateEvent: jest.fn(),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  acceptEventParticipation: jest.fn(),
  declineEventParticipation: jest.fn(),
}));

jest.mock('@/services/facility/facilityService', () => ({
  approveFacilityOverrideRequest: jest.fn(),
  refuseFacilityOverrideRequest: jest.fn(),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  acceptTeamMembershipRequest: jest.fn(),
  rejectTeamMembershipRequest: jest.fn(),
}));

const mockUseRequestsHubData = jest.fn();
jest.mock('@/services/requests/requestsHubQueries', () => ({
  getRequestsHubQueryKey: () => ['requestsHub'],
  useRequestsHubData: (/** @type {any} */ context, /** @type {any} */ options) => (
    mockUseRequestsHubData(context, options)
  ),
}));

let mockClientDeTest = /** @type {any} */ (null);
jest.mock('@tanstack/react-query', () => {
  const reel = jest.requireActual('@tanstack/react-query');
  return {
    ...reel,
    useQueryClient: () => mockClientDeTest,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ _key, /** @type {string} */ fallback) => fallback,
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => false,
    canManageTeam: true,
    clubVerificationSummary: null,
    userData: {
      documentId: 'u-coach',
      trainedTeams: [{ documentId: 'team-1', name: 'U15 Maison' }],
    },
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startWhisperChat: jest.fn() }),
}));

jest.mock('@/context/ClubScopeContext', () => ({ useClubScope: () => ({}) }));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
  emitGuidanceInteraction: jest.fn(),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => <View>{props.children}</View>,
  };
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/theme/themeContext', () => {
  /**
   * Echelle de style tolerante : un enfant qui demande une valeur inattendue ne
   * doit pas faire tomber le filet.
   * @returns {any} Un objet qui repond a tout.
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
      Colors: new Proxy({}, {
        get: (/** @type {any} */ _target, /** @type {any} */ key) => (
          typeof key === 'symbol' ? undefined : 'couleur'
        ),
      }),
      Fonts: anyScale(),
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

const navigation = { canGoBack: () => false, goBack: jest.fn(), navigate: jest.fn() };

const DEMANDE_EQUIPE = {
  actions: { primary: 'accept', secondary: 'reject' },
  createdAt: '2026-08-18T09:00:00.000Z',
  id: 'team:request-1',
  meta: { requestId: 'request-1', teamId: 'team-1', teamName: 'U15 Maison' },
  status: 'pending',
  subtitle: 'Zinedine veut rejoindre U15 Maison.',
  title: 'Demande d equipe',
  type: 'team',
};

/**
 * Les racines de cle que ce cache a vues devenir perimees.
 * @param {QueryClient} client Le client de test.
 * @returns {string[]} Les racines, triees.
 */
const racinesPerimees = (client) => Array.from(new Set(
  client.getQueryCache().getAll()
    .filter((query) => query.state.isInvalidated)
    .map((query) => String(query.queryKey[0])),
)).sort();

/**
 * Pose une query deja lue pour chaque racine surveillee.
 * @param {QueryClient} client Le client de test.
 * @returns {void}
 */
const poserLeCache = (client) => {
  [
    ['requestsHub'], ['teamMembershipRequests', 'team-1'], ['clubMembershipRequests'],
    ['clubInterestRequests'], ['pendingEvents'], ['pending-featured-requests'],
    ['facility-override-requests'], ['events'], ['teams'], ['team', 'team-1'],
    ['planning', 'personal', '2026-08-18'], ['home-summary'], ['temoin-etranger'],
  ].forEach((queryKey) => client.setQueryData(queryKey, { valeur: 'lue' }));
};

/**
 * Monte l ecran avec une seule demande d equipe, et rend son bouton primaire.
 * @returns {Promise<any>} L arbre rendu.
 */
let arbreMonte = /** @type {any} */ (null);

const monterLeHub = async () => {
  mockUseRequestsHubData.mockReturnValue({
    data: { counts: { team: 1, total: 1 }, errors: [], items: [DEMANDE_EQUIPE] },
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  });

  await act(async () => {
    arbreMonte = renderer.create(
      <RequestsHub navigation={navigation} route={{ params: {} }} />,
    );
  });
  return arbreMonte;
};

/**
 * Declenche l action « accepter » telle que l ecran la cable.
 * @param {any} tree L arbre rendu.
 * @returns {Promise<void>} Quand l action est terminee.
 */
const accepter = async (tree) => {
  const carte = tree.root.findAll(
    (/** @type {any} */ node) => typeof node.props?.onPrimaryPress === 'function'
      && node.props?.item?.id === DEMANDE_EQUIPE.id,
    { deep: true },
  )[0];
  expect(carte).toBeDefined();
  await act(async () => { await carte.props.onPrimaryPress(carte.props.item); });
};

describe('U05 — « Demandes » : accepter rafraichit l appartenance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    poserLeCache(mockClientDeTest);
  });

  afterEach(async () => {
    // La liste virtuelle de l'ecran continue de se mettre a jour apres le test
    // si on ne la demonte pas : jest sort alors en code 1 pour « log apres la
    // fin », alors que tous les temoins sont verts.
    if (arbreMonte) {
      await act(async () => { arbreMonte.unmount(); });
      arbreMonte = null;
    }
    mockClientDeTest.clear();
  });

  it('temoin 1 — accepter perime l appartenance, pas seulement la liste des demandes', async () => {
    /** @type {any} */ (acceptTeamMembershipRequest).mockResolvedValue({ ok: true });

    const tree = await monterLeHub();
    await accepter(tree);

    expect(acceptTeamMembershipRequest).toHaveBeenCalledWith('request-1');

    const perimees = racinesPerimees(mockClientDeTest);
    // Les QUATRE oubliees : c est tout le sujet du lot.
    ['teams', 'team', 'planning', 'home-summary'].forEach((racine) => {
      expect({ perimee: perimees.includes(racine), racine })
        .toEqual({ perimee: true, racine });
    });
    // Et les HUIT que l ecran faisait deja : rien n a ete perdu au passage.
    [
      'requestsHub', 'teamMembershipRequests', 'clubMembershipRequests',
      'clubInterestRequests', 'pendingEvents', 'pending-featured-requests',
      'facility-override-requests', 'events',
    ].forEach((racine) => {
      expect({ perimee: perimees.includes(racine), racine })
        .toEqual({ perimee: true, racine });
    });
  });

  it('temoin 6 — accepter ne recharge PAS toute l app', async () => {
    /** @type {any} */ (acceptTeamMembershipRequest).mockResolvedValue({ ok: true });

    const tree = await monterLeHub();
    await accepter(tree);

    expect(racinesPerimees(mockClientDeTest)).not.toContain('temoin-etranger');
  });

  it('temoin 5 — une acceptation qui ECHOUE ne rafraichit RIEN', async () => {
    /** @type {any} */ (acceptTeamMembershipRequest)
      .mockRejectedValue(new Error('le serveur a refuse'));

    const tree = await monterLeHub();
    await accepter(tree);

    expect(acceptTeamMembershipRequest).toHaveBeenCalledWith('request-1');
    expect(racinesPerimees(mockClientDeTest)).toEqual([]);
  });
});
