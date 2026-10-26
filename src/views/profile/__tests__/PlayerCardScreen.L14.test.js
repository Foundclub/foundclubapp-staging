// @ts-nocheck
/**
 * PAR-L14 — les defauts de l'ecran « Ma carte de collection » vus sur l'iPhone
 * d'Adel (12/10), cote ecran. Chaque temoin etait ROUGE sur staging 09ac9a67.
 *
 * Point 3 : une ligne d'historique par club ET par saison. L'assistant de
 * parcours cree une entree par categorie cochee : mesure du chef en production
 * (12/10), 10 groupes en double sur 5 comptes, 8 sur 10 different par la seule
 * categorie, que la carte ne montrait pas. On reunit A L'AFFICHAGE.
 *
 * Point 5 : « Partager » et « Modifier » cote a cote JUSTE SOUS la carte. Sur un
 * iPhone SE, « Partager ma carte » tombait a 723 px pour un ecran de 667 (banc du
 * site, 12/10) : il fallait defiler pour partager.
 */
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerCard from '@/components/organisms/playerCard/PlayerCard';

import { RouteNames } from '@/navigation/routeNames';

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

// CARTECODE étape 2 : le reflet (gestes, reanimated) et la feuille « ce qui part ».
jest.mock(
  '@/components/organisms/playerCard/CardSheen',
  () => function CardSheenMock({ children }) {
    return children;
  },
);
jest.mock(
  '@/components/organisms/playerCard/CardDisclosureSheet',
  () => function CardDisclosureSheetMock(props) {
    global.mockDisclosureProps = props;
    return null;
  },
);

// CARTECODE : la rarete lit le nombre de matchs (statistiques personnelles).
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => ({ data: null }),
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

    // CARTECODE Q4 A : la carte v2 montre le club, son logo et ses années (le détail des
    // niveaux et catégories reste dans le profil).
    const { historique } = carteMontree();
    expect(historique.map((l) => l.club)).toEqual([
      'Stade Marseillais Université Club', 'Sporting Club Montredon Bonneveine',
    ]);
    expect(historique[1]).toEqual({
      club: 'Sporting Club Montredon Bonneveine', logoUrl: null, periode: '2020–2022',
    });
  });

  it('le meme club sur deux saisons : deux lignes', () => {
    mockHistories = [
      { club: SPORTING, endYear: 2019, startYear: 2018 },
      { club: SPORTING, endYear: 2022, startYear: 2020 },
    ];

    monter();

    const { historique } = carteMontree();
    expect(historique.map((l) => l.periode)).toEqual(['2020–2022', '2018–2019']);
  });

  it('CARTECODE Q4 A : au plus 3 clubs sur la carte, les plus récents', () => {
    mockHistories = ['A', 'B', 'C', 'D'].map((nom, i) => ({
      club: { name: `Club ${nom}` }, endYear: 2010 + 2 * i + 1, startYear: 2010 + 2 * i,
    }));

    monter();

    expect(carteMontree().historique.map((l) => l.club)).toEqual(['Club D', 'Club C', 'Club B']);
  });
});

const textesDe = (noeud) => noeud.findAllByType(Text)
  .map((n) => [].concat(n.props.children).join(''));
const geste = (arbre, nom) => arbre.root.findAllByType(TouchableOpacity)
  .find((n) => n.props.accessibilityLabel === nom);
const ancetreRendu = (noeud) => {
  let courant = noeud.parent;
  while (courant && typeof courant.type !== 'string') courant = courant.parent;
  return courant;
};

describe('PAR-L14 point 5 — partager et modifier, cote a cote, juste sous la carte', () => {
  it('juste apres la carte : une rangee « Partager » | « Modifier », rien entre les deux', () => {
    const { arbre } = monter();
    const rendus = arbre.root.findAll((n) => typeof n.type === 'string');
    const place = (n) => rendus.indexOf(n);

    const emplacement = ancetreRendu(arbre.root.findAllByType(PlayerCard)[0]);
    const partager = geste(arbre, 'Partager ma carte');
    const modifier = geste(arbre, 'Modifier mes infos');
    const rangee = ancetreRendu(partager);

    expect(textesDe(partager)).toEqual(['Partager']);
    expect(textesDe(modifier)).toEqual(['Modifier']);
    expect(ancetreRendu(modifier)).toBe(rangee);
    expect(StyleSheet.flatten(rangee.props.style).flexDirection).toBe('row');
    // Aucun geste entre la carte et la rangee, et aucun AVANT la carte.
    const premierRendu = (n) => n.findAll((m) => typeof m.type === 'string')[0];
    const gestesAvant = arbre.root.findAllByType(TouchableOpacity)
      .filter((n) => place(premierRendu(n)) < place(rangee))
      .map((n) => n.props.accessibilityLabel);
    expect(gestesAvant).toEqual([]);
    expect(place(emplacement)).toBeLessThan(place(rangee));
  });

  it('les deux gestes font ce qu ils faisaient', () => {
    const { arbre, navigation } = monter();

    act(() => geste(arbre, 'Partager ma carte').props.onPress());
    // CARTECODE (ligne 41) : « ce qui part » d'abord, puis la feuille de partage.
    act(() => global.mockDisclosureProps.onConfirm());
    expect(mockShareModalProps[mockShareModalProps.length - 1].isVisible).toBe(true);
    act(() => geste(arbre, 'Modifier mes infos').props.onPress());
    expect(navigation.navigate)
      .toHaveBeenCalledWith(RouteNames.ProfileEdit, { source: 'player_card' });
  });
});
