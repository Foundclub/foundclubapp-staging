// @ts-nocheck
import {
  DeviceEventEmitter, Modal, Platform, StyleSheet, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MultiTeamCompositionBoard from './MultiTeamCompositionBoard';

// 📱 CLAVIER-MODALES — LA FENÊTRE « AJOUTER UN JOUEUR » DU TABLEAU DE COMPOSITION.
//
// Temps 1 du tableau, « Ajouter un joueur » : une `<Modal transparent>`, une carte CENTRÉE à
// 3 champs (Prénom, Nom, Numéro) et ses boutons « Annuler / Ajouter ». Signalée par ANDROIDBAR-3BIS
// (aucun évitement du clavier), `.recette/APRES_PUBLICATION.md` 112.
//
// - iPhone : une `<Modal>` n'évite RIEN ; la carte reste centrée sur TOUT l'écran, son bas (les
//   boutons, le « Numéro ») sous le clavier — même famille que la convocation, où Adel a vu le
//   bouton caché (TestFlight 2.6.75). Charges réelles d'iOS (`keyboardWillShow` /
//   `keyboardWillHide`, hauteur barre d'accueil COMPRISE) ; iPhone 15 (852 pt, clavier 336, barre
//   34), iPhone SE (667, 260, 0).
// - Android 15/16 : la fenêtre n'est PAS translucide : Android la remonte lui-même (cadre
//   `fitsSystemWindows` + `adjustResize`, ReactModalHostView.kt:327 et :353-355). Un retrait de
//   plus la remonterait deux fois : GARDE, aucun retrait. MESURÉ sur la fenêtre JUMELLE « Proposer
//   un match » (même <Modal transparent> non translucide ; séance émulateur, Pixel 9, Android 16,
//   14/10 00:47) : bouton du bas 2127 px → 1370 clavier ouvert (haut du clavier 1541) → 2127
//   refermé. Cette fenêtre-ci : doute 4 de la même séance.
// Le glisser-déposer (ANDROIDBAR-3BIS, ses témoins E6) n'est pas touché : la fenêtre est hors
// du plateau.

jest.setTimeout(30000);

const IPHONES = [
  {
    barre: 34, clavier: 336, ecran: 852, nom: 'iPhone 15',
  },
  {
    barre: 0, clavier: 260, ecran: 667, nom: 'iPhone SE',
  },
];

const mockClientRequeteFige = { invalidateQueries: jest.fn() };
const mockNavigationFigee = { goBack: jest.fn(), navigate: jest.fn() };
const mockAuthFige = { clubVerificationSummary: null, userData: null };
const mockInsets = {
  bottom: 34, left: 0, right: 0, top: 59,
};

jest.mock('react-native-gesture-handler', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const constructeurGeste = () => {
    const geste = {};
    ['activateAfterLongPress', 'minDistance', 'onEnd', 'onFinalize', 'onStart', 'onUpdate']
      .forEach((nom) => {
        geste[nom] = () => geste;
      });
    return geste;
  };
  return {
    Gesture: { Pan: constructeurGeste },
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: VueRN,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View: VueRN },
    runOnJS: (fonction) => fonction,
    useAnimatedStyle: () => ({}),
    useSharedValue: (valeur) => ({ value: valeur }),
    withSpring: (valeur) => valeur,
    withTiming: (valeur) => valeur,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequeteFige,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigationFigee,
  useRoute: () => ({ params: {} }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthFige,
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: {},
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger sans `API_URL`.
jest.mock('@/services/event/eventService', () => ({
  generateEventCompositionDraft: jest.fn(),
  publishEventConvocation: jest.fn(),
  saveEventCompositionDraft: jest.fn(),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ disabled, onPress, title }) => reactActuel.createElement(
      PressableRN,
      { accessibilityLabel: title, disabled, onPress },
      reactActuel.createElement(TexteRN, null, title),
    ),
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/tactical/RenderedTacticalField', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/tactical/DraggableToken', () => ({
  __esModule: true,
  default: () => null,
  GHOST_TOKEN_SIZE: { height: 40, width: 40 },
}));

const PRESET_433 = {
  key: '4-3-3',
  label: '4-3-3',
  slots: [
    {
      key: 'gk', label: 'GB', positionX: 50, positionY: 92,
    },
    {
      key: 'st', label: 'BU', positionX: 50, positionY: 18,
    },
  ],
};

const parametresEdition = () => ({
  canEdit: true,
  editorMode: 'event',
  eventId: 'event-1',
  eventName: 'Match amical',
  players: [{ documentId: 'p-zoe', firstname: 'Zoe', lastname: 'Roux' }],
  readOnly: false,
  sport: 'football',
  teamComposition: { availablePresets: [PRESET_433], draft: null, published: null },
  teamId: 'team-1',
  teamName: 'U15 Filles',
});

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = Object.getOwnPropertyDescriptor(Platform, 'Version');

const telephone = (systeme, version, barreDuBas) => {
  Platform.OS = systeme;
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  mockInsets.bottom = barreDuBas;
};

const arbresMontes = [];

afterEach(() => {
  while (arbresMontes.length > 0) {
    const arbre = arbresMontes.pop();
    act(() => {
      arbre.unmount();
    });
  }
  act(() => {
    DeviceEventEmitter.emit('keyboardWillHide');
    DeviceEventEmitter.emit('keyboardDidHide');
  });
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
  mockInsets.bottom = 34;
  jest.clearAllMocks();
});

const chargeIOS = (iphone, ouvert) => ({
  duration: 250,
  easing: 'keyboard',
  endCoordinates: {
    height: iphone.clavier,
    screenX: 0,
    screenY: ouvert ? iphone.ecran - iphone.clavier : iphone.ecran,
    width: 393,
  },
});

const ouvrirLeClavierIOS = async (iphone) => act(async () => {
  DeviceEventEmitter.emit('keyboardWillShow', chargeIOS(iphone, true));
  DeviceEventEmitter.emit('keyboardDidShow', chargeIOS(iphone, true));
});

const refermerLeClavierIOS = async (iphone) => act(async () => {
  DeviceEventEmitter.emit('keyboardWillHide', chargeIOS(iphone, false));
  DeviceEventEmitter.emit('keyboardDidHide', chargeIOS(iphone, false));
});

// Android 11+ (Pixel 9, Android 16, 3 boutons, géométrie d'ANDROIDBAR-3) : le clavier SANS la
// barre système.
const ouvrirLeClavierAndroid = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidShow', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: (2424 - 1657) / 2.625 - mockInsets.bottom,
      screenX: 0,
      screenY: 1657 / 2.625,
      width: 411,
    },
  });
});

