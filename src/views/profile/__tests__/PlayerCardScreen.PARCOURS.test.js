// @ts-nocheck
/**
 * CARTECODE-PARCOURS — « Compléter ma carte » (planche v2, parties 8 et 9), Q6 B.
 *  1. toucher sa carte quand il manque des infos ouvre le parcours ; une question par écran,
 *     la date EN PREMIER ; chaque écran se passe ; la carte se remplit en direct ;
 *  2. une date de 13-14 ans demande la déclaration parentale (le chemin de ProfileEdit) ;
 *  3. Q6 B : sans date, « Partager » ouvre l'étape « date » de ce parcours, puis « ce qui part » ;
 *  4. fin d'inscription : une carte modèle « EXEMPLE », puis sa vraie carte.
 */
import { Text, TextInput, TouchableOpacity } from 'react-native';
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

/** Il lui manque tout ce que le parcours demande. */
const SAMIR = {
  birthdate: null,
  documentId: 'samir-doc',
  firstname: 'Samir',
  id: 9,
  lastname: 'Haddad',
  preferredSport: 'football',
  role: { type: 'joueur' },
};

const COMPLET = {
  ...SAMIR,
  address: { city: 'Aix-en-Provence', postcode: '13090' },
  birthdate: '1998-03-14',
  height: '181',
  jerseyNumber: 5,
  position: 'Défenseur central',
  weight: '77',
};

const monter = async (params = {}) => {
  const navigation = { navigate: jest.fn() };
  let arbre;
  await act(async () => {
    arbre = renderer.create(<PlayerCardScreen navigation={navigation} route={{ params }} />);
  });
  return { arbre, navigation };
};

const textes = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => [].concat(n.props.children).join(''));

// Un geste par son nom accessible, ou par le texte qu'il porte (le premier trouvé).
const geste = (arbre, nom) => arbre.root.findAll((n) => typeof n.props.onPress === 'function' && (
  n.props.accessibilityLabel === nom
  || n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === nom)
))[0];

const toucher = async (arbre, nom) => {
  const cible = geste(arbre, nom);
  if (!cible) throw new Error(`geste introuvable : ${nom} — textes : ${textes(arbre).join(' | ')}`);
  await act(async () => { await cible.props.onPress(); });
};

const taper = async (arbre, label, valeur) => {
  const champ = arbre.root.findAllByType(TextInput)
    .find((n) => n.props.accessibilityLabel === label);
  if (!champ) throw new Error(`champ introuvable : ${label}`);
  await act(async () => { champ.props.onChangeText(valeur); });
};

const derniereCarteMontree = () => [...mockCardProps].reverse().find((p) => p.mode === 'ecran');

beforeEach(() => {
  jest.clearAllMocks();
  mockCardProps.length = 0;
  mockParentalCards.length = 0;
  mockAddressInputs.length = 0;
  mockUser = SAMIR;
  mockStats = null;
  mockHistories = [];
  global.mockDisclosureProps = null;
  mockUpdateMe.mockImplementation(async (patch) => ({ ...mockUser, ...patch }));
});

describe('CARTECODE-PARCOURS 1 — toucher sa carte ouvre « Compléter ma carte »', () => {
  it('il manque des infos : l écran le dit ; toucher la carte ouvre la date', async () => {
    const { arbre } = await monter();
    expect(textes(arbre)).toContain('Il manque 5 informations à ta carte');

    await toucher(arbre, 'Compléter ma carte');

    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['ÉTAPE 1 SUR 5', 'Ta date de naissance']));
  });

  it('une carte remplie : rien à compléter, la carte ne s ouvre pas', async () => {
    mockUser = COMPLET;
    const { arbre } = await monter();
    expect(geste(arbre, 'Compléter ma carte')).toBeUndefined();
    expect(textes(arbre).join(' ')).not.toMatch(/Il manque/);
  });

  it('une question par écran, chacune se passe, sans rien enregistrer', async () => {
    const { arbre } = await monter();
    await toucher(arbre, 'Compléter ma carte');

    const titres = [];
    for (let i = 0; i < 5; i += 1) {
      titres.push(textes(arbre).find((t) => /^Ta |^Ton /.test(t)));
      // eslint-disable-next-line no-await-in-loop
      await toucher(arbre, 'Passer');
    }

    expect(titres).toEqual([
      'Ta date de naissance',
      'Ton poste au football',
      'Ta taille et ton poids',
      'Ta ville',
      'Ton numéro de maillot',
    ]);
    expect(mockUpdateMe).not.toHaveBeenCalled();
    // Personne n'est bloqué : la fin du parcours rend la carte.
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Ta carte est à jour', 'Plus tard']));
  });

  it('la carte se remplit en direct, puis la réponse part au serveur, seule', async () => {
    mockUser = { ...COMPLET, jerseyNumber: null };
    const { arbre } = await monter();
    await toucher(arbre, 'Compléter ma carte');
    expect(textes(arbre)).toContain('Ton numéro de maillot');

    await taper(arbre, 'Numéro', '9');
    expect(derniereCarteMontree().numero).toBe('9');

    await toucher(arbre, 'Terminer');
    expect(mockUpdateMe).toHaveBeenCalledWith({ jerseyNumber: 9 });
    expect(mockRefetch).toHaveBeenCalled();
    expect(textes(arbre)).toContain('Ta carte est complète');
  });

  it('le poste de son sport, taille et poids, la ville avec son code postal', async () => {
    mockUser = {
      ...COMPLET, address: null, height: null, position: '',
    };
    const { arbre } = await monter();
    await toucher(arbre, 'Compléter ma carte');

    await toucher(arbre, 'Défenseur central');
    expect(derniereCarteMontree().poste).toBe('Défenseur central');
    await toucher(arbre, 'Suivant');
    expect(mockUpdateMe).toHaveBeenLastCalledWith({ position: 'Défenseur central' });

    await taper(arbre, 'Taille (cm)', '181');
    await toucher(arbre, 'Suivant');
    expect(mockUpdateMe).toHaveBeenLastCalledWith({ height: '181', weight: '77' });

    const ville = {
      city: 'Aix-en-Provence',
      label: 'Aix-en-Provence (13090)',
      postcode: '13090',
      value: '5.44|43.52',
    };
    await act(async () => { mockAddressInputs[mockAddressInputs.length - 1].setAddress(ville); });
    expect(derniereCarteMontree().ville).toBe('Aix-en-Provence 13090');
    await toucher(arbre, 'Terminer');
    expect(mockUpdateMe).toHaveBeenLastCalledWith({ address: ville, geohash: 'spey61' });
  });
});

