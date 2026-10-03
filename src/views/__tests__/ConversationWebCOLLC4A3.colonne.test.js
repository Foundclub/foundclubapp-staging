import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { creerQueryClientDeTest } from '../../testSupport/queryClientDeTest';

// ==========================================================================
// 🖥️ COLL-C4A3 (03/10/2026) — PLANCHE 47 SUR LE SITE : « Messages » de la Ville en trois
// colonnes (maquette validée HY521H1, P3c-canal-ordi) : les canaux et les conversations à
// gauche, le fil au centre, « Dans ce canal » à droite. La T9 n'avait que les deux dernières.
//
// Ce que ce témoin exige, sur le fichier du SITE (`Conversation.web.js`) — ROUGE avant le lot :
//   1. sur ordinateur, depuis l'espace de la Ville, un fil de la Ville ouvert : à gauche
//      « Canaux de la Ville » (Actualités de la Ville, Dirigeants des clubs — le fil ouvert est
//      marqué), puis « Conversations » : SES conversations privées avec ses clubs, et rien
//      d'autre (pas celles d'une autre Ville, pas les fils d'équipe) ;
//   2. une ligne de la colonne ouvre son fil AU NOM DE LA VILLE (`espace: 'ville'`) ;
//   3. l'en-tête du fil porte la tuile du canal ;
//   4. ni sur un écran étroit, ni pour un dirigeant (hors espace de la Ville) : pas de colonne.
// ==========================================================================

const CHAT_ID = 'canal-1';
const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Montrivage' };
const AUTRE_VILLE = { documentId: 'ville-voisine', name: 'Ville de Beaulieu' };

let mockLargeur = 1280;
/** @type {any} */
let mockFils = [];

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => ({ auth: { user: { documentId: 'agent-ville' } } }),
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
  default: () => ({
    allMyTeams: [],
    userData: { documentId: 'agent-ville', firstname: 'Sophie', lastname: 'Leroy' },
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    isSocketConnected: true,
    joinChat: jest.fn(),
    leaveChat: jest.fn(),
    reactToMessage: jest.fn(),
    respondToProposal: jest.fn(),
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
      collectivite: { documentId: 'ville-de-recette', name: 'Ville de Montrivage' },
      documentId: 'canal-1',
      participants: [],
      type: 'collectivite_dirigeants',
    },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: [] }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetChats: () => ({ data: { pages: [{ data: mockFils }] }, isLoading: false }),
}));

jest.mock('@/services/collectivite/collectiviteCanauxQueries', () => ({
  useMembresDuFil: () => ({
    data: {
      chat: { documentId: 'canal-1', type: 'collectivite_dirigeants' },
      clubsCount: 3,
      collectivite: { documentId: 'ville-de-recette', name: 'Ville de Montrivage' },
      groupes: [],
    },
  }),
  useMesCanauxDeLaVille: () => ({
    data: [{
      canal: { documentId: 'canal-1' },
      clubsCount: 3,
      collectivite: { documentId: 'ville-de-recette', name: 'Ville de Montrivage' },
      fonctions: ['gestionnaire'],
    }],
  }),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({ data: [] }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
  }),
}));
jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useMesActualitesDeLaVille: () => ({ data: undefined }),
}));

// Le client HTTP lit ses adresses au CHARGEMENT du module : `.env` est absent d'une copie.
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
jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(),
  getEvents: jest.fn(() => Promise.resolve({
    data: [], meta: { pagination: { page: 1, pageCount: 1 } },
  })),
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: {} }));

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// eslint-disable-next-line import/first
import ConversationWeb from '../Conversation.web';

// Le premier montage transpile tout le graphe d'imports de l'écran.
jest.setTimeout(30000);

const FILS = [
  {
    collectivite: VILLE,
    documentId: 'canal-1',
    messages: [{
      message: 'Merci. Faites chacun votre demande.',
      sender: { firstname: 'Sophie', lastname: 'Leroy' },
      senderSignature: { nom: 'Ville de Montrivage', voix: 'ville' },
    }],
    type: 'collectivite_dirigeants',
  },
  {
    collectivite: VILLE,
    collectiviteClub: { documentId: 'club-fc', name: 'Montrivage FC' },
    documentId: 'privee-fc',
    messages: [{
      message: 'Pourriez-vous compléter l’adresse ?',
      sender: { firstname: 'Sophie', lastname: 'Leroy' },
      senderSignature: { nom: 'Ville de Montrivage', voix: 'ville' },
    }],
    type: 'collectivite_club',
  },
  {
    collectivite: VILLE,
    collectiviteClub: { documentId: 'club-basket', name: 'Montrivage Basket' },
    documentId: 'privee-basket',
    messages: [{
      message: 'Bien reçu, on s’en occupe.',
      sender: { firstname: 'Karim', lastname: 'Benali' },
      senderSignature: { nom: 'Montrivage Basket', voix: 'club' },
    }],
    type: 'collectivite_club',
  },
  {
    collectivite: AUTRE_VILLE,
    collectiviteClub: { documentId: 'club-voisin', name: 'Beaulieu Sport' },
    documentId: 'privee-voisine',
    messages: [],
    type: 'collectivite_club',
  },
  {
    documentId: 'equipe-u15', messages: [], name: 'U15', type: 'team',
  },
];

