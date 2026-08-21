import renderer, { act } from 'react-test-renderer';

import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';

// AD02 (E6) : la page d'un evenement est PUBLIQUE sur le site (arbitrage d'Adel,
// `web/src/routes/screenRegistry.tsx` la declare `access: 'public'`). Un inconnu
// pouvait donc y lire des prenoms et des noms, et taper sur un bouton
// « Participer » qui partait avec `user: ''`.
//
// Mesure du 2026-08-21 sur la recette, sans aucun jeton :
//   GET https://api-staging.foundclubpro.com/api/events?populate=*
//   -> 200 · 10 "firstname" · 10 "lastname"
// Le SERVEUR envoie encore des noms a un inconnu ⇒ cette garde d'affichage est
// la seule protection en service sur le site. Ce n'est pas une ceinture derriere
// une bretelle : c'est la bretelle.
//
// Ce fichier est NEUF : `EventDetailsWebComposition.test.js` garde ses 11 temoins
// verts comme preuve d'innocence du lot. Son en-tete de mocks est COPIE ici, avec
// deux differences assumees :
//   1. `useMutation.mutateAsync` appelle VRAIMENT la `mutationFn`. Sans ca, le
//      temoin « createEventParticipation appele 0 fois » serait vert meme sur du
//      code casse : le mock d'origine remplace la mutationFn par un jest.fn().
//   2. `EventTasksSection` n'est PAS double : c'est lui qui fabrique le nom de la
//      personne a qui une tache est confiee. Une doublure texte rendrait le
//      temoin 4 vide de sens.

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockConvocationQuery = { data: null };

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: jest.fn(),
    // La VRAIE mutationFn est appelee : c'est la seule facon de prouver qu'un
    // visiteur n'envoie RIEN au serveur.
    mutateAsync: (/** @type {any} */ ...args) => Promise.resolve(options?.mutationFn?.(...args)),
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

jest.mock('@/navigation/public/publicAuthNavigation', () => ({
  openPublicAuthFlow: jest.fn(),
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

// `EventTasksSection` est monte pour de vrai : il appelle ces quatre services.
jest.mock('@/services/event/eventService', () => ({
  approveEventTaskAssignment: jest.fn(),
  assignEventTask: jest.fn(),
  cancelEventTaskAssignment: jest.fn(),
  rejectEventTaskAssignment: jest.fn(),
  updateEvent: jest.fn(),
}));

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

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

// `EventTasksSection` tire `BottomModal` -> `@gorhom/bottom-sheet` ->
// `react-native-gesture-handler`, que Jest ne transpile pas. C'est la doublure
// qu'emploient deja 10 suites du depot. Elle ne cache aucun nom : le bloc
// « Affectations confirmees » vit HORS de la feuille (EventTasksSection.js:324).
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (props.isVisible
      ? react.createElement(rn.View, null, props.children)
      : null),
  };
});

// Celui-la n'affiche AUCUN nom (uniquement « N membre(s) ») : le doubler ne
// retire rien a ce que ce fichier mesure.
/* eslint-disable global-require */
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

// Des noms VOLONTAIREMENT improbables : un temoin qui cherche « Martin » serait
// vert par accident sur du code casse (« un 0 sur un echantillon n'est pas un 0 »).
const PARTICIPANTS = [
  { documentId: 'u-p1', firstname: 'Zoltan', lastname: 'Karamazov' },
  { documentId: 'u-p2', firstname: 'Ludivine', lastname: 'Escoffier' },
  { documentId: 'u-p3', firstname: 'Amadou', lastname: 'Bergerac' },
];
const MISSING_PLAYER = { documentId: 'u-m1', firstname: 'Ophelie', lastname: 'Vandenbrouck' };
const TASK_ASSIGNEE = { documentId: 'u-t1', firstname: 'Gustave', lastname: 'Peyrelongue' };

const ALL_NAMES = [
  ...PARTICIPANTS.flatMap((user) => [user.firstname, user.lastname]),
  MISSING_PLAYER.firstname,
  MISSING_PLAYER.lastname,
  TASK_ASSIGNEE.firstname,
  TASK_ASSIGNEE.lastname,
];

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  eventTasks: [{
    assignments: [{ documentId: 'assign-1', status: 'APPROVED', user: TASK_ASSIGNEE }],
    documentId: 'task-1',
    id: 11,
    title: 'Tenir la buvette',
  }],
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  missings: [MISSING_PLAYER],
  name: 'Entrainement du mardi',
  participations: PARTICIPANTS,
  startTime: '10:00',
  team: { club: { documentId: CLUB_ID }, documentId: TEAM_ID, name: 'U15' },
  type: { name: 'Entrainement' },
  ...overrides,
});

