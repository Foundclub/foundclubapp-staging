import { Alert, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';

// T01 — LES DEUX DEFAUTS CONSTATES SUR IPHONE LE 2026-08-17.
//
// Ce fichier est SEPARE de `MatchCompositionBoard.test.js` pour une raison
// mecanique, pas par gout : ce voisin double `runOnJS` par l'IDENTITE
// (`runOnJS: (fn) => fn`), ce qui execute le rappel TOUT DE SUITE, sur place.
// C'est precisement ce qui n'arrive JAMAIS sur un telephone — `runOnJS` fait
// passer du fil UI au fil JS — et c'est pour ca qu'aucun test n'a pu voir le
// defaut 1. Ici, `runOnJS` DIFFERE, comme dans la vraie vie.
//
//   1. L'apercu du jeton doit suivre le doigt SANS dependre du fil JS.
//   2. Publier doit mener au fil de l'equipe, pas a l'evenement.
//   3. Apres publication, le retour ne doit pas ramener sur l'ecran de
//      publication.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockPopTo = jest.fn();
const mockStartTeamChat = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockAlert;

const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  popTo: mockPopTo,
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

// 🧵 LE COEUR DU TEMOIN 1 : le fil JS est OCCUPE.
// `runOnJS` n'execute rien — il empile. `viderLeFilJs()` decide QUAND le fil JS
// se libere. Un doigt qui glisse pendant que le fil JS est pris doit quand meme
// etre suivi par l'apercu : c'est tout l'interet du fil UI.
// 📌 L'objet est prefixe `mock` : c'est la seule forme que le hoisting de
// `jest.mock` accepte pour une variable de module.
/** @type {{ enAttente: Array<() => void> }} */
const mockFilJs = { enAttente: [] };
const viderLeFilJs = () => {
  mockFilJs.enAttente.splice(0).forEach((appel) => appel());
};

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
    // Le vrai `runOnJS` traverse les fils. On le rend fidele : il EMPILE.
    runOnJS: (/** @type {any} */ fn) => (/** @type {any[]} */ ...args) => {
      mockFilJs.enAttente.push(() => fn(...args));
    },
    // Evalue pour de vrai : c'est la seule facon de LIRE la position de l'apercu.
    useAnimatedStyle: (/** @type {any} */ fn) => fn(),
    // 🧨 La valeur partagee SURVIT aux rendus — c'est tout le principe, et un
    // double qui en refabrique une a chaque rendu perdrait justement ce que le
    // doigt vient d'y ecrire.
    useSharedValue: (/** @type {any} */ valeur) => {
      const React = jest.requireActual('react');
      const boite = React.useRef(null);
      if (!boite.current) boite.current = { value: valeur };
      return boite.current;
    },
    withSpring: (/** @type {any} */ valeur) => valeur,
    withTiming: (/** @type {any} */ valeur) => valeur,
  };
});

jest.mock('@/services/event/eventService', () => ({
  publishEventConvocation: jest.fn(),
  saveEventCompositionDraft: jest.fn(),
}));

// Le fil de l'equipe se trouve par le helper partage du depot (celui que
// `TeamDetails` emploie deja) : il cherche le fil existant AVANT d'en creer un.
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

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/tactical/DraggableToken', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { player }) => <TexteRN>{`JETON:${player?.lastname}`}</TexteRN>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}><TexteRN>{title}</TexteRN></TouchableOpacity>
    ),
  };
});

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Appuie sur l'element le plus profond dont le texte contient ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes(libelle))
    .pop();
  await act(async () => { await cible.props.onPress(); });
};

/**
 * Le geste attache au jeton de ce joueur.
 * @param {any} arbre
 * @param {string} nom
 * @returns {any}
 */
const gesteDuJeton = (arbre, nom) => {
  const jeton = arbre.root.findAll((/** @type {any} */ noeud) => noeud.type === Text
    && aplatirTexte(noeud.props.children) === `JETON:${nom}`)[0];
  let courant = jeton;
  while (courant && !courant.props?.gesture) courant = courant.parent;
  return courant.props.gesture;
};

/**
 * LA POSITION DESSINEE de l'apercu, telle que l'ecran la rend.
 *
 * L'apercu se reconnait a son `zIndex` : il est pose par-dessus tout le reste.
 * On lit ses `translateX`/`translateY`, c'est-a-dire l'endroit ou l'utilisateur
 * le VOIT — pas la variable qui est censee le piloter.
 * @param {any} arbre
 * @returns {{ x: number, y: number } | null}
 */
