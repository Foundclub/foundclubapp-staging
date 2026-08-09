// @ts-nocheck
import renderer, { act } from 'react-test-renderer';

import MultiTeamCompositionBoard from './MultiTeamCompositionBoard';
import { generateEventCompositionDraft, publishEventConvocation, saveEventCompositionDraft } from '@/services/event/eventService';

// D42 (E6) : `MultiTeamCompositionBoard.js` fait 1 551 lignes et n'avait AUCUN
// test propre. C'est pourtant l'ecran ou un coach compose son equipe : 4 actions
// qui touchent le serveur, un banc, des postes, des preselections.
//
// Ce fichier fige le COMPORTEMENT, jamais la mise en page : on appuie sur ce qui
// porte un libelle, on lit du texte rendu. C'est ce qui lui permet de survivre au
// decoupage en deux temps que ce lot apporte — un test qui cherchait une
// `ScrollView` a telle profondeur serait mort a la premiere ligne du lot.
//
// TEMOINS D'ARRET DU LOT (rouges avant, verts apres) : le describe
// « D42 — les deux temps ».

/** @type {any[]} */
const mockPaywallProps = [];
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
const mockClientRequeteFige = { invalidateQueries: jest.fn() };
const mockNavigationFigee = { goBack: jest.fn(), navigate: jest.fn() };
const mockAuthFige = { clubVerificationSummary: null, userData: null };

