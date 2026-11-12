// @ts-nocheck
/**
 * CARTE-MARCHE (D97, décision d'Adel du 12/11/2026, « 291 B et A ») — sous SA carte, l'écran
 * montre EN PERMANENCE :
 *  (A) la prochaine marche (computeNextRarityStep, textes playerCard.completion.nextStep.*) ;
 *  (B) le score et les 3 paliers (Rare 40, Épique 65, Légendaire 85), le palier atteint en avant ;
 *  en Légendaire : « Rareté maximale », sans marche. La barre et « Compléter ma carte » restent.
 */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerCardScreen from '../PlayerCardScreen';

/** @type {any} */
let mockUser;
/** @type {any[]} */
const mockCardProps = [];
/** @type {any[]} */
const mockParentalCards = [];
/** @type {any[]} */
const mockAddressInputs = [];
const mockUpdateMe = jest.fn();
const mockRefetch = jest.fn();
/** @type {any} */
let mockStats;
/** @type {any[]} */
let mockHistories;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (...args) => mockUpdateMe(...args),
}));

jest.mock('@/domains/playerCard/useShareCard', () => ({
  __esModule: true,
  default: () => ({
    captureToFile: jest.fn(),
    cardRef: { current: null },
    isBusy: false,
    saveCardToGallery: jest.fn(),
    shareCard: jest.fn(),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getPostOnboardingHomeRoute: () => 'Home',
    refetchUserData: mockRefetch,
    userData: mockUser,
  }),
}));

jest.mock('@/domains/places/placesUseCases', () => ({
  getGeohashForPointAndRadius: () => 'spey61',
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ chats: [], sendMessage: jest.fn() }),
}));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ data: mockHistories }),
}));

jest.mock('@/services/playerCard/uploadCardImage', () => ({ uploadCardImage: jest.fn() }));

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

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => ({ data: mockStats }),
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
  CARD_EXPORT_HEIGHT: 1262,
  CARD_EXPORT_WIDTH: 992,
  default: function PlayerCardMock(props) {
    mockCardProps.push(props);
    return null;
  },
}));

jest.mock(
  '@/components/organisms/shareCardModal/ShareCardModal',
  () => function ShareCardModalMock() {
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

jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function AutocompleteAddressInputMock(props) {
    mockAddressInputs.push(props);
    return null;
  },
);

jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput: ChampRN } = jest.requireActual('react-native');
  return reactActuel.forwardRef((props, ref) => reactActuel.createElement(ChampRN, {
    accessibilityLabel: props.label,
    onChangeText: props.onChangeText,
    ref,
    value: props.value,
  }));
});

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
      },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

// « Il manque un match seulement » : le barème « 150 A » ne le produit jamais (remplir la carte,
// déclarer un club ou rejoindre une équipe vaut toujours plus) ; ce cas simule la marche pour
// prouver que l'écran sait le dire, le jour où le barème changerait.
/** @type {any} */
let mockMarche = null;
jest.mock('@/domains/playerCard/cardModel', () => {
  const vrai = jest.requireActual('@/domains/playerCard/cardModel');
  return {
    ...vrai,
    computeNextRarityStep: (args) => mockMarche || vrai.computeNextRarityStep(args),
  };
});

/** Il manque presque tout : 2 cases sur 13 (6 points, commune). */
const SAMIR = {
  birthdate: null,
  documentId: 'samir-doc',
  firstname: 'Samir',
  id: 9,
  lastname: 'Haddad',
  preferredSport: 'football',
  role: { type: 'joueur' },
};

/** Les 13 cases remplies : 55 points, rare. */
const COMPLET = {
  ...SAMIR,
  address: { city: 'Aix-en-Provence', postcode: '13090' },
  avatar: { url: '/a.jpg' },
  bestLevel: 'Départemental 2',
  birthdate: '1998-03-14',
  category: 'Sénior',
  height: '181',
  jerseyNumber: 5,
  nationality: 'France',
  position: 'Défenseur central',
  section: { name: 'Masculine' },
  weight: '77',
};
const UN_CLUB = [{ customClubName: 'Club 1', startYear: 2011 }];
const EQUIPE = [{ club: { name: 'AS Aix' }, name: 'Séniors' }];

const monter = async () => {
  const navigation = { navigate: jest.fn() };
  let arbre;
  await act(async () => {
    arbre = renderer.create(<PlayerCardScreen navigation={navigation} route={{ params: {} }} />);
  });
  return arbre;
};

const lire = (noeud) => noeud.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const textes = (arbre) => lire(arbre.root);
const parTestId = (arbre, id) => arbre.root
  .findAll((n) => n.props.testID === id && typeof n.type === 'string');
const marche = (arbre) => {
  const blocs = arbre.root.findAll((n) => n.props.testID === 'carte-marche');
  if (!blocs.length) throw new Error(`pas de carte-marche : ${textes(arbre).join(' | ')}`);
  return lire(blocs[0]);
};
const atteint = (arbre) => parTestId(arbre, 'carte-marche-palier-atteint')
  .map((n) => lire(n).join(''))
  .filter(Boolean);
