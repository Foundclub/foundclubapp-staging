import { QueryClient } from '@tanstack/react-query';
import { TextInput } from 'react-native';
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

// PARENT-FINITIONS 4 — le bandeau d'arrivée passe par le bandeau COMMUN de l'app (app et site).
const mockShowBanner = jest.fn();
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: mockShowBanner }),
}));

// L9b — la liste des coachs de l'équipe visée (E16), lue par la requête d'équipe existante.
const mockUseGetTeam = jest.fn();
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: (/** @type {any[]} */ ...args) => mockUseGetTeam(...args),
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

/** L'équipe visée, avec ses deux coachs (la requête d'équipe la rend ainsi). */
const EQUIPE_U11F = {
  documentId: 'team-u11f',
  name: 'U11 Filles',
  trainers: [
    { documentId: 'coach-karim', firstname: 'Karim', lastname: 'Benali' },
    { documentId: 'coach-sarah', firstname: 'Sarah', lastname: 'Lopez' },
  ],
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
  mockUseGetTeam.mockReturnValue({ data: EQUIPE_U11F, isError: false, isLoading: false });
  mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await monterLeHub([INTERET_MARYLINE]);
  await act(async () => { arbreMonte.unmount(); });
  arbreMonte = null;
}, 60000);

describe('PAR-L9 — répondre à une demande d intérêt (écran Demandes)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGetTeam.mockReturnValue({ data: EQUIPE_U11F, isError: false, isLoading: false });
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

describe('PAR-L9b — ④ la feuille « Répondre » (E17) : refus motivés, mot libre', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGetTeam.mockReturnValue({ data: EQUIPE_U11F, isError: false, isLoading: false });
    mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    respondClubInterestRequest.mockResolvedValue({ data: {} });
  });

  afterEach(async () => {
    if (arbreMonte) {
      await act(async () => { arbreMonte.unmount(); });
      arbreMonte = null;
    }
    mockClientDeTest.clear();
  });

  test('la feuille dit QUI recevra le message, et range « Répondre » / « Refuser »', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'respond');

    const rendu = collecterTexte(tree.toJSON()).join(' | ');
    expect(rendu).toContain('Maryline recevra ce message.');
    expect(rendu).not.toContain('joueur intéresse');
    const ordre = [
      'RÉPONDRE', 'Merci, on revient vers toi', 'Proposer un essai', 'Compléter le profil',
      'REFUSER', 'Équipe complète', "Profil non adapté à l'équipe",
    ].map((texte) => rendu.indexOf(texte));
    ordre.forEach((position) => expect(position).toBeGreaterThanOrEqual(0));
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  test('« Profil non adapté » + un mot : les deux partent, et la fenêtre le dit', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'respond');
    await act(async () => { bouton(tree, "Profil non adapté à l'équipe").props.onPress(); });
    const champ = tree.root.findByType(TextInput);
    expect(champ.props.maxLength).toBe(280);
    expect(champ.props.placeholder).toBe('Ajouter un mot (facultatif)');
    await act(async () => { champ.props.onChangeText('  On garde ton contact.  '); });
    expect(collecterTexte(tree.toJSON()).join(' | ')).toContain('On garde ton contact.');
    await act(async () => { await bouton(tree, 'Envoyer la réponse').props.onPress(); });

    expect(respondClubInterestRequest).toHaveBeenCalledWith('interest-maryline', {
      note: 'On garde ton contact.',
      presetKey: 'unsuitable',
      responseType: 'preset',
    });
    expect(collecterTexte(tree.toJSON()).join(' | ')).toContain('Réponse envoyée à Maryline.');
  });

  test('sans mot, aucune clé `note` ne part (un vieux serveur l ignorerait)', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'respond');
    await act(async () => { tree.root.findByType(TextInput).props.onChangeText('   '); });
    await act(async () => { await bouton(tree, 'Envoyer la réponse').props.onPress(); });

    expect(respondClubInterestRequest).toHaveBeenCalledWith('interest-maryline', {
      presetKey: 'thanks',
      responseType: 'preset',
    });
  });

  test('« Annuler » referme la feuille sans rien envoyer', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'respond');
    await act(async () => { bouton(tree, 'Annuler').props.onPress(); });

    expect(respondClubInterestRequest).not.toHaveBeenCalled();
    expect(bouton(tree, 'Envoyer la réponse')).toBeUndefined();
  });
});

