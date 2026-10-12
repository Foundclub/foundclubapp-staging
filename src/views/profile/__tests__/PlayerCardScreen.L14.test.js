// @ts-nocheck
/**
 * PAR-L14 — les defauts de l'ecran « Ma carte de collection » vus sur l'iPhone
 * d'Adel (12/10), cote ecran. Chaque temoin etait ROUGE sur staging 09ac9a67.
 *
 * Point 3 : une ligne d'historique par club ET par saison. L'assistant de
 * parcours cree une entree par categorie cochee : mesure du chef en production
 * (12/10), 10 groupes en double sur 5 comptes, 8 sur 10 different par la seule
 * categorie, que la carte ne montrait pas. On reunit A L'AFFICHAGE.
 */
import renderer, { act } from 'react-test-renderer';

import PlayerCardScreen from '../PlayerCardScreen';

/** @type {any} */
let mockUser;
/** @type {any[]} */
let mockHistories;
const mockSaveCardToGallery = jest.fn();
/** @type {any[]} */
const mockCardProps = [];
/** @type {any[]} */
const mockShareModalProps = [];
/** @type {any[]} */
const mockParentalCards = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));

jest.mock('@/domains/playerCard/useShareCard', () => ({
  __esModule: true,
  default: () => ({
    captureToFile: jest.fn(),
    cardRef: { current: null },
    isBusy: false,
    saveCardToGallery: mockSaveCardToGallery,
    shareCard: jest.fn(),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ getPostOnboardingHomeRoute: () => 'Home', userData: mockUser }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ chats: [], sendMessage: jest.fn() }),
}));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ data: mockHistories }),
}));

jest.mock('@/services/playerCard/uploadCardImage', () => ({ uploadCardImage: jest.fn() }));

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
      Images: { pin: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@/components/organisms/playerCard/PlayerCard', () => ({
  __esModule: true,
  CARD_EXPORT_WIDTH: 992,
  CARD_FORMATS: { square: { height: 1262, key: 'square', width: 992 } },
  default: function PlayerCardMock(props) {
    mockCardProps.push(props);
    return null;
  },
}));

jest.mock(
  '@/components/organisms/shareCardModal/ShareCardModal',
  () => function ShareCardModalMock(props) {
    mockShareModalProps.push(props);
    return null;
  },
);

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard',
  () => function ParentalDeclarationCardMock(props) {
    mockParentalCards.push(props);
    return null;
  },
);

// Le bouton garde son NOM ACCESSIBLE (accessibilityLabel, sinon son titre) :
// c'est ce que lit un lecteur d'ecran, et ce que cherchent ces temoins.
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(props) {
    return reactActuel.createElement(
      PressableRN,
      {
        accessibilityLabel: props.accessibilityLabel ?? props.title,
        disabled: props.disabled || props.isLoading,
        onPress: props.onPress,
        testID: `bouton-${props.variant}`,
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

const ADULTE = {
  birthdate: '1999-04-02',
  documentId: 'karim-doc',
  firstname: 'Karim',
  id: 7,
  lastname: 'Testeur',
  role: { type: 'joueur' },
};

const SPORTING = { name: 'Sporting Club Montredon Bonneveine' };
const R1 = { name: 'Régional 1' };

const monter = (params = {}) => {
  const navigation = { navigate: jest.fn() };
  let arbre;
  act(() => {
    arbre = renderer.create(<PlayerCardScreen navigation={navigation} route={{ params }} />);
  });
  return { arbre, navigation };
};

// Les props de la carte MONTREE (la derniere paire rendue : montree, puis export).
const carteMontree = () => mockCardProps[mockCardProps.length - 2];

beforeEach(() => {
  jest.clearAllMocks();
  mockCardProps.length = 0;
  mockShareModalProps.length = 0;
  mockParentalCards.length = 0;
  mockHistories = [];
  mockUser = ADULTE;
});

describe('PAR-L14 point 3 — une ligne par club et par saison, categories reunies', () => {
  it('deux entrees du meme club, des memes annees, deux categories : UNE ligne', () => {
    mockHistories = [
      {
        category: { name: 'Seniors' }, club: SPORTING, endYear: 2022, level: R1, startYear: 2020,
      },
      {
        category: { name: 'U20' }, club: SPORTING, endYear: 2022, level: R1, startYear: 2020,
      },
      {
        category: { name: 'Seniors' },
        club: { name: 'Stade Marseillais Université Club' },
        isCurrentlyActive: true,
        level: { name: 'Départemental 2' },
        startYear: 2024,
      },
    ];

    monter();

    const { historique, historiqueTotal } = carteMontree();
    expect(historique.map((l) => l.club)).toEqual([
      'Stade Marseillais Université Club', 'Sporting Club Montredon Bonneveine',
    ]);
    expect(historique[1]).toMatchObject({
      categorie: 'Régional 1 · Seniors, U20', periode: '2020–2022',
    });
    expect(historiqueTotal).toBe(2);
  });

  it('le meme club sur deux saisons : deux lignes, mais UN club au compteur', () => {
    mockHistories = [
      { club: SPORTING, endYear: 2019, startYear: 2018 },
      { club: SPORTING, endYear: 2022, startYear: 2020 },
    ];

    monter();

    const { historique, historiqueTotal } = carteMontree();
    expect(historique.map((l) => l.periode)).toEqual(['2020–2022', '2018–2019']);
    expect(historiqueTotal).toBe(1);
  });

  it('le compteur compte TOUS les clubs, pas seulement les 3 lignes montrees', () => {
    mockHistories = ['A', 'B', 'C', 'D'].map((nom, i) => ({
      club: { name: `Club ${nom}` }, endYear: 2010 + 2 * i + 1, startYear: 2010 + 2 * i,
    }));

    monter();

    expect(carteMontree().historiqueTotal).toBe(4);
  });
});