describe('CARTECODE-PARCOURS 2 — une date de 13-14 ans demande la déclaration parentale', () => {
  const ilYa14Ans = () => {
    const annee = new Date().getFullYear() - 14;
    return { affiche: `01/01/${annee}`, iso: `${annee}-01-01` };
  };

  it('la case de ProfileEdit apparaît, « Suivant » attend qu elle soit cochée', async () => {
    const { arbre } = await monter();
    await toucher(arbre, 'Compléter ma carte');
    const date = ilYa14Ans();

    await taper(arbre, 'Date de naissance', date.affiche);
    expect(mockParentalCards.length).toBeGreaterThan(0);
    expect(geste(arbre, 'Suivant').props.disabled).toBe(true);

    await act(async () => { mockParentalCards[mockParentalCards.length - 1].onChange(true); });
    await toucher(arbre, 'Suivant');

    expect(mockUpdateMe).toHaveBeenCalledWith(expect.objectContaining({
      birthdate: date.iso,
      legalAcceptance: expect.objectContaining({
        sourceScreen: 'player_card_completion_parental_declaration',
      }),
      parentalDeclarationAccepted: true,
    }));
  });

  it('un adulte : pas de déclaration, seule la date part', async () => {
    const { arbre } = await monter();
    await toucher(arbre, 'Compléter ma carte');

    await taper(arbre, 'Date de naissance', '14/03/1998');
    expect(mockParentalCards).toHaveLength(0);
    await toucher(arbre, 'Suivant');

    expect(mockUpdateMe).toHaveBeenCalledWith({ birthdate: '1998-03-14' });
    expect(textes(arbre)).toContain('Ton poste au football');
  });
});

describe('CARTECODE-PARCOURS 3 — Q6 B : sans date, « Partager » ouvre l étape date', () => {
  it('l étape date s ouvre, pas l éditeur de profil ; passée, « ce qui part » suit', async () => {
    mockUser = { ...COMPLET, birthdate: null };
    const { arbre, navigation } = await monter();

    await toucher(arbre, 'Partager ma carte');
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['ÉTAPE 1 SUR 1', 'Ta date de naissance']));
    expect(global.mockDisclosureProps?.isVisible).toBe(false);

    await toucher(arbre, 'Passer');
    expect(global.mockDisclosureProps.isVisible).toBe(true);
  });
});

