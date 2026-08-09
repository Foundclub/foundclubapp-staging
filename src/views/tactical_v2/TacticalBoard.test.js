// @ts-nocheck
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { deleteTeamDefaultComposition, saveTeamDefaultComposition } from '@/services/team/teamService';

import TacticalBoard from './TacticalBoard';

// D45 (E6) : `TacticalBoard.js` fait 1 864 lignes et n'avait AUCUN test. C'est
// pourtant l'ecran de la COMPOSITION TYPE — celui qu'on ouvre depuis la fiche
// d'equipe pour ranger une composition qui pre-remplira les prochains matchs.
//
// Ce lot ne change AUCUN comportement : il change des MOTS. Un seul objet
// portait trois noms a l'ecran (« Composition type » sur le bouton d'entree,
// « Favori d'equipe » sur l'ecran, « Enregistrer le favori » sur son action).
//
// Ce fichier fige donc ce que l'ecran DIT, et rien de sa mise en page : on lit
// du texte rendu, on appuie sur ce qui porte un libelle. C'est ce qui prouve
// qu'en renommant, on n'a pas deplace un bouton ni casse une action.

/** @type {any[]} */
const mockPaywallProps = [];
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
const mockClientRequeteFige = { invalidateQueries: jest.fn() };
const mockNavigationFigee = {
  addListener: jest.fn(() => () => {}),
  goBack: jest.fn(),
  navigate: jest.fn(),
  push: jest.fn(),
};
const mockAuthFige = { clubVerificationSummary: null, userData: null };
const mockTourFige = { currentStep: null };
// 🔬 Le capteur qui rend une boucle de rendus LISIBLE. Un objet de module plutot
// que `globalThis` : le prefixe `mock` est ce que le hoisting de `jest.mock`
// autorise a referencer, et ca evite 10 alertes de la porte lint.
const mockCompteurRendus = { valeur: 0 };
// ♾️ Figee HORS de la fabrique : un objet neuf a chaque appel de `useRoute`
// relancerait les `useMemo` qui en dependent a chaque rendu (piege D42).
const mockRouteFigee = { params: {} };

// Le vrai module tire `@gorhom` / le natif : Jest ne sait pas le transformer et
// la suite tomberait AVANT le premier rendu.
jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { ScrollView: DefilementRN, View: VueRN } = jest.requireActual('react-native');
  const constructeurGeste = () => {
    const geste = { __estUnPan: true };
    [
      'activateAfterLongPress', 'activeOffsetY', 'failOffsetX', 'minDistance',
      'onBegin', 'onEnd', 'onFinalize', 'onStart', 'onUpdate',
    ].forEach((nom) => {
      geste[nom] = () => geste;
    });
    return geste;
  };

  return {
    Gesture: { Pan: constructeurGeste },
    GestureDetector: ({ children }) => reactActuel.createElement(
      VueRN,
      { accessibilityLabel: 'zone-glissable' },
      children,
    ),
    GestureHandlerRootView: VueRN,
    ScrollView: DefilementRN,
  };
});

jest.mock('react-native-reanimated', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    cancelAnimation: () => {},
    default: { View: VueRN },
    runOnJS: (fonction) => fonction,
    useAnimatedRef: () => reactActuel.createRef(),
    useAnimatedStyle: () => ({}),
    useSharedValue: (valeur) => ({ value: valeur }),
    withRepeat: (valeur) => valeur,
    withSequence: (valeur) => valeur,
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
  useRoute: () => mockRouteFigee,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthFige,
}));

jest.mock('@/context/TourContext', () => ({
  useTour: () => mockTourFige,
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
}));