const positionDessineeDeLApercu = (arbre) => {
  const noeuds = arbre.root.findAll((/** @type {any} */ noeud) => {
    if (noeud.type !== View) return false;
    const styles = [noeud.props?.style].flat(3).filter(Boolean);
    return styles.some((/** @type {any} */ style) => style?.zIndex === 9999);
  });
  if (noeuds.length === 0) return null;

  const styles = [noeuds[0].props?.style].flat(3).filter(Boolean);
  const transformations = styles.flatMap(
    (/** @type {any} */ style) => (Array.isArray(style?.transform) ? style.transform : []),
  );
  const lire = (/** @type {string} */ nom) => transformations
    .filter((/** @type {any} */ etape) => etape && etape[nom] !== undefined)
    .map((/** @type {any} */ etape) => Number(etape[nom]))
    .pop();

  return { x: lire('translateX') ?? 0, y: lire('translateY') ?? 0 };
};

const joueur = (id, firstname, lastname) => ({ documentId: id, firstname, lastname });
const ONZE = Array.from({ length: 11 }, (_, i) => joueur(`p${i}`, `Prenom${i}`, `Nom${i}`));
const DOUZE = [...ONZE, joueur('p11', 'Douzieme', 'Remplacant')];

const RECT_TERRAIN = {
  height: 450, width: 300, x: 0, y: 0,
};
const CENTRE_TERRAIN = { x: 150, y: 225 };

const placementsDeDepart = ONZE.map((player, index) => ({
  playerId: player.documentId,
  positionX: 50,
  positionY: 10 + index,
  slotId: `team_1:slot_${index + 1}`,
}));

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = {
    eventId: 'evt_1',
    selectedPlayers: DOUZE,
    sport: 'football',
    startPlacements: placementsDeDepart,
    teamId: 'team_1',
    teamName: 'Senior 1',
    ...parametres,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCompositionBoard />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/** @type {any} */
let mesureOrigine;

beforeEach(() => {
  mockFilJs.enAttente = [];
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockPopTo.mockClear();
  mockStartTeamChat.mockReset().mockResolvedValue({ documentId: 'chat_equipe_1' });
  saveEventCompositionDraft.mockReset().mockResolvedValue({});
  publishEventConvocation.mockReset().mockResolvedValue({});
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  mesureOrigine = View.prototype.measureInWindow;
  View.prototype.measureInWindow = function mesurerTerrain(/** @type {any} */ rappel) {
    rappel(RECT_TERRAIN.x, RECT_TERRAIN.y, RECT_TERRAIN.width, RECT_TERRAIN.height);
  };
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  mockAlert.mockRestore();
  View.prototype.measureInWindow = mesureOrigine;
});

describe('T01 defaut 1 — l apercu du jeton suit la position du doigt', () => {
  test('🥇 LE TEMOIN : le doigt bouge, l apercu se dessine au meme endroit', async () => {
    const arbre = await rendre();
    const geste = gesteDuJeton(arbre, 'Remplacant');

    // Le doigt part, puis glisse jusqu'au centre du terrain. Le fil JS reste
    // OCCUPE tout du long : on ne le vide pas.
    await act(async () => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      geste.rappels.onUpdate({ absoluteX: CENTRE_TERRAIN.x, absoluteY: CENTRE_TERRAIN.y });
      arbre.update(<MatchCompositionBoard />);
    });

    const apercu = positionDessineeDeLApercu(arbre);

    // Le jeton fait 64 de cote : son coin est a la moitie du jeton du doigt,
    // c'est ce qui met le doigt AU CENTRE de l'apercu.
    expect(apercu).not.toBeNull();
    expect(apercu.x).toBe(CENTRE_TERRAIN.x - 32);
    expect(apercu.y).toBe(CENTRE_TERRAIN.y - 32);
  });

  test('l apercu ne reste PAS colle au coin en haut a gauche pendant le glissement', async () => {
    const arbre = await rendre();
    const geste = gesteDuJeton(arbre, 'Remplacant');

    await act(async () => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      geste.rappels.onUpdate({ absoluteX: 220, absoluteY: 300 });
      arbre.update(<MatchCompositionBoard />);
    });

    const apercu = positionDessineeDeLApercu(arbre);

    // (0, 0) = le coin en haut a gauche, exactement ce qu'Adel a vu sur iPhone.
    expect(apercu).not.toBeNull();
    expect([apercu.x, apercu.y]).not.toEqual([0, 0]);
  });

  test('il suit le doigt a CHAQUE etape, pas seulement a la premiere', async () => {
    const arbre = await rendre();
    const geste = gesteDuJeton(arbre, 'Remplacant');
    /** @type {any[]} */
    const trace = [];

    /**
     * Avance le doigt d'un cran et note ou l'apercu se dessine.
     * @param {number} absoluteX
     * @param {number} absoluteY
     * @returns {Promise<void>}
     */
    const bougerLeDoigt = async (absoluteX, absoluteY) => {
      await act(async () => {
        geste.rappels.onUpdate({ absoluteX, absoluteY });
        arbre.update(<MatchCompositionBoard />);
      });
      trace.push(positionDessineeDeLApercu(arbre));
    };

    await act(async () => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
    });

    await bougerLeDoigt(80, 600);
    await bougerLeDoigt(140, 420);
    await bougerLeDoigt(210, 260);

    expect(trace).toEqual([
      { x: 48, y: 568 },
      { x: 108, y: 388 },
      { x: 178, y: 228 },
    ]);
  });

  test('🔒 NON-REGRESSION : le placement obtenu au LACHER est inchange', async () => {
    const arbre = await rendre({ startPlacements: [] });
    const geste = gesteDuJeton(arbre, 'Remplacant');

    // Un lacher complet, fil JS libere a la fin comme le fait un vrai telephone.
    await act(async () => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      geste.rappels.onUpdate({ absoluteX: CENTRE_TERRAIN.x, absoluteY: CENTRE_TERRAIN.y });
      geste.rappels.onEnd({ absoluteX: CENTRE_TERRAIN.x, absoluteY: CENTRE_TERRAIN.y });
      geste.rappels.onFinalize();
      viderLeFilJs();
    });

    await appuyerSur(arbre, 'matchComposition.board.actions.save');

    const [, charge] = saveEventCompositionDraft.mock.calls[0];
    const places = charge?.draft?.teams?.[0]?.placements || [];
    const pose = places.find((/** @type {any} */ p) => String(p.playerId) === 'p11');

    // Lache au centre d'un terrain 300x450 ⇒ 50 % en largeur, 50 % en hauteur.
    expect(pose).toBeTruthy();
    expect(Math.round(pose.positionX)).toBe(50);
    expect(Math.round(pose.positionY)).toBe(50);
  });
});