describe('CARTECODE-PARCOURS 4 — fin d inscription : la carte modèle, puis la sienne', () => {
  it('d abord une carte « EXEMPLE », puis « Découvrir ma carte » montre la vraie', async () => {
    const { arbre } = await monter({ celebration: true });
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Voici une carte FoundClub', 'EXEMPLE', 'Découvrir ma carte',
    ]));
    // La carte modèle est fictive, sans code QR ; la sienne n'est pas encore montrée.
    expect(mockCardProps.find((p) => p.prenom === 'Léa'))
      .toEqual(expect.objectContaining({ qrValue: '' }));
    expect(derniereCarteMontree()).toBeUndefined();

    await toucher(arbre, 'Découvrir ma carte');

    expect(derniereCarteMontree().prenom).toBe('Samir');
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Voici ta carte joueur', 'Il manque 5 informations à ta carte', 'Plus tard, continuer',
    ]));
    expect(textes(arbre)).not.toContain('EXEMPLE');
  });

  // Chef d'orchestre 27/10, option A : la carte vient de « Ouvert au recrutement ? »
  // (UserClubSearch.test.js, mêmes paramètres) ; « Plus tard, continuer » reprend le tunnel.
  it('depuis le tunnel : EXEMPLE, puis sa carte, puis l étape suivante du tunnel', async () => {
    const { arbre, navigation } = await monter({
      celebration: true, nextRoute: 'UserAffiliationGuide',
    });
    expect(textes(arbre)).toContain('EXEMPLE');
    await toucher(arbre, 'Découvrir ma carte');
    expect(derniereCarteMontree().prenom).toBe('Samir');

    await toucher(arbre, 'Plus tard, continuer');

    expect(navigation.navigate).toHaveBeenCalledWith('UserAffiliationGuide');
    expect(navigation.navigate).not.toHaveBeenCalledWith('Home');
  });

  it('sans étape suivante (tunnel fini) : « Plus tard, continuer » mène à l accueil', async () => {
    const { arbre, navigation } = await monter({ celebration: true });
    await toucher(arbre, 'Découvrir ma carte');
    await toucher(arbre, 'Plus tard, continuer');
    expect(navigation.navigate).toHaveBeenCalledWith('Home');
  });
});

describe('CARTEFIN 1 — l écran du poste dit le vrai sport du joueur', () => {
  it('basket : « Ton poste au basket », avec les postes du basket', async () => {
    mockUser = { ...COMPLET, position: '', preferredSport: 'basketball' };
    const { arbre } = await monter();
    await toucher(arbre, 'Compléter ma carte');
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Ton poste au basket', 'Meneur']));
  });
});

describe('CARTEFIN 2 — la fin du parcours donne la prochaine marche', () => {
  // 12 cases sur 13 (46 : déjà rare), ni club, ni équipe, ni match. Il manque le numéro.
  const PRESQUE = {
    ...COMPLET,
    avatar: { url: '/a.jpg' },
    bestLevel: 'Départemental 2',
    category: 'Sénior',
    jerseyNumber: null,
    nationality: 'France',
    section: { name: 'Masculine' },
  };
  const finir = async () => {
    const { arbre } = await monter();
    await toucher(arbre, 'Compléter ma carte');
    await taper(arbre, 'Numéro', '9');
    await toucher(arbre, 'Terminer');
    return arbre;
  };

  it('« Commune », chevron, « Rare », puis la marche la plus simple vers épique', async () => {
    // 10 cases (38, commune) ; le numéro en fait 11 (42, rare). Épique à 65 : 2 cases + 3 clubs.
    mockUser = { ...PRESQUE, category: null, section: null };
    const arbre = await finir();
    // SANS-EMOJI : pas de flèche typographique ; le lecteur d écran lit la montée en mots.
    expect(arbre.root.findAll((n) => n.props.accessibilityLabel === 'De commune à rare'))
      .not.toHaveLength(0);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Commune',
      'Rare',
      'Pour passer épique : remplis 2 cases de plus sur ta carte '
        + 'et déclare 3 clubs de plus dans ton parcours.',
    ]));
  });

  it('rareté inchangée : son nom seul ; les matchs comptés depuis ceux déjà joués', async () => {
    mockUser = { ...PRESQUE, myTeams: [{ club: { name: 'AS Aix' }, name: 'Séniors' }] };
    mockHistories = [1, 2, 3].map((n) => ({ customClubName: `Club ${n}`, startYear: 2010 + n }));
    mockStats = { overall: { matches: 2 } };
    const arbre = await finir();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Épique',
      'Pour passer légendaire : joue encore 3 matchs avec ton équipe.',
    ]));
    expect(arbre.root.findAll((n) => /^De /.test(n.props.accessibilityLabel || '')))
      .toHaveLength(0);
  });

  it('légendaire : plus de marche, l écran le dit', async () => {
    mockUser = { ...PRESQUE, myTeams: [{ club: { name: 'AS Aix' }, name: 'Séniors' }] };
    mockHistories = [1, 2, 3].map((n) => ({ customClubName: `Club ${n}`, startYear: 2010 + n }));
    mockStats = { overall: { matches: 20 } };
    const arbre = await finir();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Légendaire', 'C\'est la plus haute rareté.',
    ]));
    expect(textes(arbre).join(' ')).not.toMatch(/Pour passer/);
  });
});

// Le geste « toucher la carte » n'est pas un bouton de plus entre la carte et ses gestes.
it('CARTECODE-PARCOURS — toucher la carte n ajoute aucun TouchableOpacity', async () => {
  const { arbre } = await monter();
  expect(arbre.root.findAllByType(TouchableOpacity)
    .filter((n) => n.props.accessibilityLabel === 'Compléter ma carte'
      && !n.findAllByType(Text).length))
    .toHaveLength(0);
});
