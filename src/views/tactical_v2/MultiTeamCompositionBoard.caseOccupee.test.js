// @ts-nocheck
import renderer, { act } from 'react-test-renderer';

import { saveEventCompositionDraft } from '@/services/event/eventService';

import MultiTeamCompositionBoard from './MultiTeamCompositionBoard';
import { normalizeMultiTeamPack } from './multiTeamCompositionUtils';

// 👻 LOT COMPO — « UN JOUEUR POSE SUR UNE CASE OCCUPEE DISPARAIT ».
//
// 🔬 CE QUE CE FICHIER TRANCHE, ET C'EST SA RAISON D'EXISTER. Le banc d'essai du
// 09/08 a produit son constat avec des gestes INJECTES par `adb`
// (`input draganddrop`), pas avec un vrai doigt. Tant qu'on n'a pas separe les
// deux, « le glisser-deposer est casse » peut vouloir dire « adb glisse mal ».
// Ces temoins appellent la fonction de depot de l'ecran SANS AUCUN DOIGT : ils
// entrent par `onEnd` du geste, exactement la ou le fil UI depose le sien. Si
// l'etat rendu est incoherent ici, la couche gestuelle est HORS DE CAUSE.
//
// 🎯 LES 3 INVARIANTS, en mots d'utilisateur :
//   T1 — poser quelqu'un sur un poste occupe ne fait DISPARAITRE personne :
//        banc + postes tenus reste constant.
//   T2 — il y a autant de jetons DESSINES que d'occupants ENREGISTRES : c'est le
//        temoin qui aurait attrape le « 4 visibles pour 3 occupants ».
//   T3 — ce qui part au serveur, relu comme au rechargement, reste coherent.

// ⏱️ Ce plateau fait 1 986 lignes et chaque temoin le monte en entier. Sous
// charge — trois lots qui tournent sur la meme machine — un montage a depasse
// les 5 s par defaut de Jest et la suite est tombee SANS aucun test rouge.
// 30 s est le seuil deja retenu par les autres suites lourdes du depot.
jest.setTimeout(30000);

/** @type {any[]} */
const mockPaywallProps = [];
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
const mockClientRequeteFige = { invalidateQueries: jest.fn() };
const mockNavigationFigee = { goBack: jest.fn(), navigate: jest.fn() };
const mockAuthFige = { clubVerificationSummary: null, userData: null };

// 🕹️ LA DOUBLURE QUI REND LE DEPOT PILOTABLE. Celle de
// `MultiTeamCompositionBoard.test.js` JETTE les rappels (`onEnd: () => geste`) :
// elle sait compter le cablage, pas le declencher. Ici on GARDE `onEnd` et on
// l'expose sur la zone glissable, pour pouvoir lacher un joueur a un endroit
// precis du terrain — ce que la vraie main fait, sans la vraie main.
jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const constructeurGeste = () => {
    const geste = { estUnPan: true, rappelDeFin: null };
    ['activateAfterLongPress', 'minDistance', 'onStart', 'onUpdate', 'onFinalize']
      .forEach((nom) => {
        geste[nom] = () => geste;
      });
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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
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

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite avant le premier rendu.
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

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: ({ onPress }) => reactActuel.createElement(
      PressableRN,
      { accessibilityLabel: 'retour-entete', onPress },
      reactActuel.createElement(TexteRN, null, 'retour'),
    ),
  };
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: (props) => {
    mockPaywallProps.push(props);
    return null;
  },
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