/**
 * Le tableau, temps 1, puis « Ajouter un joueur » : la fenêtre et ses 3 champs.
 * @returns {any} L'arbre rendu.
 */
const ouvrirAjouterUnJoueur = () => {
  let arbre = null;
  act(() => {
    arbre = renderer.create(<MultiTeamCompositionBoard routeParams={parametresEdition()} />);
  });
  arbresMontes.push(arbre);
  const [ajouter] = arbre.root.findAll(
    (noeud) => noeud.props?.accessibilityLabel === 'Ajouter un joueur'
      && typeof noeud.props?.onPress === 'function',
  );
  act(() => {
    ajouter.props.onPress();
  });
  return arbre;
};

const laFenetre = (arbre) => arbre.root.findAllByType(Modal)
  .find((fenetre) => fenetre.props.visible && fenetre.findAllByType(TextInput).length === 3);

// Le voile : il CENTRE la carte dans ce qu'il laisse libre ; son retrait bas est ce que le
// clavier rend.
const styleDuVoile = (arbre) => {
  const [voile] = laFenetre(arbre).findAll(
    (noeud) => typeof noeud.type === 'string'
      && (StyleSheet.flatten(noeud.props.style) || {}).backgroundColor === 'rgba(0,0,0,0.8)',
  );
  return StyleSheet.flatten(voile.props.style) || {};
};

// Le bas de la zone où la carte est centrée, à l'écran.
const basDeLaZone = (arbre, ecran) => {
  const style = styleDuVoile(arbre);
  return ecran - (style.paddingBottom ?? style.padding ?? 0);
};

describe('CLAVIER-MODALES — « Ajouter un joueur », iPhone', () => {
  test('la fenêtre s ouvre : Prénom, Nom, Numéro', () => {
    telephone('ios', '18.0', 34);
    const arbre = ouvrirAjouterUnJoueur();

    expect(laFenetre(arbre)).toBeTruthy();
  });

  test.each(IPHONES)('$nom : clavier ouvert, la carte se centre au-dessus', async (iphone) => {
    telephone('ios', '18.0', iphone.barre);
    const arbre = ouvrirAjouterUnJoueur();

    await ouvrirLeClavierIOS(iphone);

    expect(basDeLaZone(arbre, iphone.ecran)).toBe(iphone.ecran - iphone.clavier);
  });

  test.each(IPHONES)('$nom : clavier refermé, la carte revient (0 pt)', async (iphone) => {
    telephone('ios', '18.0', iphone.barre);
    const arbre = ouvrirAjouterUnJoueur();
    await ouvrirLeClavierIOS(iphone);
    await refermerLeClavierIOS(iphone);

    expect(styleDuVoile(arbre).paddingBottom).toBeUndefined();
    expect(basDeLaZone(arbre, iphone.ecran)).toBe(iphone.ecran - 24);
  });

  test('clavier jamais ouvert : le voile garde sa seule marge de 24 (0 pt)', () => {
    telephone('ios', '18.0', 34);
    const arbre = ouvrirAjouterUnJoueur();

    expect(styleDuVoile(arbre).paddingBottom).toBeUndefined();
  });
});

describe('CLAVIER-MODALES — garde Android 15/16 : remontée par Android, pas deux fois', () => {
  test.each([35, 36])('API %s : clavier ouvert, aucun retrait ajouté à la fenêtre', async (api) => {
    telephone('android', api, 48);
    const arbre = ouvrirAjouterUnJoueur();

    await ouvrirLeClavierAndroid();

    expect(styleDuVoile(arbre).paddingBottom).toBeUndefined();
  });

  test('la fenêtre reste NON translucide (c est ce qui fait qu Android la remonte)', () => {
    telephone('android', 36, 48);
    const arbre = ouvrirAjouterUnJoueur();
    const { props } = laFenetre(arbre);

    expect(props.transparent).toBe(true);
    expect(Object.keys(props).filter((cle) => /Translucent$/.test(cle) && props[cle])).toEqual([]);
  });
});
