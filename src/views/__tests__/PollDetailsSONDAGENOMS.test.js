import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// 🐞 SONDAGE-NOMS (07/10, Adel sur TestFlight 2.6.70) — « QUI A RÉPONDU » AFFICHAIT « Membre ».
//
// Un vote ne garde que l'IDENTIFIANT du votant. L'écran retrouvait les noms dans trois
// sources : moi, `participants` du fil, et l'auteur de chaque message CHARGÉ. Or un fil de
// CLUB (ou d'équipe, ou multisport) est créé avec `participants: []` : un membre qui vote
// sans avoir écrit dans les messages chargés s'affichait « Membre ».
//
// Ce témoin monte le VRAI détail du sondage (mobile) sur un fil de club, avec un votant qui
// n'a rien écrit. La couture est la frontière HTTP (`@/services/client`) : le serveur rend
// les noms des votants par `GET /chat-messages/:id/poll-voters`. ROUGE avant le lot.

const mockGet = jest.fn();
const mockUseAuth = jest.fn();
const mockChat = { data: null };
const mockPages = { data: null };

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: (/** @type {any[]} */ ...args) => mockGet(...args),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ votePoll: jest.fn() }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: mockChat.data }),
  useGetChatMessages: () => ({ data: mockPages.data, isLoading: false }),
}));

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);

// eslint-disable-next-line import/first
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// eslint-disable-next-line import/first
import PollDetails from '../PollDetails';

jest.setTimeout(30000);

const MESSAGE_ID = 'message-sondage';
const KARIM = { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' };
const LEO = {
  avatar: { url: '/uploads/leo.png' }, documentId: 'leo', firstname: 'Leo', lastname: 'Martin',
};

const buildPoll = (/** @type {any} */ overrides = {}) => ({
  allowMultipleVotes: false,
  createdAt: '2026-10-07T09:30:00.000Z',
  createdBy: KARIM.documentId,
  isAnonymous: false,
  options: [
    { id: 'opt-1', label: 'Samedi 14h', voters: [LEO.documentId] },
    { id: 'opt-2', label: 'Dimanche 10h', voters: [] },
  ],
  pollId: 'poll-1',
  question: 'Quel creneau ?',
  type: 'poll',
  ...overrides,
});

/** @type {any[]} */
const aDemonter = [];

/**
 * Monte le détail d'un sondage d'un fil de CLUB : `participants: []`, et le seul message
 * chargé est le sondage lui-même, posé par Karim. Léo a voté sans jamais écrire.
 * @param {any} poll - Le sondage.
 * @param {any[]} [autresMessages] - T19R : d'autres messages chargés, après le sondage.
 * @param {any} [moi] - T19R : le compte connecté.
 * @returns {Promise<any>} La racine du rendu, une fois la lecture des noms aboutie.
 */
const monter = async (
  poll,
  autresMessages = [],
  moi = { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
) => {
  mockChat.data = { documentId: 'chat-club', participants: [], type: 'club' };
  mockPages.data = {
    pages: [{
      data: [
        {
          composition: poll, createdAt: poll.createdAt, documentId: MESSAGE_ID, sender: KARIM,
        },
        ...autresMessages,
      ],
    }],
  };
  mockUseAuth.mockReturnValue({ userData: moi });
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });

  /** @type {any} */
  let rendu = null;
  act(() => {
    rendu = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(PollDetails, {
        navigation: { goBack: jest.fn() },
        route: { params: { chatId: 'chat-club', messageId: MESSAGE_ID } },
      }),
    ));
  });
  // La lecture part à l'abonnement (fin du premier `act`) ; react-query prévient ses abonnés
  // au tour suivant : on lui laisse ce tour.
  await act(async () => {
    await new Promise((fini) => { setTimeout(fini, 20); });
  });
  aDemonter.push(() => {
    act(() => { rendu.unmount(); });
    client.clear();
  });
  return rendu.root;
};

const textes = (/** @type {any} */ root) => root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children)
    .filter((x) => typeof x === 'string' || typeof x === 'number').join(''))
  .join(' | ');

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation((/** @type {string} */ url) => (
    url === `/chat-messages/${MESSAGE_ID}/poll-voters`
      ? Promise.resolve({
        data: { chatDocumentId: 'chat-club', data: [LEO], messageDocumentId: MESSAGE_ID },
      })
      : Promise.resolve({ data: {} })
  ));
});

