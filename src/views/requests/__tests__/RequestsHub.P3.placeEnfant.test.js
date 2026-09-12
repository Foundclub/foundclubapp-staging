import { QueryClient } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import {
  respondClubInterestRequest,
} from '@/services/clubInterestRequest/clubInterestRequestService';

import RequestsHub from '../RequestsHub';

/**
 * 👶 PARENT P3 (2026-09-11) — TRANCHER UNE PLACE DEMANDEE POUR UN ENFANT.
 *
 * Decision d'Adel du 11/09 (« 1- a ») : accepter fait entrer l'enfant dans
 * l'equipe ; refuser EFFACE la demande. Ce que ces temoins verrouillent :
 *  ① « Accepter » envoie `accept_child` — et ne passe PAS par la fenetre des
 *    messages types, qui laisserait la demande traitee sans l'enfant ;
 *  ② « Refuser » demande CONFIRMATION d'abord : le geste ne se rattrape pas ;
 *  ③ l'interet d'un ADULTE garde son chemin : « Repondre » n'appelle pas le
 *    serveur directement.
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
  return { ...reel, useQueryClient: () => mockClientDeTest };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ _key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || _key
    ),
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
      trainedTeams: [{ documentId: 'team-u11', name: 'U11' }],
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

const alerte = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

const navigation = {
  addListener: jest.fn(() => () => {}),
  canGoBack: () => false,
  goBack: jest.fn(),
  navigate: jest.fn(),
};

const PLACE_POUR_LEA = {
  actions: { primary: 'accept', secondary: 'reject' },
  createdAt: '2026-09-11T09:00:00.000Z',
  id: 'interest:interest-lea',
  meta: {
    childAge: 7,
    childFirstname: 'Léa',
    childId: 'enfant-lea',
    clubId: 'club-1',
    requesterName: 'Karim Benali',
    requestId: 'interest-lea',
    teamName: 'U11',
  },
  status: 'pending',
  subtitle: 'Karim Benali demande une place pour Léa (7 ans) dans U11.',
  title: 'Place pour un enfant',
  type: 'interest',
};

const INTERET_ADULTE = {
  actions: { primary: 'respond', secondary: 'chat' },
  createdAt: '2026-09-11T09:00:00.000Z',
  id: 'interest:interest-adulte',
  meta: { requesterName: 'Mina Diallo', requestId: 'interest-adulte', teamName: 'U11' },
  status: 'pending',
  subtitle: 'Mina Diallo est intéressé par U11.',
  title: 'Intérêt club',
  type: 'interest',
};

let arbreMonte = /** @type {any} */ (null);

/**
 * Monte l ecran avec les demandes donnees.
 * @param {any[]} items Les demandes a afficher.
 * @returns {Promise<any>} L arbre rendu.
 */
const monterLeHub = async (items) => {
  mockUseRequestsHubData.mockReturnValue({
    data: { counts: { interest: items.length, total: items.length }, errors: [], items },
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
 * La carte d une demande, telle que l ecran la rend.
 * @param {any} tree L arbre rendu.
 * @param {string} id L identifiant de la demande.
 * @returns {any} Le noeud de la carte.
 */
const carteDe = (tree, id) => tree.root.findAll(
  (/** @type {any} */ node) => typeof node.props?.onPrimaryPress === 'function'
    && node.props?.item?.id === id,
  { deep: true },
)[0];

describe('P3 — trancher une place demandee pour un enfant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    respondClubInterestRequest.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    if (arbreMonte) act(() => { arbreMonte.unmount(); });
    arbreMonte = null;
  });

  test('① « Accepter » envoie `accept_child`, sans passer par les messages types', async () => {
    const tree = await monterLeHub([PLACE_POUR_LEA]);
    const carte = carteDe(tree, PLACE_POUR_LEA.id);
    expect(carte).toBeDefined();

    await act(async () => { await carte.props.onPrimaryPress(carte.props.item); });

    expect(respondClubInterestRequest).toHaveBeenCalledTimes(1);
    expect(respondClubInterestRequest).toHaveBeenCalledWith('interest-lea', {
      responseType: 'accept_child',
    });
  });

  test('② « Refuser » demande CONFIRMATION, et n envoie `refuse_child` qu apres', async () => {
    const tree = await monterLeHub([PLACE_POUR_LEA]);
    const carte = carteDe(tree, PLACE_POUR_LEA.id);

    await act(async () => { await carte.props.onSecondaryPress(carte.props.item); });

    expect(respondClubInterestRequest).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledTimes(1);
    const boutons = alerte.mock.calls[0][2] || [];
    const confirmer = boutons.find((/** @type {any} */ b) => b?.style === 'destructive');
    expect(confirmer).toBeDefined();

    await act(async () => { await confirmer.onPress(); });

    expect(respondClubInterestRequest).toHaveBeenCalledWith('interest-lea', {
      responseType: 'refuse_child',
    });
  });

  test('③ l interet d un ADULTE garde son chemin : « Repondre » n appelle rien', async () => {
    const tree = await monterLeHub([INTERET_ADULTE]);
    const carte = carteDe(tree, INTERET_ADULTE.id);

    await act(async () => { await carte.props.onPrimaryPress(carte.props.item); });

    expect(respondClubInterestRequest).not.toHaveBeenCalled();
  });
});