// Le 4-3-3 du constat, aux vraies distances : l'Avant-centre est a 31 points du
// poste libre le plus proche (AG et AD), donc TRES au-dela du rayon
// d'aimantation de 14. C'est exactement la situation du banc d'essai : lacher
// sur l'Avant-centre occupe n'a aucun poste libre de repli.
const PRESET_433 = {
  key: '4-3-3',
  label: '4-3-3',
  slots: [
    {
      key: 'gk', label: 'GB', positionX: 50, positionY: 92,
    },
    {
      key: 'lb', label: 'DG', positionX: 18, positionY: 74,
    },
    {
      key: 'lcb', label: 'DC', positionX: 38, positionY: 74,
    },
    {
      key: 'rcb', label: 'DC2', positionX: 62, positionY: 74,
    },
    {
      key: 'rb', label: 'DD', positionX: 82, positionY: 74,
    },
    {
      key: 'lm', label: 'MG', positionX: 30, positionY: 52,
    },
    {
      key: 'cm', label: 'MC', positionX: 50, positionY: 55,
    },
    {
      key: 'rm', label: 'MD', positionX: 70, positionY: 52,
    },
    {
      key: 'lw', label: 'AG', positionX: 20, positionY: 26,
    },
    {
      key: 'st', label: 'BU', positionX: 50, positionY: 18,
    },
    {
      key: 'rw', label: 'AD', positionX: 80, positionY: 26,
    },
  ],
};

const AVANT_CENTRE = { x: 50, y: 18 };

const ZOE = { documentId: 'p-zoe', firstname: 'Zoe', lastname: 'Roux' };
const NINO = { documentId: 'p-nino', firstname: 'Nino', lastname: 'Garcia' };
const LEA = { documentId: 'p-lea', firstname: 'Lea', lastname: 'Mercier' };
const JOUEURS = [ZOE, NINO, LEA];

const nomDe = (joueur) => `${joueur.firstname} ${joueur.lastname}`;

const parametresEdition = (surcharge = {}) => ({
  canEdit: true,
  editorMode: 'event',
  eventId: 'event-1',
  eventName: 'Match amical',
  players: JOUEURS,
  readOnly: false,
  sport: 'football',
  teamComposition: { availablePresets: [PRESET_433], draft: null, published: null },
  teamId: 'team-1',
  teamName: 'U15 Filles',
  ...surcharge,
});

// Le terrain mesure 400 x 600 dans la fenetre : c'est ce rectangle que
// `endDrag` utilise pour convertir un point du doigt en pourcentages.
const TERRAIN = {
  height: 600, width: 400, x: 0, y: 0,
};

/** @type {any[]} */
const arbresMontes = [];

