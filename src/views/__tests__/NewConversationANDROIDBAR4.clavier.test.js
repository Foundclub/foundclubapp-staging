import { HeaderHeightContext } from '@react-navigation/elements';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  DeviceEventEmitter, ImageBackground, KeyboardAvoidingView, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NewConversation from '../NewConversation';

// 🤖 ANDROIDBAR-4 — « Nouveau groupe » : le champ du nom s'ouvre clavier sorti (`autoFocus`), et
// la barre « Créer le groupe » est posée en bas d'un ScreenContainer SANS évitement du
// clavier. Sur Android 15/16 (bord à bord, `adjustResize` mort) comme sur iPhone, rien ne la
// remontait : le clavier la recouvrait. Android ≤ 14 rétrécissait la fenêtre : rien à voir.
//
// Monté avec le VRAI ScreenContainer ; charges réelles d'Android et d'iOS, géométrie mesurée à
// l'émulateur par ANDROIDBAR-3 (Pixel 9, Android 16).

const DENSITE = 2.625;
const ECRAN = 2424 / DENSITE;
const BARRE_ETAT = 142 / DENSITE;
const HAUT_DU_CLAVIER = 1657 / DENSITE;
const CLAVIER = ECRAN - HAUT_DU_CLAVIER - 48;

const MEMBRES = [
  {
    documentId: 'karim', firstname: 'Karim', lastname: 'Benali', role: { name: 'Entraîneur' },
  },
  {
    documentId: 'lea', firstname: 'Lea', lastname: 'Morel', role: { name: 'Joueur' },
  },
];

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 48, left: 0, right: 0, top: BARRE_ETAT,
};
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(0),
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@/navigation/commonOptions', () => ({
  getFloatingTabBarScenePaddingBottom: () => 134,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const gabarit = typeof repli === 'string' ? repli : repli?.defaultValue;
      if (typeof gabarit !== 'string') return cle;
      const v = (typeof repli === 'object' ? repli : valeurs) || {};
      return gabarit.replace(/\{\{(\w+)\}\}/g, (_m, nom) => (
        v[nom] !== undefined ? String(v[nom]) : _m
      ));
    },
  }),
}));
jest.mock('i18next', () => ({
  t: (/** @type {string} */ _cle, /** @type {any} */ repli) => (
    typeof repli === 'string' ? repli : _cle
  ),
}));
jest.mock('react-native-svg', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    Circle: VueRN,
    default: VueRN,
    Line: VueRN,
    Path: VueRN,
    Polyline: VueRN,
    Rect: VueRN,
    Svg: VueRN,
  };
});
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    allMyTeams: [],
    clubVerificationSummary: null,
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'moi',
      firstname: 'Adel',
      role: { name: 'Dirigeant' },
    },
  }),
}));
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    addGroupMembers: jest.fn(),
    startGroupChat: jest.fn(),
    startWhisperChat: jest.fn(),
  }),
}));
jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
}));
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: () => Promise.resolve({ data: MEMBRES }) },
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatById: () => ({ data: { participants: [] } }),
}));
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/atoms/loader/Loader', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);

/**
 * @typedef {object} Telephone
 * @property {'ios' | 'android'} os
 * @property {number | string} version
 * @property {number} haut
 * @property {number} bas
 * @property {number} entete Hauteur de l'en-tête de la pile.
 * @property {number} fenetre Hauteur de la fenêtre, clavier fermé.
 * @property {number} fenetreClavierOuvert Android ≤ 14 : `adjustResize` la rétrécit.
 * @property {number} hautDuClavier Haut du clavier, coordonnées de la vue racine.
 * @property {any} ouverture
 * @property {any} fermeture
 */

/**
 * Android 15/16, bord à bord.
 * @param {number} version
 * @param {number} barreDuBas
 * @returns {Telephone}
 */
const androidBordABord = (version, barreDuBas) => ({
  bas: barreDuBas,
  entete: 56 + BARRE_ETAT,
  fenetre: ECRAN,
  fenetreClavierOuvert: ECRAN,
  fermeture: {
    height: 0, screenX: 0, screenY: ECRAN - barreDuBas - BARRE_ETAT, width: 411,
  },
  haut: BARRE_ETAT,
  hautDuClavier: ECRAN - CLAVIER - barreDuBas,
  os: 'android',
  ouverture: {
    height: CLAVIER, screenX: 0, screenY: ECRAN - CLAVIER - barreDuBas, width: 411,
  },
  version,
});