// Le VRAI theme, sans le contexte React qui le porte : un Proxy rendrait les
// echecs Jest illisibles et un objet invente masquerait un jeton absent.
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

  return {
    __esModule: true,
    default: () => {
      // Compteur de rendus : le seul capteur qui voit une boucle. Le seuil fait
      // ECHOUER proprement au lieu de laisser Jest saturer la memoire.
      mockCompteurRendus.valeur += 1;
      if (mockCompteurRendus.valeur > 200) {
        throw new Error('BOUCLE DE RENDUS : le board ne se stabilise pas');
      }
      return theme;
    },
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite avant le premier rendu.
jest.mock('@/services/event/eventService', () => ({
  publishEventConvocation: jest.fn(),
  saveEventCompositionDraft: jest.fn(),
}));

jest.mock('@/services/team/teamService', () => ({
  deleteTeamDefaultComposition: jest.fn(),
  saveTeamDefaultComposition: jest.fn(),
}));

// La doublure de Button rend un VRAI pressable portant son titre : c'est ce qui
// permet de piloter l'ecran par le libelle plutot que par la forme de l'arbre.
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

// Le terrain est du SVG : on garde son role de CONTENEUR, on jette son dessin.
jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

jest.mock('./DraggableToken', () => ({
  __esModule: true,
  default: () => null,
}));

const JOUEURS = [
  { documentId: 'p1', firstname: 'Ana', lastname: 'Bern' },
  { documentId: 'p2', firstname: 'Chloe', lastname: 'Diaz' },
];

/** L'ecran tel que la fiche d'equipe l'ouvre : la COMPOSITION TYPE. */
const parametresCompositionType = (surcharge = {}) => ({
  canEdit: true,
  editorMode: 'team-default',
  players: JOUEURS,
  readOnly: false,
  sport: 'football',
  teamDefaultComposition: null,
  teamId: 'team-1',
  teamName: 'U15 Filles',
  ...surcharge,
});

/** Le meme ecran ouvert depuis un EVENEMENT : l'autre porte, celle du match. */
const parametresEvenement = (surcharge = {}) => ({
  canEdit: true,
  editorMode: 'event',
  eventId: 'event-1',
  eventName: 'Match amical',
  players: JOUEURS,
  readOnly: false,
  sport: 'football',
  teamComposition: null,
  teamId: 'team-1',
  teamName: 'U15 Filles',
  ...surcharge,
});

/** @type {any[]} */
const arbresMontes = [];

const monter = (params) => {
  mockCompteurRendus.valeur = 0;
  mockRouteFigee.params = params;
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(<TacticalBoard />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/** Tout le texte rendu, a plat : la seule couture qui survit a une refonte. */
const texteRendu = (arbre) => JSON.stringify(arbre.toJSON());

const trouverParLibelle = (arbre, libelle) => arbre.root.findAll(
  (noeud) => noeud.props?.accessibilityLabel === libelle && typeof noeud.props?.onPress === 'function',
);

const appuyerSur = (arbre, libelle) => {
  const cibles = trouverParLibelle(arbre, libelle);
  if (cibles.length === 0) throw new Error(`Aucun element pressable nomme « ${libelle} »`);
  act(() => {
    cibles[0].props.onPress();
  });
};

const estPressable = (arbre, libelle) => trouverParLibelle(arbre, libelle).length > 0;

/**
 * Ouvre le panneau « Actions », ou vivent le bouton principal et la carte
 * d'etat. 🔁 IDEMPOTENT : `togglePanel` est une BASCULE, un second appel
 * refermerait le panneau et l'inventaire vide se lirait comme une regression.
 */
const ouvrirLesActions = (arbre) => {
  if (texteRendu(arbre).includes('Modifier les joueurs')) return;
  appuyerSur(arbre, 'Actions');
};

/** Les arguments du dernier `Alert.alert` : titre, message, boutons. */
const dernierAlerte = () => Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1];

/** Declenche le bouton `libelle` de la derniere boite de dialogue. */
const repondreALAlerte = async (libelle) => {
  const boutons = dernierAlerte()[2] || [];
  const bouton = boutons.find((candidat) => candidat.text === libelle);
  if (!bouton) throw new Error(`Aucun bouton « ${libelle} » dans la derniere alerte`);
  await act(async () => {
    await bouton.onPress();
  });
};

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  // Demonter explicitement : un arbre laisse monte peut armer un timer qui
  // tombe apres la fin de l'environnement Jest et tue le processus entier.
  while (arbresMontes.length > 0) {
    const arbre = arbresMontes.pop();
    act(() => {
      arbre.unmount();
    });
  }
  mockPaywallProps.length = 0;
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('TacticalBoard — la composition type porte UN SEUL nom', () => {
  // ⛔ TEMOIN D'ARRET DU LOT D45. Chaque assertion nomme une surface que
  // l'utilisateur LIT. Avant ce lot, elles disaient toutes « Favori d'equipe ».

  test("l'en-tete annonce la composition type", () => {
    const arbre = monter(parametresCompositionType());

    expect(texteRendu(arbre)).toContain('Composition type');
    expect(texteRendu(arbre)).not.toContain('Favori d\'équipe');
  });

  test('le bouton principal enregistre la composition type', () => {
    const arbre = monter(parametresCompositionType());
    ouvrirLesActions(arbre);

    expect(estPressable(arbre, 'Enregistrer la composition type')).toBe(true);
  });

  test('sans composition enregistree, la carte invite a en preparer une', () => {
    const arbre = monter(parametresCompositionType());
    ouvrirLesActions(arbre);

    expect(texteRendu(arbre)).toContain("Prépare une composition type pour l'équipe");
    expect(texteRendu(arbre))
      .toContain('Place les joueurs sur le terrain puis enregistre cette composition type');
  });

  test('avec une composition enregistree, la carte la dit active', () => {
    const arbre = monter(parametresCompositionType({
      teamDefaultComposition: { composition: { updatedAt: '2026-08-09T10:00:00.000Z' } },
    }));
    ouvrirLesActions(arbre);

    expect(texteRendu(arbre)).toContain('Composition type active');
    expect(texteRendu(arbre)).toContain('Composition type enregistrée');
  });

  test('le retrait se nomme, se confirme et se conclut au feminin', async () => {
    deleteTeamDefaultComposition.mockResolvedValue(null);
    const arbre = monter(parametresCompositionType({
      teamDefaultComposition: { composition: { updatedAt: '2026-08-09T10:00:00.000Z' } },
    }));
    ouvrirLesActions(arbre);

    appuyerSur(arbre, 'Retirer la composition type');
    expect(dernierAlerte()[0]).toBe('Retirer la composition type');
    expect(dernierAlerte()[1]).toBe('Cette action retire la composition type de cette équipe.');

    await repondreALAlerte('Supprimer');
    expect(deleteTeamDefaultComposition).toHaveBeenCalledWith('team-1');
    expect(dernierAlerte()[0]).toBe('Succès');
    expect(dernierAlerte()[1]).toBe('Composition type supprimée.');
  });

  test("depuis un evenement, l'autre porte parle le meme langage", () => {
    const arbre = monter(parametresEvenement());
    ouvrirLesActions(arbre);

    expect(estPressable(arbre, 'Enregistrer comme composition type')).toBe(true);
    expect(texteRendu(arbre))
      .toContain('Composition type : reutilise cette composition comme base de depart');
    expect(texteRendu(arbre)).not.toContain('favori');
  });

  test('le mot « favori » a disparu des deux portes', () => {
    const typeArbre = monter(parametresCompositionType({
      teamDefaultComposition: { composition: { updatedAt: '2026-08-09T10:00:00.000Z' } },
    }));
    ouvrirLesActions(typeArbre);
    expect(texteRendu(typeArbre).toLowerCase()).not.toContain('favor');

    const evenementArbre = monter(parametresEvenement());
    ouvrirLesActions(evenementArbre);
    expect(texteRendu(evenementArbre).toLowerCase()).not.toContain('favor');
  });
});

describe('TacticalBoard — ce que D45 ne devait PAS toucher', () => {
  // ⛔ INVARIANTS : le lot ne change que des mots. Ces assertions tombent si un
  // bouton, un envoi au serveur ou le vocabulaire du BROUILLON a bouge.

  test('le board se stabilise (aucune boucle de rendus)', () => {
    monter(parametresCompositionType());

    expect(mockCompteurRendus.valeur).toBeLessThan(10);
  });

  test('le brouillon garde son propre nom, distinct de la composition type', () => {
    const arbre = monter(parametresEvenement());
    ouvrirLesActions(arbre);

    expect(estPressable(arbre, 'Sauvegarder ce brouillon')).toBe(true);
    expect(estPressable(arbre, "Publier la composition d'équipe")).toBe(true);
  });

  test('les actions de la composition type restent atteignables', () => {
    const arbre = monter(parametresCompositionType());
    ouvrirLesActions(arbre);

    expect(estPressable(arbre, 'Modifier les joueurs')).toBe(true);
    expect(estPressable(arbre, 'Sauvegarder ce brouillon')).toBe(false);
  });

  test('enregistrer envoie bien la composition au serveur pour cette equipe', async () => {
    saveTeamDefaultComposition.mockResolvedValue({ composition: { updatedAt: 'x' } });
    const arbre = monter(parametresCompositionType());
    ouvrirLesActions(arbre);

    await act(async () => {
      await trouverParLibelle(arbre, 'Enregistrer la composition type')[0].props.onPress();
    });

    expect(saveTeamDefaultComposition).toHaveBeenCalledTimes(1);
    expect(saveTeamDefaultComposition.mock.calls[0][0]).toBe('team-1');
    expect(dernierAlerte()[1]).toBe('Composition type enregistrée.');
  });

  test('le mode lecture seule garde son propre en-tete', () => {
    const arbre = monter(parametresEvenement({ readOnly: true }));

    expect(texteRendu(arbre)).toContain('Composition publiée');
  });
});