const monter = (params) => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(<MultiTeamCompositionBoard routeParams={params} />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

const trouverParLibelle = (arbre, libelle) => arbre.root.findAll(
  (noeud) => noeud.props?.accessibilityLabel === libelle
    && typeof noeud.props?.onPress === 'function',
);

const appuyerSur = (arbre, libelle) => {
  const cibles = trouverParLibelle(arbre, libelle);
  if (cibles.length === 0) throw new Error(`Aucun element pressable nomme « ${libelle} »`);
  act(() => {
    cibles[0].props.onPress();
  });
};

const allerAuTerrain = (arbre) => appuyerSur(arbre, 'Suivant');

// Appuie sur la LIGNE d'un poste, dans la liste sous le terrain. C'est la seule
// porte vers un poste DEJA TENU : son repere sur le terrain n'est plus dessine
// des qu'un jeton l'occupe.
const appuyerSurLaLigneDePoste = (arbre, libelle) => {
  const lignes = arbre.root.findAll(
    (noeud) => typeof noeud.props?.onPress === 'function'
      && noeud.findAll((enfant) => enfant.props?.children === libelle).length > 0,
  );
  if (lignes.length === 0) throw new Error(`Aucune ligne de poste « ${libelle} »`);
  act(() => {
    lignes[lignes.length - 1].props.onPress();
  });
};

// Declenche la mesure du terrain, comme le ferait la mise en page native.
//
// 🪤 LE PIEGE QUI M'A COUTE UN TOUR : le preset Jest de React Native remplace
// `View` par une CLASSE, donc la `ref` du terrain recoit l'instance de cette
// classe — pas le noeud hote. `createNodeMock` n'est alors jamais consulte et
// `measureInWindow` n'existe nulle part : `measureField` sortait aussitot, le
// rectangle du terrain restait vide, et TOUS les lachers tombaient « hors
// terrain ». On pose donc la mesure sur l'instance elle-meme.
const mesurerLeTerrain = (arbre) => {
  const surfaces = arbre.root.findAll(
    (noeud) => typeof noeud.props?.onLayout === 'function'
      && noeud.props?.collapsable === false,
  );
  act(() => {
    surfaces.forEach((surface) => {
      const { instance } = surface;
      const {
        height, width, x, y,
      } = TERRAIN;
      if (instance) {
        instance.measureInWindow = (rappel) => rappel(x, y, width, height);
      }
      surface.props.onLayout();
    });
  });
};

// Lache le joueur nomme `nom` sur le terrain, au point (`xPct`, `yPct`).
// Entre par le MEME `onEnd` que le fil UI : aucun doigt, aucun `adb`.
const lacherSurLeTerrain = (arbre, nom, xPct, yPct) => {
  const zones = arbre.root.findAll(
    (noeud) => noeud.props?.accessibilityLabel === 'zone-glissable'
      && typeof noeud.props?.onLacher === 'function',
  );
  const zone = zones.find(
    (candidate) => candidate.findAll(
      (enfant) => enfant.props?.accessibilityLabel === nom,
    ).length > 0,
  );
  if (!zone) throw new Error(`Aucune zone glissable pour « ${nom} »`);
  act(() => {
    zone.props.onLacher(
      TERRAIN.x + ((xPct / 100) * TERRAIN.width),
      TERRAIN.y + ((yPct / 100) * TERRAIN.height),
    );
  });
};

// Tous les noeuds « jeton de joueur » dessines a l'interieur d'un terrain.
const noeudsDesJetons = (arbre) => {
  const surfaces = arbre.root.findAll(
    (noeud) => noeud.props?.accessibilityLabel === 'surface-terrain',
  );
  return surfaces.flatMap((surface) => surface.findAll(
    (noeud) => typeof noeud.props?.accessibilityLabel === 'string'
      && JOUEURS.some((joueur) => nomDe(joueur) === noeud.props.accessibilityLabel)
      && typeof noeud.props?.onPress === 'function',
  ));
};

// Les joueurs DESSINES sur le terrain, une fois chacun (ce que l'oeil compte).
// On dedoublonne : l'arbre de test rend le meme jeton sous plusieurs noeuds
// imbriques, et on mesure des PERSONNES, pas des noeuds.
const jetonsDessinesSurLeTerrain = (arbre) => Array.from(new Set(
  noeudsDesJetons(arbre).map((noeud) => noeud.props.accessibilityLabel),
));

// Ou chaque joueur est dessine, en « gauche/haut ».
const positionDesJetons = (arbre) => {
  const parJoueur = new Map();
  noeudsDesJetons(arbre).forEach((noeud) => {
    const style = [].concat(noeud.props.style || []).find((entree) => entree?.left);
    parJoueur.set(noeud.props.accessibilityLabel, `${style?.left}/${style?.top}`);
  });
  return parJoueur;
};

// Les noms encore proposes au banc (les pastilles de la reserve).
const joueursAuBanc = (arbre) => JOUEURS
  .map(nomDe)
  .filter((nom) => {
    const surfaces = arbre.root.findAll(
      (noeud) => noeud.props?.accessibilityLabel === 'surface-terrain',
    );
    const surLeTerrain = surfaces.some((surface) => surface.findAll(
      (noeud) => noeud.props?.accessibilityLabel === nom,
    ).length > 0);
    return !surLeTerrain && trouverParLibelle(arbre, nom).length > 0;
  });

// Le pack tel qu'il partirait au serveur si on appuyait sur « Sauvegarder ».
//
// 🔒 On VIDE les appels avant d'appuyer, et on exige qu'il y en ait exactement
// un apres. Sans ce garde-fou, un appui sans effet rendrait silencieusement le
// pack de l'appui PRECEDENT : le temoin mesurerait alors un etat perime en
// croyant lire le neuf — un faux vert, la pire des sorties.
const packEnvoyeAuServeur = async (arbre) => {
  saveEventCompositionDraft.mockClear();
  saveEventCompositionDraft.mockResolvedValue({ draft: null });
  await act(async () => {
    appuyerSur(arbre, 'Sauvegarder');
  });
  expect(saveEventCompositionDraft).toHaveBeenCalledTimes(1);
  const [, charge] = saveEventCompositionDraft.mock.calls[0];
  return charge.draft;
};

// Les postes REELLEMENT tenus dans un pack : un placement accroche a un poste.
const postesTenus = (pack) => (pack?.teams?.[0]?.placements || [])
  .filter((placement) => Boolean(placement?.slotId));

afterEach(() => {
  while (arbresMontes.length > 0) {
    const arbre = arbresMontes.pop();
    act(() => {
      arbre.unmount();
    });
  }
  mockPaywallProps.length = 0;
  jest.clearAllMocks();
});

describe('COMPO — poser un joueur sur un poste DEJA OCCUPE', () => {
  test('T1 — personne ne disparait : banc + postes tenus reste a 3', async () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    mesurerLeTerrain(arbre);

    // 1er depot : l'Avant-centre est libre, Zoe le prend.
    lacherSurLeTerrain(arbre, nomDe(ZOE), AVANT_CENTRE.x, AVANT_CENTRE.y);
    const packAvant = await packEnvoyeAuServeur(arbre);
    expect(postesTenus(packAvant)).toHaveLength(1);
    expect(joueursAuBanc(arbre)).toHaveLength(2);

    // 2e depot : Nino est lache EXACTEMENT sur l'Avant-centre, deja tenu par Zoe.
    lacherSurLeTerrain(arbre, nomDe(NINO), AVANT_CENTRE.x, AVANT_CENTRE.y);
    const packApres = await packEnvoyeAuServeur(arbre);

    // 🚨 LE COEUR DU DEFAUT : Nino a quitte le banc et ne tient AUCUN poste.
    // Pour le coach, il a disparu — son jeton est cache sous celui de Zoe.
    expect(joueursAuBanc(arbre).length + postesTenus(packApres).length).toBe(3);
  });

  test('T2 — autant de jetons dessines que d occupants enregistres', async () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    mesurerLeTerrain(arbre);

    lacherSurLeTerrain(arbre, nomDe(ZOE), AVANT_CENTRE.x, AVANT_CENTRE.y);
    lacherSurLeTerrain(arbre, nomDe(NINO), AVANT_CENTRE.x, AVANT_CENTRE.y);
    const pack = await packEnvoyeAuServeur(arbre);

    // C'est le « 4 jetons visibles pour 3 occupants » du constat du 09/08.
    expect(jetonsDessinesSurLeTerrain(arbre)).toHaveLength(postesTenus(pack).length);
  });

  test('T2 bis — deux joueurs ne se superposent JAMAIS au meme endroit', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    mesurerLeTerrain(arbre);

    lacherSurLeTerrain(arbre, nomDe(ZOE), AVANT_CENTRE.x, AVANT_CENTRE.y);
    lacherSurLeTerrain(arbre, nomDe(NINO), AVANT_CENTRE.x, AVANT_CENTRE.y);

    // C'est le « le jeton NG se dessine PAR-DESSUS ZR #99 » du constat : deux
    // personnes au meme pixel, donc une des deux invisible.
    const positions = Array.from(positionDesJetons(arbre).values());
    expect(new Set(positions).size).toBe(positions.length);
  });

  test('T3 — au rechargement, l etat relu reste coherent', async () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    mesurerLeTerrain(arbre);

    lacherSurLeTerrain(arbre, nomDe(ZOE), AVANT_CENTRE.x, AVANT_CENTRE.y);
    lacherSurLeTerrain(arbre, nomDe(NINO), AVANT_CENTRE.x, AVANT_CENTRE.y);
    const pack = await packEnvoyeAuServeur(arbre);

    // On relit ce que le serveur renverrait : c'est ce chemin-la qui rouvre
    // l'ecran apres avoir tue l'app.
    const relu = normalizeMultiTeamPack(pack, {
      availablePresets: [PRESET_433],
      sportContext: 'football',
    });
    const placementsRelus = relu?.teams?.[0]?.placements || [];

    // Aucun jeton fantome : en mode « sur postes », chaque joueur pose tient un
    // poste, et deux joueurs ne partagent jamais le meme.
    expect(placementsRelus.every((placement) => Boolean(placement?.slotId))).toBe(true);
    expect(new Set(placementsRelus.map((placement) => placement.slotId)).size)
      .toBe(placementsRelus.length);
  });

  test('T1 bis — l ancien occupant retourne au banc, il n est pas efface', async () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    mesurerLeTerrain(arbre);

    lacherSurLeTerrain(arbre, nomDe(ZOE), AVANT_CENTRE.x, AVANT_CENTRE.y);
    lacherSurLeTerrain(arbre, nomDe(NINO), AVANT_CENTRE.x, AVANT_CENTRE.y);
    const pack = await packEnvoyeAuServeur(arbre);

    // Nino prend le poste...
    expect(postesTenus(pack).map((placement) => placement.playerId)).toEqual(['p-nino']);
    // ...et Zoe est REDEVENUE choisissable au banc, jamais perdue.
    expect(joueursAuBanc(arbre)).toContain(nomDe(ZOE));
  });

  test('T1 ter — echanger deux joueurs DEJA sur le terrain les fait permuter', async () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    mesurerLeTerrain(arbre);

    // Zoe a l'Avant-centre, Nino au Gardien.
    lacherSurLeTerrain(arbre, nomDe(ZOE), AVANT_CENTRE.x, AVANT_CENTRE.y);
    lacherSurLeTerrain(arbre, nomDe(NINO), 50, 92);
    // Puis on tire Nino sur l'Avant-centre : les deux permutent.
    lacherSurLeTerrain(arbre, nomDe(NINO), AVANT_CENTRE.x, AVANT_CENTRE.y);
    const pack = await packEnvoyeAuServeur(arbre);

    const parJoueur = new Map(
      postesTenus(pack).map((placement) => [placement.playerId, placement.slotId]),
    );
    expect(parJoueur.get('p-nino')).toBe('team_1:st');
    expect(parJoueur.get('p-zoe')).toBe('team_1:gk');
    expect(joueursAuBanc(arbre)).toEqual([nomDe(LEA)]);
  });

  // 🤝 LE TEMOIN QUI FIGE L'ACCORD ENTRE LES DEUX GESTES DU MEME ECRAN.
  //
  // Taper faisait DEJA (b) avant ce lot (`handleSlotPress`) : c'est ce desaccord
  // avec le glisser qui prouve que le glisser etait un bug, et pas un autre
  // choix de dessin. On fige donc les deux ensemble : le jour ou l'un des deux
  // repart de son cote, ce temoin le dit.
  test('T1 quater — TAPER sur un poste occupe rend aussi l ancien au banc', async () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    mesurerLeTerrain(arbre);

    // Zoe prend l'Avant-centre en TAPANT : on la choisit, puis on tape le poste.
    appuyerSur(arbre, nomDe(ZOE));
    appuyerSur(arbre, 'BU');
    expect(postesTenus(await packEnvoyeAuServeur(arbre))).toHaveLength(1);

    // Puis Nino, sur le MEME poste, par sa ligne dans la liste.
    appuyerSur(arbre, nomDe(NINO));
    appuyerSurLaLigneDePoste(arbre, 'BU');
    const pack = await packEnvoyeAuServeur(arbre);

    expect(postesTenus(pack).map((placement) => placement.playerId)).toEqual(['p-nino']);
    expect(joueursAuBanc(arbre)).toContain(nomDe(ZOE));
  });
});