// Le vrai module tire `@gorhom` / le natif : Jest ne sait pas le transformer et
// la suite tomberait AVANT le premier rendu. La doublure marque chaque zone
// glissable pour qu'on puisse compter le cablage du geste sans le simuler.
jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const constructeurGeste = () => {
    const geste = { __estUnPan: true };
    ['activateAfterLongPress', 'minDistance', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']
      .forEach((nom) => {
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
      // Compteur de rendus : c'est le seul capteur qui voit une boucle. Le seuil
      // fait ECHOUER proprement au lieu de laisser Jest saturer la memoire.
      globalThis.__rendusDuBoard = (globalThis.__rendusDuBoard || 0) + 1;
      if (globalThis.__rendusDuBoard > 200) {
        throw new Error('BOUCLE DE RENDUS : le board ne se stabilise pas');
      }
      return theme;
    },
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite avant le premier rendu.
jest.mock('@/services/event/eventService', () => ({
  generateEventCompositionDraft: jest.fn(),
  publishEventConvocation: jest.fn(),
  saveEventCompositionDraft: jest.fn(),
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

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => {
  return {
    __esModule: true,
    default: (props) => {
      mockPaywallProps.push(props);
      return null;
    },
  };
});

// Le terrain est du SVG : on garde son role de CONTENEUR (il rend les postes),
// on jette son dessin.
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

const PRESET_442 = {
  key: '4-4-2',
  label: '4-4-2',
  slots: [
    {
      key: 'gk', label: 'GB', positionX: 50, positionY: 12, preferredPositions: [],
    },
    {
      key: 'st', label: 'BU', positionX: 50, positionY: 84, preferredPositions: [],
    },
  ],
};

const JOUEURS = [
  { documentId: 'p1', firstname: 'Ana', lastname: 'Bern' },
  { documentId: 'p2', firstname: 'Chloe', lastname: 'Diaz' },
  { documentId: 'p3', firstname: 'Emma', lastname: 'Faure' },
];

const parametresEdition = (surcharge = {}) => ({
  canEdit: true,
  editorMode: 'event',
  eventId: 'event-1',
  eventName: 'Match amical',
  players: JOUEURS,
  readOnly: false,
  sport: 'football',
  teamComposition: { availablePresets: [PRESET_442], draft: null, published: null },
  teamId: 'team-1',
  teamName: 'U15 Filles',
  ...surcharge,
});

/** @type {any[]} */
const arbresMontes = [];

const monter = (params) => {
  globalThis.__rendusDuBoard = 0;
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(<MultiTeamCompositionBoard routeParams={params} />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/** Combien de rendus a coute le dernier montage. */
const rendusDuDernierMontage = () => globalThis.__rendusDuBoard;

/** Tout le texte rendu, a plat : la seule couture qui survit a une refonte. */
const texteRendu = (arbre) => JSON.stringify(arbre.toJSON());

/** Combien de fois `motif` apparait dans le rendu (noeuds hotes uniquement). */
const compter = (arbre, motif) => texteRendu(arbre).split(motif).length - 1;

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
 * D42 — passe du TEMPS 1 (« Qui joue ? ») au TEMPS 2 (« Où ils jouent »).
 * Avant ce lot, tout tenait sur un seul ecran defilant : ce helper etait un
 * non-evenement. C'est LUI qui dit ce que le decoupage a deplace.
 */
const allerAuTerrain = (arbre) => appuyerSur(arbre, 'Suivant');

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
  jest.clearAllMocks();
});

describe('MultiTeamCompositionBoard — les 4 actions restent atteignables', () => {
  // ⛔ INVARIANT DU LOT : aucune des quatre actions ne disparait. Le decoupage en
  // deux temps a le droit de les DEPLACER, jamais de les supprimer.
  test('Sauvegarder envoie le brouillon au serveur pour cet evenement et cette equipe', async () => {
    saveEventCompositionDraft.mockResolvedValue({ draft: null });
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);

    await act(async () => {
      appuyerSur(arbre, 'Sauvegarder');
    });

    expect(saveEventCompositionDraft).toHaveBeenCalledTimes(1);
    const [idEvenement, charge] = saveEventCompositionDraft.mock.calls[0];
    expect(idEvenement).toBe('event-1');
    expect(charge.teamId).toBe('team-1');
    expect(charge.draft.schemaVersion).toBe(3);
  });

  test('Publier enregistre puis publie la convocation', async () => {
    saveEventCompositionDraft.mockResolvedValue({ draft: null });
    publishEventConvocation.mockResolvedValue({ published: null });
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);

    await act(async () => {
      appuyerSur(arbre, 'Publier');
    });

    expect(saveEventCompositionDraft).toHaveBeenCalledTimes(1);
    expect(publishEventConvocation).toHaveBeenCalledWith('event-1', { teamId: 'team-1' });
  });

  test('Generation auto ouvre son panneau, et le panneau genere le brouillon', async () => {
    generateEventCompositionDraft.mockResolvedValue({ draft: null });
    const arbre = monter(parametresEdition());

    appuyerSur(arbre, 'Génération auto');
    expect(estPressable(arbre, 'Générer le brouillon')).toBe(true);

    await act(async () => {
      appuyerSur(arbre, 'Générer le brouillon');
    });

    expect(generateEventCompositionDraft).toHaveBeenCalledTimes(1);
    const [idEvenement, charge] = generateEventCompositionDraft.mock.calls[0];
    expect(idEvenement).toBe('event-1');
    expect(charge.teamId).toBe('team-1');
    expect(charge.teamCount).toBe(1);
  });

  test('Ajouter une equipe fait apparaitre une seconde equipe', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    expect(compter(arbre, 'Équipe 2')).toBe(0);

    appuyerSur(arbre, 'Ajouter une équipe');

    expect(compter(arbre, 'Équipe 2')).toBeGreaterThan(0);
  });
});

describe('MultiTeamCompositionBoard — le banc, les postes, les preselections', () => {
  test('les joueurs disponibles sont sur le banc', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    const rendu = texteRendu(arbre);

    expect(rendu).toContain('Remplaçants / en attente');
    expect(rendu).toContain('Ana Bern');
    expect(rendu).toContain('Chloe Diaz');
    expect(rendu).toContain('Emma Faure');
  });

  test('sans aucun joueur connu, le banc le dit au lieu de rester muet', () => {
    const arbre = monter(parametresEdition({ players: [] }));

    expect(texteRendu(arbre)).toContain('Aucun joueur disponible pour le moment');
  });

  test('les postes de la formation sont listes et libres', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    const rendu = texteRendu(arbre);

    expect(rendu).toContain('GB');
    expect(rendu).toContain('BU');
    expect(compter(arbre, 'Libre')).toBeGreaterThan(0);
  });

  test('la preselection de formation est proposee et nommee', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);

    expect(texteRendu(arbre)).toContain('4-4-2');
    expect(estPressable(arbre, '<')).toBe(true);
    expect(estPressable(arbre, '>')).toBe(true);
  });
});

