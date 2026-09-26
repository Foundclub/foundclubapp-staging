import { QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { invalidateAfterAction } from '@/domains/refresh/afterAction';

import { creerQueryClientDeTest } from '../../../testSupport/queryClientDeTest';
import PlayerConvocationScreen from '../PlayerConvocationScreen';

// CONVOC (demande d'Adel du 26/09) — « TU ES CONVOQUE » DIT MA REPONSE, ET ELLE EST A JOUR.
//
// Constat d'Adel, capture du match du 28/09 : « mon statut des boutons n'est pas
// a jour. Si j'ai repondu present ou absent, il devrait y avoir marque "vous avez
// repondu present", et on peut changer de statut. Comme sur les evenements de
// base. »
//
// 🧪 CE TEMOIN TOURNE SUR LE VRAI react-query : c'est le CACHE qui est en cause,
// et une doublure de `useQuery` rendrait le temoin vert sans rien prouver. Les
// SERVICES sont doubles, une couche plus bas, et ils tiennent un « serveur » qui
// garde la reponse comme le vrai (`event.participations` / `event.missings`).

const mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };
const mockServeur = { lectures: 0, reponse: 'pending' };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { eventId: 'evt-1' } }),
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

jest.mock('@/services/event/eventService', () => ({
  getEventAttendance: jest.fn(),
  getEventById: jest.fn(() => Promise.resolve({ documentId: 'evt-1' })),
  getEventByIdForEdit: jest.fn(),
  getEventConvocation: jest.fn(() => {
    mockServeur.lectures += 1;
    return Promise.resolve({
      branches: [{
        published: {
          reservePlayerIds: [],
          snapshotPlayers: [{ documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' }],
          sportContext: 'football',
          teams: [{
            id: 'team_1',
            placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 90 }],
          }],
        },
        responses: { byPlayerId: { 'joueur-1': mockServeur.reponse } },
        team: { documentId: 'team-1', name: 'Senior 1' },
      }],
      event: { documentId: 'evt-1', name: 'Match' },
    });
  }),
  getEvents: jest.fn(),
  getEventTeamComposition: jest.fn(),
  getEventTypes: jest.fn(),
  respondToEventRsvp: jest.fn((_eventId, reponse) => {
    mockServeur.reponse = reponse;
    return Promise.resolve({});
  }),
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
      <TouchableOpacity accessibilityLabel={title} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

/**
 * Tout le texte visible de l'arbre rendu, concatene.
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

/**
 * La variante du bouton qui porte ce titre : c'est elle qui dit « actif ».
 * @param {any} arbre
 * @param {string} titre
 * @returns {string | undefined}
 */
const varianteDu = (arbre, titre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.title === titre
    && typeof noeud.props?.variant === 'string')[0]?.props?.variant;

/**
 * Attend, borne par une CONDITION (20 tours au plus), que l'ecran ait fini de lire.
 * @param {() => boolean} condition
 * @returns {Promise<void>}
 */
const attendre = async (condition) => {
  for (let tour = 0; tour < 20 && !condition(); tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

/** @type {any} */
let queryClient;

const ouvrir = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <PlayerConvocationScreen />
      </QueryClientProvider>,
    );
  });
  await attendre(() => texteVisible(arbre).includes('Tu es convoqué'));
  return arbre;
};

beforeEach(() => {
  mockServeur.lectures = 0;
  mockServeur.reponse = 'pending';
  queryClient = creerQueryClientDeTest();
});

afterEach(() => {
  queryClient.clear();
});

describe('CONVOC — « Tu es convoqué » dit la réponse déjà donnée', () => {
  it('témoin 1 — à l’ouverture, la réponse Présent est écrite et son bouton actif', async () => {
    mockServeur.reponse = 'present';
    const arbre = await ouvrir();

    expect(texteVisible(arbre)).toContain('Tu as répondu Présent');
    expect(varianteDu(arbre, 'Présent')).toBe('Primary');
    expect(varianteDu(arbre, 'Absent')).toBe('Secondary');
    act(() => arbre.unmount());
  });

  it('témoin 2 — sans réponse, l’écran n’affirme rien', async () => {
    const arbre = await ouvrir();

    expect(texteVisible(arbre)).not.toContain('Tu as répondu');
    expect(varianteDu(arbre, 'Présent')).toBe('Secondary');
    expect(varianteDu(arbre, 'Absent')).toBe('Secondary');
    act(() => arbre.unmount());
  });

  it('témoin 3 — appui sur Absent : l’écran relit et écrit « Tu as répondu Absent »', async () => {
    mockServeur.reponse = 'present';
    const arbre = await ouvrir();

    await act(async () => {
      arbre.root.findByProps({ accessibilityLabel: 'Absent' }).props.onPress();
    });
    await attendre(() => texteVisible(arbre).includes('Tu as répondu Absent'));

    expect(texteVisible(arbre)).toContain('Tu as répondu Absent');
    expect(texteVisible(arbre)).not.toContain('Tu as répondu Présent');
    expect(varianteDu(arbre, 'Absent')).toBe('Primary');
    act(() => arbre.unmount());
  });
});

describe('CONVOC — la réponse donnée AILLEURS (fiche, liste, fil) est relue', () => {
  it('témoin 4 — écran ouvert : une réponse donnée ailleurs le met à jour', async () => {
    const arbre = await ouvrir();
    expect(texteVisible(arbre)).not.toContain('Tu as répondu');

    // Ce que font la fiche, la liste d'evenements et la carte du fil apres une
    // reponse reussie : `useEventAnswerMutations` -> `invalidateAfterAction`.
    mockServeur.reponse = 'present';
    await act(async () => {
      await invalidateAfterAction(queryClient, 'answerEvent');
    });
    await attendre(() => varianteDu(arbre, 'Présent') === 'Primary');

    // Le bouton d'abord : il existait avant ce lot, il dit donc si le CACHE a ete relu.
    expect(varianteDu(arbre, 'Présent')).toBe('Primary');
    expect(texteVisible(arbre)).toContain('Tu as répondu Présent');
    act(() => arbre.unmount());
  });

  it('témoin 5 — écran rouvert : une réponse donnée ailleurs entre-temps est relue', async () => {
    const premier = await ouvrir();
    expect(texteVisible(premier)).not.toContain('Tu as répondu');
    act(() => premier.unmount());

    // L'ecran est ferme ; le joueur repond depuis la fiche de l'evenement.
    mockServeur.reponse = 'absent';
    await act(async () => {
      await invalidateAfterAction(queryClient, 'answerEvent');
    });

    const second = await ouvrir();
    await attendre(() => varianteDu(second, 'Absent') === 'Primary');

    expect(varianteDu(second, 'Absent')).toBe('Primary');
    expect(texteVisible(second)).toContain('Tu as répondu Absent');
    act(() => second.unmount());
  });

  it('témoin 6 — sans réponse neuve, rouvrir dans la minute ne relit pas le serveur', async () => {
    const premier = await ouvrir();
    act(() => premier.unmount());
    const lecturesApresPremiere = mockServeur.lectures;

    const second = await ouvrir();

    expect(mockServeur.lectures).toBe(lecturesApresPremiere);
    act(() => second.unmount());
  });
});
