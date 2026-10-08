import renderer, { act } from 'react-test-renderer';

import Messaging from '../Messaging';

// ARCHIVEES (08/10, decision d Adel « archivées A ») — UNE CONVERSATION ARCHIVEE SE RETROUVE.
// Avant ce lot, « Archiver » (appui long ou glisser) faisait disparaitre le fil SANS moyen de le
// revoir (registre APRES_PUBLICATION n° 47). Le pack (README §3.14, prototype `p1a-app.jsx`)
// dessine une ligne « Archivées » en tete de liste, visible des qu un fil est archive, qui
// bascule la liste sur les fils archives (« Retour aux discussions » pour revenir) ; de la, le
// menu de l apercu et le glisser proposent « Désarchiver ». Doublures de `MessagingMSG1BA.test.js`.

/** @type {any[]} */
const mockListProps = [];
/** @type {any} */
let mockChatsQuery;
const mockNavigate = jest.fn();
const mockArchiveChatAsync = jest.fn(() => Promise.resolve());
const mockUnarchiveChatAsync = jest.fn(() => Promise.resolve());

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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

// Le glisser : la doublure dessine AUSSI l action de droite, pour qu on la lise et la touche.
jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    Swipeable: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.children,
      props.renderRightActions ? props.renderRightActions(null, null) : null,
    ),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      if (typeof gabarit !== 'string') return cle;
      return gabarit.replace(
        /\{\{(\w+)\}\}/g,
        (m, nom) => (repli?.[nom] !== undefined ? String(repli[nom]) : m),
      );
    },
  }),
}));

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

const mockAuth = { allMyTeams: [], userData: { documentId: 'moi', role: { name: 'Joueur' } } };
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    archiveChatAsync: mockArchiveChatAsync,
    getConversationName: (/** @type {any} */ input) => input?.chatGroupName || 'Conversation',
    getUnreadStatus: () => false,
    joinChat: jest.fn(),
    markChatUnread: jest.fn(),
    pinChatAsync: jest.fn(() => Promise.resolve()),
    sendReadReceipt: jest.fn(),
    unarchiveChatAsync: mockUnarchiveChatAsync,
    unpinChatAsync: jest.fn(() => Promise.resolve()),
    updateLastReadMessage: jest.fn(),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({ data: { pages: [] } }),
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

const ApercuDuFil = require('@/views/chat/ApercuDuFil').default;

const ACTIF = {
  archivedBy: [],
  documentId: 'chat-actif',
  groupName: 'Les U13',
  messages: [],
  participants: [],
  type: 'group',
  unreadCount: 0,
  updatedAt: '2026-10-08T10:00:00.000Z',
};
const ARCHIVE = {
  ...ACTIF,
  archivedBy: [{ documentId: 'moi' }],
  documentId: 'chat-archive',
  groupName: 'Covoiturage',
};
// Archive par QUELQU UN D AUTRE : pour moi, il reste dans la liste.
const ARCHIVE_PAR_UN_AUTRE = {
  ...ACTIF,
  archivedBy: [{ documentId: 'quelqu-un' }],
  documentId: 'chat-autre',
  groupName: 'Parents',
};

/**
 * Etat de la requete de liste : une page, ces fils.
 * @param {any[]} fils
 * @param {Record<string, any>} [surcharge]
 * @returns {any}
 */
const etatListe = (fils, surcharge = {}) => ({
  data: {
    pages: [{
      data: fils,
      meta: { pagination: { page: 1, pageCount: 1, total: fils.length } },
    }],
  },
  error: null,
  fetchNextPage: jest.fn(() => Promise.resolve()),
  hasNextPage: false,
  isFetching: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(() => Promise.resolve()),
  ...surcharge,
});

/**
 * L ecran Messages, sous ses doublures.
 * @returns {any} L element de l ecran.
 */
const ecran = () => (
  <Messaging
    navigation={{ navigate: mockNavigate, setParams: jest.fn() }}
    route={{ params: {} }}
  />
);

/**
 * Monte l ecran Messages avec ces fils.
 * @param {any[]} fils
 * @param {Record<string, any>} [surcharge]
 * @returns {Promise<any>}
 */
const monterAvec = async (fils, surcharge = {}) => {
  mockChatsQuery = etatListe(fils, surcharge);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(ecran());
  });
  return arbre;
};

/**
 * Les noeuds qui portent ce testID (le premier rendu de chaque composant hote suffit).
 * @param {any} arbre
 * @param {string} id
 * @returns {any[]}
 */
const parTestId = (arbre, id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && typeof n.type === 'string',
);

/**
 * Le texte rendu sous un noeud.
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => JSON.stringify(noeud.children.map((/** @type {any} */ c) => (
  typeof c === 'string' ? c : c.props
)));

/**
 * Touche la ligne « Archivées ».
 * @param {any} arbre
 * @returns {Promise<void>}
 */
const toucherLaLigneArchivees = async (arbre) => {
  const ligne = arbre.root.findAll(
    (/** @type {any} */ n) => n.props?.testID === 'liste-archivees'
      && typeof n.props?.onPress === 'function',
  )[0];
  await act(async () => {
    ligne.props.onPress();
  });
};

/**
 * Les fils dessines dans la liste, dans l ordre.
 * @param {any} arbre
 * @returns {string[]}
 */
const filsAffiches = (arbre) => [...new Set(arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.testID === 'string'
    && n.props.testID.startsWith('liste-fil-')
    && !n.props.testID.endsWith('-glisser')
    && typeof n.props?.onPress === 'function',
).map((/** @type {any} */ n) => n.props.testID.replace('liste-fil-', '')))];