describe('MultiTeamCompositionBoard — placer un joueur', () => {
  test('taper un joueur puis un poste l\'attribue a ce poste', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    expect(compter(arbre, 'Libre')).toBe(2);

    // Le banc : on selectionne le joueur, puis on tape le poste.
    appuyerSur(arbre, 'Ana Bern');
    appuyerSur(arbre, 'GB');

    // Un poste de moins est libre, et le joueur n'est plus sur le banc.
    expect(compter(arbre, 'Libre')).toBe(1);
    expect(texteRendu(arbre)).toContain('Ana Bern');
  });

  test('chaque joueur du banc porte le geste de glisser', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);

    // 3 joueurs sur le banc, aucun place : 3 zones glissables.
    expect(compter(arbre, 'zone-glissable')).toBe(3);
  });

  test('un joueur place garde le geste : il peut etre reglisse ailleurs', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);

    appuyerSur(arbre, 'Ana Bern');
    appuyerSur(arbre, 'GB');

    // 2 joueurs restes au banc + le jeton pose sur le terrain.
    expect(compter(arbre, 'zone-glissable')).toBe(3);
  });
});

// ============================================================================
// D42 — LES TEMOINS D'ARRET DU LOT. Ces tests sont ROUGES sur la source d'avant.
// ============================================================================

