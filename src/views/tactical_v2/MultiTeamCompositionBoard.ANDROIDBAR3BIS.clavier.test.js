// @ts-nocheck
import {
  ImageBackground, ScrollView, StyleSheet, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { saveEventCompositionDraft } from '@/services/event/eventService';

import {
  basDuDefilement,
  ECRAN,
  HAUT_DU_CLAVIER,
  ouvrirLeClavier,
  refermerLeClavier,
  telephone,
  telephoneDOrigine,
} from '../../testSupport/clavierAndroid15';
import MultiTeamCompositionBoard from './MultiTeamCompositionBoard';

// 🤖 ANDROIDBAR-3BIS — LE TABLEAU DE COMPOSITION, ET LE CLAVIER D'ANDROID 15 / 16.
//
// Le nom de chaque équipe se tape dans le plateau (« Où ils jouent ») : sur Android 15 et 16
// (bord à bord imposé, `adjustResize` mort), le clavier le couvrait. Le plateau n'a PAS de
// `ScreenContainer` : sa racine est un `GestureHandlerRootView`, et le jeton fantôme du
// glisser-déposer est dessiné par-dessus tout.
//
// ⚠️ C'est la zone de la régression la plus chère du projet (9 cassures du glisser-déposer).
// D'où l'ORDRE de ce fichier, imposé (E6) :
//   1. « E6 » : ce que le glisser-déposer fait AUJOURD'HUI, figé VERT avant toute retouche, sur
//      un vrai Android 15 dont le clavier s'ouvre et se referme — et le mécanisme qui rend
//      l'évitement inoffensif : la prise d'un joueur REMESURE les terrains (`beginDrag`), donc
//      un terrain qui a bougé (zone rétrécie, défilement) est lu à sa nouvelle place ;
//   2. le témoin ROUGE du champ, avec la géométrie MESURÉE par ANDROIDBAR-3.
// Entrée par les rappels du geste (`onStart`, `onEnd`) : sans doigt, sans `adb`, comme
// `MultiTeamCompositionBoard.caseOccupee.test.js`.

jest.setTimeout(30000);

const mockClientRequeteFige = { invalidateQueries: jest.fn() };
const mockNavigationFigee = { goBack: jest.fn(), navigate: jest.fn() };
const mockAuthFige = { clubVerificationSummary: null, userData: null };

// La doublure GARDE les deux rappels du geste : `onStart` (la prise, qui remesure les terrains)
// et `onEnd` (le lâcher). Les autres réglages du geste ne servent pas ici.
jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const constructeurGeste = () => {
    const geste = { rappelDeDebut: null, rappelDeFin: null };
    ['activateAfterLongPress', 'minDistance', 'onUpdate', 'onFinalize'].forEach((nom) => {
      geste[nom] = () => geste;
    });
    geste.onStart = (rappel) => {
      geste.rappelDeDebut = rappel;
      return geste;
    };
    geste.onEnd = (rappel) => {
      geste.rappelDeFin = rappel;
      return geste;
    };
    return geste;
  };

  return {
    Gesture: { Pan: constructeurGeste },
    GestureDetector: ({ children, gesture }) => reactActuel.createElement(
      VueRN,
      {
        accessibilityLabel: 'zone-glissable',
        onLacher: (absoluteX, absoluteY) => gesture?.rappelDeFin?.({ absoluteX, absoluteY }),
        onSaisir: (absoluteX, absoluteY) => gesture?.rappelDeDebut?.({ absoluteX, absoluteY }),
      },
      children,
    ),
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

// Les retraits MESURÉS (Pixel 9, Android 16, 3 boutons) : barre de navigation 48 dp, barre
// d'état 142 px.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 48, left: 0, right: 0, top: 142 / 2.625,
  }),
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

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(
      VueRN,
      { accessibilityLabel: 'surface-terrain' },
      children,
    ),
  };
});

jest.mock('@/components/tactical/DraggableToken', () => ({
  __esModule: true,
  default: () => null,
  GHOST_TOKEN_SIZE: { height: 40, width: 40 },
}));

// Le 4-3-3 du constat de la case occupée : l'Avant-centre en (50, 18).
const PRESET_433 = {
  key: '4-3-3',
  label: '4-3-3',
  slots: [
    {
      key: 'gk', label: 'GB', positionX: 50, positionY: 92,
    },
    {
      key: 'cm', label: 'MC', positionX: 50, positionY: 55,
    },
    {
      key: 'st', label: 'BU', positionX: 50, positionY: 18,
    },
  ],
};

const AVANT_CENTRE = { x: 50, y: 18 };
const ZOE = { documentId: 'p-zoe', firstname: 'Zoe', lastname: 'Roux' };
const NINO = { documentId: 'p-nino', firstname: 'Nino', lastname: 'Garcia' };
const nomDe = (joueur) => `${joueur.firstname} ${joueur.lastname}`;

const parametresEdition = () => ({
  canEdit: true,
  editorMode: 'event',
  eventId: 'event-1',
  eventName: 'Match amical',
  players: [ZOE, NINO],
  readOnly: false,
  sport: 'football',
  teamComposition: { availablePresets: [PRESET_433], draft: null, published: null },
  teamId: 'team-1',
  teamName: 'U15 Filles',
});

