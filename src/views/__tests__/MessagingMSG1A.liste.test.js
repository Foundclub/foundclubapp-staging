import renderer, { act } from 'react-test-renderer';

import Messaging from '../Messaging';

// MSG1A (§3.13) — LA LIGNE DE LA LISTE « MESSAGES », au dessin du pack : avatar 52, titre,
// heure, apercu avec « Prenom : » dans les fils a plusieurs, coches si c'est moi, icone du
// contenu riche, punaise, pastille de non-lus cyan. Les doublures sont celles de
// `MessagingMSG2.rechargement.test.js` (meme ecran, meme montage).

/** @type {any[]} */
const mockListProps = [];
/** @type {any} */
let mockChatsQuery;
const mockNavigate = jest.fn();
const mockJoinChat = jest.fn();

// FlashList ne rend rien sous `react-test-renderer` : la doublure deroule
// `data` et garde les props pour qu on lise `refreshing` et `onEndReached`.
jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    FlashList: function FlashListMock(/** @type {any} */ props) {
      mockListProps.push(props);
      return reactActuel.createElement(
        VueRN,
        null,
        (props.data || []).map((/** @type {any} */ element, /** @type {number} */ index) => (
          reactActuel.createElement(
            VueRN,
            { key: element?.documentId || index },
            props.renderItem({ item: element }),
          )
        )),
      );
    },
  };
});

jest.mock('react-native-gesture-handler', () => ({
  Swipeable: (/** @type {any} */ props) => props.children,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Le VRAI theme, jamais un Proxy : un Proxy rend les echecs Jest illisibles.
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

// Identite STABLE : un `userData` neuf a chaque rendu reconstruirait la liste.
const mockAuth = { allMyTeams: [], userData: { documentId: 'moi', role: { name: 'Joueur' } } };
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    archiveChatAsync: jest.fn(() => Promise.resolve()),
    getConversationName: (/** @type {any} */ input) => input?.chatGroupName || 'Conversation',
    getUnreadStatus: () => false,
    joinChat: mockJoinChat,
    pinChatAsync: jest.fn(() => Promise.resolve()),
    unpinChatAsync: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  // MSGREACT — les reactions emoji du fil. Aucune par defaut : les temoins de
  // cet ecran ne parlent pas de reactions, et une rangee vide ne se dessine pas.
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChats: () => mockChatsQuery,
}));

jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useGetMyBlockedUsers: () => ({ data: [] }),
}));

jest.mock('@/utils/errors/displayError', () => ({
  getErrorMessage: () => 'erreur',
}));

jest.mock('@/utils/performance/messagingPerformance', () => ({
  markMessagingPerf: jest.fn(),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingActionContainerStyle: () => ({}),
}));

jest.mock('@/components/atoms/marqueeText/MarqueeText', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');
  return (/** @type {any} */ props) => reactActuel.createElement(TexteRN, null, props.text);
});
jest.mock(
  '@/components/atoms/webFloatingOverlay/WebFloatingOverlay',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
// COLL-C4A (02/10) — les canaux de la Ville lisent le serveur : hors du sujet de ce témoin.
jest.mock('@/views/collectivite/components/CanauxDeLaVille', () => () => null);
jest.mock('@/components/molecules/header/LeagueHeaderSwitch', () => () => null);
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);
jest.mock(
  '@/components/molecules/tutorial/TutorialFlowBoundary',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => (/** @type {any} */ props) => props.children || null,
);

const CHATS = [
  {
    documentId: 'chat-1',
    groupName: 'Les U13',
    messages: [],
    participants: [],
    type: 'group',
    unreadCount: 0,
    updatedAt: '2026-09-15T10:00:00.000Z',
  },
];

/**
 * Etat de la requete de liste, fige par defaut sur « page chargee, rien en vol ».
 * @param {Record<string, any>} [surcharge] Les champs a changer.
 * @returns {any} L etat de `useGetChats`.
 */
const etatListe = (surcharge = {}) => ({
  data: { pages: [{ data: CHATS, meta: { pagination: { page: 1, pageCount: 3, total: 50 } } }] },
  error: null,
  fetchNextPage: jest.fn(() => Promise.resolve()),
  hasNextPage: true,
  isFetching: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(() => Promise.resolve()),
  ...surcharge,
});

