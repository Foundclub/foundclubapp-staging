import renderer, { act } from 'react-test-renderer';

// D48 (E6) : EventDetails.web.js fait 1 754 lignes et n'avait AUCUN test.
//
// Ce que ce fichier verrouille, et pourquoi il existe :
// `web` compile PHYSIQUEMENT les sources de `app` (vite.config.ts pointe
// ../app/src), et un fichier `.web.js` REMPLACE son jumeau sans suffixe.
// Aucune porte de `app` ne compare les deux ⇒ une divergence entre eux vit
// indefiniment, en silence. C'est la 4e fois que ce motif coute un correctif
// (D08, D22, D40, D48).
//
// Le lot D44 a fait lire au board l'etiquette `eventKind` pour qu'un match
// cesse d'afficher les commandes de la detection. Le telephone la transmet
// (EventDetails.js:3197) ; le site ne la calculait meme pas.
//
// La couture choisie est la CHARGE ENVOYEE AU BOARD, pas la forme de l'arbre :
// c'est le seul contrat que le board lit, et il survit a tout redessin du site.
// Les DEUX portes du site sont couvertes — « Gerer la composition d'equipes »
// et « Voir la composition publiee » — parce que ne reparer que celle citee au
// ticket laisserait un appelant frere casse.

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    options,
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  }),
}));

// Le theme est monte avec les VRAIS modules : un mock en Proxy rend les echecs
// Jest illisibles (piege paye au lot paywall).
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

const emptyQuery = () => ({
  data: null,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
});

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({
    data: mockEventQuery.data,
    dataUpdatedAt: 1,
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetEventConvocation: () => ({ ...emptyQuery(), data: mockConvocationQuery.data }),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/event/eventService', () => ({ updateEvent: jest.fn() }));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));

jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: jest.fn(),
  registerClubTeamToTournament: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({ share: jest.fn() }));

// Ici vivait une doublure de `@/utils/imageUrl`, seule facon de monter cet ecran
// tant que le module sans suffixe n'avait pas d'export par defaut. D49 la lui a
// donne (`src/utils/imageUrl.js`), le VRAI module se charge, et la doublure a
// ete retiree : ces 5 tests restent verts sans elle. Si cette suite redevient
// rouge sur « _imageUrl.default is not a function », l'export a ete perdu.

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// Une fabrique jest.mock est remontee en tete de fichier : elle ne peut donc pas
// s'appuyer sur un import ESM, evalue trop tard.
/* eslint-disable global-require */
jest.mock(
  '../components/EventTasksSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksSection'),
);
jest.mock(
  '../components/EventTeamAudiencesSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesSection'),
);
/* eslint-enable global-require */

// eslint-disable-next-line import/first
import EventDetailsWeb from '../EventDetails.web';

// Le premier montage transpile tout le graphe d'imports de l'ecran : au-dela des
// 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Entrainement du mardi',
  participations: [],
  startTime: '10:00',
  team: { club: { documentId: CLUB_ID }, documentId: TEAM_ID, name: 'U15' },
  type: { name: 'Entrainement' },
  ...overrides,
});

/** @type {any} */
let mounted = null;

const mountScreen = (/** @type {any} */ { convocation = null, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockConvocationQuery.data = convocation;
  mockUseAuth.mockReturnValue({
    canEditClub: () => true,
    canEditEvent: () => true,
    canManageEvent: () => true,
    freeUsageSummary: null,
    subscriptionAccessLevel: 'FREE',
    userData: { documentId: 'user-1', role: { name: 'Dirigeant' } },
  });

  act(() => {
    mounted = renderer.create(
      <EventDetailsWeb
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: jest.fn(),
        }}
        route={{ params: { eventId: 'event-1' } }}
      />,
    );
  });

  return mounted.root;
};

const textOf = (/** @type {any} */ node) => {
  const parts = [];
  const walk = (/** @type {any} */ child) => {
    if (child === null || child === undefined || child === false) return;
    if (typeof child === 'string' || typeof child === 'number') {
      parts.push(String(child));
      return;
    }
    const children = child?.props?.children;
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children);
  };
  walk(node);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Le bouton du site qui PORTE ce libelle. Le rendu web emet de vrais `<button>`,
 * donc on les cherche par type hote, pas par composant.
 * @param {any} root - Racine du rendu.
 * @param {string} label - Le libelle porte par le bouton.
 * @returns {any} - Le bouton, ou undefined.
 */
const buttonWithText = (/** @type {any} */ root, /** @type {string} */ label) => root
  .findAllByType('button')
  .find((/** @type {any} */ node) => textOf(node).includes(label));

const click = (/** @type {any} */ root, /** @type {string} */ label) => {
  const node = buttonWithText(root, label);
  if (!node) throw new Error(`Aucun bouton ne porte le libelle « ${label} »`);
  act(() => {
    node.props.onClick();
  });
};

const lastBoardParams = () => {
  const call = [...mockNavigate.mock.calls].reverse()
    .find((/** @type {any} */ entry) => entry[0] === 'TacticalBoardV2');
  return call ? call[1] : null;
};

/** Les parametres du dernier envoi vers le NOUVEAU parcours (ecran 1 du pack). */
const lastCallUpParams = () => {
  const call = [...mockNavigate.mock.calls].reverse()
    .find((/** @type {any} */ entry) => entry[0] === 'MatchCallUpSelection');
  return call ? call[1] : null;
};

/** C-E — les parametres du dernier envoi vers l ecran 13 (detection). */
const lastSquadSetupParams = () => {
  const call = [...mockNavigate.mock.calls].reverse()
    .find((/** @type {any} */ entry) => entry[0] === 'DetectionSquadSetup');
  return call ? call[1] : null;
};

