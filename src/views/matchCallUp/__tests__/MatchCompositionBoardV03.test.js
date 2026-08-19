import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { saveEventCompositionDraft } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';

// V03 — LE JETON NE SUIT TOUJOURS PAS LE DOIGT SUR IPHONE (2e constat d'Adel).
//
// 🚨 POURQUOI CE FICHIER EXISTE, ALORS QUE T01 EN AVAIT DEJA UN.
// Le temoin de T01 lisait `translateX`/`translateY` DE LA VALEUR PARTAGEE, et
// posait le terrain a l'origine de l'ecran (`x: 0, y: 0`). Deux consequences,
// et ce sont elles qui l'ont laisse passer au vert sur un geste casse :
//   1. il mesurait CE QU'ON ECRIT dans le style, pas OU LE JETON SE DESSINE :
//      la taille reelle du jeton (70 x 88) n'entrait jamais dans le calcul, donc
//      le centrage faux de `GHOST_SIZE = 64` restait invisible ;
//   2. avec un terrain a (0, 0) et un ecran sans encoche, le repere de la
//      FENETRE et le repere du PARENT de l'apercu se confondent — le seul
//      desaccord qu'on cherchait ne pouvait donc pas apparaitre.
//
// Ici : encoche de 59, terrain pose a (24, 180), `ScreenContainer` qui applique
// vraiment ses marges, et la position se MESURE en remontant tout l'arbre.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockPopTo = jest.fn();
/** @type {any} */
let mockRouteParams = {};

// 🧨 LE TERRAIN NE COMMENCE PAS A L'ORIGINE DE L'ECRAN — c'est tout l'interet.
const RECT_TERRAIN = {
  height: 450, width: 300, x: 24, y: 180,
};
const CENTRE_TERRAIN = {
  x: RECT_TERRAIN.x + (RECT_TERRAIN.width / 2),
  y: RECT_TERRAIN.y + (RECT_TERRAIN.height / 2),
};

/** @type {{ enAttente: Array<() => void> }} */
const mockFilJs = { enAttente: [] };
const viderLeFilJs = () => {
  mockFilJs.enAttente.splice(0).forEach((appel) => appel());
};

/** @type {{ rendus: number }} */
const mockCompteur = { rendus: 0 };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, popTo: mockPopTo }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

// Un iPhone a encoche : c'est cette valeur qui fait diverger les reperes.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
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
    // Le vrai `runOnJS` traverse les fils : il EMPILE, il n'execute pas.
    runOnJS: (/** @type {any} */ fn) => (/** @type {any[]} */ ...args) => {
      mockFilJs.enAttente.push(() => fn(...args));
    },
    useAnimatedStyle: (/** @type {any} */ fn) => fn(),
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
      Images: { arrowLeft: 1, bg2: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

// 🎯 LE DOUBLE FIDELE — il rejoue la GEOMETRIE de `ScreenContainer`, pas son
// decor : `paddingTop = insets.top` et `paddingHorizontal = 24` (voir
// `ScreenContainer.js`, `containerSpaces` et `horizontalPadding`). C'est cette
// marge qui decale tout enfant pose DEDANS — exactement le piege dans lequel
// `DetectionTeamsBoard` et `DetectionRotationBoard` sont tombes.
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, style }) => (
      <VueRN
        style={[
          {
            flex: 1,
            paddingBottom: 34,
            paddingHorizontal: 24,
            paddingTop: 59,
          },
          style,
        ]}
      >
        <VueRN style={{ flexGrow: 1 }}>{children}</VueRN>
      </VueRN>
    ),
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

// 🔒 TEMOIN 5 — le compteur de rendus vit ici : ce composant est redessine a
// CHAQUE rendu de l'ecran, il en est donc la mesure exacte.
jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => {
      mockCompteur.rendus += 1;
      return <VueRN>{children}</VueRN>;
    },
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

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}><TexteRN>{title}</TexteRN></TouchableOpacity>
    ),
  };
});

