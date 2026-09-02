import { readFileSync } from 'fs';
import { join } from 'path';

import { StyleSheet, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { GHOST_TOKEN_SIZE } from '@/components/tactical/DraggableToken';
import {
  buildStartFromOptions,
  getBenchPlayers,
  keepPlacementsOfCalledUpPlayers,
  placePlayerAt,
  START_FROM_DEFAULT,
} from '@/views/matchCallUp/matchCompositionUtils';

import TeamCompoTemplateScreen from '../TeamCompoTemplateScreen';
import {
  buildCompoTemplateDestination,
  buildTeamDefaultCompositionPayload,
} from '../teamCompoTemplateUtils';

// AC06 — LE FILET DE LA COMPOSITION TYPE.
//
// Constat d'Adel, recette D-24 du 2026-08-20 : « ce n'est pas accessible et
// c'est bugue. En plus le padding est bugue, on ne peut pas enregistrer. »
//
// 🧾 CE QUE LA MESURE A TROUVE, ET C'EST LA LECON DU LOT : l'ecran 11 est une
// COPIE de l'ecran 5 (`matchCallUp/MatchCompositionBoard.js`) prise AVANT que
// les lots T01, V03 et R07 ne le reparent. Les trois defauts sont donc les
// memes, deja diagnostiques, jamais recopies ici :
//
//   1. 🧵 T01 — la position de l'apercu traversait le fil JS a CHAQUE mouvement
//      de doigt (`runOnJS(updateDrag)`), pendant que ce meme geste declenchait
//      un rendu complet de l'ecran. L'apercu ne suit pas le doigt.
//   2. 📏 Le jeton pose etait recentre a la main (`-22 / -22`) alors que le
//      jeton de terrain fait 58 x 72 : il se dessinait 7 px a droite et 14 px
//      sous l'endroit du lacher.
//   3. 🪧 R07 — la zone du terrain n'etait pas BORNEE (`fieldWrapper` sans flex,
//      `fieldSurface` en `width: '100%'`). Sa hauteur valait donc
//      1,5 x la largeur de l'ecran, quelle que soit la place laissee : le banc,
//      la carte et LE BOUTON « Enregistrer » etaient pousses hors de l'ecran.
//      ⇒ c'est ça, « le padding est bugue, on ne peut pas enregistrer ».
//
// ⚠️ CE QUE CE FICHIER NE PROUVE PAS, et il faut le dire : Jest n'a pas de
// moteur de mise en page, il ne mesure aucun pixel. Il lit les CONTRAINTES
// posees sur l'arbre. C'est suffisant ici parce que le defaut EST une
// contrainte. Le rendu, lui, se constate sur un telephone.

const RACINE = join(__dirname, '..', '..', '..', '..');

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSave = jest.fn(() => Promise.resolve({}));

/** @type {any} */
let mockDefaultComposition;

// 🧵 LE COEUR DU TEMOIN « l'apercu suit le doigt » : le fil JS est OCCUPE.
// `runOnJS` n'execute rien — il empile. C'est la vraie vie : il fait passer du
// fil UI au fil JS, et ce meme geste declenche un rendu qui l'occupe.
/** @type {{ enAttente: Array<() => void> }} */
const mockFilJs = { enAttente: [] };
const viderLeFilJs = () => {
  mockFilJs.enAttente.splice(0).forEach((appel) => appel());
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({
    params: {
      players: [
        { documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' },
        { documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra' },
        { documentId: 'joueur-3', firstname: 'Yanis', lastname: 'Bendaoud' },
      ],
      sport: 'football',
      teamId: 'team-1',
      teamName: 'Senior 1',
    },
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: () => {
      options.mutationFn();
      options.onSuccess();
    },
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-native/Libraries/Alert/Alert', () => {
  const mockModule = { alert: () => {} };
  // RN 0.79 lit `require(module).default` la ou 0.78 lisait le module entier :
  // le mock sert les DEUX formes, pour survivre aux deux versions.
  return { ...mockModule, default: mockModule };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeamDefaultComposition: () => ({ data: mockDefaultComposition }),
}));

jest.mock('@/services/team/teamService', () => ({
  saveTeamDefaultComposition: (/** @type {any} */ ...args) => mockSave(...args),
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
    // Le vrai `runOnJS` traverse les fils. On le rend fidele : il EMPILE.
    runOnJS: (/** @type {any} */ fn) => (/** @type {any[]} */ ...args) => {
      mockFilJs.enAttente.push(() => fn(...args));
    },
    useAnimatedStyle: (/** @type {any} */ fn) => fn(),
    // 🧨 La valeur partagee SURVIT aux rendus — un double qui en refabrique une
    // a chaque rendu perdrait justement ce que le doigt vient d'y ecrire.
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

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const { Text: TexteRN, TouchableOpacity, View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChange, options }) => (
      <VueRN>
        {options.map((/** @type {any} */ option) => (
          <TouchableOpacity key={option.value} onPress={() => onChange(option.value)}>
            <TexteRN>{option.label}</TexteRN>
          </TouchableOpacity>
        ))}
      </VueRN>
    ),
  };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
  };
});

// 🧨 Le double PORTE LA POSITION : depuis V03 c'est le JETON qui bouge, pas le
// calque. Sans ça, il n'y a plus rien a lire pour le temoin de l'apercu.
jest.mock('@/components/tactical/DraggableToken', () => {
  const { Text: TexteRN, View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      player, scale, translateX, translateY,
    }) => {
      const libelle = <TexteRN>{`JETON:${player?.lastname}`}</TexteRN>;
      if (!translateX || !translateY) return libelle;
      // 📌 Les trois valeurs se lisent AVANT le JSX : le greffon babel de
      // reanimated refuse un `.value` ecrit directement dans un style.
      const x = translateX.value;
      const y = translateY.value;
      const facteur = scale ? scale.value : 1;
      return (
        <VueRN style={{ transform: [{ translateX: x }, { translateY: y }, { scale: facteur }] }}>
          {libelle}
        </VueRN>
      );
    },
    GHOST_TOKEN_SIZE: jest.requireActual('@/components/tactical/DraggableToken').GHOST_TOKEN_SIZE,
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

/** @type {any[]} */
const arbresMontes = [];

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TeamCompoTemplateScreen />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Le premier noeud dont le style aplati satisfait ce predicat.
 * @param {any} arbre
 * @param {(style: any) => boolean} predicat
 * @returns {any}
 */
const noeudParStyle = (arbre, predicat) => arbre.root.findAll((/** @type {any} */ noeud) => {
  if (noeud.type !== View) return false;
  return predicat(StyleSheet.flatten(noeud.props?.style) || {});
})[0];

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
 * LA POSITION DESSINEE de l'apercu, telle que l'ecran la rend. L'apercu se
 * reconnait a son calque pose par-dessus tout le reste (`zIndex`).
 * @param {any} arbre
 * @returns {{ x: number, y: number } | null}
 */
const positionDessineeDeLApercu = (arbre) => {
  const calques = arbre.root.findAll((/** @type {any} */ noeud) => {
    if (noeud.type !== View) return false;
    const style = StyleSheet.flatten(noeud.props?.style) || {};
    return Number(style.zIndex) >= 20 && style.position === 'absolute';
  });
  if (calques.length === 0) return null;

  const porteurs = [calques[0], ...calques[0].findAll(
    (/** @type {any} */ noeud) => noeud.type === View,
  )];
  const transformations = porteurs.flatMap((/** @type {any} */ noeud) => {
    const style = StyleSheet.flatten(noeud.props?.style) || {};
    return Array.isArray(style.transform) ? style.transform : [];
  });
  const lire = (/** @type {string} */ nom) => transformations
    .filter((/** @type {any} */ etape) => etape && etape[nom] !== undefined)
    .map((/** @type {any} */ etape) => Number(etape[nom]))
    .pop();

  return { x: lire('translateX') ?? 0, y: lire('translateY') ?? 0 };
};

const COMPO_ENREGISTREE = {
  composition: {
    placements: [{
      playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
    }],
  },
};

/** @type {any} */
let mesureOrigine;

beforeEach(() => {
  jest.clearAllMocks();
  mockFilJs.enAttente = [];
  mockDefaultComposition = COMPO_ENREGISTREE;

  mesureOrigine = View.prototype.measureInWindow;
  View.prototype.measureInWindow = function mesurerTerrain(/** @type {any} */ rappel) {
    rappel(0, 0, 300, 450);
  };
});

afterEach(() => {
  act(() => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  View.prototype.measureInWindow = mesureOrigine;
});

describe('TEMOIN 1 — la compo type s atteint depuis la fiche de l equipe', () => {
  test('la porte de la fiche equipe mene a un ecran REGISTRE dans la meme pile', () => {
    const destination = buildCompoTemplateDestination({
      players: [],
      team: { activities: [{ name: 'Football' }], documentId: 'team-1', name: 'Senior 1' },
    });
    const pile = readFileSync(
      join(RACINE, 'navigation', 'private', 'stacks', 'TeamStack.js'),
      'utf8',
    );

    // La fiche equipe ET la compo type vivent dans la MEME pile : sans ça,
    // `navigate` sortirait de l'onglet en cours (ou ne trouverait rien).
    expect(destination?.screen).toBe('TeamCompoTemplate');
    expect(pile).toContain('RouteNames.TeamDetails');
    expect(pile).toContain('RouteNames.TeamCompoTemplate');
  });

  test('la fiche equipe appelle bien cette porte, et elle emporte l effectif', () => {
    const fiche = readFileSync(join(RACINE, 'views', 'team', 'TeamDetails.js'), 'utf8');

    expect(fiche).toContain('buildCompoTemplateDestination');
    expect(fiche).toContain('teamDetails.actions.defaultComposition');
  });
});

describe('TEMOIN 2 — 🥇 ON PEUT L ENREGISTRER : le bouton est atteignable au doigt', () => {
  test('🥇 LA ZONE DU TERRAIN EST BORNEE — elle prend la place LAISSEE, pas 1,5 ecran', () => {
    const arbre = rendre();
    const surface = noeudParStyle(arbre, (style) => style.aspectRatio !== undefined);
    const zone = StyleSheet.flatten(surface.parent.props.style) || {};

    // `flex: 1` = la zone grandit ET retrecit, en partant de ZERO. C'est LA
    // propriete qui empeche le terrain de pousser le pied hors de l'ecran.
    expect(zone.flex).toBe(1);
  });

  test('🥇 et le terrain ne S IMPOSE PLUS une largeur pleine', () => {
    const arbre = rendre();
    const surface = StyleSheet.flatten(
      noeudParStyle(arbre, (style) => style.aspectRatio !== undefined).props.style,
    ) || {};

    // 🧨 LE DEFAUT EXACT : `width: '100%'` + `aspectRatio` = une hauteur de
    // 1,5 x la largeur de l'ecran, quelle que soit la place restante. Sur un
    // telephone de 390 pt de large, le terrain reclamait 543 pt a lui seul —
    // le banc, la carte et le bouton « Enregistrer » partaient dessous.
    expect(surface.width).toBeUndefined();
    expect(surface.maxWidth).toBe('100%');
  });

  test('le pied vit HORS de la zone du terrain — il ne peut pas etre pousse', () => {
    const arbre = rendre();
    const surface = noeudParStyle(arbre, (style) => style.aspectRatio !== undefined);
    const texteDeLaZone = surface.parent.findAllByType(Text)
      .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
      .join(' | ');

    expect(texteDeLaZone).not.toContain('compoTemplate.actions.save');
  });

  test('⛔ et sa reserve basse n est PAS remise a zero', () => {
    const arbre = rendre();
    const pieds = arbre.root.findAll((/** @type {any} */ noeud) => {
      if (noeud.type !== View) return false;
      const style = StyleSheet.flatten(noeud.props?.style) || {};
      return typeof style.paddingBottom === 'number' && style.paddingTop === 12;
    });

    expect(pieds.length).toBeGreaterThan(0);
    expect(StyleSheet.flatten(pieds[pieds.length - 1].props.style).paddingBottom)
      .toBeGreaterThanOrEqual(12);
  });

  test('⛔ AUCUNE hauteur en fraction d ECRAN dans cet ecran', () => {
    const source = readFileSync(
      join(RACINE, 'views', 'team', 'composition', 'TeamCompoTemplateScreen.js'),
      'utf8',
    );

    // La contrainte vient de la place LAISSEE, jamais de la taille de l'ecran.
    expect(source).not.toContain('Dimensions');
    expect(source).not.toMatch(/useWindowDimensions/);
  });

  test('appuyer sur « Enregistrer » envoie bien la compo affichee', () => {
    const arbre = rendre();
    const bouton = arbre.root.findAll((/** @type {any} */ noeud) => (
      typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes('compoTemplate.actions.save')
    )).pop();

    act(() => { bouton.props.onPress(); });

    expect(mockSave).toHaveBeenCalledWith('team-1', {
      composition: expect.objectContaining({
        placements: [expect.objectContaining({ playerId: 'joueur-1' })],
      }),
    });
  });
});

describe('TEMOIN b — « c est bugue » : l apercu doit suivre le doigt', () => {
  test('🥇 le doigt bouge, l apercu se dessine au meme endroit — SANS le fil JS', () => {
    const arbre = rendre();
    const geste = gesteDuJeton(arbre, 'Diarra');

    // Le fil JS est libere UNE fois, le temps de dire quel joueur on traine.
    // Puis il reste OCCUPE : c'est exactement la vie d'un vrai glissement.
    act(() => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      viderLeFilJs();
    });
    act(() => {
      geste.rappels.onUpdate({ absoluteX: 150, absoluteY: 225 });
      arbre.update(<TeamCompoTemplateScreen />);
    });

    const apercu = positionDessineeDeLApercu(arbre);

    expect(apercu).not.toBeNull();
    expect(apercu.x).toBe(150 - (GHOST_TOKEN_SIZE.width / 2));
    expect(apercu.y).toBe(225 - (GHOST_TOKEN_SIZE.height / 2));
  });

  test('l apercu ne reste PAS colle au coin en haut a gauche', () => {
    const arbre = rendre();
    const geste = gesteDuJeton(arbre, 'Diarra');

    act(() => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      viderLeFilJs();
    });
    act(() => {
      geste.rappels.onUpdate({ absoluteX: 220, absoluteY: 300 });
      arbre.update(<TeamCompoTemplateScreen />);
    });

    const apercu = positionDessineeDeLApercu(arbre);

    // 🧨 Le calque doit EXISTER : ne le monter qu'avec `activeDragPlayer` (qui
    // arrive par le fil JS) le faisait naitre en retard, a (0, 0).
    expect(apercu).not.toBeNull();
    expect([apercu.x, apercu.y]).not.toEqual([0, 0]);
  });

  test('il suit le doigt a CHAQUE etape, pas seulement a la premiere', () => {
    const arbre = rendre();
    const geste = gesteDuJeton(arbre, 'Diarra');
    /** @type {any[]} */
    const trace = [];

    act(() => {
      geste.rappels.onStart({ absoluteX: 40, absoluteY: 700 });
      viderLeFilJs();
    });

    [[80, 600], [140, 420], [210, 260]].forEach(([x, y]) => {
      act(() => {
        geste.rappels.onUpdate({ absoluteX: x, absoluteY: y });
        arbre.update(<TeamCompoTemplateScreen />);
      });
      trace.push(positionDessineeDeLApercu(arbre));
    });

    expect(trace).toEqual([[80, 600], [140, 420], [210, 260]].map(([x, y]) => ({
      x: x - (GHOST_TOKEN_SIZE.width / 2),
      y: y - (GHOST_TOKEN_SIZE.height / 2),
    })));
  });

  test('📏 le jeton pose se dessine LA OU on l a lache, pas 7 px a cote', () => {
    const arbre = rendre();
    const jeton = arbre.root.findAll((/** @type {any} */ noeud) => noeud.type === Text
      && aplatirTexte(noeud.props.children) === 'JETON:Sylla')[0];
    let courant = jeton;
    while (courant
      && (StyleSheet.flatten(courant.props?.style) || {}).position !== 'absolute') {
      courant = courant.parent;
    }
    const style = StyleSheet.flatten(courant.props.style) || {};

    // Le jeton de terrain fait 58 x 72 (`DraggableToken.fieldToken`). Le
    // recentrer demande donc la MOITIE de ces valeurs — les recopier a la main
    // (`-22 / -22`) posait le jeton 7 px a droite et 14 px sous le lacher.
    expect(style.marginLeft).toBe(-29);
    expect(style.marginTop).toBe(-36);
  });
});

describe('TEMOIN 3 — elle se recharge telle qu on l a laissee', () => {
  test('la compo enregistree revient sur le terrain a la reouverture', () => {
    const arbre = rendre();
    const surface = noeudParStyle(arbre, (style) => style.aspectRatio !== undefined);
    const texteDuTerrain = surface.findAllByType(Text)
      .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
      .join(' | ');

    expect(texteDuTerrain).toContain('JETON:Sylla');
  });

  test('🧾 le POSTE survit a l aller-retour serveur — il ne disparait pas', () => {
    // 🧨 MESURE (2026-08-21, `admin/src/api/team/controllers/team.ts:90`) :
    // `normalizeCompositionPlacements` garde `playerId`, `position`,
    // `positionX`, `positionY` — et JETTE `slotId`. L'ecran envoyait `slotId`
    // et rien d'autre : au rechargement, la pastille de poste n'avait plus de
    // quoi se calculer et disparaissait.
    const charge = buildTeamDefaultCompositionPayload({
      placements: [{
        playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
      }],
      players: [{ documentId: 'joueur-1' }],
      sport: 'football',
    });

    expect(charge.placements[0].position).toBe('GB');
  });

  test('🧾 et il se relit depuis ce que le serveur a garde', () => {
    mockDefaultComposition = {
      composition: {
        // Ce que le serveur rend VRAIMENT : pas de `slotId`.
        placements: [{
          playerId: 'joueur-1', position: 'GB', positionX: 50, positionY: 93,
        }],
      },
    };
    const arbre = rendre();
    const texte = arbre.root.findAllByType(Text)
      .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
      .join(' | ');

    expect(texte).toContain('GB');
  });
});

describe('TEMOIN 4 — elle se reporte sur un nouveau match', () => {
  test('🥇 LA PROMESSE PAYANTE : la compo type pre-remplit le terrain du match', () => {
    const convoques = Array.from({ length: 11 }, (_, index) => ({ documentId: `p${index}` }));
    const compoType = {
      composition: {
        placements: convoques.map((joueur, index) => ({
          playerId: joueur.documentId,
          positionX: 50,
          positionY: 10 + index,
          slotId: `team_1:slot_${index + 1}`,
        })),
      },
    };

    const options = buildStartFromOptions({
      defaultComposition: compoType, players: convoques, sport: 'football',
    });
    const depuisLaCompoType = options.find((option) => option.key === START_FROM_DEFAULT);

    expect(depuisLaCompoType?.available).toBe(true);
    expect(depuisLaCompoType?.placements).toHaveLength(11);
  });
});

describe('TEMOIN 5 — 🔒 un report sur un effectif plus petit ne casse rien', () => {
  test('une compo type de 11 posee sur 8 convoques rend 8 jetons, sans lever', () => {
    const compoDeOnze = Array.from({ length: 11 }, (_, index) => ({
      playerId: `p${index}`,
      positionX: 50,
      positionY: 10 + index,
      slotId: `team_1:slot_${index + 1}`,
    }));
    const huitDisponibles = Array.from({ length: 8 }, (_, index) => ({ documentId: `p${index}` }));

    const options = buildStartFromOptions({
      defaultComposition: { composition: { placements: compoDeOnze } },
      players: huitDisponibles,
      sport: 'football',
    });
    const depuisLaCompoType = options.find((option) => option.key === START_FROM_DEFAULT);

    expect(depuisLaCompoType?.available).toBe(true);
    expect(depuisLaCompoType?.placements).toHaveLength(8);
    // Les 3 absents ne reviennent pas au banc par surprise : ils ne sont
    // simplement plus la.
    expect(getBenchPlayers(huitDisponibles, depuisLaCompoType?.placements || [])).toHaveLength(0);
  });

  test('⛔ et un effectif VIDE ne rend pas un ecran casse — juste une option grisee', () => {
    const options = buildStartFromOptions({
      defaultComposition: { composition: { placements: [{ playerId: 'p0' }] } },
      players: [],
      sport: 'football',
    });
    const depuisLaCompoType = options.find((option) => option.key === START_FROM_DEFAULT);

    expect(depuisLaCompoType?.available).toBe(false);
    expect(depuisLaCompoType?.unavailableReason).toBe('noDefaultComposition');
  });
});

describe('TEMOIN 6 — 🔒 le tableau de composition d un MATCH n a pas change', () => {
  test('l arithmetique PARTAGEE avec l ecran 5 rend exactement les memes valeurs', () => {
    const slots = [
      {
        label: 'GB', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
      },
      {
        label: 'DD', positionX: 86, positionY: 76, slotId: 'team_1:slot_2',
      },
    ];

    // Aimante : le jeton colle au repere libre le plus proche.
    expect(placePlayerAt({
      magnetEnabled: true, placements: [], playerId: 'p1', slots, x: 52, y: 91,
    })).toEqual([{
      playerId: 'p1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
    }]);

    // Repere deja pris : le suivant va sur l'autre, jamais par-dessus.
    expect(placePlayerAt({
      magnetEnabled: true,
      placements: [{
        playerId: 'p1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
      }],
      playerId: 'p2',
      slots,
      x: 84,
      y: 78,
    }).pop()).toEqual({
      playerId: 'p2', positionX: 86, positionY: 76, slotId: 'team_1:slot_2',
    });

    // Le tri des convoques ne bouge pas non plus.
    expect(keepPlacementsOfCalledUpPlayers(
      [{ playerId: 'p1' }, { playerId: 'parti' }],
      [{ documentId: 'p1' }],
    )).toEqual([{ playerId: 'p1' }]);
  });
});
