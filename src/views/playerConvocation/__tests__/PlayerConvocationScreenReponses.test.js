import renderer, { act } from 'react-test-renderer';

import PlayerConvocationScreen from '../PlayerConvocationScreen';
import { getConvocationPlayerResponse } from '../playerConvocationUtils';

// CONVOC (demande d'Adel du 26/09, « pas tres grave ») — LA COMPO DE « TU ES
// CONVOQUE » MONTRE QUI A REPONDU.
//
// « Sur la compo, je ne vois pas qui a repondu present ou pas. »
//
// ⛔ AUCUNE DONNEE NEUVE : le serveur range deja la reponse de CHAQUE convoque
// dans la branche (`responses.byPlayerId`, `buildConvocationResponses`), dans la
// charge que l'ecran lit pour dessiner le terrain. Elle n'etait simplement pas
// affichee. Un joueur hors app n'y figure pas : il ne peut pas repondre, il n'a
// donc aucune marque — pas meme « sans reponse ».

const mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };

/** @type {any} */
let mockConvocation;
/** @type {any} POINTAGE : l evenement tel que `useGetEvent` le rend. */
let mockEvenement = { documentId: 'evt-1' };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { eventId: 'evt-1', teamId: 'team-1' } }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

const mockAuth = { userData: { documentId: 'joueur-1' } };
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: mockEvenement }),
  useGetEventConvocation: () => ({ data: mockConvocation, isError: false, isLoading: false }),
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
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: { arrowLeft: 1, chevronLeft: 1 },
    Spaces: espaces,
  };

  return { __esModule: true, default: () => theme };
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
      <TouchableOpacity accessibilityLabel={title} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

/**
 * Une convocation publiee : trois titulaires (un par reponse), un joueur hors
 * app sur le terrain, et un remplacant qui a dit Absent.
 * @param {any} [responses] `responses` de la branche, ou rien (ancienne charge).
 * @returns {any}
 */
const convocation = (responses) => ({
  branches: [{
    published: {
      manualPlayers: [{ firstname: 'Hors', id: 'manuel-1', lastname: 'App' }],
      reservePlayerIds: ['joueur-4'],
      snapshotPlayers: [
        { documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' },
        { documentId: 'joueur-2', firstname: 'Yanis', lastname: 'Benali' },
        { documentId: 'joueur-3', firstname: 'Enzo', lastname: 'Rossi' },
        { documentId: 'joueur-4', firstname: 'Lucas', lastname: 'Martin' },
        { documentId: 'manuel-1', firstname: 'Hors', lastname: 'App' },
      ],
      sportContext: 'football',
      teams: [{
        id: 'team_1',
        placements: [
          { playerId: 'joueur-1', positionX: 50, positionY: 90 },
          { playerId: 'joueur-2', positionX: 30, positionY: 60 },
          { playerId: 'joueur-3', positionX: 70, positionY: 60 },
          { playerId: 'manuel-1', positionX: 50, positionY: 30 },
        ],
      }],
    },
    ...(responses ? { responses } : {}),
    team: { documentId: 'team-1', name: 'Senior 1' },
  }],
  event: { documentId: 'evt-1', name: 'Match' },
});

const REPONSES = {
  byPlayerId: {
    'joueur-1': 'present',
    'joueur-2': 'absent',
    'joueur-3': 'pending',
    'joueur-4': 'absent',
  },
  counts: { absent: 2, pending: 1, present: 1 },
};

/** @type {any[]} */
let arbresOuverts = [];

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<PlayerConvocationScreen />);
  });
  arbresOuverts.push(arbre);
  return arbre;
};

/**
 * La marque de reponse posee sur le jeton d'un joueur du terrain.
 * @param {any} arbre
 * @param {string} id
 * @returns {string | null} Son libelle, ou `null` sans marque.
 */
const marqueDuJeton = (arbre, id) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === `reponse-${id}`)[0]
  ?.props?.accessibilityLabel ?? null;

/**
 * Tout le texte visible, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const aplatir = (/** @type {any} */ enfants) => {
    if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
    if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
    if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
    return String(enfants);
  };
  return arbre.root.findAllByType(TexteRN)
    .map((/** @type {any} */ noeud) => aplatir(noeud.props.children))
    .join(' | ');
};

afterEach(() => {
  arbresOuverts.forEach((arbre) => act(() => arbre.unmount()));
  arbresOuverts = [];
});