describe('T01 defaut 2 — apres « Publier », ou arrive-t-on', () => {
  /**
   * Publie, puis appuie sur le bouton de l'alerte de reussite.
   * @param {any} arbre
   * @returns {Promise<void>}
   */
  const publierPuisValiderLAlerte = async (arbre) => {
    await appuyerSur(arbre, 'matchComposition.board.actions.publish');
    await appuyerSur(arbre, 'matchComposition.sheet.actions.publish');

    const [, , boutons] = mockAlert.mock.calls[mockAlert.mock.calls.length - 1];
    await act(async () => { await boutons[0].onPress(); });
  };

  test('🥇 publier mene au FIL DE L EQUIPE, pas aux details de l evenement', async () => {
    const arbre = await rendre();
    await publierPuisValiderLAlerte(arbre);

    const versLeFil = mockNavigate.mock.calls
      .find((/** @type {any[]} */ appel) => appel[0] === 'Conversation');

    expect(versLeFil).toBeTruthy();
    expect(versLeFil[1]).toMatchObject({ chatId: 'chat_equipe_1' });
    expect(mockNavigate.mock.calls.map((/** @type {any[]} */ a) => a[0]))
      .not.toContain('EventDetails');
  });

  test('le fil vise est bien celui de l EQUIPE de la composition', async () => {
    const arbre = await rendre();
    await publierPuisValiderLAlerte(arbre);

    expect(mockStartTeamChat).toHaveBeenCalledWith('team_1');
  });

  test('🔒 apres publication, le retour ne ramene PAS sur l ecran de publication', async () => {
    const arbre = await rendre();
    await publierPuisValiderLAlerte(arbre);

    // La pile au moment de publier : l'evenement, puis les 3 ecrans de
    // composition. Le fil de l'equipe vit AILLEURS (`PrivateNavigator`), donc y
    // aller ne retire rien tout seul : sans depilage, le retour retombe sur
    // l'ecran de publication — le defaut constate.
    expect(mockPopTo).toHaveBeenCalledWith('EventDetails', expect.anything());

    const ordre = [
      ...mockPopTo.mock.calls.map(() => 'depile'),
      ...mockNavigate.mock.calls.map(() => 'part'),
    ];
    expect(ordre[0]).toBe('depile');
  });

  test('un echec de publication ne deplace personne', async () => {
    publishEventConvocation.mockRejectedValue(new Error('boom'));
    const arbre = await rendre();

    await appuyerSur(arbre, 'matchComposition.board.actions.publish');
    await appuyerSur(arbre, 'matchComposition.sheet.actions.publish');

    expect(mockPopTo).not.toHaveBeenCalled();
    expect(mockNavigate.mock.calls.map((/** @type {any[]} */ a) => a[0]))
      .not.toContain('Conversation');
  });

  test('🚪 fil d equipe introuvable : on ne laisse PAS l utilisateur coince', async () => {
    mockStartTeamChat.mockResolvedValue(null);
    const arbre = await rendre();
    await publierPuisValiderLAlerte(arbre);

    // Pas de fil ⇒ on retombe sur l'evenement. Ce qui compte : il part
    // QUELQUE PART, et jamais sur l'ecran de publication.
    expect(mockPopTo).toHaveBeenCalledWith('EventDetails', expect.anything());
  });
});
