import renderer, { act } from 'react-test-renderer';

import PlayerConvocationScreen from '../PlayerConvocationScreen';
import {
  buildPlayerConvocationView,
  CONVOCATION_ROLE_CALLED_UP,
  getViewerConvocationRole,
} from '../playerConvocationUtils';

// ==========================================================================
// 📋 CONVLISTE (26/10, planche B6) — CONVOQUE « EN LISTE » : NI TITULAIRE, NI REMPLACANT.
//
// Une convocation en liste n'a aucun placement : le serveur range chaque convoque au banc. L'ecran
// du joueur en deduisait « Remplaçant » pour tout le monde, dessinait un terrain vide et une
// section « Remplaçants ». En liste, il dit « Convoqué » et montre la liste des convoques.
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
    default: (/** @type {any} */ { children }) => (
      <View testID="terrain-du-joueur">{children}</View>
    ),
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

const PACK_LISTE = {
  publishedBy: { firstname: 'Coach', lastname: 'Karim' },
  reservePlayerIds: ['joueur-1', 'joueur-2'],
  reserveSnapshotPlayers: [
    {
      documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla', number: 1,
    },
    {
      documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra', number: 7,
    },
  ],
  snapshotPlayers: [],
  sportContext: 'football',
  teams: [{ id: 'team_1', name: 'Senior 1', placements: [] }],
};

const CHARGE_LISTE = {
  branches: [{
    published: PACK_LISTE,
    responses: { byPlayerId: {}, counts: { absent: 0, pending: 2, present: 0 } },
    team: { documentId: 'team-1', name: 'Senior 1' },
    viewer: { inReserve: true, teamEntryIds: [] },
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
  mockQueryState = { data: CHARGE_LISTE, isError: false, isLoading: false };
});

describe('CONVLISTE · le joueur convoque en liste', () => {
  test('🥇 la regle « aucun joueur place = liste » donne le role « convoque »', () => {
    expect(getViewerConvocationRole(CHARGE_LISTE, 'joueur-1')).toBe(CONVOCATION_ROLE_CALLED_UP);
    const vue = buildPlayerConvocationView({ convocation: CHARGE_LISTE, userId: 'joueur-1' });
    expect(vue?.role).toBe(CONVOCATION_ROLE_CALLED_UP);
    expect(vue?.isList).toBe(true);
  });

  test('🥇 l ecran dit « Convoqué », jamais « Remplaçant », et liste les convoques', () => {
    const arbre = rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Convoqué');
    expect(texte).not.toContain('Remplaçant');
    expect(texte).not.toContain('REMPLAÇANTS');
    expect(texte).toContain('CONVOQUÉS');
    expect(texte).toContain('Leo Diarra');
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props.testID === 'terrain-du-joueur'))
      .toHaveLength(0);
  });
});
