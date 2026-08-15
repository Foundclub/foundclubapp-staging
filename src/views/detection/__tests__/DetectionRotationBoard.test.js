import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { saveEventCompositionDraft } from '@/services/event/eventService';

import DetectionRotationBoard from '../DetectionRotationBoard';
import DetectionTeamsBoard from '../DetectionTeamsBoard';

// C-E — ECRANS 16 et 17 du pack composition : « Terrains multi-equipes » et
// « Rotation + chasuble ».
//
// Les 4 regles que ce fichier tient, parce que ce sont les temoins d'arret :
//   1. 🈲 Le mot « banc » et ses synonymes n'apparaissent NULLE PART a l'ecran.
//      Le pack l'interdit en detection (§6), et l'ancien hub disait
//      « Remplacants / en attente ». Ce temoin lit le TEXTE RENDU, pas le code.
//   2. 🔒 Glisser un joueur d'une equipe a l'autre marche toujours, et ne le
//      duplique jamais.
//   3. ⏱️ Le temps de jeu cumule est ECRIT sur le jeton, et il passe au rouge
//      sous 5 minutes.
//   4. ⛔ Passer a la manche suivante n'efface aucune affectation — la charge
//      envoyee au serveur porte les memes equipes.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockCompositionQuery = { data: null };

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const compte = options?.count;
        let valeur = lire(cle);
        if (typeof valeur !== 'string' && compte !== undefined) {
          valeur = lire(`${cle}${compte === 1 ? '_one' : '_other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_correspondance, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

// Le geste est REMPLACE par un enregistreur : chaque `Gesture.Pan()` garde ses
// rappels, et le test les declenche lui-meme. Seule facon d'exercer un
// glisser-deposer sans doigt. Motif repris du board de D79.
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

jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTeamComposition: () => mockCompositionQuery,
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

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { decision, isVisible }) => (
      isVisible ? <TexteRN>{`FEUILLE_OFFRE:${decision?.reason || ''}`}</TexteRN> : null
    ),
  };
});

jest.mock('@/components/tactical/DraggableToken', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { player }) => <TexteRN>{`JETON:${player?.lastname}`}</TexteRN>,
  };
});

const JOUEURS = [
  {
    appliedPosition: 'GB', documentId: 'p1', firstname: 'Ali', lastname: 'Un',
  },
  {
    appliedPosition: 'DC', documentId: 'p2', firstname: 'Bea', lastname: 'Deux',
  },
  {
    appliedPosition: 'BU', documentId: 'p3', firstname: 'Cyd', lastname: 'Trois',
  },
  { documentId: 'p4', firstname: 'Dan', lastname: 'Quatre' },
  { documentId: 'p5', firstname: 'Eve', lastname: 'Cinq' },
];

const equipes = () => ([
  {
    bibColor: 'jaune', name: 'Jaune', players: ['p1', 'p2', 'p3'], rotation: ['p3'], terrain: null,
  },
  {
    bibColor: 'rouge', name: 'Rouge', players: ['p4'], rotation: [], terrain: 'terrain B',
  },
]);

/** @type {any} */
let monte = null;

const texteDe = (/** @type {any} */ noeud) => {
  /** @type {string[]} */
  const morceaux = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    const enfants = enfant?.props?.children;
    if (Array.isArray(enfants)) enfants.forEach(parcourir);
    else parcourir(enfants);
  };
  parcourir(noeud);
  return morceaux.join(' ');
};

const toutLeTexte = (/** @type {any} */ racine) => racine.findAllByType(Text)
  .map((/** @type {any} */ noeud) => texteDe(noeud))
  .join(' | ');

const monter = (/** @type {any} */ Ecran, /** @type {any} */ parametres) => {
  mockRouteParams = parametres;
  act(() => {
    monte = renderer.create(<Ecran />);
  });
  return monte.root;
};

/**
 * Le geste attache au jeton de ce joueur.
 *
 * 🧨 On REMONTE depuis le jeton rendu : `props.children` ne contient que
 * l'arbre ECRIT, pas la sortie d'un composant. Chercher « JETON:… » dans les
 * enfants d'un parent ne trouve donc rien (piege paye au board de D79).
 * @param {any} racine - La racine du rendu.
 * @param {string} nom - Le nom de famille porte par le jeton.
 * @returns {any} - Le geste enregistre par la doublure.
 */
const gestePour = (racine, nom) => {
  const jeton = racine.findAll((/** @type {any} */ noeud) => noeud.type === Text
    && texteDe(noeud.props.children) === `JETON:${nom}`)[0];
  let courant = jeton;
  while (courant && !courant.props?.gesture) courant = courant.parent;
  return courant?.props?.gesture;
};

/**
 * Rejoue un glisser complet. Le terrain n'est jamais mesure dans un test
 * (`measureInWindow` n'existe pas sur un rendu de test) : `fieldRectRef` reste
 * donc nul, et TOUT lacher tombe « hors du terrain ». C'est ce qui permet de
 * prouver la sortie ; l'entree se prouve par la charge envoyee au serveur.
 * @param {any} geste - Le geste enregistre par la doublure.
 * @returns {void}
 */
const lacherDehors = (geste) => {
  act(() => {
    geste.rappels.onStart({ absoluteX: 10, absoluteY: 10 });
    geste.rappels.onEnd({ absoluteX: 9999, absoluteY: 9999 });
    geste.rappels.onFinalize();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCompositionQuery = { data: null };
  mockRouteParams = {};
});

afterEach(() => {
  if (monte) {
    act(() => {
      monte.unmount();
    });
    monte = null;
  }
});

describe('ECRAN 16 — terrains multi-equipes', () => {
  const parametres = () => ({
    eventId: 'event-1',
    players: JOUEURS,
    sport: 'football',
    teamId: 'team-1',
  });

  beforeEach(() => {
    mockCompositionQuery = {
      data: {
        detectionSplit: {
          rounds: [], splitBy: 'requested_position', teamCount: 2, teams: equipes(),
        },
        draft: { schemaVersion: 3 },
        eligiblePlayers: JOUEURS,
      },
    };
  });

  test('🈲 le mot « banc » et ses synonymes n apparaissent NULLE PART', () => {
    const racine = monter(DetectionTeamsBoard, parametres());

    const texte = toutLeTexte(racine).toLowerCase();
    expect(texte).not.toMatch(/banc/);
    expect(texte).not.toMatch(/rempla/);
    expect(texte).not.toMatch(/en attente/);
    expect(texte).not.toMatch(/convocation/);
  });

  test('le bandeau du bas s appelle NON AFFECTES et compte les vrais restants', () => {
    const racine = monter(DetectionTeamsBoard, parametres());

    // `p5` n'est dans aucune equipe : c'est le seul non affecte.
    expect(toutLeTexte(racine)).toContain('NON AFFECTÉS · 1');
    expect(toutLeTexte(racine)).toContain('Glisse pour placer');
  });

  test('les chips du pack sont la, dont « Par poste recherché »', () => {
    const racine = monter(DetectionTeamsBoard, parametres());

    const texte = toutLeTexte(racine);
    expect(texte).toContain('2/11 placés');
    expect(texte).toContain('Par poste recherché');
    expect(texte).toContain('Glisse pour échanger');
  });

  test('la pastille de poste du jeton porte le poste DEMANDÉ', () => {
    const racine = monter(DetectionTeamsBoard, parametres());

    // `p1` est place et a demande GB ; `p5` est non affecte, sans poste demande.
    expect(toutLeTexte(racine)).toContain('GB');
  });

  test('🔒 sortir un joueur du terrain le rend aux non affectés, sans le dupliquer', () => {
    const racine = monter(DetectionTeamsBoard, parametres());

    lacherDehors(gestePour(racine, 'Un'));

    const texte = toutLeTexte(racine);
    expect(texte).toContain('NON AFFECTÉS · 2');
    // Il n'apparait qu'une fois : ni sur le terrain, ni deux fois en bas.
    expect(texte.split('JETON:Un')).toHaveLength(2);
  });

  test('« + Équipe » ouvre un terrain de plus sans toucher aux affectations', () => {
    const racine = monter(DetectionTeamsBoard, parametres());

    const ajouter = racine.findAll((/** @type {any} */ noeud) => (
      typeof noeud.type !== 'string'
      && noeud.props?.onPress
      && texteDe(noeud).includes('+ Équipe')
    ))[0];
    act(() => {
      ajouter.props.onPress();
    });

    const texte = toutLeTexte(racine);
    expect(texte).toContain('3 équipes générées');
    expect(texte).toContain('Jaune · 3');
    expect(texte).toContain('Rouge · 1');
  });

  test('🚪 la porte de l ecran 17 existe, et elle emporte l equipe ouverte', () => {
    const racine = monter(DetectionTeamsBoard, parametres());

    const rotation = racine.findAll((/** @type {any} */ noeud) => (
      typeof noeud.type !== 'string'
      && noeud.props?.onPress
      && texteDe(noeud).includes('Faire tourner')
    ))[0];
    act(() => {
      rotation.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      'DetectionRotation',
      expect.objectContaining({ teamIndex: 0 }),
    );
    const charge = mockNavigate.mock.calls[0][1].detectionSplit;
    expect(charge.teams[0].players).toEqual(['p1', 'p2', 'p3']);
    expect(charge.teams[0].rotation).toEqual(['p3']);
  });
});

describe('ECRAN 17 — rotation, chasuble et temps de jeu', () => {
  const parametres = (/** @type {any} */ supplement = {}) => ({
    detectionSplit: {
      rounds: [{
        index: 1,
        playtimeByPlayer: { p1: 22, p2: 3 },
        startedAt: '2026-08-15T10:00:00.000Z',
      }],
      teamCount: 2,
      teams: equipes(),
    },
    eventId: 'event-1',
    players: JOUEURS,
    sport: 'football',
    teamId: 'team-1',
    teamIndex: 0,
    ...supplement,
  });

  test('🈲 aucun mot interdit, et le bandeau s appelle ROTATION', () => {
    const racine = monter(DetectionRotationBoard, parametres());

    const texte = toutLeTexte(racine);
    expect(texte.toLowerCase()).not.toMatch(/banc|rempla|en attente|convocation/);
    expect(texte).toContain('ROTATION · 1');
    expect(texte).toContain('Temps de jeu cumulé');
  });

  test('⏱️ le temps de jeu cumulé est ÉCRIT sur le jeton', () => {
    const racine = monter(DetectionRotationBoard, parametres());

    const texte = toutLeTexte(racine);
    expect(texte).toContain('22 min');
    expect(texte).toContain('3 min');
  });

  test('🔴 un joueur sous 5 minutes porte une pastille ROUGE, pas les autres', () => {
    const couleurs = jest.requireActual('@/theme/colors').default();
    const racine = monter(DetectionRotationBoard, parametres());

    const pastille = (/** @type {string} */ minutes) => racine.findAllByType(View)
      .find((/** @type {any} */ noeud) => texteDe(noeud) === minutes
        && noeud.props.style?.some?.((/** @type {any} */ entree) => entree?.backgroundColor));

    const styleDe = (/** @type {any} */ noeud) => noeud.props.style
      .find((/** @type {any} */ entree) => entree?.backgroundColor).backgroundColor;

    expect(styleDe(pastille('3 min'))).toBe(couleurs.error500);
    expect(styleDe(pastille('22 min'))).not.toBe(couleurs.error500);
  });

  test('la chasuble et le terrain sont annoncés en entête', () => {
    const racine = monter(DetectionRotationBoard, parametres({ teamIndex: 1 }));

    const texte = toutLeTexte(racine);
    expect(texte).toContain('Équipe Rouge');
    expect(texte).toContain('Chasuble Rouge');
    expect(texte).toContain('terrain B');
  });

  test('les chips disent qui joue et sur quelle manche', () => {
    const racine = monter(DetectionRotationBoard, parametres());

    const texte = toutLeTexte(racine);
    expect(texte).toContain('2 sur le terrain');
    expect(texte).toContain('Manche 1 / 1');
  });

  test('⛔ TEMOIN — lancer la manche suivante ne perd AUCUNE affectation', async () => {
    const racine = monter(DetectionRotationBoard, parametres());

    const suivante = racine.findAll((/** @type {any} */ noeud) => (
      typeof noeud.type !== 'string'
      && noeud.props?.onPress
      && texteDe(noeud).includes('Lancer la manche 2')
    ))[0];
    await act(async () => {
      await suivante.props.onPress();
    });

    const charge = saveEventCompositionDraft.mock.calls[0][1].draft;
    // 🔒 Les equipes partent a l'identique — c'est l'invariant du lot.
    expect(charge.detectionSplit.teams).toEqual(equipes());
    expect(charge.detectionSplit.rounds).toHaveLength(2);
    expect(charge.detectionSplit.rounds[1].index).toBe(2);
    // 🧨 Et le brouillon deja pose survit : `saveDraft` REMPLACE ce qu il recoit.
    expect(charge.schemaVersion).toBeUndefined();
  });

  test('🔒 sortir un joueur du terrain le met en ROTATION, il ne quitte pas l équipe', () => {
    const racine = monter(DetectionRotationBoard, parametres());

    lacherDehors(gestePour(racine, 'Un'));

    const texte = toutLeTexte(racine);
    expect(texte).toContain('ROTATION · 2');
    expect(texte).toContain('1 sur le terrain');
    expect(texte.split('JETON:Un')).toHaveLength(2);
  });

  test('« Voir les N équipes » ramène a l écran 16', () => {
    const racine = monter(DetectionRotationBoard, parametres());

    const retour = racine.findAll((/** @type {any} */ noeud) => (
      typeof noeud.type !== 'string'
      && noeud.props?.onPress
      && texteDe(noeud).includes('Voir les 2 équipes')
    ))[0];
    act(() => {
      retour.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('DetectionTeamsBoard', expect.any(Object));
  });
});
