import { StyleSheet, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';

import Messaging from '../Messaging';

// IPH09 — le vrai bloc Ville doit appartenir a la seule liste defilante,
// avec les archives et les conversations, y compris quand la recherche est vide.
// Doublures de services issues de MSG2 ; aucune API ni donnee reelle.

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
        { testID: 'iph09-contenu-defilant' },
        props.ListHeaderComponent,
        props.data.length ? null : reactActuel.createElement(props.ListEmptyComponent),
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

// R17-CANAUX — épingler et archiver sont COMPTÉS (le canal des dirigeants de la Ville).
const mockPin = jest.fn(() => Promise.resolve());
const mockArchive = jest.fn(() => Promise.resolve());
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    archiveChatAsync: mockArchive,
    getConversationName: (/** @type {any} */ input) => input?.chatGroupName || 'Conversation',
    getUnreadStatus: () => false,
    joinChat: mockJoinChat,
    pinChatAsync: mockPin,
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
  default: () => ({ floatingActionBottomOffset: 80, sceneBottomInset: 100 }),
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
jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useMesActualitesDeLaVille: () => ({ data: { actualites: [], collectivites: [mockVille] } }),
}));
jest.mock('@/services/collectivite/collectiviteCanauxQueries', () => ({
  useMesCanauxDeLaVille: () => ({ data: [{ canal: { documentId: 'ville-canal' }, collectivite: mockVille }] }),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: () => ({ data: [] }),
  useMyCollectivites: () => ({ data: [mockVille] }),
}));
jest.mock('@/views/collectivite/components/BlocDeLaVille', () => ({ EcussonVille: () => null }));
jest.mock('@/views/collectivite/components/FilDeLaVille', () => ({ IconeDuCanal: () => null }));
const mockVille = { documentId: 'demouville-test', name: 'Ville de Demouville (test)' };
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

// R17-CANAUX — les fils de l'espace de la Ville : son canal des dirigeants, une conversation
// privée avec un club, et le canal d'une AUTRE Ville (qu'elle ne voit pas).
const FILS_DE_LA_VILLE = [
  {
    collectivite: mockVille,
    documentId: 'canal-demouville',
    messages: [],
    participants: [],
    type: 'collectivite_dirigeants',
    updatedAt: '2026-10-18T10:00:00.000Z',
  },
  {
    collectivite: mockVille,
    collectiviteClub: { documentId: 'club-fc', name: 'Demouville FC' },
    documentId: 'privee-demouville',
    messages: [],
    participants: [],
    type: 'collectivite_club',
    updatedAt: '2026-10-17T10:00:00.000Z',
  },
  {
    collectivite: { documentId: 'autre-ville', name: 'Autre Ville' },
    documentId: 'canal-ailleurs',
    messages: [],
    participants: [],
    type: 'collectivite_dirigeants',
    updatedAt: '2026-10-16T10:00:00.000Z',
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
 * @param params
 * @returns {Promise<any>} L ecran monte.
 */
const monter = async (params = {}) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Messaging
        navigation={{ navigate: mockNavigate, setParams: jest.fn() }}
        route={{ params }}
      />,
    );
  });
  return arbre;
};

const dernieresProps = () => mockListProps[mockListProps.length - 1];

beforeEach(() => {
  mockListProps.length = 0;
  mockNavigate.mockClear();
  mockJoinChat.mockClear();
});

const contenu = (arbre) => arbre.root.findAllByProps({ testID: 'iph09-contenu-defilant' })[0];
const parId = (racine, id) => racine.findAllByProps({ testID: id })[0];