// ⚠️ `DraggableToken` n'est PAS double : c'est lui qui porte la taille reelle du
// jeton. Le doubler, c'est perdre la seule chose qu'on mesure ici.

/**
 * Aplati un style RN (tableau imbrique ou objet) en un seul objet.
 * @param {any} style - Le style a aplatir.
 * @returns {any} Un objet de style unique.
 */
const aplatirStyle = (style) => [style].flat(6).filter(Boolean)
  .reduce((/** @type {any} */ accumule, /** @type {any} */ morceau) => (
    typeof morceau === 'object' ? { ...accumule, ...morceau } : accumule
  ), {});

/**
 * La somme des `translateX` / `translateY` declares par un style.
 * @param {any} style - Un style deja aplati.
 * @returns {{ x: number, y: number }} Le deplacement declare.
 */
const translationDe = (style) => {
  const etapes = Array.isArray(style?.transform) ? style.transform : [];
  return etapes.reduce((/** @type {any} */ total, /** @type {any} */ etape) => ({
    x: total.x + (Number(etape?.translateX) || 0),
    y: total.y + (Number(etape?.translateY) || 0),
  }), { x: 0, y: 0 });
};

/**
 * Le calque de l'apercu : la vue la plus HAUTE de l'arbre qui se declare
 * intraversable au doigt. Elle existe dans les deux formes possibles de
 * l'ecran, c'est donc par elle qu'on entre.
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud du calque, ou null.
 */
const calqueDeLApercu = (arbre) => arbre.root.findAll((/** @type {any} */ noeud) => (
  noeud.type === View && noeud.props?.pointerEvents === 'none'
))[0] || null;

/**
 * Le jeton fantome DESSINE : la premiere vue du calque qui declare une taille.
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud du jeton, ou null.
 */
const jetonDessine = (arbre) => {
  const calque = calqueDeLApercu(arbre);
  if (!calque) return null;
  return [calque, ...calque.findAll((/** @type {any} */ n) => n.type === View)]
    .find((/** @type {any} */ noeud) => {
      const style = aplatirStyle(noeud.props?.style);
      return typeof style.width === 'number' && typeof style.height === 'number';
    }) || null;
};

/**
 * 🥇 LA MESURE QUI MANQUAIT : ou le jeton se dessine DANS LE REPERE DE L'ECRAN.
 *
 * On part du jeton et on remonte jusqu'a la racine en additionnant TOUT ce qui
 * deplace une vue : sa translation, son `left`/`top` d'element absolu, et la
 * MARGE INTERIEURE de chaque parent — parce qu'un enfant absolu est pose a
 * l'origine de la boite interieure de son parent, pas de son bord.
 *
 * ⚠️ CE QUE CETTE MESURE NE SAIT PAS FAIRE : suivre une vue placee par le flux
 * (posee sous ses soeurs). Aucun moteur de mise en page ne tourne ici. Le
 * temoin 4 verrouille donc separement la seule chose dont elle depend : le
 * calque de l'apercu est absolu et couvre l'ecran.
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} La position ecran du jeton, ou null.
 */
const positionEcranDuJeton = (arbre) => {
  const jeton = jetonDessine(arbre);
  if (!jeton) return null;

  const styleJeton = aplatirStyle(jeton.props?.style);
  let x = 0;
  let y = 0;

  for (let noeud = jeton; noeud; noeud = noeud.parent) {
    if (noeud.type === View) {
      const style = aplatirStyle(noeud.props?.style);
      const translation = translationDe(style);
      x += translation.x;
      y += translation.y;
      if (style.position === 'absolute') {
        x += Number(style.left) || 0;
        y += Number(style.top) || 0;
      }
      if (noeud !== jeton) {
        x += Number(style.paddingLeft ?? style.paddingHorizontal ?? style.padding) || 0;
        y += Number(style.paddingTop ?? style.paddingVertical ?? style.padding) || 0;
      }
    }
  }

  const largeur = Number(styleJeton.width) || 0;
  const hauteur = Number(styleJeton.height) || 0;
  return {
    centreX: x + (largeur / 2),
    centreY: y + (hauteur / 2),
    hauteur,
    largeur,
    x,
    y,
  };
};

