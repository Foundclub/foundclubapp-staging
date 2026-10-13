import {
  DeviceEventEmitter, Platform, StyleSheet, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ConvocationWizard from '../ConvocationWizard';

// 🤖 ANDROIDBAR-4 — l'assistant de convocation vit dans une `<Modal statusBarTranslucent>`
// plein écran : sur Android 15 et 16 (bord à bord imposé), rien ne la remonte au-dessus du
// clavier — ni `adjustResize` (mort en bord à bord), ni le cadre de React Native (pas de
// `fitsSystemWindows` quand la barre d'état est translucide, `ReactModalHostView.kt`). Mesuré
// par ANDROIDBAR-2 : une fenêtre translucide descend sous la barre d'Android.
// Le clavier recouvrait donc le pied « Suivant / Publier » et le bas des champs.
//
// Chaque événement porte la charge qu'Android envoie réellement (ReactRootView.java), avec la
// géométrie mesurée à l'émulateur par ANDROIDBAR-3 (Pixel 9, Android 16, 3 boutons).

const DENSITE = 2.625;
const ECRAN = 2424 / DENSITE;
const BARRE_ETAT = 142 / DENSITE;
const HAUT_DU_CLAVIER = 1657 / DENSITE;

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 48, left: 0, right: 0, top: BARRE_ETAT,
};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'coach-1', firstname: 'Coach' } }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendMessage: jest.fn(() => 'temp-1') }),
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
}));

jest.mock('@/domains/refresh/afterAction', () => ({
  invalidateAfterAction: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({
  __esModule: true,
  default: () => null,
  SvgIcon: () => null,
}));

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/molecules/eventCard/EventCardNew', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChatMessages: () => ({ data: { pages: [{ data: [] }] } }),
}));

jest.mock('@/services/chat/chatService', () => ({
  createChatMessage: jest.fn(() => Promise.resolve({})),
}));

const mockMatch = {
  date: '2026-10-10T13:00:00.000Z',
  documentId: 'match-samedi',
  name: 'Match vs US Pelican',
  team: { activities: [{ name: 'Football' }], documentId: 'equipe-seniors' },
  type: { name: 'Match' },
};

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvents: () => ({ data: { pages: [{ data: [mockMatch] }] }, isFetching: false }),
  useGetEventTeamComposition: () => ({
    data: {
      eligiblePlayers: [{ documentId: 'hugo', firstname: 'Hugo', lastname: 'Martin' }],
      published: null,
      responses: null,
      rsvpEnabled: true,
    },
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/event/eventService', () => ({
  publishEventConvocation: jest.fn(() => Promise.resolve({})),
  saveEventCompositionDraft: jest.fn(() => Promise.resolve({})),
}));

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

/**
 * Joue un téléphone : son système, sa version et sa barre du bas.
 * @param {'ios' | 'android'} systeme
 * @param {number | string} version `Platform.Version` (35 = Android 15).
 * @param {number} barreDuBas `insets.bottom` (48 = 3 boutons, 24 = gestes, 34 = iPhone).
 */
const telephone = (systeme, version, barreDuBas) => {
  Platform.OS = /** @type {any} */ (systeme);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  mockInsets.bottom = barreDuBas;
};

afterEach(() => {
  // Le clavier de React Native retient son dernier état : on le referme entre deux témoins.
  act(() => {
    DeviceEventEmitter.emit('keyboardDidHide');
  });
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
  mockInsets.bottom = 48;
});

/**
 * Clavier ouvert : la charge d'Android 11+ (clavier SANS la barre système).
 * @returns {Promise<void>}
 */
const ouvrirLeClavier = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidShow', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: (ECRAN - HAUT_DU_CLAVIER) - mockInsets.bottom,
      screenX: 0,
      screenY: HAUT_DU_CLAVIER,
      width: 411,
    },
  });
});

/**
 * Clavier refermé : Android envoie la hauteur VISIBLE comme haut du clavier.
 * @returns {Promise<void>}
 */
const refermerLeClavier = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidHide', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: 0, screenX: 0, screenY: ECRAN - mockInsets.bottom - BARRE_ETAT, width: 411,
    },
  });
});

/**
 * Ouvre l'assistant à l'étape « Joueurs », formulaire « Ajouter un joueur » ouvert (2 champs).
 * @returns {any} L'arbre rendu.
 */
