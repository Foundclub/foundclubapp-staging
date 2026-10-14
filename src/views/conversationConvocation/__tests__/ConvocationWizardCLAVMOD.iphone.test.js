import {
  DeviceEventEmitter, LayoutAnimation, Platform, StyleSheet, Text, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ConvocationWizard from '../ConvocationWizard';

// 📱 CLAVIER-MODALES — l'assistant de convocation est une `<Modal>` plein écran. Sur iPhone, une
// fenêtre `<Modal>` n'évite RIEN : le clavier se pose par-dessus. VU PAR ADEL sur son iPhone
// (TestFlight 2.6.75, 13/10 ~23h) : Messages › fil de l'équipe › « + » › Convocation › étape 4
// « Détails » › toucher « Infos » ⇒ « Envoyer la convocation » est caché par le clavier.
//
// Charges réelles d'iOS (RCTKeyboardObserver) : le clavier ANNONCE son mouvement
// (`keyboardWillShow` / `keyboardWillHide`) avec sa durée et sa courbe ; sa hauteur COMPTE la
// barre d'accueil (le cadre du clavier descend jusqu'au bas de l'écran). Géométrie : iPhone 15
// (852 pt, clavier 336, barre d'accueil 34) et iPhone SE (667 pt, clavier 260, pas de barre) —
// celle du banc d'ANDROIDBAR-4 (`.tmp/portes/ANDROIDBAR/LOT4/banc-assistant.json`).

const IPHONES = [
  {
    barre: 34, clavier: 336, ecran: 852, nom: 'iPhone 15',
  },
  {
    barre: 0, clavier: 260, ecran: 667, nom: 'iPhone SE',
  },
];

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 34, left: 0, right: 0, top: 59,
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
 * @param {number | string} version `Platform.Version`.
 * @param {number} barreDuBas `insets.bottom`.
 */
const telephone = (systeme, version, barreDuBas) => {
  Platform.OS = /** @type {any} */ (systeme);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  mockInsets.bottom = barreDuBas;
};

afterEach(() => {
  // Le clavier de React Native retient son dernier état : on le referme entre deux témoins.
  act(() => {
    DeviceEventEmitter.emit('keyboardWillHide');
    DeviceEventEmitter.emit('keyboardDidHide');
  });
  jest.restoreAllMocks();
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
  mockInsets.bottom = 34;
});

/**
 * La charge d'iOS : le cadre FINAL du clavier, annoncé avant son mouvement.
 * @param {{ clavier: number, ecran: number }} iphone
 * @param {boolean} ouvert
 * @returns {any}
 */
const chargeIOS = (iphone, ouvert) => ({
  duration: 250,
  easing: 'keyboard',
  endCoordinates: {
    height: iphone.clavier,
    screenX: 0,
    screenY: ouvert ? iphone.ecran - iphone.clavier : iphone.ecran,
    width: 393,
  },
  isEventFromThisApp: true,
  startCoordinates: {
    height: iphone.clavier,
    screenX: 0,
    screenY: ouvert ? iphone.ecran : iphone.ecran - iphone.clavier,
    width: 393,
  },
});

/**
 * Le clavier s'ouvre (toucher « Infos ») : iOS annonce, puis confirme.
 * @param {{ clavier: number, ecran: number }} iphone
 * @returns {Promise<void>}
 */
const ouvrirLeClavier = async (iphone) => act(async () => {
  DeviceEventEmitter.emit('keyboardWillShow', chargeIOS(iphone, true));
  DeviceEventEmitter.emit('keyboardDidShow', chargeIOS(iphone, true));
});

/**
 * Le clavier se referme.
 * @param {{ clavier: number, ecran: number }} iphone
 * @returns {Promise<void>}
 */
const refermerLeClavier = async (iphone) => act(async () => {
  DeviceEventEmitter.emit('keyboardWillHide', chargeIOS(iphone, false));
  DeviceEventEmitter.emit('keyboardDidHide', chargeIOS(iphone, false));
});

const parTestId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props.testID === id
    && noeud.type === TouchableOpacity);

const appuyer = (/** @type {any} */ arbre, /** @type {string} */ id) => {
  const [bouton] = parTestId(arbre, id);
  if (!bouton) throw new Error(`bouton introuvable : ${id}`);
  act(() => { bouton.props.onPress(); });
};

/**
 * Le chemin d'Adel : « + » › Convocation (création), l'événement du fil, un joueur, le
 * placement, puis l'étape 4 « Détails ».
 * @returns {any} L'arbre rendu.
 */