/** Android ≤ 14 : barre d'état opaque (24 dp), 3 boutons, `adjustResize`. */
const ANDROID_14 = /** @type {Telephone} */ ({
  bas: 0,
  entete: 56,
  fenetre: ECRAN - 24 - 48,
  fenetreClavierOuvert: HAUT_DU_CLAVIER - 24,
  fermeture: {
    height: 0, screenX: 0, screenY: ECRAN - 24 - 48, width: 411,
  },
  haut: 0,
  hautDuClavier: HAUT_DU_CLAVIER - 24,
  os: 'android',
  ouverture: {
    height: CLAVIER, screenX: 0, screenY: HAUT_DU_CLAVIER, width: 411,
  },
  version: 34,
});

/** iPhone 15 : écran 852, clavier 336. */
const IPHONE_15 = /** @type {Telephone} */ ({
  bas: 34,
  entete: 44 + 59,
  fenetre: 852,
  fenetreClavierOuvert: 852,
  fermeture: {
    height: 0, screenX: 0, screenY: 852, width: 393,
  },
  haut: 59,
  hautDuClavier: 852 - 336,
  os: 'ios',
  ouverture: {
    height: 336, screenX: 0, screenY: 852 - 336, width: 393,
  },
  version: '18.0',
});

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

afterEach(() => {
  act(() => {
    DeviceEventEmitter.emit('keyboardDidHide');
    DeviceEventEmitter.emit('keyboardWillHide');
  });
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
});

const texteDe = (/** @type {any} */ noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [n.props.children].flat().join(''))
  .join(' ');

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ motif) => {
  const trouves = arbre.root
    .findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ n) => texteDe(n).includes(motif));
  const cible = trouves[trouves.length - 1];
  if (!cible) throw new Error(`Aucun bouton « ${motif} »`);
  await act(async () => {
    await cible.props.onPress();
  });
};

const lire = (/** @type {any} */ s, /** @type {'Top' | 'Bottom'} */ cote) => (
  s[`padding${cote}`] ?? s.paddingVertical ?? s.padding ?? 0
);

/**
 * Ouvre « Nouveau groupe » (2 membres choisis, « Suivant ») sur un téléphone, puis joue
 * ouverture et fermeture du clavier.
 * @param {Telephone} tel
 * @returns {Promise<{ ferme: number, ouvert: number, referme: number }>} y (dp) du bas du
 *   bouton « Créer le groupe », coordonnées de la vue racine.
 */