/**
 * Le geste attache au jeton de ce joueur.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} prenom - Le prenom affiche sur le jeton.
 * @returns {any} Le geste attache.
 */
const gesteDuJeton = (arbre, prenom) => {
  const textes = arbre.root.findAll((/** @type {any} */ noeud) => noeud.type === Text
    && String(noeud.props?.children ?? '') === prenom);
  let courant = textes[textes.length - 1];
  while (courant && !courant.props?.gesture) courant = courant.parent;
  return courant?.props?.gesture;
};

/**
 * Appuie sur l'element le plus profond dont le texte contient ce libelle.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle recherche.
 * @returns {Promise<void>} Rien.
 */
const appuyerSur = async (arbre, libelle) => {
  const aplatir = (/** @type {any} */ enfants) => {
    if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
    if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
    if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
    return String(enfants);
  };
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatir(noeud.props.children).includes(libelle))
    .pop();
  await act(async () => { await cible.props.onPress(); });
};

const joueur = (
  /** @type {string} */ id,
  /** @type {string} */ prenom,
  /** @type {string} */ nom,
) => ({ documentId: id, firstname: prenom, lastname: nom });

const ONZE = Array.from({ length: 11 }, (_, i) => joueur(`p${i}`, `Prenom${i}`, `Nom${i}`));
const DOUZE = [...ONZE, joueur('p11', 'Douzieme', 'Remplacant')];
const PRENOM_TRAINE = 'Douzieme';

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
 * @param {any} [parametres] - Parametres de route a surcharger.
 * @returns {Promise<any>} L'arbre monte.
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
  mockCompteur.rendus = 0;
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockPopTo.mockClear();
  saveEventCompositionDraft.mockReset().mockResolvedValue({});

  mesureOrigine = View.prototype.measureInWindow;
  View.prototype.measureInWindow = function mesurerTerrain(/** @type {any} */ rappel) {
    rappel(RECT_TERRAIN.x, RECT_TERRAIN.y, RECT_TERRAIN.width, RECT_TERRAIN.height);
  };
});

afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  View.prototype.measureInWindow = mesureOrigine;
});