/** @type {any} */
let mounted = null;

const mountScreen = (/** @type {any} */ { auth, convocation = null, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockConvocationQuery.data = convocation;
  mockUseAuth.mockReturnValue(auth || {
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

/** Un inconnu : pas de compte, donc `userData` a null. L'ecran ne lit que ces deux clefs. */
const mountAsVisitor = () => mountScreen({
  auth: { canManageEvent: () => false, userData: null },
  event: buildEvent(),
});

/** Un dirigeant du club : il a le droit de lire la page en entier. */
const mountAsManager = () => mountScreen({
  auth: {
    canManageEvent: () => true,
    userData: { documentId: 'user-1', role: { name: 'Dirigeant' } },
  },
  event: buildEvent(),
});

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
 * TOUT le texte reellement rendu a l'ecran.
 *
 * ⚠️ Piege paye a l'ecriture de ce fichier : `textOf(mounted.root)` rend la
 * chaine VIDE — la racine est une TestInstance, pas un element, et ses enfants
 * ne sont pas dans `props.children`. Les temoins 1, 3 et 4 etaient alors verts
 * SUR DU CODE CASSE. On lit donc l'arbre RENDU (`toJSON`), dont les enfants
 * texte sont de vraies chaines.
 * @returns {string} - Le texte visible de l'ecran monte.
 */
const screenText = () => {
  const parts = [];
  const walk = (/** @type {any} */ node) => {
    if (node === null || node === undefined || node === false) return;
    if (typeof node === 'string' || typeof node === 'number') {
      parts.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    walk(node.children);
  };
  walk(mounted?.toJSON());
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

const click = async (/** @type {any} */ root, /** @type {string} */ label) => {
  const node = buttonWithText(root, label);
  if (!node) throw new Error(`Aucun bouton ne porte le libelle « ${label} »`);
  await act(async () => {
    await node.props.onClick();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

describe('AD02 · la page publique d un evenement face a un visiteur sans compte', () => {
  test('temoin 1 · un visiteur sans compte ne lit AUCUN nom de participant', () => {
    mountAsVisitor();
    const text = screenText();

    PARTICIPANTS.forEach((participant) => {
      expect(text).not.toContain(participant.firstname);
      expect(text).not.toContain(participant.lastname);
    });
  });

  test('temoin 2 · le NOMBRE de participants reste juste pour un visiteur', () => {
    // On MASQUE, on ne vide jamais : la page doit continuer a dire combien de
    // personnes viennent. (Le rendu decoupe le compte et le mot en deux noeuds,
    // d'ou « 3 participant » et non « 3 participants ».)
    mountAsVisitor();
    expect(screenText()).toContain('3 participant');
  });

  test('temoin 3 · un visiteur ne sait pas QUI est signale absent', () => {
    mountAsVisitor();
    const text = screenText();

    expect(text).not.toContain(MISSING_PLAYER.firstname);
    expect(text).not.toContain(MISSING_PLAYER.lastname);
  });

  test('temoin 4 · un visiteur ne sait pas A QUI une tache est confiee', () => {
    mountAsVisitor();
    const text = screenText();

    expect(text).not.toContain(TASK_ASSIGNEE.firstname);
    expect(text).not.toContain(TASK_ASSIGNEE.lastname);
  });

  test('temoin 5 · un visiteur voit une porte vers la connexion, pas « Participer »', () => {
    const root = mountAsVisitor();

    expect(buttonWithText(root, 'Participer')).toBeUndefined();
    expect(buttonWithText(root, 'Se connecter')).toBeDefined();
  });

  test('temoin 6 · l appui du visiteur ouvre le tunnel de connexion et n envoie RIEN', async () => {
    const root = mountAsVisitor();

    await click(root, 'Se connecter');

    expect(openPublicAuthFlow).toHaveBeenCalledTimes(1);
    expect(createEventParticipation).toHaveBeenCalledTimes(0);
  });

  test('temoin 7 · un membre concerne voit toujours les noms', () => {
    // Le temoin ANTI-DEGAT : il prouve que la page n'a pas ete cassee pour ceux
    // qui ont le droit de la lire.
    mountAsManager();
    const text = screenText();

    ALL_NAMES.forEach((name) => {
      expect(text).toContain(name);
    });
  });
});
