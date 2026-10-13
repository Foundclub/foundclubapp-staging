import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { creerQueryClientDeTest } from '../../testSupport/queryClientDeTest';

// ==========================================================================
// AMICAUX-CORRECTIFS 81 (13/10) — LA DISCUSSION D UN MATCH AMICAL, SUR LE SITE.
//
// Constat des captures (`fc-social/.../constats/site_discussion_vue_par_celui_qui_propose_
// boutons_accepter_refuser_pc.png`) : l equipe qui a ENVOYE la proposition voyait « Accepter /
// Refuser », et le texte « … se deplace chez vous », faux pour elle.
//
// 🔎 Mesure : `renderComposition` dessinait la carte GENERIQUE de proposition (celle de la
// League) pour toute `type: 'proposal'`, boutons montres a tous, et son « Accepter » appelait la
// reponse generique (`/chat-messages/:id/proposal-response`), qui ne cree PAS le match amical.
// Le telephone, lui, rend `ProposalMessageBubble` avec `canAcceptFriendlyProposal` et appelle
// le workflow amical (`respondToFriendlyProposal`). Ces temoins exigent la meme chose du site.
// ==========================================================================

const CHAT_ID = 'chat-amical';
const mockRespondToProposal = jest.fn();
const mockRespondAmical = jest.fn();

jest.mock('@/services/friendlyMatch/friendlyMatchService', () => ({
  respondToFriendlyMatchApplication: (/** @type {any[]} */ ...args) => mockRespondAmical(...args),
}));

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
/** @type {any} */
let mockSnapshot;
/** @type {any[]} */
let mockMessages = [];

const mockServeur = {
  lectures: 0,
  reponse: 'pending',
  requireResponse: true,
  /** @type {Array<{ eventId: string, reponse: string }>} */
  reponses: [],
  version: 2,
};

jest.mock('@react-navigation/native', () => ({
  // COLL-R-APP-CREATION (13/10) : le catalogue des bandeaux importe navigationService.
  createNavigationContainerRef: () => ({ isReady: () => false }),
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => mockSnapshot,
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: new Proxy({}, { get: () => 1 }),
    scheme: 'dark',
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    isSocketConnected: true,
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    reactToMessage: jest.fn(),
    respondToProposal: (/** @type {any[]} */ ...args) => mockRespondToProposal(...args),
    retryFailedMessage: jest.fn(),
    sendMessage: jest.fn(),
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    votePoll: jest.fn(),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    data: {
      documentId: 'chat-equipe',
      name: 'Aix-Perd en Buvette',
      participants: [],
      type: 'friendly_match',
    },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: mockMessages }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  // COLL-C4A3 : la liste des fils, que le site ne lit que pour la colonne de la Ville.
  useGetChats: () => ({ data: undefined }),
}));

// Le client HTTP lit ses adresses au CHARGEMENT du module : dans une copie de
// travail, `.env` n'existe pas (`piege-env-absent-worktree-import-service`).
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));
jest.mock('@/services/chat/chatService', () => ({ createChatMessage: jest.fn() }));
jest.mock('@/services/league/leagueMatchService', () => ({
  createLeagueProposal: jest.fn(),
  respondToLeagueProposal: jest.fn(),
}));
jest.mock('@/services/messageReport/messageReportService', () => ({
  createMessageReport: jest.fn(),
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: {} }));
// MSG1W §3.5 — les fenetres du « + » (grande carte d evenement, sondage du telephone) : leurs
// modules natifs ne se chargent pas dans ce banc, et ce temoin ne les regarde pas.
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
// L assistant de convocation (MESSAGERIE-1C) charge le mur payant et son stockage natif :
// une doublure ici ; les temoins Playwright du site ouvrent le vrai.
jest.mock('@/views/conversationConvocation/ConvocationWizard', () => () => null);
// MSG1W §3.8 — la bulle d evenement du telephone, doublee : elle ecrit le nom qu elle recoit.
jest.mock('@/components/molecules/eventMessageBubble/EventMessageBubble', () => {
  const react = jest.requireActual('react');
  return function BulleEvenementDouble(/** @type {any} */ props) {
    return react.createElement(
      'div',
      { 'data-testid': 'bulle-evenement' },
      String(props.event?.name || ''),
    );
  };
});

jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(() => {
    mockServeur.lectures += 1;
    return Promise.resolve({
      branches: [{
        published: {
          requireResponse: mockServeur.requireResponse,
          reservePlayerIds: ['joueur-2'],
          reserveSnapshotPlayers: [
            { documentId: 'joueur-2', firstname: 'Paul', lastname: 'Veuillet' },
          ],
          snapshotPlayers: [
            { documentId: 'joueur-1', firstname: 'Adel', lastname: 'Ferchichi' },
            { documentId: 'joueur-2', firstname: 'Paul', lastname: 'Veuillet' },
          ],
          sportContext: 'football',
          teams: [{
            id: 't1',
            placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 20 }],
          }],
          version: mockServeur.version,
        },
        responses: {
          byPlayerId: { 'joueur-1': mockServeur.reponse, 'joueur-2': 'pending' },
        },
        team: { documentId: 'team-1', name: 'Aix-Perd en Buvette' },
      }],
      event: { date: '2099-06-14T16:00:00.000Z', documentId: 'evt-1', name: '' },
    });
  }),
  getEvents: jest.fn(() => Promise.resolve({
    data: [],
    meta: { pagination: { page: 1, pageCount: 1 } },
  })),
  missingEvent: jest.fn(() => Promise.resolve({})),
  respondToEventRsvp: jest.fn((/** @type {string} */ eventId, /** @type {string} */ reponse) => {
    mockServeur.reponses.push({ eventId, reponse });
    mockServeur.reponse = reponse;
    return Promise.resolve({ changed: true });
  }),
}));

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, style }) => (
      <View style={style} testID="mini-terrain">{children}</View>
    ),
  };
});

// Le bouton du design system, reduit a ce qui se verifie : son titre, sa
// variante (c'est elle qui dit « ta reponse ») et son appui.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity accessibilityLabel={title} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

// eslint-disable-next-line import/first
import ConversationWeb from '../Conversation.web';

// Le premier montage transpile tout le graphe d'imports de l'ecran.
jest.setTimeout(30000);

const AUTEUR = 'user-auteur';
const CANDIDAT = 'user-candidat';

/** La charge que le serveur pose dans le fil (friendly-match-workflow, AMIC-82 compris). */
const PROPOSITION = {
  adId: 'ad-1',
  applicationId: 'app-1',
  canAcceptUserIds: [AUTEUR],
  categoryLabel: 'U13',
  dateLabel: 'samedi 24 octobre',
  hostTeamName: 'Montrivage Olympique',
  kind: 'friendly_match',
  levelLabel: 'Départemental',
  sectionLabel: 'Mixte',
  staffMessage: 'On amène les maillots blancs.',
  status: 'pending',
  teamName: 'Valbrune U13',
  timeLabel: 'de 14:00 à 16:00',
  type: 'proposal',
  venue: 'Stade du Moulin',
};
const TEXTE_DE_SECOURS = [
  'Valbrune U13 propose un match.',
  'Date : samedi 24 octobre',
  'Valbrune U13 se déplace chez vous.',
  'On amène les maillots blancs.',
].join('\n');

/** @type {any} */
let queryClient;
/** @type {any[]} */
const montes = [];

const texteDe = (/** @type {any} */ noeud) => {
  /** @type {string[]} */
  const morceaux = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    (enfant.children || []).forEach(parcourir);
  };
  parcourir(noeud);
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Monte la discussion du site, lue par `lecteur`, sur un fil qui porte la proposition.
 * @param {string} lecteur
 * @param {any} [composition]
 * @returns {Promise<any>}
 */