afterEach(() => {
  while (aDemonter.length) aDemonter.pop()();
});

describe('SONDAGE-NOMS — le détail mobile nomme un votant qui n a rien écrit', () => {
  test('fil de club, participants vides : le votant s affiche « Leo Martin »', async () => {
    const root = await monter(buildPoll());

    const rendu = textes(root);
    expect(rendu).not.toContain('Membre');
    expect(rendu).toContain('Leo Martin');
    expect(mockGet).toHaveBeenCalledWith(`/chat-messages/${MESSAGE_ID}/poll-voters`);
  });

  // Décision d'Adel (07/10) : un votant dont le compte est supprimé s'affiche « Compte
  // supprimé » — le serveur le signale (`deleted: true`, aucun nom). Un votant que le serveur ne
  // cite pas (parti du fil) reste « Membre ».
  test('compte supprimé : « Compte supprimé » ; votant non cité : « Membre »', async () => {
    mockGet.mockImplementation((/** @type {string} */ url) => (
      url === `/chat-messages/${MESSAGE_ID}/poll-voters`
        ? Promise.resolve({
          data: {
            chatDocumentId: 'chat-club',
            data: [
              LEO,
              {
                avatar: null, deleted: true, documentId: 'ancien', firstname: '', lastname: '',
              },
            ],
            messageDocumentId: MESSAGE_ID,
          },
        })
        : Promise.resolve({ data: {} })
    ));
    const root = await monter(buildPoll({
      options: [
        { id: 'opt-1', label: 'Samedi 14h', voters: [LEO.documentId, 'ancien'] },
        { id: 'opt-2', label: 'Dimanche 10h', voters: ['parti'] },
      ],
    }));

    const rendu = textes(root);
    expect(rendu).toContain('Leo Martin');
    expect(rendu).toContain('Compte supprimé');
    expect(rendu).toContain('Membre');
  });

  test('un sondage anonyme ne demande AUCUN nom au serveur', async () => {
    await monter(buildPoll({ isAnonymous: true }));

    expect(mockGet).not.toHaveBeenCalledWith(`/chat-messages/${MESSAGE_ID}/poll-voters`);
  });
});

// 🐞 T19-RESTES (08/10, recette) — « Créé par mouri nio » sur un sondage ANONYME de Karim. Le
// serveur garde dans chaque message une copie FIGÉE du nom de l'auteur à l'envoi : Karim
// s'appelait « mouri nio » dans ses messages du 29/09. L'écran inscrivait les auteurs du plus
// récent au plus ancien, et le DERNIER inscrit gagnait (journal :
// `.recette/t19r/JOURNAL_voterDirectory_site.txt`). ROUGE avant le lot.
describe('T19R — « Créé par » nomme l auteur sous son nom d aujourd hui', () => {
  const VIEUX_MESSAGE = {
    createdAt: '2026-09-29T19:14:15.726Z',
    documentId: 'vieux-message',
    message: 'Composition du samedi',
    sender: { documentId: KARIM.documentId, firstname: 'mouri', lastname: 'nio' },
  };

  test('lu par un autre membre : le message le plus récent de l auteur fait foi', async () => {
    const root = await monter(
      buildPoll({ createdAt: '2026-10-08T00:08:30.019Z', isAnonymous: true }),
      [VIEUX_MESSAGE],
    );

    const rendu = textes(root);
    expect(rendu).toContain('Karim Benali');
    expect(rendu).not.toContain('mouri nio');
  });

  test('lu par l auteur lui-même : son compte l emporte sur la copie figée', async () => {
    const root = await monter(
      buildPoll({ createdAt: '2026-10-08T00:08:30.019Z', isAnonymous: true }),
      [
        VIEUX_MESSAGE,
        { ...VIEUX_MESSAGE, createdAt: '2026-09-28T22:15:19.309Z', documentId: 'v2' },
      ],
      KARIM,
    );

    const rendu = textes(root);
    expect(rendu).toContain('Karim Benali');
    expect(rendu).not.toContain('mouri nio');
  });
});
