import { QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  resetGuidanceRuntimeForTests,
  subscribeToGuidanceSignals,
} from '@/domains/guidance/guidanceRuntime';
import { exampleMatch } from '@/domains/tour/tourExamples';

import { publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';

// GUIDE-BONUS (L5, 28/10) — audit du guide Entraîneur, captures 61 et 64 : après
// la clôture, la feuille « Publier la compo ? » du match d'exemple restait ouverte
// sur l'accueil, avec « Publier la convocation ». Règle 2 du pack tutoriels : les
// données fictives ne touchent JAMAIS l'API, même guide fini, même feuille
// ouverte (ici : aucun `TourProvider`, le guide n'existe plus). Et « Publier »
// sans aucun joueur placé ne faisait rien, sans un mot.

const mockNavigate = jest.fn();
const mockPopTo = jest.fn();
const mockGoBack = jest.fn();
const mockStartTeamChat = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockAlert;
/** @type {any} */
let mockClientDeTest = null;

const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  popTo: mockPopTo,
};

jest.mock('@tanstack/react-query', () => {
  const reel = jest.requireActual('@tanstack/react-query');
  return { ...reel, useQueryClient: () => mockClientDeTest };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle) => cle,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const fabriquerGeste = () => {
    /** @type {any} */
    const geste = { rappels: {} };
    ['activateAfterLongPress', 'minDistance'].forEach((nom) => {
      geste[nom] = () => geste;
    });
    ['onStart', 'onUpdate', 'onEnd', 'onFinalize'].forEach((nom) => {
      geste[nom] = (/** @type {any} */ fn) => { geste.rappels[nom] = fn; return geste; };
    });
    return geste;
  };

  return {
    Gesture: { Pan: fabriquerGeste },
    GestureDetector: (/** @type {any} */ { children, gesture }) => (
      <VueRN gesture={gesture}>{children}</VueRN>
    ),
    GestureHandlerRootView: VueRN,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View: VueRN },
    runOnJS: (/** @type {any} */ fn) => fn,
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ valeur) => ({ value: valeur }),
    withSpring: (/** @type {any} */ valeur) => valeur,
    withTiming: (/** @type {any} */ valeur) => valeur,
  };
});

jest.mock('@/services/event/eventService', () => ({
  publishEventConvocation: jest.fn(),
  saveEventCompositionDraft: jest.fn(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: mockStartTeamChat }),
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
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (
      isVisible ? (
        <VueRN>
          {children}
          {footerComponent}
        </VueRN>
      ) : null
    ),
  };
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { isVisible }) => (
      isVisible ? <TexteRN>FEUILLE_OFFRE</TexteRN> : null
    ),
  };
});

jest.mock('@/components/tactical/DraggableToken', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { player }) => <TexteRN>{`JETON:${player?.lastname}`}</TexteRN>,
    GHOST_TOKEN_SIZE: jest.requireActual('@/components/tactical/DraggableToken').GHOST_TOKEN_SIZE,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants Le noeud de depart.
 * @returns {string} Le texte concatene.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Appuie sur l element le plus profond dont le texte contient ce libelle.
 * @param {any} arbre L arbre rendu.
 * @param {string} libelle Le texte cherche.
 * @returns {Promise<number>} Le temps rendu a l utilisateur, en millisecondes.
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes(libelle))
    .pop();
  expect(cible).toBeDefined();
  const debut = Date.now();
  await act(async () => { await cible.props.onPress(); });
  return Date.now() - debut;
};

beforeEach(() => {
  resetGuidanceRuntimeForTests();
  mockClientDeTest = new QueryClient();
  jest.clearAllMocks();
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  mockAlert.mockRestore();
});

/**
 * Monte le terrain du match d'exemple, avec ou sans joueurs placés.
 * @param {number} places Nombre de titulaires posés sur le terrain.
 * @returns {Promise<any>} L'arbre rendu.
 */
const monterExemple = async (places) => {
  const exemple = exampleMatch({ userData: { preferredSport: 'football' } });
  mockRouteParams = {
    ...exemple,
    selectedPlayers: exemple.players.slice(0, 11),
    startPlacements: exemple.players.slice(0, places).map((player, index) => ({
      playerId: player.documentId,
      positionX: 50,
      positionY: 10 + index,
      slotId: `exemple:slot_${index + 1}`,
    })),
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCompositionBoard />);
  });
  return arbre;
};

/**
 * La feuille « Publier la compo ? » est-elle rendue ?
 * @param {any} arbre L'arbre rendu.
 * @returns {boolean} Vrai si son titre est à l'écran.
 */
const feuilleOuverte = (arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.children === 'matchComposition.sheet.title')
  .length > 0;

it('feuille ouverte, guide fini : « Publier la convocation » puis « Enregistrer » = 0 appel au '
  + 'service, 0 requête', async () => {
  const fetchEspion = jest.spyOn(global, 'fetch').mockImplementation(() => Promise.reject());
  const arbre = await monterExemple(11);

  await appuyerSur(arbre, 'matchComposition.board.actions.publish');
  expect(feuilleOuverte(arbre)).toBe(true);
  await appuyerSur(arbre, 'matchComposition.sheet.actions.publish');
  await appuyerSur(arbre, 'matchComposition.board.actions.publish');
  await appuyerSur(arbre, 'matchComposition.board.actions.save');

  expect(publishEventConvocation).toHaveBeenCalledTimes(0);
  expect(saveEventCompositionDraft).toHaveBeenCalledTimes(0);
  expect(mockStartTeamChat).toHaveBeenCalledTimes(0);
  expect(fetchEspion).toHaveBeenCalledTimes(0);
  expect(mockClientDeTest.getQueryCache().getAll()).toHaveLength(0);
  expect(mockClientDeTest.getMutationCache().getAll()).toHaveLength(0);
  expect(mockPopTo).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();

  fetchEspion.mockRestore();
  act(() => arbre.unmount());
});

it('« Publier » sans joueur placé : un message le dit, la feuille ne s’ouvre pas', async () => {
  const signaux = [];
  const desabonner = subscribeToGuidanceSignals((signal) => signaux.push(signal));
  const arbre = await monterExemple(0);

  await appuyerSur(arbre, 'matchComposition.board.actions.publish');

  expect(feuilleOuverte(arbre)).toBe(false);
  expect(mockAlert).toHaveBeenCalledTimes(1);
  expect(mockAlert.mock.calls[0][1]).toBe('tourExamples.match.nonePlaced');
  expect(signaux.filter((signal) => signal.kind === 'action')).toEqual([]);
  expect(publishEventConvocation).toHaveBeenCalledTimes(0);

  desabonner();
  act(() => arbre.unmount());
});
