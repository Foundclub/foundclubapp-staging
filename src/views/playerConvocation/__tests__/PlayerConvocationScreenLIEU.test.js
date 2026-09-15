import renderer, { act } from 'react-test-renderer';

import PlayerConvocationScreen from '../PlayerConvocationScreen';

// LIEU — la colonne « Lieu » ne rend JAMAIS « [object Object] ».
//
// Constat du 15/09/2026 : l ecran lisait `String(event.location)`. Or le serveur
// range dans `location` un objet `{ lat, lng }` (event/schema.json : type json ;
// ecriture eventUseCases.js `buildLocationPayload`) et l adresse lisible dans
// `locationDetails`, une chaine JSON `{"address":"..."}`. Les trois temoins
// existants simulaient `location: 'Stade Municipal'` : une forme que le
// serveur n envoie pas, d ou leur vert.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockRsvp = jest.fn(() => Promise.resolve({}));

/** @type {any} */
let mockConvocation;
/** @type {any} */
let mockUserData;
/** @type {any} */
let mockEvent;

// 🧨 Fige : recreer `navigation` a chaque rendu relance les effets qui en
// dependent et Jest part en boucle infinie, sans message utile.
const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { eventId: 'evt-1', teamId: 'team-1' } }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ input) => {
      options.mutationFn(input);
    },
  }),
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
  useGetEvent: () => ({ data: mockEvent }),
  useGetEventConvocation: () => ({
    data: mockConvocation,
    isError: false,
    isLoading: false,
  }),
}));

jest.mock('@/services/event/eventService', () => ({
  respondToEventRsvp: (/** @type {any} */ ...args) => mockRsvp(...args),
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

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
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

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
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
  reservePlayerIds: [],
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
  // La forme REELLE d un evenement : coordonnees dans `location`, adresse ailleurs.
  mockEvent = { location: { lat: 48.85, lng: 2.35 }, startTime: '15:00:00.000' };
  mockConvocation = {
    event: { date: '2026-08-15T15:00:00.000Z', documentId: 'evt-1', name: 'Match' },
    published: PACK,
    responses: { byPlayerId: {}, counts: { absent: 0, pending: 1, present: 0 } },
    team: { documentId: 'team-1', name: 'Senior 1' },
  };
});

describe('LIEU — la colonne Lieu lit l adresse, jamais l objet des coordonnees', () => {
  test('location { lat, lng } + locationDetails JSON : la colonne dit « Stade X »', () => {
    mockEvent = { ...mockEvent, locationDetails: '{"address":"Stade X"}' };

    const texte = texteVisible(rendre());

    expect(texte).not.toContain('[object Object]');
    expect(texte).toContain('LIEU | Stade X');
  });

  test('sans locationDetails : le nom de l installation prend le relais', () => {
    mockEvent = { ...mockEvent, facility: { name: 'Gymnase Jean Moulin' } };

    const texte = texteVisible(rendre());

    expect(texte).not.toContain('[object Object]');
    expect(texte).toContain('LIEU | Gymnase Jean Moulin');
  });

  test('ni adresse ni installation : « Non précisé », pas l objet', () => {
    const texte = texteVisible(rendre());

    expect(texte).not.toContain('[object Object]');
    expect(texte).toContain('LIEU | Non précisé');
  });
});
