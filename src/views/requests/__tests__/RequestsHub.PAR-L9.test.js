import { QueryClient } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

// Le vrai i18next en français : les libellés viennent de fr.js, pas des replis.
import '@/theme/strings';
import { mapClubInterestRequestToHubItem } from '@/domains/requests/requestMappers';

import { RouteNames } from '@/navigation/routeNames';

import {
  respondClubInterestRequest,
} from '@/services/clubInterestRequest/clubInterestRequestService';

import RequestsHub from '../RequestsHub';

// ─────────────────────────────────────────────────────────────────────────────
// 👪 PAR-L9 (13/10) — RÉPONDRE À UNE DEMANDE D'INTÉRÊT, côté club. Recette
// parent d'Adel (iPhone 2.6.73, 11/10), fiche PAR-011 ; design du 12/10, écrans
// E15 à E17 (planches 6 et 7). Décisions d'Adel : D3 (le dirigeant choisit :
// lui-même, ou un coach qu'il sélectionne) et D3 bis A (conversation à trois).
//
// ① L'action « conversation » n'était vérifiée par AUCUN témoin : ce fichier la
//   décrit d'abord telle qu'elle est (E6), puis telle que L9b la change.
// ② Une réponse « message type » ne se félicite pas : « Équipe complète » n'est
//   pas une victoire. La fenêtre dit « Réponse envoyée à Maryline. ».
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => {
  const reel = jest.requireActual('@/services/clubInterestRequest/clubInterestRequestService');
  return {
    ...reel,
    respondClubInterestRequest: jest.fn(),
  };
});

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
  refreshRequestsHubIfStale: () => Promise.resolve(),
  useRequestsHubData: (/** @type {any} */ context, /** @type {any} */ options) => (
    mockUseRequestsHubData(context, options)
  ),
}));

let mockClientDeTest = /** @type {any} */ (null);
jest.mock('@tanstack/react-query', () => {
  const reel = jest.requireActual('@tanstack/react-query');
  return { ...reel, useQueryClient: () => mockClientDeTest };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => true,
    canManageTeam: true,
    clubVerificationSummary: null,
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'u-dirigeant',
      firstname: 'Paul',
      trainedTeams: [],
    },
  }),
}));

const mockStartWhisperChat = jest.fn();
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startWhisperChat: mockStartWhisperChat }),
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

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => 'ProfileAvatar');

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(colors),
      Colors: colors,
      Fonts: jest.requireActual('@/theme/fonts').default(colors),
      Images: new Proxy({}, {
        get: (/** @type {any} */ _target, /** @type {any} */ key) => (
          typeof key === 'symbol' ? undefined : 1
        ),
      }),
      Spaces: jest.requireActual('@/theme/spaces').default,
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

/** L'intérêt d'une ADULTE (ici une maman) pour U11 Filles, tel que le serveur le rend. */
const INTERET_MARYLINE = {
  club: { documentId: 'club-1', name: 'FoundClub' },
  createdAt: '2026-10-11T08:39:00.000Z',
  documentId: 'interest-maryline',
  status: 'pending',
  team: { club: { documentId: 'club-1' }, documentId: 'team-u11f', name: 'U11 Filles' },
  user: {
    documentId: 'u-maryline', firstname: 'Maryline', lastname: 'Monroe',
  },
};

let arbreMonte = /** @type {any} */ (null);

/**
 * Monte l'écran avec les demandes données, passées par le VRAI mappeur.
 * @param {any[]} demandes Les demandes brutes.
 * @returns {Promise<any>} L'arbre rendu.
 */