const allerAuxDetails = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ConvocationWizard
        chatId="fil-equipe"
        initialEventId="match-samedi"
        onClose={jest.fn()}
        teamId="equipe-seniors"
        teamName="Seniors"
        visible
      />,
    );
  });
  appuyer(arbre, 'convocation-wizard-next');
  appuyer(arbre, 'convocation-check-hugo');
  appuyer(arbre, 'convocation-wizard-next');
  appuyer(arbre, 'convocation-wizard-next');
  return arbre;
};

/**
 * Où s'arrête, à l'écran, le bouton du pied : le bas de la fenêtre, moins ce que la racine
 * laisse en bas, moins la marge basse du pied.
 * @param {any} arbre
 * @param {number} ecran Hauteur de l'écran (pt).
 * @returns {number} y (pt) du bas du bouton.
 */
const basDuBoutonEnvoyer = (arbre, ecran) => {
  const [racine] = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props.testID === 'convocation-wizard'
      && typeof noeud.type === 'string',
  );
  const [envoyer] = parTestId(arbre, 'convocation-wizard-next');
  let pied = envoyer.parent;
  while (pied && typeof pied.type !== 'string') pied = pied.parent;
  const styleDeLaRacine = StyleSheet.flatten(racine.props.style) || {};
  const styleDuPied = StyleSheet.flatten(pied.props.style) || {};
  return ecran - (styleDeLaRacine.paddingBottom || 0) - (styleDuPied.paddingBottom || 0);
};

const retraitDeLaRacine = (/** @type {any} */ arbre) => {
  const [racine] = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props.testID === 'convocation-wizard'
      && typeof noeud.type === 'string',
  );
  return (StyleSheet.flatten(racine.props.style) || {}).paddingBottom || 0;
};

describe('CLAVIER-MODALES — assistant de convocation, étape « Détails », iPhone', () => {
  it('le chemin d Adel mène bien à « Envoyer la convocation », champ « Infos » à l écran', () => {
    telephone('ios', '18.0', 34);
    const arbre = allerAuxDetails();
    expect(arbre.root.findAll(
      (/** @type {any} */ n) => n.props.testID === 'convocation-infos' && n.type === TextInput,
    )).toHaveLength(1);
    const [envoyer] = parTestId(arbre, 'convocation-wizard-next');
    expect(envoyer.findAllByType(Text).map((/** @type {any} */ n) => n.props.children))
      .toContain('conversationConvocation.send');
  });

  it.each(IPHONES)('$nom : clavier ouvert, « Envoyer » reste au-dessus', async (iphone) => {
    telephone('ios', '18.0', iphone.barre);
    const arbre = allerAuxDetails();

    await ouvrirLeClavier(iphone);

    const hautDuClavier = iphone.ecran - iphone.clavier;
    const bas = basDuBoutonEnvoyer(arbre, iphone.ecran);
    expect(bas).toBeLessThanOrEqual(hautDuClavier + 0.01);
    // Pas d'autre trou que la marge que le pied garde déjà sous le bouton (10 pt).
    expect(bas).toBeGreaterThanOrEqual(hautDuClavier - 10.01);
  });

  it.each(IPHONES)('$nom : clavier refermé, le pied revient en bas (0 pt)', async (iphone) => {
    telephone('ios', '18.0', iphone.barre);
    const arbre = allerAuxDetails();
    await ouvrirLeClavier(iphone);
    await refermerLeClavier(iphone);

    expect(retraitDeLaRacine(arbre)).toBe(0);
    expect(basDuBoutonEnvoyer(arbre, iphone.ecran))
      .toBe(iphone.ecran - (Math.max(iphone.barre, 12) + 10));
  });

  it('clavier jamais ouvert : rien ne bouge (0 pt)', () => {
    telephone('ios', '18.0', 34);
    const arbre = allerAuxDetails();
    expect(retraitDeLaRacine(arbre)).toBe(0);
  });

  it('clavier DÉJÀ ouvert à l ouverture de l assistant : évité dès le montage', async () => {
    telephone('ios', '18.0', 34);
    await ouvrirLeClavier(IPHONES[0]);
    const arbre = allerAuxDetails();

    expect(basDuBoutonEnvoyer(arbre, 852)).toBeLessThanOrEqual(852 - 336 + 0.01);
  });

  it('le pied suit la durée et la courbe du clavier d iOS', async () => {
    telephone('ios', '18.0', 34);
    const arbre = allerAuxDetails();
    const animer = jest.spyOn(LayoutAnimation, 'configureNext');

    await ouvrirLeClavier(IPHONES[0]);

    expect(retraitDeLaRacine(arbre)).toBeGreaterThan(0);
    expect(animer).toHaveBeenCalledWith(expect.objectContaining({
      duration: 250,
      update: expect.objectContaining({ duration: 250, type: 'keyboard' }),
    }));
  });
});
