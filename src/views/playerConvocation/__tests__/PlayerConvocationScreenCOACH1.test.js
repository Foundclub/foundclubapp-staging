import renderer, { act } from 'react-test-renderer';

import PlayerConvocationScreen from '../PlayerConvocationScreen';

// ==========================================================================
// LOT COACH1 (E6) — « l entraineur apparait sur la convocation que voient les
// joueurs » (decision d Adel du 2026-09-21, confirmee « 3 - A »).
//
// Le serveur range l encadrement dans chaque branche de
// `GET /events/:id/convocation` (`staff`, `event-composition.ts`,
// `buildConvocationStaff`) : les entraineurs de l equipe qui ont repondu
// PRESENT. L ecran du joueur doit le montrer dans une partie a part —
// « ENCADREMENT » — jamais sur le terrain ni sur le banc.
//
// Harnais repris d `PlayerConvocationScreenAC08` (memes doublures, meme charge
// serveur, traductions REELLES de fr.js). Ecrits ROUGES contre `f9ea5914`.
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

beforeEach(() => {
  jest.clearAllMocks();
  mockUserData = { documentId: 'joueur-1' };
  mockMutationState = { isPending: false, mutate: jest.fn(), variables: undefined };
  mockQueryState = { data: CHARGE_SERVEUR, isError: false, isLoading: false };
});

const AVEC_ENCADREMENT = {
  ...CHARGE_SERVEUR,
  branches: [{
    ...CHARGE_SERVEUR.branches[0],
    staff: [
      {
        documentId: 'coach-1', firstname: 'Adel', id: 77, lastname: 'Ferchichi',
      },
      {
        documentId: 'coach-2', firstname: 'Sandra', id: 78, lastname: 'Bernard',
      },
    ],
  }],
};

describe('COACH1 · la convocation du joueur montre son ENCADREMENT', () => {
  test('la partie « ENCADREMENT » nomme les entraineurs qui viennent', () => {
    mockQueryState = { data: AVEC_ENCADREMENT, isError: false, isLoading: false };

    const texte = texteVisible(rendre());

    expect(texte).toContain('ENCADREMENT');
    expect(texte).toContain('Adel Ferchichi');
    expect(texte).toContain('Sandra Bernard');
  });

  test('🔒 les entraineurs ne passent ni sur le terrain ni sur le banc', () => {
    mockQueryState = { data: AVEC_ENCADREMENT, isError: false, isLoading: false };

    const texte = texteVisible(rendre());

    // Le banc garde son seul remplacant ; les entraineurs n apparaissent
    // qu APRES le titre « ENCADREMENT », jamais avant (terrain, banc).
    expect(texte).toContain('Leo Diarra');
    const debutEncadrement = texte.indexOf('ENCADREMENT');
    expect(debutEncadrement).toBeGreaterThan(-1);
    expect(texte.slice(0, debutEncadrement)).not.toContain('Adel Ferchichi');
    expect(texte.slice(0, debutEncadrement)).not.toContain('Sandra Bernard');
  });

  test('🔒 sans encadrant venu, aucun titre vide : la partie n existe pas', () => {
    const texte = texteVisible(rendre());

    expect(texte).not.toContain('ENCADREMENT');
  });
});