const monterLeHub = async (demandes) => {
  const items = demandes.map(mapClubInterestRequestToHubItem);
  mockUseRequestsHubData.mockReturnValue({
    data: { counts: { interest: items.length, total: items.length }, errors: [], items },
    isLoading: false,
    isPending: false,
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
 * Tous les textes rendus, aplatis.
 * @param {any} node Le noeud de départ.
 * @returns {string[]} Les chaînes trouvées.
 */
const collecterTexte = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collecterTexte);
  return collecterTexte(node.children);
};

/**
 * Le bouton portant ce titre, s'il existe.
 * @param {any} tree L'arbre rendu.
 * @param {string} titre Le libellé cherché.
 * @returns {any} Le noeud, ou undefined.
 */
const bouton = (tree, titre) => tree.root.findAll(
  (/** @type {any} */ node) => (
    node.props?.title === titre || node.props?.accessibilityLabel === titre
  )
    && typeof node.props?.onPress === 'function',
  { deep: true },
)[0];

/**
 * La carte d'une demande, telle que l'écran la rend.
 * @param {any} tree L'arbre rendu.
 * @returns {any} Le noeud de la carte.
 */
const carteDe = (tree) => tree.root.findAll(
  (/** @type {any} */ node) => typeof node.props?.onPrimaryPress === 'function'
    && node.props?.item?.id === 'interest:interest-maryline',
  { deep: true },
)[0];

/**
 * Appuie sur le bouton de la carte qui porte ce geste (« chat » ou « respond »),
 * quelle que soit sa place.
 * @param {any} tree L'arbre rendu.
 * @param {'chat' | 'respond'} geste Le geste voulu.
 * @returns {Promise<void>}
 */
const appuyerSurLaCarte = async (tree, geste) => {
  const carte = carteDe(tree);
  expect(carte).toBeDefined();
  const { item } = carte.props;
  const appui = item.actions.primary === geste
    ? carte.props.onPrimaryPress
    : carte.props.onSecondaryPress;
  expect([item.actions.primary, item.actions.secondary]).toContain(geste);
  await act(async () => { await appui(item); });
};

// ⏱️ Le PREMIER rendu charge l'écran entier (fr.js, thème, composants) : mesuré
// 7,9 s à froid contre ~0,2 s ensuite. On le paie une fois ici, hors des témoins,
// pour qu'aucun ne rougisse sur le chronomètre de 5 s de jest.
beforeAll(async () => {
  mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await monterLeHub([INTERET_MARYLINE]);
  await act(async () => { arbreMonte.unmount(); });
  arbreMonte = null;
}, 60000);

describe('PAR-L9 — répondre à une demande d intérêt (écran Demandes)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    respondClubInterestRequest.mockResolvedValue({ data: {} });
    mockStartWhisperChat.mockResolvedValue({ documentId: 'fil-maryline' });
  });

  afterEach(async () => {
    if (arbreMonte) {
      await act(async () => { arbreMonte.unmount(); });
      arbreMonte = null;
    }
    mockClientDeTest.clear();
  });

  test('② une réponse « message type » ne se félicite pas : « Réponse envoyée à … »', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'respond');
    await act(async () => { await bouton(tree, 'Envoyer la réponse').props.onPress(); });

    expect(respondClubInterestRequest).toHaveBeenCalledWith(
      'interest-maryline',
      expect.objectContaining({ presetKey: 'thanks', responseType: 'preset' }),
    );
    const rendu = collecterTexte(tree.toJSON()).join(' | ');
    expect(rendu).toContain('Réponse envoyée à Maryline.');
    expect(rendu).not.toContain('Félicitations');
    expect(rendu).not.toContain('Ta réponse est partie.');
    // La ligne quitte la liste au moment du geste, comme une acceptation.
    expect(carteDe(tree)).toBeUndefined();
    expect(alerte).not.toHaveBeenCalled();
  });

  test('② un refus motivé (« Équipe complète ») ne se félicite pas non plus', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'respond');
    await act(async () => { bouton(tree, 'Équipe complète').props.onPress(); });
    await act(async () => { await bouton(tree, 'Envoyer la réponse').props.onPress(); });

    expect(respondClubInterestRequest).toHaveBeenCalledWith(
      'interest-maryline',
      expect.objectContaining({ presetKey: 'full', responseType: 'preset' }),
    );
    const rendu = collecterTexte(tree.toJSON()).join(' | ');
    expect(rendu).toContain('Réponse envoyée à Maryline.');
    expect(rendu).not.toContain('Félicitations');
  });

  test('② un échec n affiche aucune fenêtre : l erreur se voit, la demande reste', async () => {
    respondClubInterestRequest.mockRejectedValue(new Error('Refus serveur'));
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'respond');
    await act(async () => { await bouton(tree, 'Envoyer la réponse').props.onPress(); });

    const rendu = collecterTexte(tree.toJSON()).join(' | ');
    expect(rendu).not.toContain('Réponse envoyée');
    expect(alerte).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});

describe('PAR-L9 — ① l action « conversation » (caractérisation avant L9b)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    respondClubInterestRequest.mockResolvedValue({ data: {} });
    mockStartWhisperChat.mockResolvedValue({ documentId: 'fil-maryline' });
  });

  afterEach(async () => {
    if (arbreMonte) {
      await act(async () => { arbreMonte.unmount(); });
      arbreMonte = null;
    }
    mockClientDeTest.clear();
  });

  test('ouvre un tête-à-tête avec la demandeuse, le lie à la demande, puis y emmène', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'chat');

    expect(mockStartWhisperChat).toHaveBeenCalledWith(['u-maryline']);
    expect(respondClubInterestRequest).toHaveBeenCalledWith('interest-maryline', {
      chatDocumentId: 'fil-maryline',
      responseType: 'chat',
    });
    expect(navigation.navigate)
      .toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'fil-maryline' });
  });

  test('si le fil ne s ouvre pas, rien n est lié et l erreur se voit', async () => {
    mockStartWhisperChat.mockRejectedValue(new Error('Offre FoundClub requise.'));
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'chat');

    expect(respondClubInterestRequest).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledTimes(1);
  });
});