describe('IPH09 — la Ville defile avec les conversations', () => {
  // 🏛️ R17-CANAUX (19/10, REC17-004, correction 2 du chef, §1 ter) — RÉÉCRITS. Côté membre, le
  // bloc épinglé de la Ville (« Dirigeants des clubs », « Actualités de la Ville ») au-dessus des
  // conversations doublait la ligne « Toute la ville » : il est parti. La liste défile seule ; le
  // canal des dirigeants est une ligne qu'on épingle et qu'on archive, comme dans l'espace de la
  // Ville.
  // ⏳ GARDE (19/10, décision « C » du chef) : le site part de staging AVANT le serveur CANAUX.
  // Sans ligne « Toute la ville » dans la liste (le serveur d'avant), la carte « Actualités de la
  // Ville » reste en tête, comme sur staging — sans le canal des dirigeants, devenu une ligne.
  test('GARDE : sans « Toute la ville », la carte reste ; archives et 100 fils', async () => {
    const fils = Array.from({ length: 100 }, (_, i) => ({
      ...CHATS[0], documentId: `fil-${i}`, groupName: `Fil ${i}`,
    }));
    mockChatsQuery = etatListe({
      data: {
        pages: [{
          data: [
            ...fils, { ...CHATS[0], archivedBy: [{ documentId: 'moi' }], documentId: 'archive' },
          ],
        }],
      },
    });
    const arbre = await monter();
    const liste = contenu(arbre);
    expect(parId(liste, 'canaux-de-la-ville-membre')).toBeDefined();
    expect(parId(liste, 'canal-dirigeants-demouville-test')).toBeUndefined();
    expect(parId(liste, 'canal-actualites-demouville-test')).toBeDefined();
    act(() => parId(liste, 'canal-actualites-demouville-test').props.onPress());
    expect(mockNavigate).toHaveBeenLastCalledWith('CollectiviteActualitesCanal', {
      collectiviteId: 'demouville-test',
    });
    expect(parId(liste, 'liste-archivees')).toBeDefined();
    expect(dernieresProps().data).toHaveLength(100);
    expect(dernieresProps().contentContainerStyle.paddingBottom).toBe(100);
    expect(dernieresProps().stickyHeaderIndices).toBeUndefined();
    expect(dernieresProps().keyboardShouldPersistTaps).toBe('handled');
    const ligne = parId(liste, 'liste-fil-fil-0');
    expect(StyleSheet.flatten(ligne.props.style).height).toBeUndefined();
    expect(StyleSheet.flatten(ligne.props.style).minHeight).toBe(72);
  });

  test('R17-CANAUX : côté club, « Dirigeants des clubs » est une ligne', async () => {
    mockPin.mockClear();
    mockArchive.mockClear();
    const canal = { ...FILS_DE_LA_VILLE[0], updatedAt: '2026-10-18T10:00:00.000Z' };
    mockChatsQuery = etatListe({ data: { pages: [{ data: [...CHATS, canal] }] } });
    const arbre = await monter();
    const liste = contenu(arbre);
    const ligne = parId(liste, 'liste-fil-canal-demouville');
    expect(ligne).toBeDefined();
    expect(ligne.findAllByType(Text).map((n) => n.props.children))
      .toContain('Dirigeants des clubs');
    act(() => ligne.props.onPress());
    expect(mockNavigate).toHaveBeenLastCalledWith('Conversation', expect.objectContaining({
      chatId: 'canal-demouville', chatType: 'collectivite_dirigeants',
    }));
    const glissable = liste.findAll((n) => typeof n.props.renderLeftActions === 'function'
      && n.findAll((m) => m.props?.testID === 'liste-fil-canal-demouville').length > 0)[0];
    await act(async () => { glissable.props.renderLeftActions(0, 0).props.onPress(); });
    expect(mockPin).toHaveBeenCalledWith('canal-demouville');
    await act(async () => { await glissable.props.renderRightActions(0, 0).props.onPress(); });
    expect(mockArchive).toHaveBeenCalledWith('canal-demouville');
  });

  // Décision d'Adel « B » (19/10, relayée par le chef) : « Toute la ville » aux MAJEURS. Le serveur
  // ne l'envoie pas à un mineur ; si une liste en garde un (cache d'avant), l'app ne le montre pas.
  test('R17-CANAUX : un mineur ne voit pas « Toute la ville » dans sa liste', async () => {
    const toute = {
      collectivite: mockVille,
      documentId: 'toute-demouville',
      messages: [],
      participants: [],
      type: 'collectivite_ville',
      updatedAt: '2026-10-18T10:00:00.000Z',
    };
    mockChatsQuery = etatListe({ data: { pages: [{ data: [...CHATS, toute] }] } });
    const avant = mockAuth.userData.birthdate;
    mockAuth.userData.birthdate = '2014-06-01';
    try {
      const mineur = await monter();
      expect(dernieresProps().data.map((/** @type {any} */ c) => c.documentId)).toEqual(['chat-1']);
      // ⏳ GARDE : sans la ligne, le mineur garde la carte d'actualités (sa règle d'avant).
      expect(parId(contenu(mineur), 'canal-actualites-demouville-test')).toBeDefined();
    } finally {
      mockAuth.userData.birthdate = avant;
    }
    const majeur = await monter();
    expect(dernieresProps().data[0].documentId).toBe('toute-demouville');
    // ⏳ GARDE : la ligne est là, la carte part — jamais les deux.
    expect(parId(contenu(majeur), 'canaux-de-la-ville-membre')).toBeUndefined();
  });

  // ⏳ GARDE (19/10) : comme sur staging, la carte d'actualités reste quand la recherche ou le
  // filtre ne laisse aucun fil (serveur d'avant, pas de « Toute la ville »).
  test('GARDE : recherche ou filtre sans résultat, la carte d’actualités reste', async () => {
    mockChatsQuery = etatListe();
    const arbre = await monter();
    act(() => arbre.root.findByType(TextInput).props.onChangeText('introuvable'));
    expect(dernieresProps().data).toEqual([]);
    expect(parId(contenu(arbre), 'canaux-de-la-ville-membre')).toBeDefined();
    act(() => arbre.root.findByType(TextInput).props.onChangeText(''));
    act(() => arbre.root.findByType(SegmentedControl).props.onChange('league'));
    expect(dernieresProps().data).toEqual([]);
  });

  test('en erreur, Reessayer relit sans mutation', async () => {
    mockChatsQuery = etatListe({ error: new Error('erreur fabriquee') });
    const arbre = await monter();
    // ⏳ GARDE : comme sur staging, la carte d'actualités reste en tête de la liste en erreur.
    expect(parId(contenu(arbre), 'canaux-de-la-ville-membre')).toBeDefined();
    expect(dernieresProps().onEndReached).toBeUndefined();
    const retry = parId(contenu(arbre), 'messaging-retry');
    await act(async () => { await retry.props.onPress(); });
    expect(mockChatsQuery.refetch).toHaveBeenCalledTimes(1);
  });

  // 🏛️ R17-CANAUX (19/10, REC17-004) — RÉÉCRIT. Avant : l'espace de la mairie montrait ses deux
  // cartes et « Publier une actualité » au-dessus des conversations. Adel : « la messagerie ne
  // doit être que sous forme de message ; le canal des dirigeants doit être comme les autres ».
  // Après : rien au-dessus ; « Dirigeants des clubs » est une ligne qu'on épingle et archive.
  test('R17-CANAUX : espace mairie, que des conversations, le canal en est une', async () => {
    mockPin.mockClear();
    mockArchive.mockClear();
    mockChatsQuery = etatListe({ data: { pages: [{ data: FILS_DE_LA_VILLE }] } });
    const arbre = await monter({ collectiviteId: 'demouville-test', espace: 'ville' });
    const liste = contenu(arbre);
    expect(parId(liste, 'canaux-de-la-ville-mairie')).toBeUndefined();
    expect(arbre.root.findAll((n) => n.props.title === 'Publier une actualité')).toHaveLength(0);
    // Le canal des dirigeants de CETTE Ville est une ligne ; celui d'une autre Ville, non.
    const ligne = parId(liste, 'liste-fil-canal-demouville');
    expect(ligne).toBeDefined();
    expect(parId(liste, 'liste-fil-canal-ailleurs')).toBeUndefined();
    expect(dernieresProps().data.map((/** @type {any} */ c) => c.documentId))
      .toEqual(['canal-demouville', 'privee-demouville']);
    act(() => ligne.props.onPress());
    expect(mockNavigate).toHaveBeenLastCalledWith('Conversation', expect.objectContaining({
      chatId: 'canal-demouville', chatType: 'collectivite_dirigeants', espace: 'ville',
    }));
    // Comme les autres lignes : glisser pour épingler, glisser pour archiver.
    const glissable = liste.findAll((n) => typeof n.props.renderLeftActions === 'function'
      && n.findAll((m) => m.props?.testID === 'liste-fil-canal-demouville').length > 0)[0];
    await act(async () => { glissable.props.renderLeftActions(0, 0).props.onPress(); });
    expect(mockPin).toHaveBeenCalledWith('canal-demouville');
    await act(async () => { await glissable.props.renderRightActions(0, 0).props.onPress(); });
    expect(mockArchive).toHaveBeenCalledWith('canal-demouville');
  });

  // 🏛️ R17-CANAUX (19/10, REC17-004, point 5) — « Toute la ville » : une ligne de conversation,
  // EN TÊTE ; ni épingler ni archiver (le serveur ne dit à personne qui l'a fait), le reste comme
  // les autres lignes.
  test('R17-CANAUX : « Toute la ville » en tête, chez la Ville et chez le membre', async () => {
    const toute = {
      collectivite: mockVille,
      documentId: 'toute-demouville',
      messages: [{
        createdAt: '2026-09-01T10:00:00.000Z',
        message: 'Nouvelle actualité de la Ville : « Dojo fermé »',
        sender: null,
      }],
      participants: [],
      type: 'collectivite_ville',
      updatedAt: '2026-09-01T10:00:00.000Z',
    };
    mockChatsQuery = etatListe({ data: { pages: [{ data: [...FILS_DE_LA_VILLE, toute] }] } });
    const ville = await monter({ collectiviteId: 'demouville-test', espace: 'ville' });
    expect(dernieresProps().data.map((/** @type {any} */ c) => c.documentId))
      .toEqual(['toute-demouville', 'canal-demouville', 'privee-demouville']);
    const ligne = parId(contenu(ville), 'liste-fil-toute-demouville');
    expect(ligne.findAllByType(Text).map((n) => n.props.children)).toContain('Toute la ville');
    expect(ville.root.findAll((n) => n.props?.text === 'Toute la ville')).toHaveLength(1);
    // Ni glisser pour épingler, ni glisser pour archiver.
    const glissables = contenu(ville).findAll((n) => typeof n.props.renderLeftActions === 'function'
      && n.findAll((m) => m.props?.testID === 'liste-fil-toute-demouville').length > 0);
    expect(glissables).toHaveLength(0);
    act(() => ligne.props.onPress());
    expect(mockNavigate).toHaveBeenLastCalledWith('Conversation', expect.objectContaining({
      chatId: 'toute-demouville',
      chatType: 'collectivite_ville',
      espace: 'ville',
      title: 'Toute la ville',
    }));
    // Chez le membre : la même ligne, nommée avec sa Ville, en tête de SA liste.
    mockChatsQuery = etatListe({ data: { pages: [{ data: [...CHATS, toute] }] } });
    const membre = await monter();
    expect(dernieresProps().data[0].documentId).toBe('toute-demouville');
    // ⏳ GARDE : la ligne de SA Ville est là ⇒ plus de carte « Actualités de la Ville ».
    expect(parId(contenu(membre), 'canaux-de-la-ville-membre')).toBeUndefined();
    // La doublure de traduction de ce fichier rend le repli sans l interpoler : le nom de la
    // Ville est verifie par collectiviteCanaux.test.js (titreDuFil).
    expect(membre.root.findAll((n) => String(n.props?.text || '').startsWith('Toute la ville · ')))
      .toHaveLength(1);
  });
});

