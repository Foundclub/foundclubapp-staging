// @ts-nocheck
/**
 * PAR-L14 (E6) — ce que l'ecran « Ma carte de collection » fait dans ses TROIS
 * etats, fige AVANT sa reparation :
 *  - normal (adulte, depuis le profil) ;
 *  - verrouille (13-14 ans sans accord parental) ;
 *  - celebration (fin d'inscription, `params.celebration`).
 *
 * Le lot ne redessine que l'etat normal (E31). Les etats verrouille et
 * celebration n'ont pas ete maquettes : ils doivent rester ce qu'ils sont, et
 * ce fichier le garde. Les gestes sont cherches par leur NOM ACCESSIBLE, pas par
 * leur forme : un bouton qui change de place reste le meme geste.
 */
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

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
  documentId: 'adel-doc',
  firstname: 'Adel',
  id: 7,
  lastname: 'Ferchichi',
  role: { type: 'joueur' },
};

/** 14 ans cette annee, sans accord parental : aperçu verrouille. */
const ADO_SANS_ACCORD = {
  birthdate: `${new Date().getFullYear() - 14}-01-01`,
  documentId: 'sami-doc',
  firstname: 'Sami',
  id: 8,
  lastname: 'Benali',
  role: { type: 'joueur' },
};

const monter = (params = {}) => {
  const navigation = { navigate: jest.fn() };
  let arbre;
  act(() => {
    arbre = renderer.create(<PlayerCardScreen navigation={navigation} route={{ params }} />);
  });
  return { arbre, navigation };
};

const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => [].concat(n.props.children).join(''));

// Un geste par son nom accessible, ou par le texte qu'il porte.
const gestes = (arbre, nom) => arbre.root.findAllByType(TouchableOpacity).filter((n) => (
  n.props.accessibilityLabel === nom
  || n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === nom)
));

beforeEach(() => {
  jest.clearAllMocks();
  mockCardProps.length = 0;
  mockShareModalProps.length = 0;
  mockParentalCards.length = 0;
  mockHistories = [];
  mockUser = ADULTE;
});

describe('PAR-L14 — etat NORMAL : les gestes qui doivent survivre au redessin', () => {
  it('le titre, puis la carte montree ET la carte d export, toutes deux deverrouillees', () => {
    const { arbre } = monter();

    expect(textes(arbre)).toContain('Ma carte de collection');
    expect(mockCardProps.length).toBeGreaterThanOrEqual(2);
    const derniers = mockCardProps.slice(-2);
    expect(derniers.map((p) => p.locked)).toEqual([false, false]);
    expect(derniers[1].width).toBe(496);
  });

  it('« Partager ma carte » ouvre la feuille de partage', () => {
    const { arbre } = monter();

    const partager = gestes(arbre, 'Partager ma carte');
    expect(partager).toHaveLength(1);
    act(() => partager[0].props.onPress());
    expect(mockShareModalProps[mockShareModalProps.length - 1].isVisible).toBe(true);
  });

  it('« Modifier mes infos » ouvre l editeur de profil depuis la carte', () => {
    const { arbre, navigation } = monter();

    const modifier = gestes(arbre, 'Modifier mes infos');
    expect(modifier).toHaveLength(1);
    act(() => modifier[0].props.onPress());
    expect(navigation.navigate)
      .toHaveBeenCalledWith(RouteNames.ProfileEdit, { source: 'player_card' });
  });

  it('« Enregistrer l image » reste un geste de l ecran', async () => {
    const { arbre } = monter();

    const enregistrer = gestes(arbre, 'Enregistrer l\'image');
    expect(enregistrer).toHaveLength(1);
    await act(async () => { await enregistrer[0].props.onPress(); });
    expect(mockSaveCardToGallery).toHaveBeenCalledTimes(1);
  });

  it('la jauge de rarete garde sa phrase', () => {
    expect(textes(monter().arbre))
      .toContain('Complète ton profil et ton parcours pour monter en rareté.');
  });

  it('un club de l historique arrive a la carte avec sa periode', () => {
    mockHistories = [{
      club: { name: 'Aix-Perd en Buvette' },
      isCurrentlyActive: true,
      level: { name: 'Départemental 2' },
      startYear: 2024,
    }];

    monter();

    const { historique } = mockCardProps[mockCardProps.length - 1];
    expect(historique).toHaveLength(1);
    expect(historique[0]).toMatchObject({ club: 'Aix-Perd en Buvette', periode: '2024–Auj.' });
    expect(historique[0].categorie).toContain('Départemental 2');
  });
});

describe('PAR-L14 — etat VERROUILLE (13-14 ans sans accord) : inchange', () => {
  beforeEach(() => {
    mockUser = ADO_SANS_ACCORD;
  });

  it('la carte montree est verrouillee, celle d export ne l est pas', () => {
    monter();

    const derniers = mockCardProps.slice(-2);
    expect(derniers.map((p) => p.locked)).toEqual([true, false]);
    expect(derniers[0].photo).toBeUndefined();
  });

  it('ni partage, ni enregistrement, ni modification : seulement la demande d accord', () => {
    const { arbre, navigation } = monter();

    expect(gestes(arbre, 'Partager ma carte')).toHaveLength(0);
    expect(gestes(arbre, 'Partager')).toHaveLength(0);
    expect(gestes(arbre, 'Enregistrer l\'image')).toHaveLength(0);
    expect(gestes(arbre, 'Modifier mes infos')).toHaveLength(0);
    expect(gestes(arbre, 'Modifier')).toHaveLength(0);
    expect(mockParentalCards).not.toHaveLength(0);
    expect(mockParentalCards[0]).toMatchObject({ disabled: true, title: 'Accord parental requis' });

    const demander = gestes(arbre, 'Demander l\'accord parental');
    expect(demander).toHaveLength(1);
    act(() => demander[0].props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.UserParentalDeclaration, {
      returnRoute: RouteNames.PlayerCard,
      source: 'player_card',
    });
  });

  it('les textes de l ecran verrouille sont ceux d avant', () => {
    const lus = textes(monter().arbre);

    expect(lus).toEqual(expect.arrayContaining([
      'Ma carte de collection',
      'Partage ta carte, gagne en visibilité et fais-toi détecter.',
      'Complète ton profil et ton parcours pour monter en rareté.',
    ]));
  });
});

describe('PAR-L14 — etat CELEBRATION (fin d inscription) : inchange', () => {
  it('l accueil, le titre de revelation et la phrase d accroche', () => {
    const lus = textes(monter({ celebration: true }).arbre);

    expect(lus).toEqual(expect.arrayContaining([
      'Bienvenue',
      'Voici ta carte de collection',
      'Partage ta carte, gagne en visibilité et fais-toi détecter.',
    ]));
  });

  it('les gestes d avant : modifier, partager ma carte, enregistrer, plus tard', () => {
    const { arbre, navigation } = monter({ celebration: true });
    const lus = textes(arbre);

    expect(lus).toEqual(expect.arrayContaining([
      'Modifier mes infos', 'Partager ma carte', 'Enregistrer l\'image', 'Plus tard, continuer',
    ]));
    act(() => gestes(arbre, 'Plus tard, continuer')[0].props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('Home');
  });
});