const PALIERS = ['Rare (40)', 'Épique (65)', 'Légendaire (85)'];

beforeEach(() => {
  jest.clearAllMocks();
  mockCardProps.length = 0;
  mockUser = SAMIR;
  mockStats = null;
  mockHistories = [];
  mockMarche = null;
  global.mockDisclosureProps = null;
});

describe('CARTE-MARCHE (A)+(B) — sous ma carte, la marche et les paliers, en permanence', () => {
  it('commune (6 points) : score, 3 paliers sans aucun atteint, la marche vers rare', async () => {
    const arbre = await monter();
    const lus = marche(arbre);
    expect(lus).toEqual(expect.arrayContaining(['6 points', ...PALIERS]));
    expect(atteint(arbre)).toEqual([]);
    expect(lus).toContain('Pour passer rare : remplis 6 cases de plus sur ta carte '
      + 'et déclare 1 club de plus dans ton parcours.');
  });

  it('il manque des informations seulement (12 cases, 37 points) : remplir 1 case', async () => {
    mockUser = { ...COMPLET, jerseyNumber: null };
    const arbre = await monter();
    expect(marche(arbre)).toEqual(expect.arrayContaining([
      '37 points', 'Pour passer rare : remplis 1 case de plus sur ta carte.',
    ]));
    expect(atteint(arbre)).toEqual([]);
  });

  it('rare (55 points) : « Rare (40) » mis en avant, la marche vers épique', async () => {
    mockUser = COMPLET;
    const arbre = await monter();
    expect(marche(arbre)).toEqual(expect.arrayContaining([
      '55 points', ...PALIERS, 'Pour passer épique : déclare 1 club de plus dans ton parcours.',
    ]));
    expect(atteint(arbre)).toEqual(['Rare (40)']);
  });

  it('épique (70 points) : « Épique (65) » mis en avant, rejoindre une équipe', async () => {
    mockUser = COMPLET;
    mockHistories = UN_CLUB;
    const arbre = await monter();
    expect(marche(arbre)).toEqual(expect.arrayContaining([
      '70 points', ...PALIERS, 'Pour passer légendaire : rejoins une équipe.',
    ]));
    expect(atteint(arbre)).toEqual(['Épique (65)']);
  });

  it('légendaire (85 points) : « Rareté maximale », aucune marche', async () => {
    mockUser = { ...COMPLET, myTeams: EQUIPE };
    mockHistories = UN_CLUB;
    const arbre = await monter();
    const lus = marche(arbre);
    expect(lus).toEqual(expect.arrayContaining(['85 points', ...PALIERS, 'Rareté maximale']));
    expect(lus.join(' ')).not.toMatch(/Pour passer/);
    expect(atteint(arbre)).toEqual(['Légendaire (85)']);
  });

  it('il manque un match seulement : « joue encore 1 match avec ton équipe »', async () => {
    mockUser = { ...COMPLET, myTeams: EQUIPE };
    mockStats = { overall: { matches: 4 } };
    mockMarche = {
      actions: [{ count: 1, kind: 'matches' }], next: 'legendary', rarity: 'epic', score: 80,
    };
    const arbre = await monter();
    expect(marche(arbre)).toEqual(expect.arrayContaining([
      '80 points', 'Pour passer légendaire : joue encore 1 match avec ton équipe.',
    ]));
    expect(atteint(arbre)).toEqual(['Épique (65)']);
  });

  it('un seul score à l écran : celui de la marche est celui de la barre', async () => {
    mockUser = COMPLET;
    mockHistories = UN_CLUB;
    const arbre = await monter();
    const barre = arbre.root.findAll((n) => n.props.testID === 'carte-marche-barre'
      && typeof n.type === 'string');
    expect(barre).not.toHaveLength(0);
    const largeur = [].concat(barre[0].props.style).find((s) => s && s.width)?.width;
    expect(largeur).toBe('70%');
    expect(marche(arbre)).toContain('70 points');
  });

  it('rien de retiré : la barre, sa phrase et « Compléter ma carte » restent', async () => {
    const arbre = await monter();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Complète ton profil et ton parcours pour monter en rareté.',
      'Compléter ma carte',
    ]));
    expect(parTestId(arbre, 'carte-marche-barre')).not.toHaveLength(0);
  });
});

describe('CARTE-MARCHE — les textes neufs existent en français ET en anglais', () => {
  it('fr = en pour playerCard.ladder', () => {
    const fr = jest.requireActual('@/theme/strings/translations/fr').default;
    const en = jest.requireActual('@/theme/strings/translations/en').default;
    const cles = (o) => Object.keys(o || {}).sort();
    expect(cles(fr.playerCard.ladder)).not.toHaveLength(0);
    expect(cles(en.playerCard.ladder)).toEqual(cles(fr.playerCard.ladder));
  });
});