/**
 * Monte l ecran Messages sous ses doublures.
 * @returns {Promise<any>} L ecran monte.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Messaging
        navigation={{ navigate: mockNavigate, setParams: jest.fn() }}
        route={{ params: {} }}
      />,
    );
  });
  return arbre;
};

beforeEach(() => {
  mockListProps.length = 0;
  mockNavigate.mockClear();
  mockJoinChat.mockClear();
});

describe('MSG1A (§3.13) — la ligne de la liste « Messages »', () => {
  // eslint-disable-next-line global-require
  const GlyphIcon = require('@/components/atoms/glyphIcon/GlyphIcon').default;
  // eslint-disable-next-line global-require
  const AvatarDuFil = require('@/views/chat/AvatarDuFil').default;

  /**
   * Aide du temoin : `monterAvec`.
   * @param {any[]} fils
   * @returns {Promise<any>}
   */
  const monterAvec = async (fils) => {
    mockChatsQuery = etatListe({
      data: {
        pages: [{
          data: fils,
          meta: { pagination: { page: 1, pageCount: 1, total: fils.length } },
        }],
      },
      hasNextPage: false,
    });
    return monter();
  };

  /**
   * Aide du temoin : `toutLeTexte`.
   * @param {any} arbre
   * @returns {string}
   */
  const toutLeTexte = (arbre) => JSON.stringify(arbre.toJSON());

  test(
    'LI1 — groupe : « Prénom : », icône du contenu riche, pastille de non-lus cyan avec le nombre',
    async () => {
      const arbre = await monterAvec([
        {
          ...CHATS[0],
          messages: [
            {
              composition: { question: 'Quel créneau ?', type: 'poll' },
              createdAt: '2026-10-07T10:00:00.000Z',
              sender: { documentId: 'karim', firstname: 'Karim' },
            },
          ],
          unreadCount: 3,
        },
      ]);

      expect(toutLeTexte(arbre)).toContain('Karim :');
      expect(toutLeTexte(arbre)).toContain('Sondage : Quel créneau ?');
      const icones = arbre.root.findAllByType(GlyphIcon)
        .map((/** @type {any} */ n) => n.props.name);
      expect(icones).toContain('chartSimpleHorizontal');
      expect(toutLeTexte(arbre)).toContain('"3"');
      // Un seul bouton par ligne : l'avatar n'en est plus un second.
      expect(arbre.root.findAllByType(AvatarDuFil)[0].props.size).toBe(52);
    },
  );

  test(
    'LI2 — mon dernier message : les coches, pas de « Prénom : » ; épinglé : la punaise',
    async () => {
      const arbre = await monterAvec([
        {
          ...CHATS[0],
          messages: [
            {
              createdAt: '2026-10-07T10:00:00.000Z',
              message: 'A demain',
              sender: { documentId: 'moi', firstname: 'Adel' },
            },
          ],
          pinnedBy: [{ documentId: 'moi' }],
        },
      ]);

      const icones = arbre.root.findAllByType(GlyphIcon)
        .map((/** @type {any} */ n) => n.props.name);
      expect(icones).toEqual(expect.arrayContaining(['checkDouble', 'thumbtack']));
      expect(toutLeTexte(arbre)).not.toContain('Adel :');
    },
  );

  test('LI3 — tête-à-tête : jamais de « Prénom : »', async () => {
    const arbre = await monterAvec([
      {
        ...CHATS[0],
        messages: [
          {
            createdAt: '2026-10-07T10:00:00.000Z',
            message: 'Salut',
            sender: { documentId: 'karim', firstname: 'Karim' },
          },
        ],
        type: 'whisper',
      },
    ]);
    expect(toutLeTexte(arbre)).not.toContain('Karim :');
  });

  test(
    'LI4 — mon dernier message LU par quelqu un : coches cyan ; pas encore lu : grises',
    async () => {
    // eslint-disable-next-line global-require
      const genererCouleurs = require('@/theme/colors').default;
      const couleurs = genererCouleurs();
      const fil = (readBy) => ({
        ...CHATS[0],
        messages: [
          {
            createdAt: '2026-10-07T10:00:00.000Z',
            message: 'A demain',
            readBy,
            sender: { documentId: 'moi', firstname: 'Adel' },
          },
        ],
      });
      const coches = (arbre) => arbre.root
        .findAllByType(GlyphIcon)
        .find((/** @type {any} */ n) => n.props.name === 'checkDouble').props.color;

      expect(coches(await monterAvec([fil([{ documentId: 'karim' }])]))).toBe(couleurs.primary500);
      expect(coches(await monterAvec([fil([])]))).not.toBe(couleurs.primary500);
    },
  );
});