describe('PAR-L9b — ③ « Ouvrir une conversation » : moi, ou un coach choisi (D3, D3 bis)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGetTeam.mockReturnValue({ data: EQUIPE_U11F, isError: false, isLoading: false });
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

  const MOI = 'Moi — je discute directement avec Maryline.';
  const UN_COACH = 'Un·e coach de U11 Filles — je choisis qui.';
  const OUVRIR = 'Ouvrir la conversation';

  test('le bouton de la carte OUVRE LA FEUILLE : rien n est créé ni choisi d office', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'chat');

    expect(mockStartWhisperChat).not.toHaveBeenCalled();
    expect(respondClubInterestRequest).not.toHaveBeenCalled();
    const rendu = collecterTexte(tree.toJSON()).join(' | ');
    expect(rendu).toContain('Maryline Monroe · intérêt pour U11 Filles');
    expect(rendu).toContain("Ouvrir une conversation ne vaut pas inscription dans l'équipe.");
    expect(bouton(tree, MOI).props.accessibilityState).toMatchObject({ checked: false });
    expect(bouton(tree, UN_COACH).props.accessibilityState).toMatchObject({ checked: false });
    expect(bouton(tree, OUVRIR).props.disabled).toBe(true);
  });

  test('« Moi » : un tête-à-tête avec la personne, lié à la demande, puis on y entre', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'chat');
    await act(async () => { bouton(tree, MOI).props.onPress(); });
    expect(bouton(tree, OUVRIR).props.disabled).toBe(false);
    await act(async () => { await bouton(tree, OUVRIR).props.onPress(); });

    expect(mockStartWhisperChat).toHaveBeenCalledWith(['u-maryline']);
    expect(respondClubInterestRequest).toHaveBeenCalledWith('interest-maryline', {
      chatDocumentId: 'fil-maryline',
      responseType: 'chat',
    });
    expect(navigation.navigate)
      .toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'fil-maryline' });
  });

  test('« Un·e coach » : la liste des coachs de l équipe, et il faut en choisir un', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'chat');
    await act(async () => { bouton(tree, UN_COACH).props.onPress(); });

    expect(mockUseGetTeam)
      .toHaveBeenCalledWith('team-u11f', expect.objectContaining({ enabled: true }));
    expect(bouton(tree, 'Karim B. · coach U11 Filles')).toBeDefined();
    expect(bouton(tree, 'Sarah L. · coach U11 Filles')).toBeDefined();
    expect(bouton(tree, OUVRIR).props.disabled).toBe(true);
  });

  test('coach choisi : conversation À TROIS, coach nommé au serveur, puis on y entre', async () => {
    mockStartWhisperChat.mockResolvedValue({ documentId: 'fil-a-trois' });
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'chat');
    await act(async () => { bouton(tree, UN_COACH).props.onPress(); });
    await act(async () => { bouton(tree, 'Karim B. · coach U11 Filles').props.onPress(); });
    await act(async () => { await bouton(tree, OUVRIR).props.onPress(); });

    expect(mockStartWhisperChat).toHaveBeenCalledWith(['u-maryline', 'coach-karim']);
    expect(respondClubInterestRequest).toHaveBeenCalledWith('interest-maryline', {
      chatDocumentId: 'fil-a-trois',
      coachDocumentId: 'coach-karim',
      responseType: 'chat',
    });
    expect(navigation.navigate)
      .toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'fil-a-trois' });
  });

  test('une équipe SANS autre coach que moi : la rangée le dit et ne se choisit pas', async () => {
    mockUseGetTeam.mockReturnValue({
      data: {
        ...EQUIPE_U11F,
        trainers: [{ documentId: 'u-dirigeant', firstname: 'Paul', lastname: 'Dirigeant' }],
      },
      isError: false,
      isLoading: false,
    });
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'chat');

    // Une rangée désactivée n a PAS de geste : on la cherche par son nom seul.
    const rangee = tree.root.findAll(
      (/** @type {any} */ node) => node.props?.accessibilityRole === 'radio'
        && node.props?.accessibilityLabel === 'Aucun·e coach dans U11 Filles',
    )[0];
    expect(rangee).toBeDefined();
    expect(rangee.props.disabled).toBe(true);
    expect(rangee.props.onPress).toBeUndefined();
    expect(bouton(tree, UN_COACH)).toBeUndefined();
  });

  test('« Annuler » referme sans rien créer', async () => {
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'chat');
    await act(async () => { bouton(tree, MOI).props.onPress(); });
    await act(async () => { bouton(tree, 'Annuler').props.onPress(); });

    expect(mockStartWhisperChat).not.toHaveBeenCalled();
    expect(bouton(tree, OUVRIR)).toBeUndefined();
  });

  test('si le fil ne s ouvre pas, rien n est lié et l erreur se voit', async () => {
    mockStartWhisperChat.mockRejectedValue(new Error('Offre FoundClub requise.'));
    const tree = await monterLeHub([INTERET_MARYLINE]);

    await appuyerSurLaCarte(tree, 'chat');
    await act(async () => { bouton(tree, MOI).props.onPress(); });
    await act(async () => { await bouton(tree, OUVRIR).props.onPress(); });

    expect(respondClubInterestRequest).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledTimes(1);
    expect(mockShowBanner).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 👪 PARENT-FINITIONS 4 (14/10, design E16, planche 7) — EN ARRIVANT DANS LE FIL, UN BANDEAU
// DIT AVEC QUI : « Conversation ouverte avec Maryline et Karim. » ; si le fil existait déjà,
// « Ta conversation avec Maryline est rouverte. ». Avant : on arrivait dans le fil sans un mot.
// ⛔ Aucun prénom dans les paramètres de la route (sur le site, ils vont dans l'adresse) : le
// bandeau est celui de l'app, posé APRÈS l'arrivée.
// ─────────────────────────────────────────────────────────────────────────────
describe('PARENT-FINITIONS 4 — le bandeau d arrivée dans la conversation (E16)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGetTeam.mockReturnValue({ data: EQUIPE_U11F, isError: false, isLoading: false });
    mockClientDeTest = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    respondClubInterestRequest.mockResolvedValue({ data: {} });
  });

  afterEach(async () => {
    if (arbreMonte) {
      await act(async () => { arbreMonte.unmount(); });
      arbreMonte = null;
    }
    mockClientDeTest.clear();
  });

  const MOI = 'Moi — je discute directement avec Maryline.';
  const UN_COACH = 'Un·e coach de U11 Filles — je choisis qui.';

  /**
   * Ouvre la feuille, choisit « Moi » ou un coach, et confirme.
   * @param {string | null} coach Le libellé du coach, ou null pour « Moi ».
   * @returns {Promise<void>}
   */
  const ouvrirLeFil = async (coach) => {
    const tree = await monterLeHub([INTERET_MARYLINE]);
    await appuyerSurLaCarte(tree, 'chat');
    if (coach) {
      await act(async () => { bouton(tree, UN_COACH).props.onPress(); });
      await act(async () => { bouton(tree, coach).props.onPress(); });
    } else {
      await act(async () => { bouton(tree, MOI).props.onPress(); });
    }
    await act(async () => { await bouton(tree, 'Ouvrir la conversation').props.onPress(); });
  };

  test('« Moi », fil NEUF : « Conversation ouverte avec Maryline. », après l arrivée', async () => {
    mockStartWhisperChat.mockResolvedValue({
      documentId: 'fil-maryline', openingOutcome: 'created',
    });

    await ouvrirLeFil(null);

    expect(navigation.navigate)
      .toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'fil-maryline' });
    expect(mockShowBanner).toHaveBeenCalledTimes(1);
    expect(mockShowBanner.mock.calls[0][0])
      .toMatchObject({ title: 'Conversation ouverte avec Maryline.' });
    expect(mockShowBanner.mock.invocationCallOrder[0])
      .toBeGreaterThan(navigation.navigate.mock.invocationCallOrder[0]);
  });

  test('coach choisi, fil NEUF : « Conversation ouverte avec Maryline et Karim. »', async () => {
    mockStartWhisperChat.mockResolvedValue({
      documentId: 'fil-a-trois', openingOutcome: 'created',
    });

    await ouvrirLeFil('Karim B. · coach U11 Filles');

    expect(mockShowBanner).toHaveBeenCalledTimes(1);
    expect(mockShowBanner.mock.calls[0][0])
      .toMatchObject({ title: 'Conversation ouverte avec Maryline et Karim.' });
  });

  test('le fil EXISTAIT : « Ta conversation avec Maryline est rouverte. »', async () => {
    mockStartWhisperChat.mockResolvedValue({
      documentId: 'fil-maryline', openingOutcome: 'reused',
    });

    await ouvrirLeFil(null);

    expect(mockShowBanner).toHaveBeenCalledTimes(1);
    expect(mockShowBanner.mock.calls[0][0])
      .toMatchObject({ title: 'Ta conversation avec Maryline est rouverte.' });
  });

  test.each([
    ['existant depuis 30 s', -30000, 'reused', 'Ta conversation avec Maryline est rouverte.'],
    ['existant sans date', null, 'reused', 'Ta conversation avec Maryline est rouverte.'],
    ['existant daté demain', 86400000, 'reused', 'Ta conversation avec Maryline est rouverte.'],
    ['créé avec horloge décalée', -86400000, 'created', 'Conversation ouverte avec Maryline.'],
    ['ancien serveur, date ancienne', -86400000, undefined, 'Conversation avec Maryline.'],
    ['ancien serveur, sans date', null, undefined, 'Conversation avec Maryline.'],
    ['indicateur inconnu', -86400000, 'other', 'Conversation avec Maryline.'],
  ])('%s : le résultat du geste décide du verbe', async (_cas, decalage, openingOutcome, title) => {
    mockStartWhisperChat.mockResolvedValue({
      ...(decalage === null ? {} : { createdAt: new Date(Date.now() + decalage).toISOString() }),
      documentId: 'fil-maryline',
      openingOutcome,
    });

    await ouvrirLeFil(null);

    expect(mockShowBanner).toHaveBeenCalledTimes(1);
    expect(mockShowBanner.mock.calls[0][0]).toMatchObject({ title });
    expect(navigation.navigate)
      .toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'fil-maryline' });
  });

  test('un refus serveur ne lie pas la demande et ne montre aucun bandeau', async () => {
    mockStartWhisperChat.mockRejectedValue(new Error('Contact refusé'));

    await ouvrirLeFil(null);

    expect(respondClubInterestRequest).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(mockShowBanner).not.toHaveBeenCalled();
  });

  test('si le lien à la demande échoue, on n arrive nulle part : aucun bandeau', async () => {
    mockStartWhisperChat.mockResolvedValue({
      createdAt: new Date().toISOString(), documentId: 'fil-maryline',
    });
    respondClubInterestRequest.mockRejectedValue(new Error('boom'));

    await ouvrirLeFil(null);

    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(mockShowBanner).not.toHaveBeenCalled();
  });
});