/** Le nom de la route empruntee au dernier appui. */
const lastRoute = () => {
  const call = [...mockNavigate.mock.calls].pop();
  return call ? call[0] : null;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEventQuery.data = null;
  mockConvocationQuery.data = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

describe('le site ouvre la composition comme le telephone', () => {
  // ⚠️ CE TEMOIN A CHANGE DE DESTINATION LE 2026-08-14, ET C EST LE SUJET DU LOT.
  // Il verrouillait « le site mene au board ». Le board vise ici est l ANCIEN
  // terrain : le site y allait TOUJOURS, alors que le telephone passe par le
  // nouveau parcours depuis D77. Ce qu il protege reellement — « le bouton mene
  // quelque part, avec le bon evenement et la bonne equipe » — est conserve.
  test('« Gerer la composition d equipes » mene bien a la composition', () => {
    const root = mountScreen();

    click(root, "Gérer la composition d'équipes");

    expect(mockNavigate).toHaveBeenCalledWith(
      'MatchCallUpSelection',
      expect.objectContaining({ eventId: 'event-1', teamId: TEAM_ID }),
    );
  });

  test('un entrainement part avec eventKind « match »', () => {
    const root = mountScreen();

    click(root, "Gérer la composition d'équipes");

    expect(lastCallUpParams()).toEqual(
      expect.objectContaining({ eventKind: 'match' }),
    );
  });

  test('une detection part avec eventKind « detection »', () => {
    const root = mountScreen({ event: buildEvent({ type: { name: 'Détection' } }) });

    click(root, "Gérer la composition d'équipes");

    expect(lastSquadSetupParams()).toEqual(
      expect.objectContaining({ eventKind: 'detection' }),
    );
  });

  test('le libelle brut du type accompagne l etiquette', () => {
    const root = mountScreen({ event: buildEvent({ type: { name: 'Détection' } }) });

    click(root, "Gérer la composition d'équipes");

    expect(lastSquadSetupParams()).toEqual(
      expect.objectContaining({ eventTypeLabel: 'Détection' }),
    );
  });

  // La seconde porte du site. Ne reparer que la premiere laisserait un appelant
  // frere casse — c'est exactement ce que la methode interdit.
  test('« Voir la composition publiee » transmet la meme etiquette', () => {
    const root = mountScreen({
      convocation: {
        published: { schemaVersion: 3, teams: [{ documentId: 'branch-1', placements: [] }] },
        team: { documentId: TEAM_ID, name: 'U15' },
      },
      event: buildEvent({ type: { name: 'Détection' } }),
    });

    click(root, 'Voir la composition publiée');

    expect(lastBoardParams()).toEqual(
      expect.objectContaining({ eventKind: 'detection', readOnly: true }),
    );
  });
});

// ---------------------------------------------------------------------------
// C-A (🚪) LA PORTE WEB DES 4 ECRANS NEUFS
// ---------------------------------------------------------------------------
//
// Mesure du lot C1 : les 4 ecrans du pack composition sont ecrits, testes et
// ROUTES (webRoutes.js:201-204, montes dans web/src/routes/screenRegistry.tsx),
// mais AUCUN bouton du site n y menait — on ne pouvait les atteindre qu en
// tapant l URL a la main. La moitie web d un travail deja paye etait invisible,
// et rien sur le telephone ne pouvait le faire voir.
//
// La regle recopiee du natif (EventDetails.js:3232) est exactement celle-ci :
//   startsWithCallUp = !isDetectionEvent && canEdit && !readOnly
// Une DETECTION et une LECTURE SEULE continuent d aller a l ancien terrain :
// ni l une ni l autre ne convoque.
describe('C-A — depuis le site, la page d un match mene au NOUVEAU terrain', () => {
  test('🥇 un match modifiable ouvre l ecran de convocation, plus l ancien terrain', () => {
    const root = mountScreen();

    click(root, "Gérer la composition d'équipes");

    expect(lastRoute()).toBe('MatchCallUpSelection');
    expect(lastBoardParams()).toBeNull();
  });

  // ⚠️ CE TEMOIN A CHANGE DE DESTINATION LE 2026-08-15, ET C'EST LE SUJET DU LOT
  // C-E. Il verrouillait « une detection reste sur l ancien terrain », ce qui
  // etait juste tant que les ecrans 13 a 15 n existaient pas. Ils existent
  // depuis C-D, et rien ne les atteignait. Ce qu'il protege reellement — une
  // detection ne passe JAMAIS par l ecran de convocation d un match — est
  // conserve, et meme renforce.
  test('🚪 une DETECTION ouvre l ecran 13, et ne convoque toujours pas', () => {
    const root = mountScreen({ event: buildEvent({ type: { name: 'Détection' } }) });

    click(root, "Gérer la composition d'équipes");

    expect(lastRoute()).toBe('DetectionSquadSetup');
    expect(lastCallUpParams()).toBeNull();
  });

  test('⛔ la LECTURE SEULE reste sur l ancien terrain', () => {
    const root = mountScreen({
      convocation: {
        published: { schemaVersion: 3, teams: [{ documentId: 'branch-1', placements: [] }] },
        team: { documentId: TEAM_ID, name: 'U15' },
      },
    });

    click(root, 'Voir la composition publiée');

    expect(lastRoute()).toBe('TacticalBoardV2');
  });

  test('l ecran 1 recoit de quoi travailler : evenement, equipe, sport et effectif', () => {
    const root = mountScreen();

    click(root, "Gérer la composition d'équipes");

    expect(lastCallUpParams()).toEqual(expect.objectContaining({
      canEdit: true,
      eventId: 'event-1',
      teamId: TEAM_ID,
    }));
    expect(Array.isArray(lastCallUpParams()?.players)).toBe(true);
  });
});