const jouer = async (tel) => {
  Platform.OS = /** @type {any} */ (tel.os);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => tel.version });
  mockInsets.top = tel.haut;
  mockInsets.bottom = tel.bas;
  let { fenetre } = tel;

  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <HeaderHeightContext.Provider value={tel.entete}>
          <NewConversation
            navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() }}
            route={{ params: {} }}
          />
        </HeaderHeightContext.Provider>
      </QueryClientProvider>,
    );
  });
  for (let tour = 0; tour < 50 && !texteDe(arbre.root).includes('Benali'); tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((fin) => {
        setTimeout(fin, 10);
      });
    });
  }
  await appuyer(arbre, 'Karim Benali');
  await appuyer(arbre, 'Lea Morel');
  await appuyer(arbre, 'Suivant');
  // Le champ du nom est là, clavier demandé dès l'arrivée.
  const [champ] = arbre.root.findAll(
    (/** @type {any} */ n) => n.props.testID === 'nouveau-groupe-nom' && n.type === TextInput,
  );
  expect(champ.props.autoFocus).toBe(true);

  const basDuBouton = () => {
    const [bouton] = arbre.root.findAll(
      (/** @type {any} */ n) => n.props.testID === 'nouveau-groupe-creer'
        && n.type === TouchableOpacity,
    );
    let barre = bouton.parent;
    while (typeof barre.type !== 'string') barre = barre.parent;
    // Les vues hôtes du fond de l'écran jusqu'au parent de la barre, de l'extérieur vers
    // l'intérieur : chacune part du haut de son parent et le remplit, sauf hauteur imposée.
    const vues = [];
    let noeud = barre.parent;
    while (noeud && noeud.type !== ImageBackground) {
      if (typeof noeud.type === 'string') vues.unshift(noeud);
      noeud = noeud.parent;
    }
    let haut = 0;
    let bas = fenetre;
    vues.forEach((vue) => {
      const style = StyleSheet.flatten(vue.props.style) || {};
      if (style.height !== undefined) bas = haut + style.height;
      haut += lire(style, 'Top');
      bas -= lire(style, 'Bottom');
    });
    const styleDeLaBarre = StyleSheet.flatten(barre.props.style) || {};
    return bas - (styleDeLaBarre.marginBottom || 0) - (styleDeLaBarre.paddingBottom || 0);
  };

  const vider = () => act(async () => {
    await new Promise((fin) => { setImmediate(fin); });
  });

  // L'évitement du conteneur (iPhone, Android ≤ 14) part sous l'en-tête, à l'écran 0.
  const mesurer = async () => {
    const [evitement] = arbre.root.findAllByType(KeyboardAvoidingView);
    if (evitement) {
      const vue = evitement.findAllByType(View)[0];
      const style = StyleSheet.flatten(vue.props.style) || {};
      await act(async () => {
        // eslint-disable-next-line no-underscore-dangle
        await evitement.instance._onLayout({
          nativeEvent: {
            layout: {
              height: style.height === undefined ? fenetre - tel.entete - tel.bas : style.height,
              width: 411,
              x: 0,
              y: tel.entete,
            },
          },
          persist: () => {},
        });
      });
    }
    await vider();
  };

  const evenement = async (/** @type {'Show' | 'Hide'} */ sens, /** @type {any} */ charge) => {
    await act(async () => {
      DeviceEventEmitter.emit(`keyboard${tel.os === 'ios' ? 'Will' : 'Did'}${sens}`, {
        duration: 0,
        easing: 'keyboard',
        endCoordinates: charge,
      });
    });
    await vider();
  };

  await mesurer();
  const ferme = basDuBouton();

  fenetre = tel.fenetreClavierOuvert;
  await mesurer();
  await evenement('Show', tel.ouverture);
  await mesurer();
  await mesurer();
  const ouvert = basDuBouton();

  fenetre = tel.fenetre;
  await mesurer();
  await evenement('Hide', tel.fermeture);
  await mesurer();
  await mesurer();
  const referme = basDuBouton();

  act(() => arbre.unmount());
  client.clear();
  return { ferme, ouvert, referme };
};

// La barre garde 34 dp sous le bouton : c'est le seul trou permis au-dessus du clavier.
const MARGE_DE_LA_BARRE = 34;

describe('ANDROIDBAR-4 — « Créer le groupe » reste au-dessus du clavier', () => {
  it.each([
    ['Android 16, 3 boutons', androidBordABord(36, 48)],
    ['Android 15, gestes', androidBordABord(35, 24)],
    ['iPhone 15', IPHONE_15],
  ])('%s : clavier ouvert, le bouton est au-dessus ; refermé, aucun vide', async (_nom, tel) => {
    const mesure = await jouer(/** @type {Telephone} */ (tel));

    expect(mesure.ouvert).toBeLessThanOrEqual(tel.hautDuClavier + 0.01);
    expect(tel.hautDuClavier - mesure.ouvert).toBeLessThanOrEqual(MARGE_DE_LA_BARRE + 0.01);
    expect(mesure.referme).toBeCloseTo(mesure.ferme, 5);
  });
});

describe('ANDROIDBAR-4 — caractérisation : Android ≤ 14 ne bouge pas', () => {
  it('Android 14 : la fenêtre rétrécit, bouton au-dessus ; refermé, aucun vide', async () => {
    const mesure = await jouer(ANDROID_14);

    expect(mesure.ferme).toBeCloseTo(ANDROID_14.fenetre - MARGE_DE_LA_BARRE, 5);
    expect(mesure.ouvert).toBeCloseTo(ANDROID_14.hautDuClavier - MARGE_DE_LA_BARRE, 5);
    expect(mesure.referme).toBeCloseTo(mesure.ferme, 5);
  });
});
