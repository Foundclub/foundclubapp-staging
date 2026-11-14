/* eslint-disable max-len */
import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Messaging from '../Messaging';

// COMMUNAUTES-L4 (14/11/2026, D76, maquette v3 écran 1) — LA LIGNE DU CANAL DU CLUB DEVIENT LA
// LIGNE DE LA COMMUNAUTÉ. Rien n'est ajouté au-dessus des conversations (décision du 19/10) : même
// place, même identifiant de fil (`liste-fil-<id>`), seuls le titre, la puce, le résumé des groupes,
// la pastille (total) et l'appui changent. Sans communauté (404 : serveur ou téléphone 2.6.99), la
// ligne et les autres fils restent ceux d'aujourd'hui. Doublures : `MessagingCOMMUNAUTES.entree`.

const mockNavigate = jest.fn();
let mockChatsQuery;
const mockGetMesCommunautes = jest.fn();
jest.mock('@/services/chat/communauteService', () => ({
  getMesCommunautes: (...args) => mockGetMesCommunautes(...args),
}));

jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: function FlashListMock(/** @type {any} */ props) {
      return reactActuel.createElement(
        VueRN,
        null,
        props.ListHeaderComponent,
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
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (!repli?.defaultValue) return cle;
      return repli.defaultValue.replace(/{{(\w+)}}/g, (_, nom) => String(repli[nom]));
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
// Identité STABLE : un `userData` neuf à chaque rendu reconstruirait la liste.
const mockAuth = {
  allMyTeams: [],
  userData: { documentId: 'moi', role: { name: 'Authenticated' } },
};
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
    joinChat: jest.fn(),
    pinChatAsync: jest.fn(() => Promise.resolve()),
    unpinChatAsync: jest.fn(() => Promise.resolve()),
  }),
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
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

const FIL_CLUB = {
  club: { documentId: 'club-1', name: 'AS Bellevue' },
  documentId: 'fil-club',
  groupName: 'AS Bellevue',
  messages: [{
    createdAt: '2026-11-14T08:02:00.000Z',
    documentId: 'm1',
    message: 'Entraînement du mercredi déplacé',
    sender: { documentId: 'sami', firstname: 'Sami' },
  }],
  type: 'club',
  unreadCount: 1,
};
const FIL_U13 = {
  documentId: 'fil-u13',
  groupName: 'U13',
  messages: [{
    createdAt: '2026-11-14T07:40:00.000Z',
    documentId: 'm2',
    message: 'Rendez-vous 13 h 30',
    sender: { documentId: 'karim', firstname: 'Karim' },
  }],
  team: { documentId: 'u13', name: 'U13' },
  type: 'team',
  unreadCount: 4,
};
const COMMUNAUTE = {
  annonces: 'fil-club',
  annoncesNonLus: 1,
  documentId: 'club-1',
  genre: 'club',
  groupes: [
    { chat: 'fil-u13', nonLus: 4, origine: 'equipe' },
    { chat: 'g-parents', nonLus: 2, origine: 'groupe' },
    { chat: 'g-benevoles', nonLus: 0, origine: 'groupe' },
  ],
  groupesAvecDuNouveau: 2,
  nom: 'AS Bellevue',
  nonLus: 7,
};

const etatListe = (fils) => ({
  data: { pages: [{ data: fils, meta: { pagination: { page: 1, pageCount: 1, total: fils.length } } }] },
  error: null,
  fetchNextPage: jest.fn(() => Promise.resolve()),
  hasNextPage: false,
  isFetching: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(() => Promise.resolve()),
});

/** @type {any[]} */
const montes = [];

const monter = async (fils) => {
  mockChatsQuery = etatListe(fils);
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <Messaging navigation={{ addListener: () => () => {}, navigate: mockNavigate, setParams: jest.fn() }} route={{ params: {} }} />,
    );
  });
  montes.push(arbre);
  return arbre;
};

/**
 * Les lignes de fil, dans l'ordre de l'écran.
 * @param {any} arbre - L'écran monté.
 * @returns {string[]} Leurs testID.
 */
const lignes = (arbre) => arbre.root.findAll((n) => typeof n.props?.testID === 'string'
  && /^liste-fil-[^o]/.test(n.props.testID) && n.type === TouchableOpacity)
  .map((n) => n.props.testID);
const textesDe = (noeud) => noeud.findAll((n) => typeof n.props?.children === 'string')
  .map((n) => n.props.children);
