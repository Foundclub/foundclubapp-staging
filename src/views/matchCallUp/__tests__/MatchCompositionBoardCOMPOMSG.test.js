import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getEventConvocation } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';

// ==========================================================================
// COMPOMSG — LE PLEIN ÉCRAN, OUVERT DEPUIS LA MESSAGERIE (23/09).
//
// 🗣️ Adel, captures 1 et 3 : le plein écran (ouvert depuis la carte du fil)
// montrait 8 joueurs sur le terrain, « Tu es convoqué » en montrait 9 pour le
// même match. La carte est une PHOTO prise à la publication : le plateau
// recevait cette photo telle quelle, et une compo republiée depuis restait
// invisible à qui passait par un ancien message.
//
// Et un joueur y lisait « 8/11 placés » — une pastille d'entraîneur (les
// postes encore vides), pas une information de lecteur.
//
// Ce fichier tient trois promesses :
//   1. 🔄 ouvert depuis la carte, le plateau relit la DERNIÈRE version publiée ;
//   2. 🪧 si la carte était dépassée, il le DIT ;
//   3. 👀 un lecteur lit « N titulaires », l'entraîneur garde « N/M placés ».
// ==========================================================================

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

const mockFetchQuery = jest.fn(({ queryFn }) => queryFn());
const mockClientRequeteFige = { fetchQuery: mockFetchQuery, invalidateQueries: jest.fn() };

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequeteFige,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const fabriquerGeste = () => {
    /** @type {any} */
    const geste = {};
    ['activateAfterLongPress', 'minDistance', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']
      .forEach((nom) => { geste[nom] = () => geste; });
    return geste;
  };
  return {
    Gesture: { Pan: fabriquerGeste },
    GestureDetector: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
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
  getEventConvocation: jest.fn(),
  publishEventConvocation: jest.fn(),
  saveEventCompositionDraft: jest.fn(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: jest.fn().mockResolvedValue(null) }),
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

jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
}));

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
 * Aplatit les enfants React en une chaîne, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const texteVisible = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

const joueur = (id, firstname, lastname) => ({ documentId: id, firstname, lastname });
const HUIT = Array.from({ length: 8 }, (_, i) => joueur(`p${i}`, `Prenom${i}`, `Nom${i}`));
const BANC = [joueur('b1', 'Paul', 'Veuillet')];
const NOUVEAU = joueur('j9', 'Jules', 'Nouveau');

const placer = (/** @type {any[]} */ joueurs) => joueurs.map((player, index) => ({
  playerId: player.documentId,
  positionX: 20 + index * 5,
  positionY: 10 + index * 8,
}));

// Ce que la CARTE du fil emporte : la version 1, 8 joueurs placés.
const PARAMETRES_DE_LA_CARTE = {
  canEdit: false,
  eventId: 'evt_1',
  existingComposition: { teams: [{ id: 'team_1', placements: placer(HUIT) }] },
  messageVersion: 1,
  readOnly: true,
  refreshFromServer: true,
  selectedPlayers: [...HUIT, ...BANC],
  sport: 'football',
  startPlacements: placer(HUIT),
  teamId: 'team_1',
  teamName: 'Aix-Perd en Buvette',
};

// Ce que le SERVEUR sait : la version 2, republiée avec un 9e joueur placé.
const convocationServeur = (/** @type {number} */ version) => ({
  branches: [{
    published: {
      reservePlayerIds: ['b1'],
      reserveSnapshotPlayers: BANC,
      snapshotPlayers: [...HUIT, NOUVEAU, ...BANC],
      sportContext: 'football',
      teams: [{ id: 'team_1', placements: placer([...HUIT, NOUVEAU]) }],
      version,
    },
    team: { documentId: 'team_1', name: 'Aix-Perd en Buvette' },
  }],
});

/** @type {any[]} */
const montes = [];

const rendre = async (/** @type {any} */ parametres) => {
  mockRouteParams = parametres;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCompositionBoard />);
  });
  // La relecture est une promesse : on laisse passer son `then`.
  await act(async () => { await Promise.resolve(); });
  montes.push(arbre);
  return arbre;
};

/** @type {any} */
let mesureOrigine;

beforeEach(() => {
  jest.clearAllMocks();
  getEventConvocation.mockReset().mockResolvedValue(convocationServeur(2));
  mesureOrigine = View.prototype.measureInWindow;
  View.prototype.measureInWindow = function mesurerTerrain(/** @type {any} */ rappel) {
    rappel(0, 0, 300, 450);
  };
});

afterEach(async () => {
  await act(async () => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  View.prototype.measureInWindow = mesureOrigine;
});

describe('COMPOMSG · écran 2 — le plein écran relit la DERNIÈRE version publiée', () => {
  test('🥇 ouvert depuis la carte, il demande la convocation au serveur', async () => {
    await rendre(PARAMETRES_DE_LA_CARTE);

    expect(getEventConvocation).toHaveBeenCalledWith('evt_1', 'team_1');
    // Même clef de cache que « Tu es convoqué » et la page de l'événement.
    expect(mockFetchQuery.mock.calls[0][0].queryKey)
      .toEqual(['eventConvocation', 'evt_1', 'team_1']);
  });

  test('🥇 il dessine la version du SERVEUR, pas la photo de la carte', async () => {
    const texte = texteVisible(await rendre(PARAMETRES_DE_LA_CARTE));

    expect(texte).toContain('JETON:Nouveau');
    expect(texte).toContain('9 titulaires');
  });

  test('🪧 et il DIT que la carte était dépassée', async () => {
    const texte = texteVisible(await rendre(PARAMETRES_DE_LA_CARTE));

    expect(texte).toContain('version 2');
  });

  test('🔒 carte à jour : aucun bandeau', async () => {
    getEventConvocation.mockResolvedValue(convocationServeur(1));
    const texte = texteVisible(await rendre(PARAMETRES_DE_LA_CARTE));

    expect(texte).not.toContain('Composition modifiée depuis ce message');
  });

  test('🔒 serveur injoignable : la photo de la carte reste, rien ne casse', async () => {
    getEventConvocation.mockRejectedValue(new Error('réseau coupé'));
    const texte = texteVisible(await rendre(PARAMETRES_DE_LA_CARTE));

    expect(texte).toContain('8 titulaires');
    expect(texte).not.toContain('JETON:Nouveau');
  });

  test('🔒 ouvert d’ailleurs (sans `refreshFromServer`) : aucune requête', async () => {
    await rendre({ ...PARAMETRES_DE_LA_CARTE, refreshFromServer: false });

    expect(getEventConvocation).not.toHaveBeenCalled();
  });
});

describe('COMPOMSG · écran 2 — des pastilles de LECTEUR', () => {
  test('🥇 un lecteur lit « 8 titulaires », pas « 8/11 placés »', async () => {
    const texte = texteVisible(await rendre({
      ...PARAMETRES_DE_LA_CARTE, refreshFromServer: false,
    }));

    expect(texte).toContain('8 titulaires');
    expect(texte).not.toContain('placés');
    expect(texte).toContain('Banc 1');
  });

  test('🔒 l’entraîneur (canEdit) garde sa pastille de postes', async () => {
    const texte = texteVisible(await rendre({
      ...PARAMETRES_DE_LA_CARTE, canEdit: true, refreshFromServer: false,
    }));

    expect(texte).toContain('8/11 placés');
  });
});