describe('D42 — les deux temps', () => {
  test('TEMOIN 1 — on ouvre sur « Qui joue ? », et « Suivant » mene au terrain', () => {
    const arbre = monter(parametresEdition());

    // Temps 1 : on choisit les joueurs. Le terrain n'est pas encore la.
    expect(texteRendu(arbre)).toContain('Qui joue ?');
    expect(texteRendu(arbre)).toContain('Étape 1 sur 2');
    expect(estPressable(arbre, 'Suivant')).toBe(true);
    expect(texteRendu(arbre)).not.toContain('Remplaçants / en attente');

    allerAuTerrain(arbre);

    // Temps 2 : le terrain, le banc glissable, les postes.
    expect(texteRendu(arbre)).toContain('Étape 2 sur 2');
    expect(texteRendu(arbre)).toContain('Remplaçants / en attente');
    expect(texteRendu(arbre)).toContain('GB');
  });

  test('TEMOIN 2 — les 4 actions restent atteignables, chacune a son temps', () => {
    const arbre = monter(parametresEdition());

    // Temps 1 : la generation automatique, qui REMPLACE tout le pack.
    expect(estPressable(arbre, 'Génération auto')).toBe(true);
    expect(estPressable(arbre, 'Sauvegarder')).toBe(false);
    expect(estPressable(arbre, 'Publier')).toBe(false);
    expect(estPressable(arbre, 'Ajouter une équipe')).toBe(false);

    allerAuTerrain(arbre);

    // Temps 2 : les trois autres, plus le retour.
    expect(estPressable(arbre, 'Sauvegarder')).toBe(true);
    expect(estPressable(arbre, 'Publier')).toBe(true);
    expect(estPressable(arbre, 'Ajouter une équipe')).toBe(true);
    expect(estPressable(arbre, 'Retour')).toBe(true);
  });

  test('TEMOIN 3 — l\'aller-retour entre les deux temps ne perd RIEN', () => {
    const arbre = monter(parametresEdition());

    // Temps 1 : on ecarte un joueur.
    appuyerSur(arbre, 'Chloe Diaz');
    expect(texteRendu(arbre)).toContain('Écarté');

    // Temps 2 : on en place un autre sur un poste.
    allerAuTerrain(arbre);
    expect(compter(arbre, 'Libre')).toBe(2);
    appuyerSur(arbre, 'Ana Bern');
    appuyerSur(arbre, 'GB');
    expect(compter(arbre, 'Libre')).toBe(1);

    // Retour au temps 1 : le joueur ecarte l'est toujours.
    appuyerSur(arbre, 'Retour');
    expect(texteRendu(arbre)).toContain('Qui joue ?');
    expect(texteRendu(arbre)).toContain('Écarté');

    // Et le placement a survecu au passage.
    allerAuTerrain(arbre);
    expect(compter(arbre, 'Libre')).toBe(1);
  });

  test('la fleche de l\'entete revient au temps 1 au lieu de quitter l\'ecran', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);

    appuyerSur(arbre, 'retour-entete');

    expect(texteRendu(arbre)).toContain('Qui joue ?');
    expect(mockNavigationFigee.goBack).not.toHaveBeenCalled();
  });

  test('au temps 1, la fleche de l\'entete quitte bien l\'ecran', () => {
    const arbre = monter(parametresEdition());

    appuyerSur(arbre, 'retour-entete');

    expect(mockNavigationFigee.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('D42 — le temps 1 decide qui joue', () => {
  test('ecarter un joueur le retire du banc du temps 2', () => {
    const arbre = monter(parametresEdition());
    appuyerSur(arbre, 'Chloe Diaz');
    allerAuTerrain(arbre);

    const rendu = texteRendu(arbre);
    expect(rendu).toContain('Ana Bern');
    expect(rendu).not.toContain('Chloe Diaz');
  });

  test('un joueur ecarte alors qu\'il etait sur le terrain quitte le terrain', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    appuyerSur(arbre, 'Ana Bern');
    appuyerSur(arbre, 'GB');
    expect(compter(arbre, 'Libre')).toBe(1);

    appuyerSur(arbre, 'Retour');
    appuyerSur(arbre, 'Ana Bern');
    allerAuTerrain(arbre);

    // Le poste est redevenu libre : plus personne d'ecarte ne traine dessus.
    expect(compter(arbre, 'Libre')).toBe(2);
    expect(texteRendu(arbre)).not.toContain('Ana Bern');
  });

  test('la convocation part au serveur : un joueur ecarte n\'est plus en reserve', async () => {
    saveEventCompositionDraft.mockResolvedValue({ draft: null });
    const arbre = monter(parametresEdition());

    appuyerSur(arbre, 'Chloe Diaz');
    allerAuTerrain(arbre);
    await act(async () => {
      appuyerSur(arbre, 'Sauvegarder');
    });

    const [, charge] = saveEventCompositionDraft.mock.calls[0];
    expect(charge.draft.reservePlayerIds).toEqual(['p1', 'p3']);
  });

  test('« Effacer » puis « Tout sélectionner » remet tout le monde', () => {
    const arbre = monter(parametresEdition());

    appuyerSur(arbre, 'Effacer');
    expect(compter(arbre, 'Convoqué')).toBe(0);

    appuyerSur(arbre, 'Tout sélectionner');
    expect(compter(arbre, 'Convoqué')).toBe(3);
  });

  test('un joueur ajoute a la main rejoint la composition et part au serveur', async () => {
    saveEventCompositionDraft.mockResolvedValue({ draft: null });
    const arbre = monter(parametresEdition({ players: [] }));

    appuyerSur(arbre, 'Ajouter un joueur');
    const champs = arbre.root.findAll(
      (noeud) => noeud.props?.placeholder && typeof noeud.props?.onChangeText === 'function',
    );
    act(() => {
      champs.find((champ) => champ.props.placeholder.startsWith('Prénom')).props.onChangeText('Zoe');
      champs.find((champ) => champ.props.placeholder.startsWith('Nom')).props.onChangeText('Roux');
    });
    appuyerSur(arbre, 'Ajouter');

    expect(texteRendu(arbre)).toContain('Zoe Roux');

    allerAuTerrain(arbre);
    await act(async () => {
      appuyerSur(arbre, 'Sauvegarder');
    });

    const [, charge] = saveEventCompositionDraft.mock.calls[0];
    expect(charge.draft.manualPlayers).toHaveLength(1);
    expect(charge.draft.manualPlayers[0].firstname).toBe('Zoe');
  });
});

describe('D42 — la consigne decrit le geste qui existe vraiment', () => {
  test('le temps 2 parle de GLISSER, plus seulement de toucher un poste', () => {
    const arbre = monter(parametresEdition());
    allerAuTerrain(arbre);
    const rendu = texteRendu(arbre);

    expect(rendu).toContain('Fais glisser un joueur des remplaçants vers le terrain');
    // L'ancienne consigne decrivait un mode qui n'etait plus le seul.
    expect(rendu).not.toContain("puis touche un poste pour l'attribuer");
  });
});

describe('D42 — la lecture seule n\'a PAS de deux temps', () => {
  // Ce que voit un joueur sur une convocation publiee. Le decoupage ne le
  // concerne pas : il n'a rien a composer.
  test('la convocation publiee rend ses branches, sans etape ni « Suivant »', () => {
    const arbre = monter(parametresEdition({
      aggregateBranches: [{
        published: { schemaVersion: 3, teams: [] },
        team: { documentId: 't1', name: 'U15 Filles' },
        viewer: { inReserve: false, teamEntryIds: [] },
      }],
      canEdit: false,
      readOnly: true,
    }));
    const rendu = texteRendu(arbre);

    expect(rendu).toContain('U15 Filles');
    expect(rendu).toContain('branche(s)');
    expect(rendu).not.toContain('Étape 1 sur 2');
    expect(estPressable(arbre, 'Suivant')).toBe(false);
  });
});

describe('D42 — le board se stabilise (regression de boucle de rendus)', () => {
  // MESURE du 2026-08-08 sur la source d'avant ce lot : ces trois cas rendaient
  // 402 fois sans jamais se stabiliser, parce que les valeurs par defaut `= []`
  // de la destructuration fabriquaient un tableau neuf a chaque rendu.
  test('tel que EventDetails ouvre l\'ecran (ni availablePresets ni selectedPlayers)', () => {
    monter(parametresEdition());
    expect(rendusDuDernierMontage()).toBeLessThan(10);
  });

  test('tel que TacticalSelection ouvre l\'ecran (selectedPlayers seul)', () => {
    monter(parametresEdition({ selectedPlayers: JOUEURS }));
    expect(rendusDuDernierMontage()).toBeLessThan(10);
  });

  test('sur un sport sans aucune formation connue', () => {
    monter(parametresEdition({ teamComposition: null }));
    expect(rendusDuDernierMontage()).toBeLessThan(10);
  });

  test('en lecture seule (convocation publiee consultee par un joueur)', () => {
    monter(parametresEdition({
      aggregateBranches: [{ published: { teams: [] }, team: { name: 'U15 Filles' } }],
      canEdit: false,
      readOnly: true,
    }));
    expect(rendusDuDernierMontage()).toBeLessThan(10);
  });
});

// ============================================================================
// D44 — UN MATCH N'EST PAS UNE DETECTION. Temoins d'arret du lot : ROUGES avant.
//
// Le type de l'evenement descend depuis EventDetails sous le nom `eventKind`
// ('match' | 'detection'). Il arrivait jusqu'ici et PERSONNE ne le lisait :
// `git grep eventKind` ne rendait que l'ANCIEN board. Consequence mesuree — un
// match de football affichait « Generation auto » et « Ajouter une equipe »
// parce que leur seule condition etait « ce sport a des schemas connus », ce qui
// est vrai de tout match de football.
//
// ⛔ INVARIANT : la DETECTION ne perd rien, et une composition DEJA ENREGISTREE
// reste affichable et modifiable, quel que soit le type.
// ============================================================================

const parametresMatch = (surcharge = {}) => parametresEdition({ eventKind: 'match', ...surcharge });
const parametresDetection = (surcharge = {}) => parametresEdition({
  eventKind: 'detection',
  ...surcharge,
});

/** Une composition a DEUX equipes, telle que le serveur la rend une fois enregistree. */
const COMPO_DEUX_EQUIPES = {
  schemaVersion: 3,
  teams: [
    {
      id: 'team_1', name: 'Groupe A', placements: [], presetKey: '4-4-2',
    },
    {
      id: 'team_2', name: 'Groupe B', placements: [], presetKey: '4-4-2',
    },
  ],
};

describe('D44 — un MATCH ne montre plus les commandes de la DETECTION', () => {
  test('TEMOIN 1 — sur un MATCH, ni « Generation auto » ni « Ajouter une equipe »', () => {
    const arbre = monter(parametresMatch());

    expect(estPressable(arbre, 'Génération auto')).toBe(false);

    allerAuTerrain(arbre);
    expect(estPressable(arbre, 'Ajouter une équipe')).toBe(false);
  });

  test('TEMOIN 2 — sur une DETECTION, les 4 commandes sont TOUTES la', () => {
    const arbre = monter(parametresDetection());

    expect(estPressable(arbre, 'Génération auto')).toBe(true);

    allerAuTerrain(arbre);
    expect(estPressable(arbre, 'Ajouter une équipe')).toBe(true);
    expect(estPressable(arbre, 'Sauvegarder')).toBe(true);
    expect(estPressable(arbre, 'Publier')).toBe(true);
  });

  test('TEMOIN 3 — une compo multi-equipes DEJA ENREGISTREE sur un match reste modifiable', () => {
    const arbre = monter(parametresMatch({ existingComposition: COMPO_DEUX_EQUIPES }));
    allerAuTerrain(arbre);
    const rendu = texteRendu(arbre);

    // AFFICHABLE : les deux equipes enregistrees sont rendues.
    expect(rendu).toContain('Groupe A');
    expect(rendu).toContain('Groupe B');

    // MODIFIABLE : on peut retirer une equipe, changer son schema, et placer un
    // joueur. Cacher le bouton qui CREE ne doit rien retirer de tout ca.
    expect(estPressable(arbre, 'Suppr.')).toBe(true);
    expect(estPressable(arbre, 'Sauvegarder')).toBe(true);
    expect(estPressable(arbre, 'Publier')).toBe(true);
    appuyerSur(arbre, 'Ana Bern');
    appuyerSur(arbre, 'GB');
    expect(texteRendu(arbre)).toContain('Ana Bern');

    // PAS D'IMPASSE : la composition est deja multi-equipes, donc « Ajouter une
    // equipe » reste offert. Sinon un coach qui en retire une par erreur ne
    // pourrait plus jamais la remettre.
    expect(estPressable(arbre, 'Ajouter une équipe')).toBe(true);
  });

  test('un MATCH garde tout le reste : convoquer, ajouter un joueur, avancer, enregistrer', () => {
    const arbre = monter(parametresMatch());

    expect(estPressable(arbre, 'Tout sélectionner')).toBe(true);
    expect(estPressable(arbre, 'Effacer')).toBe(true);
    expect(estPressable(arbre, 'Ajouter un joueur')).toBe(true);
    expect(estPressable(arbre, 'Suivant')).toBe(true);

    allerAuTerrain(arbre);
    expect(estPressable(arbre, 'Sauvegarder')).toBe(true);
    expect(estPressable(arbre, 'Publier')).toBe(true);
    expect(estPressable(arbre, 'Retour')).toBe(true);
  });

  test('sur un MATCH, le panneau de generation reste ferme meme si on demande « auto »', () => {
    const arbre = monter(parametresMatch({ compositionIntent: 'auto' }));

    expect(texteRendu(arbre)).not.toContain('Génération automatique');
    expect(estPressable(arbre, 'Générer le brouillon')).toBe(false);
  });

  test('sur une DETECTION, l\'appelant qui demande « auto » ouvre bien le panneau', () => {
    const arbre = monter(parametresDetection({ compositionIntent: 'auto' }));

    expect(texteRendu(arbre)).toContain('Génération automatique');
    expect(estPressable(arbre, 'Générer le brouillon')).toBe(true);
  });

  test('TYPE INCONNU (vieux parametres, appelant muet) : rien ne disparait', () => {
    // Le choix le plus sur : on ne retire une commande que sur un type DIT
    // 'match'. Une commande de trop se voit et se corrige ; une commande absente
    // laisse un coach sans issue, et c'est irrattrapable depuis l'ecran.
    const arbre = monter(parametresEdition());
    expect(parametresEdition().eventKind).toBeUndefined();

    expect(estPressable(arbre, 'Génération auto')).toBe(true);
    allerAuTerrain(arbre);
    expect(estPressable(arbre, 'Ajouter une équipe')).toBe(true);
  });

  test('le board ne boucle pas davantage avec un type d\'evenement', () => {
    monter(parametresMatch());
    expect(rendusDuDernierMontage()).toBeLessThan(10);

    monter(parametresDetection());
    expect(rendusDuDernierMontage()).toBeLessThan(10);
  });
});