describe('CONVOC — la compo de « Tu es convoqué » montre qui a répondu', () => {
  it('témoin 1 — chaque joueur du terrain porte sa réponse', () => {
    mockConvocation = convocation(REPONSES);
    const arbre = rendre();

    expect(marqueDuJeton(arbre, 'joueur-1')).toBe('Présent·e');
    expect(marqueDuJeton(arbre, 'joueur-2')).toBe('Absent·e');
    expect(marqueDuJeton(arbre, 'joueur-3')).toBe('Sans réponse');
  });

  it('témoin 2 — un joueur hors app n’a aucune marque, pas même « sans réponse »', () => {
    mockConvocation = convocation(REPONSES);
    const arbre = rendre();

    expect(marqueDuJeton(arbre, 'manuel-1')).toBeNull();
  });

  it('témoin 3 — le remplaçant affiche sa réponse sur sa ligne du banc', () => {
    mockConvocation = convocation(REPONSES);
    const arbre = rendre();

    const pastille = arbre.root
      .findAll((/** @type {any} */ noeud) => noeud.props?.testID === 'reponse-banc-joueur-4')[0];
    const { Text: TexteRN } = jest.requireActual('react-native');

    expect(pastille).toBeDefined();
    expect(pastille.findAllByType(TexteRN)
      .map((/** @type {any} */ noeud) => noeud.props.children).join('')).toBe('Absent·e');
  });

  it('témoin 4 — une légende dit ce que veulent dire les marques', () => {
    mockConvocation = convocation(REPONSES);
    const arbre = rendre();
    const texte = texteVisible(arbre);

    ['Présent·e', 'Absent·e', 'Sans réponse'].forEach((libelle) => {
      expect(texte).toContain(libelle);
    });
  });

  it('témoin 5 — une charge sans réponses (ancienne forme) : ni marque ni légende', () => {
    mockConvocation = convocation(undefined);
    const arbre = rendre();

    expect(marqueDuJeton(arbre, 'joueur-1')).toBeNull();
    expect(texteVisible(arbre)).not.toContain('Sans réponse');
  });
});

describe('CONVOC — getConvocationPlayerResponse', () => {
  it('lit la réponse que le serveur a calculée, et rien d’autre', () => {
    const vue = {
      responsesByPlayerId: {
        a: 'present', b: 'absent', c: 'pending', d: 'n-importe',
      },
    };

    expect(getConvocationPlayerResponse(vue, 'a')).toBe('present');
    expect(getConvocationPlayerResponse(vue, 'b')).toBe('absent');
    expect(getConvocationPlayerResponse(vue, 'c')).toBe('pending');
    expect(getConvocationPlayerResponse(vue, 'd')).toBeNull();
    expect(getConvocationPlayerResponse(vue, 'inconnu')).toBeNull();
    expect(getConvocationPlayerResponse(null, 'a')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POINTAGE (decisions d Adel du 29/09) — « LES PARTICIPANTS REPONDENT » DECOCHEE :
// la barre Present / Absent de « Tu es convoque » disparait, comme sur la fiche.
// L ecran relit deja l evenement complet (`useGetEvent`), qui porte l option.
// Ecrits ROUGES contre app `4c0d8a57`.
// ---------------------------------------------------------------------------
describe('POINTAGE — la barre de reponse suit l option « Les participants repondent »', () => {
  const boutons = (arbre) => arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.accessibilityLabel === 'string'
      && typeof noeud.props?.onPress === 'function',
  ).map((/** @type {any} */ noeud) => noeud.props.accessibilityLabel);

  afterEach(() => {
    mockEvenement = { documentId: 'evt-1' };
  });

  it('option cochee (ou evenement d avant le lot) : Present et Absent sont la', () => {
    mockConvocation = convocation(REPONSES);

    const arbre = rendre();

    expect(boutons(arbre)).toEqual(expect.arrayContaining(['Présent', 'Absent']));
  });

  it('🚨 option decochee : ni Present ni Absent', () => {
    mockConvocation = convocation(REPONSES);
    mockEvenement = { documentId: 'evt-1', rsvpEnabled: false };

    const arbre = rendre();

    expect(boutons(arbre)).not.toContain('Présent');
    expect(boutons(arbre)).not.toContain('Absent');
  });
});