beforeEach(() => {
  mockListProps.length = 0;
  mockNavigate.mockClear();
  mockArchiveChatAsync.mockClear();
  mockUnarchiveChatAsync.mockClear();
});

describe('ARCHIVEES — la ligne « Archivées » en tete de « Messages »', () => {
  test('AR1 — aucun fil archive : pas de ligne « Archivées »', async () => {
    const arbre = await monterAvec([ACTIF]);
    expect(parTestId(arbre, 'liste-archivees')).toHaveLength(0);
    expect(filsAffiches(arbre)).toEqual(['chat-actif']);
  });

  test('AR2 — archive par moi : « Archivées » et son compte, le fil hors de la liste', async () => {
    const arbre = await monterAvec([ACTIF, ARCHIVE]);
    const ligne = parTestId(arbre, 'liste-archivees');
    expect(ligne.length).toBeGreaterThan(0);
    const tout = JSON.stringify(arbre.toJSON());
    expect(tout).toContain('Archivées');
    expect(parTestId(arbre, 'liste-archivees-compte')[0].children).toEqual(['1']);
    expect(filsAffiches(arbre)).toEqual(['chat-actif']);
  });

  test('AR3 — archive par QUELQU UN D AUTRE : il reste dans MA liste, aucune ligne', async () => {
    const arbre = await monterAvec([ACTIF, ARCHIVE_PAR_UN_AUTRE]);
    expect(parTestId(arbre, 'liste-archivees')).toHaveLength(0);
    expect(filsAffiches(arbre).sort()).toEqual(['chat-actif', 'chat-autre']);
  });

  test('AR4 — « Archivées » : la liste des archives, puis « Retour aux discussions »', async () => {
    const arbre = await monterAvec([ACTIF, ARCHIVE]);
    await toucherLaLigneArchivees(arbre);
    expect(filsAffiches(arbre)).toEqual(['chat-archive']);
    expect(JSON.stringify(arbre.toJSON())).toContain('Retour aux discussions');

    await toucherLaLigneArchivees(arbre);
    expect(filsAffiches(arbre)).toEqual(['chat-actif']);
    expect(JSON.stringify(arbre.toJSON())).not.toContain('Retour aux discussions');
  });

  test('AR5 — appui long sur un fil archive : « Désarchiver » (et plus « Archiver »)', async () => {
    const arbre = await monterAvec([ACTIF, ARCHIVE]);
    await toucherLaLigneArchivees(arbre);
    const ligne = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'liste-fil-chat-archive'
        && typeof n.props?.onLongPress === 'function',
    )[0];
    act(() => {
      ligne.props.onLongPress();
    });
    const { entrees } = arbre.root.findByType(ApercuDuFil).props;
    expect(entrees.map((/** @type {any} */ e) => e.cle))
      .toEqual(['marquer-non-lu', 'epingler', 'desarchiver']);
    const desarchiver = entrees.find((/** @type {any} */ e) => e.cle === 'desarchiver');
    expect(desarchiver.libelle).toBe('Désarchiver');
    await act(async () => {
      await desarchiver.onPress();
    });
    expect(mockUnarchiveChatAsync).toHaveBeenCalledWith('chat-archive');
    expect(mockArchiveChatAsync).not.toHaveBeenCalled();
  });

  test('AR6 — glisser un fil archive : l action « Désarchiver »', async () => {
    const arbre = await monterAvec([ACTIF, ARCHIVE]);
    await toucherLaLigneArchivees(arbre);
    const action = parTestId(arbre, 'liste-fil-chat-archive-glisser')[0];
    expect(texteDe(action)).toContain('Désarchiver');
    const touchable = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'liste-fil-chat-archive-glisser'
        && typeof n.props?.onPress === 'function',
    )[0];
    await act(async () => {
      await touchable.props.onPress();
    });
    expect(mockUnarchiveChatAsync).toHaveBeenCalledWith('chat-archive');
  });

  test('AR7 — le dernier fil desarchive : la liste revient seule, la ligne disparait', async () => {
    const arbre = await monterAvec([ACTIF, ARCHIVE]);
    await toucherLaLigneArchivees(arbre);
    expect(filsAffiches(arbre)).toEqual(['chat-archive']);

    // Le serveur a repondu : le fil n est plus archive (la liste est relue).
    mockChatsQuery = etatListe([ACTIF, { ...ARCHIVE, archivedBy: [] }]);
    await act(async () => {
      arbre.update(ecran());
    });
    expect(parTestId(arbre, 'liste-archivees')).toHaveLength(0);
    expect(filsAffiches(arbre).sort()).toEqual(['chat-actif', 'chat-archive']);
  });

  test('AR8 — page des archives, liste incomplete : les pages suivantes sont lues', async () => {
    const arbre = await monterAvec([ACTIF, ARCHIVE], { hasNextPage: true });
    expect(mockChatsQuery.fetchNextPage).not.toHaveBeenCalled();
    await toucherLaLigneArchivees(arbre);
    expect(mockChatsQuery.fetchNextPage).toHaveBeenCalled();
  });

  test('AR9 — glisser un fil de la liste ordinaire : toujours « Archiver »', async () => {
    const arbre = await monterAvec([ACTIF, ARCHIVE]);
    const touchable = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'liste-fil-chat-actif-glisser'
        && typeof n.props?.onPress === 'function',
    )[0];
    await act(async () => {
      await touchable.props.onPress();
    });
    expect(mockArchiveChatAsync).toHaveBeenCalledWith('chat-actif');
    expect(mockUnarchiveChatAsync).not.toHaveBeenCalled();
  });
});