const ouvrirLAssistant = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ConvocationWizard
        chatId="fil-equipe"
        initialEventId="match-samedi"
        mode="edit"
        onClose={jest.fn()}
        startStep={2}
        teamId="equipe-seniors"
        teamName="Seniors"
        visible
      />,
    );
  });
  const [ajouter] = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props.testID === 'convocation-add-player'
      && noeud.type === TouchableOpacity,
  );
  act(() => { ajouter.props.onPress(); });
  return arbre;
};

/**
 * Où s'arrêtent, à l'écran, les boutons du pied : le bas de la fenêtre, moins ce que la racine
 * laisse en bas, moins la marge basse du pied.
 * @param {any} arbre
 * @returns {number} y (dp) du bas des boutons du pied.
 */
const basDesBoutonsDuPied = (arbre) => {
  const [racine] = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props.testID === 'convocation-wizard'
      && typeof noeud.type === 'string',
  );
  const [suivant] = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props.testID === 'convocation-wizard-next'
      && noeud.type === TouchableOpacity,
  );
  const styleDeLaRacine = StyleSheet.flatten(racine.props.style) || {};
  // Le pied : le parent du bouton « Suivant ».
  let pied = suivant.parent;
  while (pied && typeof pied.type !== 'string') pied = pied.parent;
  const styleDuPied = StyleSheet.flatten(pied.props.style) || {};
  return ECRAN - (styleDeLaRacine.paddingBottom || 0) - (styleDuPied.paddingBottom || 0);
};

const retraitDeLaRacine = (/** @type {any} */ arbre) => {
  const [racine] = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props.testID === 'convocation-wizard'
      && typeof noeud.type === 'string',
  );
  return (StyleSheet.flatten(racine.props.style) || {}).paddingBottom || 0;
};

describe('ANDROIDBAR-4 — assistant de convocation : Android 15 et 16, clavier ouvert', () => {
  it.each([
    [35, 48, '3 boutons'],
    [36, 48, '3 boutons'],
    [35, 24, 'gestes'],
    [36, 24, 'gestes'],
  ])('API %s, barre %s dp (%s) : le pied reste au-dessus du clavier', async (api, barre) => {
    telephone('android', api, barre);
    const arbre = ouvrirLAssistant();
    expect(arbre.root.findAllByType(TextInput).length).toBeGreaterThanOrEqual(2);

    await ouvrirLeClavier();

    // Les boutons s'arrêtent au-dessus du haut du clavier, sans trou plus grand que la marge
    // que le pied garde déjà sous eux (10 dp).
    const bas = basDesBoutonsDuPied(arbre);
    expect(bas).toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.01);
    expect(bas).toBeGreaterThanOrEqual(HAUT_DU_CLAVIER - 10.01);
  });

  it('API 36 : clavier REFERMÉ, plus aucun retrait (aucun vide sous le pied)', async () => {
    telephone('android', 36, 48);
    const arbre = ouvrirLAssistant();
    await ouvrirLeClavier();
    await refermerLeClavier();

    expect(retraitDeLaRacine(arbre)).toBe(0);
    expect(basDesBoutonsDuPied(arbre)).toBeCloseTo(ECRAN - (48 + 10), 5);
  });

  it('API 35 : clavier DÉJÀ ouvert à l ouverture, évité dès le montage', async () => {
    telephone('android', 35, 48);
    await ouvrirLeClavier();
    const arbre = ouvrirLAssistant();

    expect(basDesBoutonsDuPied(arbre)).toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.01);
  });
});

describe('ANDROIDBAR-4 — caractérisation : iPhone et Android ≤ 14 ne bougent pas', () => {
  it('iPhone : aucun retrait, clavier fermé comme ouvert (pied : barre + 10)', async () => {
    telephone('ios', '18.0', 34);
    const arbre = ouvrirLAssistant();
    expect(retraitDeLaRacine(arbre)).toBe(0);

    await act(async () => {
      DeviceEventEmitter.emit('keyboardWillShow', {
        duration: 0,
        easing: 'keyboard',
        endCoordinates: {
          height: 336, screenX: 0, screenY: 852 - 336, width: 393,
        },
      });
    });
    expect(retraitDeLaRacine(arbre)).toBe(0);
  });

  it.each([30, 34])('Android API %s : aucun retrait (la fenêtre rétrécit seule)', async (api) => {
    telephone('android', api, 0);
    const arbre = ouvrirLAssistant();
    await ouvrirLeClavier();

    expect(retraitDeLaRacine(arbre)).toBe(0);
  });
});