describe('V03 — l apercu du jeton, mesure DANS LE REPERE DE L ECRAN', () => {
  test('🥇 TEMOIN 1 : le CENTRE du jeton dessine est sous le doigt', async () => {
    const arbre = await rendre();
    const geste = gesteDuJeton(arbre, PRENOM_TRAINE);
    const doigt = { absoluteX: 220, absoluteY: 300 };

    await act(async () => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      geste.rappels.onUpdate(doigt);
      viderLeFilJs();
    });
    await act(async () => { arbre.update(<MatchCompositionBoard />); });

    const apercu = positionEcranDuJeton(arbre);

    // La taille du jeton n'est PAS une constante du temoin : elle se lit sur le
    // jeton lui-meme, donc le temoin reste juste si le pack la fait changer.
    expect(apercu).not.toBeNull();
    expect(apercu.largeur).toBeGreaterThan(0);
    expect(apercu.hauteur).toBeGreaterThan(0);
    expect(apercu.centreX).toBe(doigt.absoluteX);
    expect(apercu.centreY).toBe(doigt.absoluteY);
  });

  test('🥇 TEMOIN 2 : le lacher tombe la ou l apercu se dessine', async () => {
    const arbre = await rendre({ startPlacements: [] });
    const geste = gesteDuJeton(arbre, PRENOM_TRAINE);
    const doigt = { absoluteX: 180, absoluteY: 420 };

    await act(async () => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      geste.rappels.onUpdate(doigt);
      viderLeFilJs();
    });
    await act(async () => { arbre.update(<MatchCompositionBoard />); });

    const apercu = positionEcranDuJeton(arbre);

    await act(async () => {
      geste.rappels.onEnd(doigt);
      geste.rappels.onFinalize();
      viderLeFilJs();
    });
    await appuyerSur(arbre, 'matchComposition.board.actions.save');

    const [, charge] = saveEventCompositionDraft.mock.calls[0];
    const pose = (charge?.draft?.teams?.[0]?.placements || [])
      .find((/** @type {any} */ p) => String(p.playerId) === 'p11');

    // Le pourcentage OU L'ON VOIT le jeton et le pourcentage OU IL EST POSE
    // doivent etre le meme nombre. C'est ca, « parler le meme langage ».
    const vuX = ((apercu.centreX - RECT_TERRAIN.x) / RECT_TERRAIN.width) * 100;
    const vuY = ((apercu.centreY - RECT_TERRAIN.y) / RECT_TERRAIN.height) * 100;

    expect(pose).toBeTruthy();
    expect(pose.positionX).toBeCloseTo(vuX, 5);
    expect(pose.positionY).toBeCloseTo(vuY, 5);
  });

  test('🔒 TEMOIN 3 : le lacher continue de tomber juste (terrain hors origine)', async () => {
    const arbre = await rendre({ startPlacements: [] });
    const geste = gesteDuJeton(arbre, PRENOM_TRAINE);

    await act(async () => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      geste.rappels.onUpdate({ absoluteX: CENTRE_TERRAIN.x, absoluteY: CENTRE_TERRAIN.y });
      geste.rappels.onEnd({ absoluteX: CENTRE_TERRAIN.x, absoluteY: CENTRE_TERRAIN.y });
      geste.rappels.onFinalize();
      viderLeFilJs();
    });
    await appuyerSur(arbre, 'matchComposition.board.actions.save');

    const [, charge] = saveEventCompositionDraft.mock.calls[0];
    const pose = (charge?.draft?.teams?.[0]?.placements || [])
      .find((/** @type {any} */ p) => String(p.playerId) === 'p11');

    expect(pose).toBeTruthy();
    expect(Math.round(pose.positionX)).toBe(50);
    expect(Math.round(pose.positionY)).toBe(50);
  });

  test('🥇 TEMOIN 4 : le calque de l apercu est monte, absolu et PLEIN ECRAN', async () => {
    const arbre = await rendre();

    // Monte AVANT que le fil JS ait dit qui l'on traine : c'est l'acquis de T01.
    const calque = calqueDeLApercu(arbre);
    expect(calque).not.toBeNull();

    // Et il porte un repere a lui : sans boite, l'enfant absolu qu'il contient
    // n'a rien a quoi s'accrocher — c'est le coin en haut a gauche d'Adel.
    const style = aplatirStyle(calque.props?.style);
    expect(style.position).toBe('absolute');
    expect([style.top, style.left, style.right, style.bottom]).toEqual([0, 0, 0, 0]);
  });

  test('🔒 TEMOIN 5 : aucune boucle de rendus (D42 : 402 rendus au montage)', async () => {
    const arbre = await rendre();
    const auMontage = mockCompteur.rendus;
    expect(auMontage).toBeLessThanOrEqual(3);

    const geste = gesteDuJeton(arbre, PRENOM_TRAINE);
    await act(async () => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      geste.rappels.onUpdate({ absoluteX: 120, absoluteY: 500 });
      geste.rappels.onUpdate({ absoluteX: 200, absoluteY: 380 });
      viderLeFilJs();
    });

    // Un glissement entier = UN seul rendu (celui qui dit qui l'on traine).
    expect(mockCompteur.rendus - auMontage).toBeLessThanOrEqual(2);
  });
});
