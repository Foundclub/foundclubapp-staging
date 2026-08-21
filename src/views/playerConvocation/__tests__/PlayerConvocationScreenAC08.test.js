import renderer, { act } from 'react-test-renderer';

import PlayerConvocationScreen from '../PlayerConvocationScreen';

// ==========================================================================
// AC08 — TEMOINS 2, 3 et 4 du lot.
//
//   2. ⛔ PLUS DE CUL-DE-SAC : un retour existe DES le chargement. L'ecran
//      d'attente n'avait qu'un rond qui tourne ; charge vide, requete en
//      erreur ou reseau coupe, le joueur restait enferme sans aucun geste.
//   3. 🔦 LE VOYANT SUR LE BON BOUTON : il se lisait sur la reponse DEJA
//      enregistree, donc sans reponse anterieure, appuyer sur « Absent »
//      faisait tourner « Present ».
//   4. 🪑 LE BANC : `reservePlayerIds` et `reserveSnapshotPlayers` voyagent
//      dans la charge depuis toujours et AUCUN ecran ne les montrait.
//
// 🧨 Et la charge utilisee ici est celle du SERVEUR (forme `branches`), pas
// l'ancienne forme a plat : c'est elle qui rendait l'ecran vide pour tout le
// monde, notification comprise.
// ==========================================================================

const mockGoBack = jest.fn();
const mockReplace = jest.fn();

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockMutationState;
/** @type {any} */
let mockQueryState;

const mockNavigation = { goBack: mockGoBack, navigate: jest.fn(), replace: mockReplace };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { eventId: 'evt-1', teamId: 'team-1' } }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => mockMutationState,
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const valeur = cle.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: { location: 'Stade Municipal', startTime: '15:00:00.000' } }),
  useGetEventConvocation: () => mockQueryState,
}));

jest.mock('@/services/event/eventService', () => ({
  respondToEventRsvp: jest.fn(() => Promise.resolve({})),
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
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

// 🔒 La doublure du bouton de RETOUR porte son `onPress` : c'est ce qui permet
// de prouver qu'un geste de sortie EXISTE, pas seulement qu'un mot est ecrit.
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>RETOUR</TexteRN>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/components/atoms/loader/Loader', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>CHARGEMENT</TexteRN> };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

// La doublure du bouton ECRIT son voyant : « Absent ⏳ » se lit, contrairement
// a une propriete rangee dans l'arbre.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { isLoading, onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{`${title}${isLoading ? ' ⏳' : ''}`}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
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
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TexteRN)
    .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
    .join(' | ');
};

const PACK = {
  publishedBy: { firstname: 'Coach', lastname: 'Karim' },
  reservePlayerIds: ['joueur-2'],
  reserveSnapshotPlayers: [{
    documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra', number: 7,
  }],
  snapshotPlayers: [
    {
      documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla', number: 1,
    },
  ],
  sportContext: 'football',
  teams: [{
    id: 'team_1',
    name: 'Senior 1',
    placements: [{
      playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
    }],
  }],
};

// 🧨 LA CHARGE REELLE : `branches`, jamais `published` a la racine.
const CHARGE_SERVEUR = {
  branches: [{
    published: PACK,
    responses: { byPlayerId: {}, counts: { absent: 0, pending: 2, present: 0 } },
    team: { documentId: 'team-1', name: 'Senior 1' },
    viewer: { inReserve: false, teamEntryIds: [] },
  }],
  event: { date: '2026-08-15T15:00:00.000Z', documentId: 'evt-1', name: 'Match' },
  eventKind: 'event',
  schemaVersion: 3,
};

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<PlayerConvocationScreen />);
  });
  return arbre;
};

/**
 * Le pressable qui porte ce mot dans son texte.
 * @param {any} arbre
 * @param {string} mot
 * @returns {any}
 */
const boutonPortant = (arbre, mot) => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TouchableOpacity).find(
    (/** @type {any} */ noeud) => noeud.findAllByType(TexteRN)
      .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).includes(mot)),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserData = { documentId: 'joueur-1' };
  mockMutationState = { isPending: false, mutate: jest.fn(), variables: undefined };
  mockQueryState = { data: CHARGE_SERVEUR, isError: false, isLoading: false };
});

describe('AC08 · TEMOIN — la charge REELLE du serveur est enfin lue', () => {
  test('🥇 le convoque voit son terrain — la charge n a AUCUN « published » a la racine', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('Tu es convoqué');
    expect(texte).toContain('Titulaire');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('AC08 · TEMOIN 2 — ⛔ aucun cul-de-sac', () => {
  test('pendant le chargement, un bouton de RETOUR existe et il agit', () => {
    mockQueryState = { data: undefined, isError: false, isLoading: true };
    const arbre = rendre();

    expect(texteVisible(arbre)).toContain('CHARGEMENT');

    const retour = boutonPortant(arbre, 'RETOUR');
    expect(retour).toBeDefined();
    act(() => {
      retour.props.onPress();
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('quand la charge n apporte rien, on le DIT — et le retour est toujours la', () => {
    mockQueryState = { data: { branches: [] }, isError: false, isLoading: false };
    const arbre = rendre();

    expect(texteVisible(arbre)).toContain('Aucune composition publiée ne te concerne');
    expect(boutonPortant(arbre, 'RETOUR')).toBeDefined();
    // ⛔ Jamais « Tu es convoque » a quelqu un qui ne l est pas.
    expect(texteVisible(arbre)).not.toContain('Tu es convoqué');
  });

  test('une requete en ERREUR ne laisse pas non plus le joueur enferme', () => {
    mockQueryState = { data: undefined, isError: true, isLoading: false };

    expect(boutonPortant(rendre(), 'RETOUR')).toBeDefined();
  });
});

describe('AC08 · TEMOIN 3 — 🔦 le voyant sur le BON bouton', () => {
  test('sans reponse anterieure, appuyer sur « Absent » fait tourner ABSENT', () => {
    mockMutationState = { isPending: true, mutate: jest.fn(), variables: 'absent' };
    const texte = texteVisible(rendre());

    expect(texte).toContain('Absent ⏳');
    expect(texte).not.toContain('Présent ⏳');
  });

  test('et appuyer sur « Present » fait tourner PRESENT', () => {
    mockMutationState = { isPending: true, mutate: jest.fn(), variables: 'present' };
    const texte = texteVisible(rendre());

    expect(texte).toContain('Présent ⏳');
    expect(texte).not.toContain('Absent ⏳');
  });

  test('au repos, aucun bouton ne tourne', () => {
    expect(texteVisible(rendre())).not.toContain('⏳');
  });
});

describe('AC08 · TEMOIN 4 — 🪑 le banc, montre a quelqu un pour la premiere fois', () => {
  test('un remplacant lit son nom dans le bloc Remplacants', () => {
    mockUserData = { documentId: 'joueur-2' };
    const texte = texteVisible(rendre());

    expect(texte).toContain('REMPLAÇANTS');
    expect(texte).toContain('Leo Diarra');
  });

  test('le titulaire voit le banc lui aussi — il sait qui l accompagne', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('REMPLAÇANTS');
    expect(texte).toContain('Leo Diarra');
  });

  test('sans remplacant, aucun bloc vide n est dessine', () => {
    mockQueryState = {
      data: {
        ...CHARGE_SERVEUR,
        branches: [{
          ...CHARGE_SERVEUR.branches[0],
          published: { ...PACK, reservePlayerIds: [], reserveSnapshotPlayers: [] },
        }],
      },
      isError: false,
      isLoading: false,
    };

    expect(texteVisible(rendre())).not.toContain('REMPLAÇANTS');
  });
});
