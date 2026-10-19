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
//      « Conversations » : son canal des dirigeants et SES conversations privées avec ses clubs
//      (le fil ouvert est marqué), et rien d'autre (pas celles d'une autre Ville, pas les fils
//      d'équipe). R17-CANAUX (19/10) : le groupe « Canaux de la Ville » (Actualités, Dirigeants)
//      qui les précédait est parti ;
//   2. une ligne de la colonne ouvre son fil AU NOM DE LA VILLE (`espace: 'ville'`) ;
//   3. l'en-tête du fil porte la tuile du canal ;
//   4. ni sur un écran étroit, ni pour un dirigeant (hors espace de la Ville) : pas de colonne.
// ==========================================================================

const CHAT_ID = 'canal-1';
const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Montrivage' };
const AUTRE_VILLE = { documentId: 'ville-voisine', name: 'Ville de Beaulieu' };

let mockLargeur = 1280;
// COLL-C4A3 point 4 — l'envoi et « Réessayer », et les messages du fil.
const mockSendMessage = jest.fn(() => 'temp-1');
const mockRetry = jest.fn();
/** @type {any[]} */
let mockMessagesDuFil = [];
/** @type {any} */
let mockFils = [];
// R17-CANAUX — le fil ouvert et sa réponse « qui est dans ce canal » (par défaut : le canal des
// dirigeants, comme avant le lot).
const CANAL_OUVERT = {
  collectivite: { documentId: 'ville-de-recette', name: 'Ville de Montrivage' },
  documentId: 'canal-1',
  participants: [],
  type: 'collectivite_dirigeants',
};
const MEMBRES_DU_CANAL = {
  chat: { documentId: 'canal-1', type: 'collectivite_dirigeants' },
  clubsCount: 3,
  collectivite: { documentId: 'ville-de-recette', name: 'Ville de Montrivage' },
  groupes: [],
};
/** @type {any} */
let mockChatOuvert = CANAL_OUVERT;
/** @type {any} */
let mockMembresDuFil = MEMBRES_DU_CANAL;

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 900, scale: 1, width: mockLargeur,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  // COLL-R-APP-CREATION (13/10) : le catalogue des bandeaux importe navigationService.
  createNavigationContainerRef: () => ({ isReady: () => false }),
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
    retryFailedMessage: mockRetry,
    sendMessage: mockSendMessage,
    sendReadReceipt: jest.fn(),
    sendTypingStart: jest.fn(),
    sendTypingStop: jest.fn(),
    votePoll: jest.fn(),
  }),
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({
    data: mockChatOuvert,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetChatMessageReactions: () => ({ data: { chatDocumentId: '', data: [] } }),
  useGetChatMessages: () => ({
    data: { pages: [{ data: mockMessagesDuFil }] },
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
  useMembresDuFil: () => ({ data: mockMembresDuFil }),
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
// MSG1W §3.5 — les fenetres du « + » (grande carte d evenement, sondage du telephone) : leurs
// modules natifs ne se chargent pas dans ce banc, et ce temoin ne les regarde pas.
jest.mock('@/components/molecules/eventCard/EventCardNew', () => () => null);
jest.mock('@/components/organisms/pollCreationModal/PollCreationModal', () => () => null);
// L assistant de convocation (MESSAGERIE-1C) charge le mur payant et son stockage natif :
// une doublure ici ; les temoins Playwright du site ouvrent le vrai.
jest.mock('@/views/conversationConvocation/ConvocationWizard', () => () => null);

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
  mockChatOuvert = CANAL_OUVERT;
  mockMembresDuFil = MEMBRES_DU_CANAL;
  mockMessagesDuFil = [];
  mockSendMessage.mockClear();
  mockRetry.mockClear();
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  queryClient.clear();
});

describe('COLL-C4A3 — planche 47 sur le site : la colonne de gauche de la Ville', () => {
  // 🏛️ R17-CANAUX (19/10, REC17-004) — RÉÉCRITS. Adel : « la messagerie ne doit être que sous
  // forme de message ; le canal des dirigeants doit être comme les autres ». Avant : un groupe
  // « Canaux de la Ville » (Actualités de la Ville, Dirigeants des clubs) AU-DESSUS des
  // conversations. Après : rien que « Conversations », dont « Dirigeants des clubs » est une ligne.
  test('R17-CANAUX : que des conversations, « Dirigeants des clubs » en est une', async () => {
    const { arbre } = await monter();
    const [colonne] = parTestID(arbre, 'colonne-fils-de-la-ville');
    expect(colonne).toBeTruthy();
    const texte = texteDe(colonne);
    [
      'Conversations',
      'Dirigeants des clubs',
      'Vous : Merci. Faites chacun votre demande.',
      'Montrivage FC',
      'Vous : Pourriez-vous compléter l’adresse ?',
      'Montrivage Basket',
      'Karim Benali : Bien reçu, on s’en occupe.',
    ].forEach((attendu) => expect(texte).toContain(attendu));
    ['Canaux de la Ville', 'Actualités de la Ville', 'Lecture seule pour les clubs']
      .forEach((parti) => expect(texte).not.toContain(parti));
    expect(texte.indexOf('Conversations')).toBeLessThan(texte.indexOf('Dirigeants des clubs'));
    // Ni la conversation d'une AUTRE Ville, ni un fil d'équipe.
    expect(texte).not.toContain('Beaulieu Sport');
    expect(texte).not.toContain('U15');
    // Le fil ouvert est marqué, et lui seul.
    expect(lien(arbre, 'colonne-canal-1').props.accessibilityState)
      .toEqual({ selected: true });
    expect(lien(arbre, 'colonne-privee-fc').props.accessibilityState)
      .toEqual({ selected: false });
    expect(parTestID(arbre, 'colonne-actualites')).toHaveLength(0);
  });

  test('R17-CANAUX : chaque ligne, canal compris, ouvre son fil AU NOM DE LA VILLE', async () => {
    const { arbre, navigation } = await monter();
    await act(async () => { lien(arbre, 'colonne-privee-fc').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'privee-fc',
      chatType: 'collectivite_club',
      espace: 'ville',
      title: 'Montrivage FC',
    });
    await act(async () => { lien(arbre, 'colonne-canal-1').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'canal-1',
      chatType: 'collectivite_dirigeants',
      espace: 'ville',
      title: 'Dirigeants des clubs',
    });
  });

  test('aucune conversation : la phrase de la maquette', async () => {
    // R17-CANAUX : le canal des dirigeants est désormais une conversation de la liste ; pour
    // une liste vide, il part aussi.
    mockFils = FILS.filter((fil) => (
      !['collectivite_club', 'collectivite_dirigeants'].includes(fil.type)
    ));
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

// 🗣️ COLL-C4A3 point 4 — LA VOIX D'UN COMPTE MIXTE, SUR LE SITE (« voix ok », Adel 02/10). La règle
// est au serveur (`voixDeLExpediteur`, admin tests/authz/COLL-C4A2-canal-dirigeants, test 8 : les
// deux sens) ; le téléphone a son témoin (ConversationCOLLC4A2.filDeLaVille). Le site n'en avait
// aucun : depuis l'espace de la Ville il DEMANDE la voix de la Ville, depuis le club il ne demande
// rien (le serveur signe alors au nom du club). Et « Réessayer » redemande la même voix.
describe('COLL-C4A3 — point 4 : la voix demandée par le site, dans les deux sens', () => {
  /**
   * Écrit un message dans la zone de saisie du site, et l'envoie par Entrée.
   * @param {any} arbre - L'écran.
   * @param {string} texte - Le message.
   */
  const ecrire = async (arbre, texte) => {
    await act(async () => {
      arbre.root.findByType('textarea').props.onChange({ target: { value: texte } });
    });
    await act(async () => {
      arbre.root.findByType('textarea').props.onKeyDown({
        key: 'Enter', preventDefault: () => {}, shiftKey: false,
      });
    });
  };

  test('depuis l’espace de la Ville : la voix de la Ville est DEMANDÉE', async () => {
    const { arbre } = await monter({ espace: 'ville' });
    await ecrire(arbre, 'Faites chacun votre demande.');
    expect(mockSendMessage).toHaveBeenCalledWith(
      CHAT_ID,
      'Faites chacun votre demande.',
      expect.objectContaining({ senderSignature: { voix: 'ville' } }),
    );
  });

  test('depuis le club (hors espace de la Ville) : aucune voix demandée', async () => {
    const { arbre } = await monter({});
    await ecrire(arbre, 'Nos U15 peuvent passer à 19:00.');
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage.mock.calls[0][2]).not.toHaveProperty('senderSignature');
  });

  test('« Renvoyer » un message en échec : la même voix (Ville ; club : aucune)', async () => {
    const echec = {
      createdAt: '2026-10-03T08:00:00.000Z',
      documentId: 'temp-echec',
      failed: true,
      message: 'Faites chacun votre demande.',
      sender: { documentId: 'agent-ville', firstname: 'Sophie', lastname: 'Leroy' },
    };
    mockMessagesDuFil = [echec];
    const boutonRenvoyer = (/** @type {any} */ arbre) => arbre.root.findAll(
      (/** @type {any} */ n) => n.type === 'button' && texteDe(n).includes('Renvoyer'),
    )[0];

    const ville = await monter({ espace: 'ville' });
    await act(async () => { boutonRenvoyer(ville.arbre).props.onClick(); });
    expect(mockRetry).toHaveBeenLastCalledWith(
      CHAT_ID,
      expect.objectContaining({ documentId: 'temp-echec' }),
      { senderSignature: { voix: 'ville' } },
    );

    const club = await monter({});
    await act(async () => { boutonRenvoyer(club.arbre).props.onClick(); });
    expect(mockRetry).toHaveBeenCalledTimes(2);
    expect(mockRetry.mock.calls[1][2] || {}).not.toHaveProperty('senderSignature');
  });
});

// ==========================================================================
// FINITIONS16 · POINT 20 (tournee T15, photos SITE_C47a / SITE_C47b ; planche 47,
// P3c-canal-ordi) — le canal des dirigeants SUR LE SITE :
//   1. une bulle d'UNE ligne faisait 648 px : la grille du fil etirait sa seule rangee ;
//   2. mon message ne disait pas au nom de qui il part (planche : « Ville de Montrivage ») ;
//   3. « 06/10/2026 a 04:23 », « Repondre » ;
//   4. le bouton « Réagir » etait un emoji (« 🙂 ») : aucun emoji (decision de design du 01/10) ;
//   5. le titre du fil et ceux de la colonne de droite, sombres sur sombre (le CSS global du site
//      colore h1/h2/h3 en primary900) ;
//   6. des textes de developpeur : « Socket actif » / « Mode HTTP », « Parite web … sockets ».
// ROUGE avant.
// ==========================================================================
describe('FINITIONS16 20 — le canal des dirigeants, sur le site', () => {
  const MON_MESSAGE = {
    createdAt: '2026-10-06T02:23:00.000Z',
    documentId: 'msg-t15',
    message: 'Recette T15 canal temps reel, a ignorer',
    sender: { documentId: 'agent-ville', firstname: 'Sophie', lastname: 'Leroy' },
    senderSignature: { nom: 'Ville de Montrivage', voix: 'ville' },
  };

  const hotes = (/** @type {any} */ arbre, /** @type {string} */ type) => arbre.root.findAll(
    (/** @type {any} */ n) => n.type === type,
  );

  test('🔴 la grille du fil ne s etire plus : une bulle d une ligne reste d une ligne', async () => {
    mockMessagesDuFil = [MON_MESSAGE];
    const { arbre } = await monter();
    // MSG1W (07/10) : le fil est repere par son nom de temoin ; il n est plus une grille a
    // 16 px d ecart (les bulles se groupent par marges), mais il ne doit toujours pas s etirer.
    const fil = hotes(arbre, 'div').find(
      (/** @type {any} */ n) => n.props['data-testid'] === 'MSG1W-fil'
        && n.props.style?.overflowY === 'auto',
    );
    expect(fil).toBeDefined();
    expect(fil.props.style.alignContent).toBe('start');
  });

  test('🔴 mon message dit au nom de qui il part : « Ville de Montrivage »', async () => {
    mockMessagesDuFil = [MON_MESSAGE];
    const { arbre } = await monter();
    const [bulle] = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.['data-testid'] === 'REACTWEB-bulle-msg-t15',
    );
    expect(texteDe(bulle)).toContain('Ville de Montrivage');
  });

  test('🔴 « à » et « Répondre », avec leurs accents', async () => {
    mockMessagesDuFil = [MON_MESSAGE];
    const { arbre } = await monter();
    const texte = texteDe(arbre.root);
    expect(texte).toContain('Répondre');
    expect(texte).not.toContain('Repondre');
    // MSG1W (07/10, pack « modele WhatsApp » §3.1) : la date complete sous chaque bulle
    // (« 06/10/2026 à 04:23 ») laisse la place a l heure DANS la bulle et a une puce par jour.
    expect(texte).toMatch(/\d{2}:\d{2}/);
    expect(texte).not.toMatch(/\d{2}\/\d{2}\/\d{4} à/);
  });

  test('🔴 le bouton « Réagir » n est pas un emoji', async () => {
    mockMessagesDuFil = [MON_MESSAGE];
    const { arbre } = await monter();
    const [bouton] = arbre.root.findAll(
      (/** @type {any} */ n) => n.type === 'button'
        && n.props?.['data-testid'] === 'REACTWEB-reagir-msg-t15',
    );
    expect(bouton.props['aria-label']).toBe('Réagir à ce message');
    expect(texteDe(bouton)).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(bouton.findAll((/** @type {any} */ n) => n.type === 'svg')).toHaveLength(1);
  });

  // Le CSS global du site peint h1/h2/h3 en primary900 : sombre sur sombre.
  test('🔴 chaque titre porte sa couleur claire', async () => {
    mockMessagesDuFil = [MON_MESSAGE];
    const { arbre } = await monter();
    const titres = ['h1', 'h2', 'h3'].flatMap((type) => hotes(arbre, type));
    expect(titres.length).toBeGreaterThan(0);
    expect(titres.filter((/** @type {any} */ n) => !n.props.style?.color)
      .map((/** @type {any} */ n) => texteDe(n))).toEqual([]);
  });

  test('🔴 aucun texte de développeur', async () => {
    mockMessagesDuFil = [MON_MESSAGE];
    const { arbre } = await monter();
    const texte = texteDe(arbre.root);
    expect(texte).not.toMatch(/Socket actif|Mode HTTP|Parite web|sockets partages|hooks, services/);
  });
});

// 🏛️ R17-CANAUX (19/10/2026, REC17-004, point 5) — « TOUTE LA VILLE » SUR LE SITE : en tête de la
// colonne de la Ville ; pour un membre, « Seule la Ville écrit ici » à la place de la saisie et
// pas de colonne « Dans ce canal » (personne ne voit qui le lit) ; l'actualité posée mène à elle.
describe('R17-CANAUX — « Toute la ville » sur le site', () => {
  const TOUTE = {
    collectivite: VILLE,
    documentId: 'toute-1',
    messages: [{
      createdAt: '2026-09-01T08:00:00.000Z',
      message: 'Nouvelle actualité de la Ville : « Dojo fermé »',
      sender: null,
    }],
    participants: [],
    type: 'collectivite_ville',
  };
  const LIGNE_ACTU = {
    createdAt: '2026-10-19T08:00:00.000Z',
    documentId: 'm-actu',
    message: 'Nouvelle actualité de la Ville : « Dojo fermé »',
    sender: null,
    systemNotice: {
      actualite: { documentId: 'actu-1', title: 'Dojo fermé' },
      collectivite: { documentId: 'ville-de-recette' },
      kind: 'collectivite_actualite',
      version: 1,
    },
  };

  test('en tête de la colonne de la Ville, avec l écusson de la Ville', async () => {
    // eslint-disable-next-line global-require
    const { EcussonVille } = require('@/views/collectivite/components/BlocDeLaVille');
    mockFils = [...FILS, TOUTE];
    const { arbre, navigation } = await monter();
    const texte = texteDe(parTestID(arbre, 'colonne-fils-de-la-ville')[0]);
    expect(texte.indexOf('Toute la ville')).toBeGreaterThan(-1);
    expect(texte.indexOf('Toute la ville')).toBeLessThan(texte.indexOf('Dirigeants des clubs'));
    const ligne = lien(arbre, 'colonne-toute-1');
    expect(ligne.findAllByType(EcussonVille)).toHaveLength(1);
    await act(async () => { ligne.props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'toute-1', chatType: 'collectivite_ville', espace: 'ville', title: 'Toute la ville',
    });
  });

  test('un membre : « Seule la Ville écrit ici », ni saisie ni « Dans ce canal »', async () => {
    mockChatOuvert = { ...TOUTE, messages: undefined };
    mockMembresDuFil = {
      ...MEMBRES_DU_CANAL,
      chat: { documentId: 'toute-1', type: 'collectivite_ville' },
      peutEcrire: false,
    };
    mockMessagesDuFil = [LIGNE_ACTU];
    const { arbre, navigation } = await monter({});
    const parDataTestId = (/** @type {string} */ id) => arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.['data-testid'] === id,
    );
    const [pied] = parDataTestId('MSG1W-lecture-seule');
    expect(pied).toBeTruthy();
    expect(texteDe(pied)).toContain('Seule la Ville écrit ici');
    expect(texteDe(arbre.toJSON())).not.toContain('Dans ce canal');
    // L actualité : une ligne qui mène à elle.
    const [ligne] = parDataTestId('R17CANAUX-actualite-m-actu');
    expect(ligne).toBeTruthy();
    expect(ligne.props['aria-label']).toBe('Voir l’actualité « Dojo fermé »');
    await act(async () => { ligne.props.onClick(); });
    expect(navigation.navigate).toHaveBeenCalledWith('CollectiviteActualitesCanal', {
      actualiteId: 'actu-1', collectiviteId: 'ville-de-recette',
    });
  });

  test('la Ville, depuis son espace : la saisie', async () => {
    mockChatOuvert = { ...TOUTE, messages: undefined };
    mockMembresDuFil = {
      ...MEMBRES_DU_CANAL,
      chat: { documentId: 'toute-1', type: 'collectivite_ville' },
      peutEcrire: true,
    };
    const { arbre } = await monter({ chatType: 'collectivite_ville', espace: 'ville' });
    const pieds = arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.['data-testid'] === 'MSG1W-lecture-seule',
    );
    expect(pieds).toHaveLength(0);
  });
});