// Le terrain, dans la fenêtre, clavier fermé : 400 x 600 en haut de l'écran.
const TERRAIN = {
  height: 600, width: 400, x: 0, y: 0,
};

/** @type {any[]} */
const arbresMontes = [];

const monter = () => {
  let arbre = null;
  act(() => {
    arbre = renderer.create(<MultiTeamCompositionBoard routeParams={parametresEdition()} />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

const appuyerSur = (arbre, libelle) => {
  const cibles = arbre.root.findAll(
    (noeud) => noeud.props?.accessibilityLabel === libelle
      && typeof noeud.props?.onPress === 'function',
  );
  if (cibles.length === 0) throw new Error(`Aucun element pressable nomme « ${libelle} »`);
  act(() => {
    cibles[0].props.onPress();
  });
};

// Le temps 2, « Où ils jouent » : le terrain, le banc glissable et le nom de chaque équipe.
const allerAuTerrain = (arbre) => appuyerSur(arbre, 'Suivant');

// Où la fenêtre dit que le terrain est. Le preset Jest rend `View` en CLASSE : la mesure se
// pose sur l'instance (piège décrit dans `caseOccupee`).
const placerLeTerrain = (arbre, rectangle, { mettreEnPage = false } = {}) => {
  const surfaces = arbre.root.findAll(
    (noeud) => typeof noeud.props?.onLayout === 'function' && noeud.props?.collapsable === false,
  );
  // Le composant et son noeud natif portent tous deux la mesure : on les règle tous les deux.
  expect(surfaces.length).toBeGreaterThan(0);
  act(() => {
    surfaces.forEach((surface) => {
      const {
        height, width, x, y,
      } = rectangle;
      if (surface.instance) {
        // eslint-disable-next-line no-param-reassign -- la doublure de mesure, voir ci-dessus.
        surface.instance.measureInWindow = (rappel) => rappel(x, y, width, height);
      }
      if (mettreEnPage) surface.props.onLayout();
    });
  });
};

const zoneGlissableDe = (arbre, nom) => {
  const zone = arbre.root.findAll(
    (noeud) => noeud.props?.accessibilityLabel === 'zone-glissable'
      && typeof noeud.props?.onLacher === 'function',
  ).find((candidate) => candidate.findAll(
    (enfant) => enfant.props?.accessibilityLabel === nom,
  ).length > 0);
  if (!zone) throw new Error(`Aucune zone glissable pour « ${nom} »`);
  return zone;
};

// Le doigt, au point (`xPct`, `yPct`) du terrain tel qu'il est À L'ÉCRAN maintenant.
const pointDuDoigt = (rectangle, xPct, yPct) => [
  rectangle.x + ((xPct / 100) * rectangle.width),
  rectangle.y + ((yPct / 100) * rectangle.height),
];

// La prise (`onStart`) : elle remesure les terrains 60 ms plus tard (`measureAllFields`).
const saisir = async (arbre, nom, rectangle) => {
  const zone = zoneGlissableDe(arbre, nom);
  await act(async () => {
    zone.props.onSaisir(...pointDuDoigt(rectangle, 10, 10));
    await new Promise((resolve) => { setTimeout(resolve, 100); });
  });
};

const lacher = (arbre, nom, rectangle, xPct, yPct) => {
  const zone = zoneGlissableDe(arbre, nom);
  act(() => {
    zone.props.onLacher(...pointDuDoigt(rectangle, xPct, yPct));
  });
};

// Les postes réellement tenus, tels qu'ils partiraient au serveur (« Sauvegarder »).
const postesEnvoyes = async (arbre) => {
  saveEventCompositionDraft.mockClear();
  saveEventCompositionDraft.mockResolvedValue({ draft: null });
  await act(async () => {
    appuyerSur(arbre, 'Sauvegarder');
  });
  expect(saveEventCompositionDraft).toHaveBeenCalledTimes(1);
  const [, charge] = saveEventCompositionDraft.mock.calls[0];
  return (charge.draft?.teams?.[0]?.placements || [])
    .filter((placement) => Boolean(placement?.slotId))
    .map((placement) => `${placement.playerId}@${placement.slotId}`);
};

// La zone qui défile du plateau : celle qui porte le nom des équipes.
const defilementDuPlateau = (arbre) => {
  const defilements = arbre.root.findAllByType(ScrollView).filter(
    (defilement) => defilement.findAllByType(TextInput).length > 0,
  );
  expect(defilements).toHaveLength(1);
  return defilements[0];
};

// Le calque du jeton fantôme : plein écran, immobile, sans toucher (V03).
const calqueDuFantome = (arbre) => arbre.root.findAll(
  (noeud) => typeof noeud.type === 'string' && noeud.props?.pointerEvents === 'none',
)[0];

afterEach(async () => {
  await refermerLeClavier();
  while (arbresMontes.length > 0) {
    const arbre = arbresMontes.pop();
    act(() => {
      arbre.unmount();
    });
  }
  telephoneDOrigine();
  jest.clearAllMocks();
});

describe('ANDROIDBAR-3BIS — E6 : le glisser-déposer d aujourd hui (vert AVANT retouche)', () => {
  test('API 35, clavier jamais ouvert : Zoé lâchée sur l Avant-centre le prend', async () => {
    telephone('android', 35);
    const arbre = monter();
    allerAuTerrain(arbre);
    placerLeTerrain(arbre, TERRAIN, { mettreEnPage: true });

    await saisir(arbre, nomDe(ZOE), TERRAIN);
    lacher(arbre, nomDe(ZOE), TERRAIN, AVANT_CENTRE.x, AVANT_CENTRE.y);

    expect(await postesEnvoyes(arbre)).toEqual(['p-zoe@team_1:st']);
  });

  test('API 35, clavier ouvert puis refermé : le même geste donne le même poste', async () => {
    telephone('android', 35);
    const arbre = monter();
    allerAuTerrain(arbre);
    placerLeTerrain(arbre, TERRAIN, { mettreEnPage: true });

    await ouvrirLeClavier();
    await refermerLeClavier();
    await saisir(arbre, nomDe(ZOE), TERRAIN);
    lacher(arbre, nomDe(ZOE), TERRAIN, AVANT_CENTRE.x, AVANT_CENTRE.y);

    expect(await postesEnvoyes(arbre)).toEqual(['p-zoe@team_1:st']);
  });

  test('API 35, clavier OUVERT, terrain déplacé : la prise le relit à sa place', async () => {
    telephone('android', 35);
    const arbre = monter();
    allerAuTerrain(arbre);
    placerLeTerrain(arbre, TERRAIN, { mettreEnPage: true });

    await ouvrirLeClavier();
    // La zone a rétréci et défilé : le terrain est remonté de 200 dp à l'écran. Aucune mise en
    // page ne le signale (son contenu n'a pas changé) : seule la PRISE le remesure.
    const deplace = { ...TERRAIN, y: TERRAIN.y - 200 };
    placerLeTerrain(arbre, deplace);
    await saisir(arbre, nomDe(ZOE), deplace);
    lacher(arbre, nomDe(ZOE), deplace, AVANT_CENTRE.x, AVANT_CENTRE.y);

    // Lu à l'ANCIENNE place, ce doigt tomberait hors du terrain : Zoé resterait au banc.
    expect(await postesEnvoyes(arbre)).toEqual(['p-zoe@team_1:st']);
  });

  test('API 35 : le calque du jeton fantôme reste plein écran, clavier ouvert', async () => {
    telephone('android', 35);
    const arbre = monter();
    allerAuTerrain(arbre);
    const avant = StyleSheet.flatten(calqueDuFantome(arbre).props.style);

    await ouvrirLeClavier();
    const apres = StyleSheet.flatten(calqueDuFantome(arbre).props.style);

    expect(apres).toEqual(avant);
    expect([apres.position, apres.top, apres.left, apres.right, apres.bottom])
      .toEqual(['absolute', 0, 0, 0, 0]);
    // Il n'est pas DANS le fond du plateau : rien de ce qui évite le clavier ne le touche.
    const [fond] = arbre.root.findAllByType(ImageBackground);
    expect(fond.findAll(
      (noeud) => typeof noeud.type === 'string' && noeud.props?.pointerEvents === 'none',
    )).toHaveLength(0);
  });

  test.each([
    ['iPhone', 'ios', '18.0'],
    ['Android 14', 'android', 34],
  ])('%s : le clavier ne change rien au plateau', async (_, systeme, version) => {
    telephone(systeme, version);
    const arbre = monter();
    allerAuTerrain(arbre);
    const avant = arbre.toJSON();

    await ouvrirLeClavier();

    expect(arbre.toJSON()).toEqual(avant);
  });
});

describe('ANDROIDBAR-3BIS — le nom des équipes au-dessus du clavier (Android 15 et 16)', () => {
  test.each([35, 36])('API %s : clavier ouvert, la zone qui défile s arrête au clavier', async (
    api,
  ) => {
    telephone('android', api);
    const arbre = monter();
    allerAuTerrain(arbre);
    const defilement = defilementDuPlateau(arbre);

    await ouvrirLeClavier();

    // ROUGE avant : 923,4 dp (le bas de l'écran), 292 dp SOUS le haut du clavier (631,2 dp).
    expect(basDuDefilement(defilement)).toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.01);
  });

  test('API 35 : clavier refermé, la zone retrouve tout l écran (aucun vide)', async () => {
    telephone('android', 35);
    const arbre = monter();
    allerAuTerrain(arbre);
    const defilement = defilementDuPlateau(arbre);

    await ouvrirLeClavier();
    await refermerLeClavier();

    expect(basDuDefilement(defilement)).toBeCloseTo(ECRAN, 5);
  });

  test('API 35 : clavier DÉJÀ ouvert à l arrivée, évité dès le montage', async () => {
    telephone('android', 35);
    await ouvrirLeClavier();
    const arbre = monter();
    allerAuTerrain(arbre);

    expect(basDuDefilement(defilementDuPlateau(arbre)))
      .toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.01);
  });
});
