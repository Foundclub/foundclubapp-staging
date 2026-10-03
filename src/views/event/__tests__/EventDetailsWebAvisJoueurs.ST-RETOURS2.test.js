/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// ST-RETOURS2 · POINT 1 — ÉCRAN 21 SUR ORDINATEUR : « AVIS DES JOUEURS ».
//
// Le site a SA fiche d'événement (`EventDetails.web.js`, une réécriture DOM) : le bloc des
// avis n'y existait pas. Planche ordinateur (parcours 6, « Les retours ») : la séance à
// gauche, les avis à DROITE — la moyenne, la répartition, le taux de réponse, chaque mot.
//
// 🚪 LES MÊMES PORTES QUE LE TÉLÉPHONE, et ce sont les MÊMES fonctions qui les tiennent
// (`peutVoirLesAvisDEntrainement`, `peutRelireSaNote`) : un entraînement, terminé à l'horloge
// du SERVEUR, et l'encadrant (entraîneur ou dirigeant, `canManageEvent`). Un joueur ne voit
// JAMAIS les avis des autres — et la lecture ne part même pas (la policy la lui refuserait) ;
// il relit seulement SA note.
//
// ⛔ Ce qui se mesure ici est le TEXTE RENDU par le vrai composant du téléphone servi au site.
// ==========================================================================

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockAttendanceQuery = { data: null };
const mockAvis = { data: null };
const mockMaNote = { data: null };
const mockAppelsAvis = jest.fn();
const mockAppelsMaNote = jest.fn();

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
  useGetEventAttendance: () => ({ ...emptyQuery(), data: mockAttendanceQuery.data }),
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

// Les services ne se chargent jamais pour de vrai : le client HTTP refuse de se charger
// sans `.env` (aucune copie de travail n'en a), et la suite entière tomberait.
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => ({
    data: null, isFetching: false, isLoading: false, refetch: jest.fn(),
  }),
}));

// 🔎 Les deux lectures des avis : on garde CHAQUE identifiant demandé, pour prouver qu'un
// joueur ne déclenche jamais la lecture des avis de l'équipe.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetMyTrainingReview: (/** @type {any} */ id) => {
    mockAppelsMaNote(id);
    return { data: id ? mockMaNote.data : undefined };
  },
  useGetTrainingReviews: (/** @type {any} */ id) => {
    mockAppelsAvis(id);
    return { data: id ? mockAvis.data : undefined };
  },
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

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

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

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const COACH = { documentId: 'coach-1', firstname: 'Karim', lastname: 'Coach' };
const JOUEUR = { documentId: 'joueur-1', firstname: 'Hugo', lastname: 'Lemaire' };

const buildTraining = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T17:00:00.000Z',
  documentId: 'event-1',
  endDate: '2099-01-01T18:30:00.000Z',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Entraînement · Seniors A',
  participations: [],
  startTime: '18:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: 'team-1',
    name: 'Seniors A',
    players: [JOUEUR],
    trainers: [COACH],
  },
  type: { name: 'Entrainement' },
  ...overrides,
});

/** L'horloge du SERVEUR après la fin de la séance. */
const APRES = { data: { items: [], serverNow: '2099-01-01T20:00:00.000Z', timezone: 'Europe/Paris' } };
/** L'horloge du SERVEUR pendant la séance. */
const PENDANT = { data: { items: [], serverNow: '2099-01-01T17:30:00.000Z', timezone: 'Europe/Paris' } };

/** La réponse de `GET /events/:id/training-reviews` — planche ordinateur, état 1. */
const NEUF_AVIS = {
  average: 7.6,
  count: 9,
  presentCount: 14,
  reviews: [
    { comment: 'Super séance, l’atelier de passes était top.', rating: 9 },
    { comment: 'Trop d’attente entre les exercices.', rating: 4 },
    { comment: '', rating: 10 },
    { comment: null, rating: 8 },
    { comment: '', rating: 8 },
    { comment: '', rating: 7 },
    { comment: '', rating: 7 },
    { comment: '', rating: 6 },
    { comment: '', rating: 5 },
  ],
  thresholdReached: true,
};

const ENCADRANT = {
  canEditClub: () => true,
  canEditEvent: () => true,
  canManageEvent: () => true,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { ...COACH, role: { name: 'Entraineur' } },
};

const LE_JOUEUR = {
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { ...JOUEUR, role: { name: 'Joueur' } },
};

/** @type {any} */
let mounted = null;

const monter = (/** @type {any} */ { attendance = APRES, auth = ENCADRANT, event = buildTraining() } = {}) => {
  mockEventQuery.data = event;
  mockAttendanceQuery.data = attendance;
  mockUseAuth.mockReturnValue(auth);
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
  return mounted;
};

