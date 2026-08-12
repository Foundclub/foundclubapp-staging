import renderer, { act } from 'react-test-renderer';

import RequestsHub from '../RequestsHub';

// D92 — filet caracterisant de `RequestsHub`, qui n en avait AUCUN (E6).
//
// Ce qu il verrouille : une proposition de match amical recue apparait dans
// « Demandes », et son bouton emmene sur l ANNONCE — pas sur la racine de la
// messagerie, l erreur exacte que ce lot repare ailleurs.
//
// Pourquoi ce test existe malgre le poids de l ecran : avant ce lot,
// `grep -ci "friendly|amical" RequestsHub.js` rendait 0. Une proposition que
// le destinataire ne voit nulle part est une fonctionnalite qui n existe pas.

// `RequestsHub` importe une dizaine de services. Les charger pour de vrai tire
// le client HTTP (qui LEVE sans API_URL) puis, de proche en proche, des paquets
// publies en ESM pur (react-native-blob-util) absents de transformIgnorePatterns.
// On coupe a la racine : aucun de ces services n est l objet de ce filet, et
// aucun appel reseau n est fait ici.
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

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

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

// Le conteneur d ecran traine des paquets ESM purs hors transformIgnorePatterns
// (cf. FriendlyMatchAdDetails.test.js) : on le remplace par une View.
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
      Colors: new Proxy({}, {
        get: (/** @type {any} */ _target, /** @type {any} */ key) => (
          typeof key === 'symbol' ? undefined : 'couleur'
        ),
      }),
      Fonts: anyScale(),
      // `Button` lit Images[icon] : sans cette entree il leve sur `check`.
      Images: anyScale(),
      Spaces: anyScale(),
    }),
  };
});

const navigation = { canGoBack: () => false, goBack: jest.fn(), navigate: jest.fn() };

const FRIENDLY_ITEM = {
  actions: { primary: 'open' },
  createdAt: '2026-08-12T09:00:00.000Z',
  id: 'friendly:application-1',
  meta: {
    adId: 'ad-1',
    applicationId: 'application-1',
    isOutgoing: false,
    opponentName: 'U15 Voisine',
    teamName: 'U15 Maison',
  },
  status: 'pending',
  subtitle: 'U15 Voisine propose un match à U15 Maison.',
  title: 'Proposition de match amical',
  type: 'friendly',
};

/**
 * Tous les textes rendus, aplatis.
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
 * @param {any[]} items
 * @returns {Promise<any>}
 */
const renderHub = async (items) => {
  mockUseRequestsHubData.mockReturnValue({
    data: { counts: { friendly: items.length, total: items.length }, errors: [], items },
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
  });

  let tree;
  await act(async () => {
    tree = renderer.create(
      <RequestsHub navigation={navigation} route={{ params: {} }} />,
    );
  });
  return tree;
};

describe('D92 — « Demandes » porte enfin les propositions de match amical', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('temoin 1 — la proposition recue est A L ECRAN, avec le nom de l adversaire', async () => {
    const tree = await renderHub([FRIENDLY_ITEM]);
    const rendered = collectText(tree.toJSON()).join(' | ');

    expect(rendered).toContain('Proposition de match amical');
    expect(rendered).toContain('U15 Voisine');
    // Le filtre existe pour qui encadre une equipe.
    expect(rendered).toContain('Amicaux');
    expect(rendered).not.toContain('Aucune demande en attente');
  });

  it('le bouton emmene sur L ANNONCE, jamais sur la racine de la messagerie', async () => {
    const tree = await renderHub([FRIENDLY_ITEM]);

    const button = tree.root.findAll(
      (/** @type {any} */ node) => node.props?.title === 'Voir la proposition',
      { deep: true },
    )[0];
    expect(button).toBeDefined();

    await act(async () => { await button.props.onPress(); });

    expect(navigation.navigate).toHaveBeenCalledWith('FriendlyMatchAdDetails', { adId: 'ad-1' });
    expect(navigation.navigate).not.toHaveBeenCalledWith('Chat');
  });

  it('une proposition ENVOYEE s affiche sans bouton : c est l autre staff qui tranche', async () => {
    const tree = await renderHub([{
      ...FRIENDLY_ITEM,
      actions: {},
      id: 'friendly-sent:application-mine',
      meta: { ...FRIENDLY_ITEM.meta, infoOnly: true, isOutgoing: true },
      subtitle: 'Envoyée à U15 Voisine. En attente de sa réponse.',
      title: 'Ta proposition de match',
    }]);
    const rendered = collectText(tree.toJSON()).join(' | ');

    expect(rendered).toContain('Ta proposition de match');
    expect(rendered).toContain('En attente de sa réponse');
    expect(tree.root.findAll(
      (/** @type {any} */ node) => node.props?.title === 'Voir la proposition',
      { deep: true },
    )).toHaveLength(0);
  });
});
