import renderer, { act } from 'react-test-renderer';

import PlayerConvocationScreen from '../PlayerConvocationScreen';

// C-C — TEMOINS 1 et 3 du lot.
//
//   1. « un joueur convoque voit un ecran qui le lui dit » — le temoin principal
//      du lot : c'est la moitie de la fonctionnalite qui n'existait pas.
//   3. « un joueur non convoque ne voit pas l'ecran de convocation » — le
//      garde-fou. Le serveur envoie la MEME notification a l'entraineur, a
//      l'organisateur et aux non-retenus.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockRsvp = jest.fn(() => Promise.resolve({}));

/** @type {any} */
let mockConvocation;
/** @type {any} */
let mockUserData;

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
  useGetEvent: () => ({ data: { location: 'Stade Municipal', startTime: '15:00:00.000' } }),
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
  mockConvocation = {
    event: { date: '2026-08-15T15:00:00.000Z', documentId: 'evt-1', name: 'Match' },
    published: PACK,
    responses: { byPlayerId: {}, counts: { absent: 0, pending: 1, present: 0 } },
    team: { documentId: 'team-1', name: 'Senior 1' },
  };
});

describe('TEMOIN 1 — un joueur convoque voit un ecran qui le lui dit', () => {
  test('il lit « Tu es convoque », sa chip Titulaire, son poste et qui l a convoque', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('Tu es convoqué');
    expect(texte).toContain('Titulaire');
    expect(texte).toContain('Poste : GB');
    expect(texte).toContain('N°1');
    expect(texte).toContain('Convoqué par Coach Karim');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('les 3 colonnes sont la — le RDV dit « Non précisé », il ne l invente pas', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('RDV');
    expect(texte).toContain('COUP D’ENVOI');
    expect(texte).toContain('LIEU');
    expect(texte).toContain('15:00');
    expect(texte).toContain('Stade Municipal');
    expect(texte).toContain('Non précisé');
  });

  test('un remplacant lit sa chip Remplacant', () => {
    mockUserData = { documentId: 'joueur-2' };
    mockConvocation.published = {
      ...PACK,
      reservePlayerIds: ['joueur-2'],
      snapshotPlayers: [...PACK.snapshotPlayers, { documentId: 'joueur-2', firstname: 'Leo' }],
    };

    expect(texteVisible(rendre())).toContain('Remplaçant');
  });

  test('la barre presence appelle le MEME service que le reste de l app', () => {
    const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
    const arbre = rendre();
    const bouton = arbre.root.findAllByType(TouchableOpacity).find(
      (/** @type {any} */ noeud) => noeud.findAllByType(TexteRN)
        .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children) === 'Présent'),
    );

    act(() => {
      bouton.props.onPress();
    });

    expect(mockRsvp).toHaveBeenCalledWith('evt-1', 'present', expect.anything());
  });
});

describe('TEMOIN 3 — un joueur NON convoque ne voit pas l ecran de convocation', () => {
  test('il est repose sur la page de l evenement, et ne lit jamais « Tu es convoque »', () => {
    mockUserData = { documentId: 'joueur-9' };
    const texte = texteVisible(rendre());

    expect(mockReplace).toHaveBeenCalledWith('EventDetails', { eventId: 'evt-1' });
    expect(texte).not.toContain('Tu es convoqué');
  });

  test('l entraineur qui recoit la meme notification est repose lui aussi', () => {
    mockUserData = { documentId: 'coach-1' };
    rendre();

    expect(mockReplace).toHaveBeenCalledWith('EventDetails', { eventId: 'evt-1' });
  });
});