const monterLeFil = async (lecteur, composition = PROPOSITION) => {
  mockSnapshot = { auth: { user: { documentId: lecteur } } };
  mockUseAuth.mockReturnValue({
    userData: { documentId: lecteur, firstname: 'Moi', lastname: 'Test' },
  });
  mockMessages = [{
    attachments: [],
    composition,
    createdAt: '2026-10-13T08:00:00.000Z',
    documentId: 'message-proposition',
    message: TEXTE_DE_SECOURS,
    sender: { documentId: CANDIDAT, firstname: 'Julien', lastname: 'Marchal' },
  }];
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <ConversationWeb
          navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
          route={{ params: { chatId: CHAT_ID } }}
        />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};

/**
 * Appuie sur le controle dont le texte est exactement `libelle` (bouton du site ou du telephone).
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyer = async (arbre, libelle) => {
  const cible = arbre.root.findAll((/** @type {any} */ noeud) => (
    (typeof noeud.props?.onPress === 'function' || typeof noeud.props?.onClick === 'function')
    && texteDe(noeud) === libelle
  ))[0];
  await act(async () => {
    (cible.props.onPress || cible.props.onClick)();
  });
};

beforeEach(() => {
  queryClient = creerQueryClientDeTest();
  mockRespondToProposal.mockReset();
  mockRespondAmical.mockReset();
  mockRespondAmical.mockResolvedValue({});
  window.confirm = jest.fn(() => true);
  window.alert = jest.fn();
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  queryClient.clear();
});

describe('AMIC-81 — la discussion d un match amical, sur le site', () => {
  test('81 — l equipe qui a ENVOYE la proposition ne voit ni Accepter ni Refuser', async () => {
    const texte = texteDe((await monterLeFil(CANDIDAT)).root);
    expect(texte).not.toContain('Accepter');
    expect(texte).not.toContain('Refuser');
    expect(texte).toContain('En attente de la réponse adverse');
  });

  test('81 — ni le texte « … se deplace chez vous », faux pour elle', async () => {
    expect(texteDe((await monterLeFil(CANDIDAT)).root)).not.toContain('se déplace chez vous');
  });

  test('81 — qui RECOIT voit Accepter, et Accepter cree le match (workflow amical)', async () => {
    const arbre = await monterLeFil(AUTEUR);
    await appuyer(arbre, 'Accepter');
    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(mockRespondAmical).toHaveBeenCalledWith('app-1', { action: 'accept' });
    expect(mockRespondToProposal).not.toHaveBeenCalled();
  });

  test('81 — Refuser passe aussi par le workflow amical, sans confirmation', async () => {
    const arbre = await monterLeFil(AUTEUR);
    await appuyer(arbre, 'Refuser');
    expect(window.confirm).not.toHaveBeenCalled();
    expect(mockRespondAmical).toHaveBeenCalledWith('app-1', { action: 'decline' });
  });

  test('82 — le petit mot est DANS la bulle, et le texte de secours ne le double pas', async () => {
    const texte = texteDe((await monterLeFil(AUTEUR)).root);
    expect(texte).toContain('On amène les maillots blancs.');
    expect(texte).not.toContain('Valbrune U13 propose un match.');
  });

  // -- PROTEGE ------------------------------------------------------------------------------------
  test('PROTEGE — une proposition d AVANT ce lot, sans petit mot, garde son texte', async () => {
    const ancienne = { ...PROPOSITION, staffMessage: undefined };
    const texte = texteDe((await monterLeFil(AUTEUR, ancienne)).root);
    expect(texte).toContain('On amène les maillots blancs.');
  });

  test('PROTEGE — une proposition LEAGUE garde sa carte et ses boutons', async () => {
    const league = {
      date: '2099-10-24T12:00:00.000Z', matchId: 'match-1', status: 'pending', type: 'proposal',
    };
    const texte = texteDe((await monterLeFil(AUTEUR, league)).root);
    expect(texte).toContain('Proposition de match');
    expect(texte).toContain('Accepter');
  });
});