/**
 * Tout le texte RENDU (arbre hôte), dans l'ordre de la page.
 * @param {any} arbre - Le rendu.
 * @returns {string} - Le texte.
 */
const texteRendu = (arbre) => {
  /** @type {string[]} */
  const morceaux = [];
  const parcourir = (/** @type {any} */ noeud) => {
    if (noeud === null || noeud === undefined) return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      morceaux.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    (noeud.children || []).forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

const lectureDesAvisDemandee = () => mockAppelsAvis.mock.calls.some(([id]) => Boolean(id));

beforeEach(() => {
  jest.clearAllMocks();
  mockAvis.data = null;
  mockMaNote.data = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

describe('ST-RETOURS2 · point 1 — « Avis des joueurs » sur la fiche d’un entraînement du site', () => {
  test('① l’entraîneur, séance terminée : la moyenne, le taux de réponse, la répartition, chaque mot, l’anonymat', () => {
    mockAvis.data = NEUF_AVIS;
    const texte = texteRendu(monter());

    expect(lectureDesAvisDemandee()).toBe(true);
    expect(texte).toContain('Avis des joueurs');
    expect(texte).toContain('7,6');
    expect(texte).toContain('note moyenne sur 10');
    expect(texte).toContain('9 avis sur 14 présents');
    expect(texte).toContain('Super séance, l’atelier de passes était top.');
    expect(texte).toContain('9/10');
    expect(texte).toContain('Trop d’attente entre les exercices.');
    expect(texte).toContain('+ 7 notes sans commentaire');
    expect(texte).toContain('Anonymes : tu vois les notes, jamais qui les a mises.');
  });

  test('② la planche : les avis vivent dans la colonne de DROITE, au-dessus des « Infos rapides »', () => {
    mockAvis.data = NEUF_AVIS;
    const texte = texteRendu(monter());

    const participants = texte.indexOf('Participants');
    const avis = texte.indexOf('Avis des joueurs');
    const infos = texte.indexOf('Infos rapides');
    expect(participants).toBeGreaterThan(-1);
    expect(avis).toBeGreaterThan(participants);
    expect(infos).toBeGreaterThan(avis);
  });

  test('③ aucun avis encore : la carte dit quand et pendant combien de temps les joueurs peuvent noter', () => {
    mockAvis.data = {
      average: null, count: 0, presentCount: 14, thresholdReached: false,
    };
    const texte = texteRendu(monter());

    expect(texte).toContain('Avis des joueurs');
    expect(texte).toContain('Aucun avis pour l’instant. Tes joueurs présents reçoivent l’invitation à la fin de la séance, et peuvent noter pendant 7 jours.');
  });

  test('④ séance pas terminée (horloge du serveur) : pas de bloc, et pas de lecture', () => {
    mockAvis.data = NEUF_AVIS;
    const texte = texteRendu(monter({ attendance: PENDANT }));

    expect(texte).not.toContain('Avis des joueurs');
    expect(lectureDesAvisDemandee()).toBe(false);
  });

  test('⑤ un match terminé n’a pas d’« Avis des joueurs » (son équivalent est « Stats du match »)', () => {
    mockAvis.data = NEUF_AVIS;
    const texte = texteRendu(monter({ event: buildTraining({ name: 'Match vs Lyon', type: { name: 'Match' } }) }));

    expect(texte).not.toContain('Avis des joueurs');
    expect(lectureDesAvisDemandee()).toBe(false);
  });

  test('⑥ le JOUEUR : jamais les avis des autres (la lecture ne part pas) ; il relit SA note, anonyme', () => {
    mockAvis.data = NEUF_AVIS;
    mockMaNote.data = { comment: null, rating: 8 };
    const texte = texteRendu(monter({ auth: LE_JOUEUR }));

    expect(lectureDesAvisDemandee()).toBe(false);
    expect(texte).not.toContain('Avis des joueurs');
    expect(texte).not.toContain('7,6');
    expect(texte).toContain('Tu as noté cette séance : 8/10');
    expect(texte).toContain('Anonyme : Karim ne sait pas qui l’a mise.');
  });

  test('⑦ le joueur qui n’a pas noté : rien du tout', () => {
    const texte = texteRendu(monter({ auth: LE_JOUEUR }));

    expect(texte).not.toContain('Tu as noté cette séance');
    expect(texte).not.toContain('Avis des joueurs');
  });

  test('⑧ un visiteur sans compte : ni les avis, ni la lecture', () => {
    mockAvis.data = NEUF_AVIS;
    const texte = texteRendu(monter({ auth: { canManageEvent: () => false, userData: null } }));

    expect(texte).not.toContain('Avis des joueurs');
    expect(lectureDesAvisDemandee()).toBe(false);
    expect(mockAppelsMaNote.mock.calls.some(([id]) => Boolean(id))).toBe(false);
  });
});