const ligne = (arbre, id) => arbre.root.find((n) => n.type === TouchableOpacity && n.props?.testID === `liste-fil-${id}`);
const parLibelle = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ n) => n.props?.accessibilityLabel === libelle);

// RECOLTE-T11 K8 (14/11/2026, Adel « 337- B ») : ces témoins décrivent l'interrupteur
// FC_COMMUNAUTES_V1 ALLUMÉ (la recette) ; le bloc « K8 » en fin de fichier, ÉTEINT (la prod).
beforeEach(() => {
  process.env.FC_COMMUNAUTES_V1 = '1';
});
afterEach(() => {
  // `delete` ne retire rien du process.env de jest : on remet la valeur vide.
  process.env.FC_COMMUNAUTES_V1 = '';
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockGetMesCommunautes.mockReset();
  mockAuth.userData = { documentId: 'moi', role: { name: 'Parent', type: 'parent' } };
});

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => {
    arbre.unmount();
  }));
});

describe('COMMUNAUTES-L4 — écran 1 : la ligne de la communauté', () => {
  test('L1 — sans communauté (404, 2.6.99) : la ligne du canal est celle d aujourd hui', async () => {
    mockGetMesCommunautes.mockRejectedValue(Object.assign(new Error('Not Found'), { response: { status: 404 } }));
    const arbre = await monter([FIL_CLUB, FIL_U13]);
    expect(lignes(arbre)).toEqual(['liste-fil-fil-club', 'liste-fil-fil-u13']);
    expect(textesDe(ligne(arbre, 'fil-club'))).not.toContain('Communauté');
    act(() => ligne(arbre, 'fil-club').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', expect.objectContaining({ chatId: 'fil-club' }));
  });

  test('L2 — la ligne garde l identifiant de son fil et sa place ; total des non-lus ; ouvre la communauté', async () => {
    mockGetMesCommunautes.mockResolvedValue([COMMUNAUTE]);
    const arbre = await monter([FIL_CLUB, FIL_U13]);
    expect(lignes(arbre)).toEqual(['liste-fil-fil-club', 'liste-fil-fil-u13']);
    const textes = textesDe(ligne(arbre, 'fil-club'));
    expect(textes).toEqual(expect.arrayContaining(['AS Bellevue', 'Communauté', '3 groupes · 2 avec du nouveau', '7']));
    act(() => ligne(arbre, 'fil-club').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Communautes', { genre: 'club', id: 'club-1' });
    // Rien au-dessus des conversations : le bouton rond de L2 n'est plus là quand la ligne existe.
    expect(parLibelle(arbre, 'Communautés')).toHaveLength(0);
  });

  test('L3 — les autres fils ne changent pas (le fil U13 garde ses textes et son appui)', async () => {
    mockGetMesCommunautes.mockRejectedValue(Object.assign(new Error('Not Found'), { response: { status: 404 } }));
    const avant = textesDe(ligne(await monter([FIL_CLUB, FIL_U13]), 'fil-u13'));
    mockGetMesCommunautes.mockReset();
    mockGetMesCommunautes.mockResolvedValue([COMMUNAUTE]);
    const arbre = await monter([FIL_CLUB, FIL_U13]);
    expect(textesDe(ligne(arbre, 'fil-u13'))).toEqual(avant);
    act(() => ligne(arbre, 'fil-u13').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', expect.objectContaining({ chatId: 'fil-u13' }));
  });
});

// RECOLTE-T11 K8 — interrupteur ÉTEINT (la prod) : rien des Communautés, et aucun appel au serveur.
describe('K8 — interrupteur FC_COMMUNAUTES_V1 éteint', () => {
  beforeEach(() => {
    process.env.FC_COMMUNAUTES_V1 = '0';
  });

  test('K8-L — la ligne du canal est celle d aujourd hui et ouvre le fil ; aucun bouton, aucun appel', async () => {
    mockGetMesCommunautes.mockResolvedValue([COMMUNAUTE]);
    const arbre = await monter([FIL_CLUB, FIL_U13]);
    expect(lignes(arbre)).toEqual(['liste-fil-fil-club', 'liste-fil-fil-u13']);
    expect(textesDe(ligne(arbre, 'fil-club'))).not.toContain('Communauté');
    act(() => ligne(arbre, 'fil-club').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', expect.objectContaining({ chatId: 'fil-club' }));
    expect(parLibelle(arbre, 'Communautés')).toHaveLength(0);
    expect(mockGetMesCommunautes).not.toHaveBeenCalled();
  });
});