/** @type {any} */
let queryClient;
/** @type {any[]} */
const montes = [];

/**
 * Tout le texte rendu sous un nœud, collé comme le navigateur le colle.
 * @param {any} noeud - Le nœud.
 * @returns {string} Le texte.
 */
const texteDe = (noeud) => {
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

const parTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.type !== 'string',
);
// Le LIEN d une ligne de la colonne (le bouton lui-meme, pas la ligne qui le compose).
const lien = (/** @type {any} */ arbre, /** @type {string} */ testID) => parTestID(arbre, testID)
  .find((/** @type {any} */ n) => n.props.accessibilityRole === 'link');

/**
 * Monte la messagerie du site sur le canal des dirigeants.
 * @param {Record<string, unknown>} [params] - Les paramètres de route.
 * @returns {Promise<{ arbre: any, navigation: any }>} L'arbre et la navigation.
 */
const monter = async (params = { espace: 'ville' }) => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <ConversationWeb
          navigation={navigation}
          route={{ params: { chatId: CHAT_ID, chatType: 'collectivite_dirigeants', ...params } }}
        />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return { arbre, navigation };
};

beforeEach(() => {
  queryClient = creerQueryClientDeTest();
  mockLargeur = 1280;
  mockFils = FILS;
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  queryClient.clear();
});

describe('COLL-C4A3 — planche 47 sur le site : la colonne de gauche de la Ville', () => {
  test('les canaux de la Ville, puis SES conversations privées, le fil ouvert marqué', async () => {
    const { arbre } = await monter();
    const [colonne] = parTestID(arbre, 'colonne-fils-de-la-ville');
    expect(colonne).toBeTruthy();
    const texte = texteDe(colonne);
    [
      'Canaux de la Ville',
      'Actualités de la Ville',
      'Lecture seule pour les clubs',
      'Dirigeants des clubs',
      'Vous : Merci. Faites chacun votre demande.',
      'Conversations',
      'Montrivage FC',
      'Vous : Pourriez-vous compléter l’adresse ?',
      'Montrivage Basket',
      'Karim Benali : Bien reçu, on s’en occupe.',
    ].forEach((attendu) => expect(texte).toContain(attendu));
    expect(texte.indexOf('Dirigeants des clubs')).toBeLessThan(texte.indexOf('Conversations'));
    // Ni la conversation d'une AUTRE Ville, ni un fil d'équipe.
    expect(texte).not.toContain('Beaulieu Sport');
    expect(texte).not.toContain('U15');
    // Le fil ouvert est marqué, et lui seul.
    expect(lien(arbre, 'colonne-canal-dirigeants').props.accessibilityState)
      .toEqual({ selected: true });
    expect(lien(arbre, 'colonne-privee-fc').props.accessibilityState)
      .toEqual({ selected: false });
  });

  test('une ligne ouvre son fil AU NOM DE LA VILLE ; les actualités, leur liste', async () => {
    const { arbre, navigation } = await monter();
    await act(async () => { lien(arbre, 'colonne-privee-fc').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'privee-fc',
      chatType: 'collectivite_club',
      espace: 'ville',
      title: 'Montrivage FC',
    });
    await act(async () => { lien(arbre, 'colonne-actualites').props.onPress(); });
    expect(navigation.navigate)
      .toHaveBeenCalledWith('CollectiviteActualites', { collectiviteId: 'ville-de-recette' });
  });

  test('aucune conversation : la phrase de la maquette', async () => {
    mockFils = FILS.filter((fil) => fil.type !== 'collectivite_club');
    const { arbre } = await monter();
    expect(texteDe(parTestID(arbre, 'colonne-fils-de-la-ville')[0]))
      .toContain('Aucune conversation. Un dirigeant qui vous écrit apparaîtra ici.');
  });

  test('l’en-tête du fil porte la tuile du canal', async () => {
    // eslint-disable-next-line global-require
    const { IconeDuCanal } = require('@/views/collectivite/components/FilDeLaVille');
    const { arbre } = await monter();
    const [enTete] = parTestID(arbre, 'fil-de-la-ville-ecusson');
    expect(enTete.findAllByType(IconeDuCanal)).toHaveLength(1);
  });

  test('ni sur un écran étroit, ni pour un dirigeant (hors espace de la Ville)', async () => {
    mockLargeur = 800;
    expect(parTestID((await monter()).arbre, 'colonne-fils-de-la-ville')).toHaveLength(0);
    mockLargeur = 1280;
    expect(parTestID((await monter({})).arbre, 'colonne-fils-de-la-ville')).toHaveLength(0);
  });
});
