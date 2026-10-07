import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

// 🐞 SONDAGE-NOMS (07/10) — LE MÊME DÉFAUT, CÔTÉ SITE (`PollDetails.web.js`).
//
// Le témoin historique de cet écran (PollDetailsWeb.test.js) donne TOUJOURS des participants
// remplis : il ne pouvait pas voir un fil de club, créé avec `participants: []`, où un membre
// vote sans avoir écrit. Ici, Léo n'a rien écrit : avant le lot, le site affichait « Membre ».
// La couture est la frontière HTTP (`@/services/client`). ROUGE avant le lot.

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
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({ Colors, scheme: 'dark' }),
  };
});

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

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// eslint-disable-next-line import/first
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// eslint-disable-next-line import/first
import PollDetailsWeb from '../PollDetails.web';

jest.setTimeout(30000);

const MESSAGE_ID = 'message-sondage';
const KARIM = { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' };
const LEO = {
  avatar: { url: '/uploads/leo.png' }, documentId: 'leo', firstname: 'Leo', lastname: 'Martin',
};

const POLL = {
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
};

// Même lecture que le témoin historique : le texte visible, concaténé comme le navigateur.
const textOf = (/** @type {any} */ node) => {
  /** @type {string[]} */
  const parts = [];
  const walk = (/** @type {any} */ child) => {
    if (child === null || child === undefined || child === false) return;
    if (typeof child === 'string' || typeof child === 'number') {
      parts.push(String(child));
      return;
    }
    (child.children || []).forEach(walk);
  };
  walk(node);
  return parts.join('').replace(/\s+/g, ' ').trim();
};

/** @type {any} */
let mounted = null;
/** @type {any} */
let client = null;

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockImplementation((/** @type {string} */ url) => (
    url === `/chat-messages/${MESSAGE_ID}/poll-voters`
      ? Promise.resolve({
        data: { chatDocumentId: 'chat-club', data: [LEO], messageDocumentId: MESSAGE_ID },
      })
      : Promise.resolve({ data: {} })
  ));
  mockChat.data = { documentId: 'chat-club', participants: [], type: 'club' };
  mockPages.data = {
    pages: [{ data: [{ composition: POLL, documentId: MESSAGE_ID, sender: KARIM }] }],
  };
  mockUseAuth.mockReturnValue({
    userData: { documentId: 'moi', firstname: 'Adel', lastname: 'F' },
  });
  client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
});

afterEach(() => {
  if (mounted) {
    act(() => { mounted.unmount(); });
    mounted = null;
  }
  client.clear();
});

describe('SONDAGE-NOMS — le détail du site nomme un votant qui n a rien écrit', () => {
  test('fil de club, participants vides : « Leo Martin » et sa photo, pas « Membre »', async () => {
    act(() => {
      mounted = renderer.create(createElement(
        QueryClientProvider,
        { client },
        createElement(PollDetailsWeb, {
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

    const rendu = textOf(mounted.root);
    expect(rendu).not.toContain('Membre');
    expect(rendu).toContain('Leo Martin');
    const photo = mounted.root.findAllByType('img')
      .find((/** @type {any} */ n) => n.props.alt === 'Leo Martin');
    expect(photo).toBeTruthy();
    expect(mockGet).toHaveBeenCalledWith(`/chat-messages/${MESSAGE_ID}/poll-voters`);
  });

  // Décision d'Adel (07/10) : « Compte supprimé » pour un compte effacé, signalé par le serveur.
  // Il a écrit un message chargé (son ancien nom y est figé) : le serveur, plus frais, l'emporte.
  test('un compte supprimé s affiche « Compte supprimé », même s il avait écrit', async () => {
    mockGet.mockImplementation((/** @type {string} */ url) => (
      url === `/chat-messages/${MESSAGE_ID}/poll-voters`
        ? Promise.resolve({
          data: {
            chatDocumentId: 'chat-club',
            data: [{
              avatar: null, deleted: true, documentId: 'ancien', firstname: '', lastname: '',
            }],
            messageDocumentId: MESSAGE_ID,
          },
        })
        : Promise.resolve({ data: {} })
    ));
    mockPages.data = {
      pages: [{
        data: [
          {
            composition: {
              ...POLL,
              options: [{ id: 'opt-1', label: 'Samedi 14h', voters: ['ancien'] }],
            },
            documentId: MESSAGE_ID,
            sender: KARIM,
          },
          {
            composition: null,
            documentId: 'message-ancien',
            message: 'Bonjour',
            sender: { documentId: 'ancien', firstname: 'Paul', lastname: 'Ancien' },
          },
        ],
      }],
    };

    act(() => {
      mounted = renderer.create(createElement(
        QueryClientProvider,
        { client },
        createElement(PollDetailsWeb, {
          navigation: { goBack: jest.fn() },
          route: { params: { chatId: 'chat-club', messageId: MESSAGE_ID } },
        }),
      ));
    });
    await act(async () => {
      await new Promise((fini) => { setTimeout(fini, 20); });
    });

    const rendu = textOf(mounted.root);
    expect(rendu).toContain('Compte supprimé');
    expect(rendu).not.toContain('Paul Ancien');
  });
});