// COL-007 (recette collectivite du 11/10, decision D6 A) — comme le pack MSG1A
// (`p1a-app.jsx:83-104`, un seul conteneur qui defile) : le titre « Messages »,
// les puces et la recherche partent avec la liste ; seule la rangee FOUNDCLUB
// (bascule League, cloche, profil) reste fixe, comme sur Accueil et Equipes.
describe('COL-007 — le haut de « Messages » defile avec la liste', () => {
  const titre = (racine) => racine.findAll(
    (n) => n.type === Text && n.props.children === 'messaging.title',
  );
  const ordre = (racine, noeud) => racine.findAll(() => true).indexOf(noeud);

  // R17-CANAUX : le bloc de la Ville est parti (correction 2) ; « Archivées » reste le repère.
  test('titre, puces et recherche DANS la liste, avant « Archivees »', async () => {
    const archive = { ...CHATS[0], archivedBy: [{ documentId: 'moi' }], documentId: 'archive' };
    mockChatsQuery = etatListe({ data: { pages: [{ data: [...CHATS, archive] }] } });
    const arbre = await monter();
    const liste = contenu(arbre);
    expect(titre(liste)).toHaveLength(1);
    expect(liste.findAllByType(SegmentedControl)).toHaveLength(1);
    expect(liste.findAllByType(TextInput)).toHaveLength(1);
    // Rien du haut ne reste en double hors de la liste.
    expect(titre(arbre.root)).toHaveLength(1);
    expect(arbre.root.findAllByType(TextInput)).toHaveLength(1);
    const rangTitre = ordre(liste, titre(liste)[0]);
    const rangPuces = ordre(liste, liste.findByType(SegmentedControl));
    const rangRecherche = ordre(liste, liste.findByType(TextInput));
    expect(rangTitre).toBeLessThan(rangPuces);
    expect(rangPuces).toBeLessThan(rangRecherche);
    // ⏳ GARDE (serveur d'avant) : la carte d'actualités revient, sous la recherche.
    expect(rangRecherche).toBeLessThan(ordre(liste, parId(liste, 'canaux-de-la-ville-membre')));
    expect(rangRecherche).toBeLessThan(ordre(liste, parId(liste, 'liste-archivees')));
  });

  test('la rangee FOUNDCLUB (League, cloche, profil) reste fixe, hors de la liste', async () => {
    mockChatsQuery = etatListe();
    const arbre = await monter();
    const liste = contenu(arbre);
    [LeagueHeaderSwitch, NotificationBadge, ProfileButton].forEach((Composant) => {
      expect(arbre.root.findAllByType(Composant)).toHaveLength(1);
      expect(liste.findAllByType(Composant)).toHaveLength(0);
    });
  });

  // R17-CANAUX (19/10) — RÉÉCRIT : le repère d'ordre était la carte de la mairie, partie ; c'est
  // désormais la première ligne, le canal des dirigeants.
  test('espace de la Ville : titre et recherche defilent, toujours sans puces', async () => {
    mockChatsQuery = etatListe({ data: { pages: [{ data: FILS_DE_LA_VILLE }] } });
    const arbre = await monter({ collectiviteId: 'demouville-test', espace: 'ville' });
    const liste = contenu(arbre);
    expect(titre(liste)).toHaveLength(1);
    expect(liste.findAllByType(TextInput)).toHaveLength(1);
    expect(arbre.root.findAllByType(SegmentedControl)).toHaveLength(0);
    expect(ordre(liste, liste.findByType(TextInput)))
      .toBeLessThan(ordre(liste, parId(liste, 'liste-fil-canal-demouville')));
  });

  test('la frappe ne remonte pas le champ : en-tete passe en ELEMENT, meme instance', async () => {
    mockChatsQuery = etatListe();
    const arbre = await monter();
    // FlashList 2.2 (`getValidComponent`) rend un element tel quel mais CREE un
    // composant neuf a partir d une fonction : le champ serait remonte a chaque
    // lettre et le clavier se fermerait.
    expect(typeof dernieresProps().ListHeaderComponent).not.toBe('function');
    const avant = arbre.root.findByType(TextInput).instance;
    act(() => arbre.root.findByType(TextInput).props.onChangeText('U'));
    act(() => arbre.root.findByType(TextInput).props.onChangeText('U1'));
    expect(arbre.root.findByType(TextInput).props.value).toBe('U1');
    expect(arbre.root.findByType(TextInput).instance).toBe(avant);
  });
});
