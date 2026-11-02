/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// RECETTE-WEB-DIRIGEANT (29/10, décision d'Adel « 4- A ») — SUR LE SITE, L'ORGANISATEUR ANNULE
// SON ÉVÉNEMENT, COMME AU TÉLÉPHONE.
//
// Constaté sur la recette (Karim, AS Montrivage) : le téléphone a « Annuler » dans « Gérer
// l'événement » ; le site n'avait ce menu que pour un match, et sans « Annuler ». Un dirigeant
// ne pouvait donc pas annuler un entraînement depuis l'ordinateur.
// Harnais repris du témoin de l'en-tête (EventDetailsWebEnTete.FINITIONS11.test.js).
// ==========================================================================

const mockNavigate = jest.fn();
const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockCreateEventReport = jest.fn(() => Promise.resolve({ data: { id: 1 } }));

// La mutation APPELLE sa fonction : c'est l'envoi du signalement qu'on veut voir partir.
// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
// Le consentement de detection est couvert par EventDetailsWebVisiteurAD02.
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
/** @type {{ props: any }} */
const mockVillePrevenue = { props: null };
jest.mock('@/views/event/components/VillePrevenueDialog', () => (/** @type {any} */ props) => {
  mockVillePrevenue.props = props;
  return null;
});

jest.mock('@/views/event/components/EventChildRegistration', () => ({
  __esModule: true,
  default: () => null,
  EventChildRegistrationsForOrganizer: () => null,
}));
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => {
      Promise.resolve(options?.mutationFn?.(variables)).then(
        (result) => options?.onSuccess?.(result, variables),
        (error) => options?.onError?.(error, variables),
      );
    },
    // CORR-EVENEMENTS 130 : la feuille d'équipe passe par `mutateAsync`, qui appelle le service.
    mutateAsync: (/** @type {any} */ variables) => Promise.resolve(options?.mutationFn?.(variables)),
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
  useGetEventAttendance: () => emptyQuery(),
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  useRemindEventMatchResponses: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetMyTrainingReview: () => ({ data: undefined }),
  useGetTrainingReviews: () => ({ data: undefined }),
}));

const mockCancelEvent = jest.fn(() => Promise.resolve({ data: {} }));
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
const mockRespondToEventRsvp = jest.fn(() => Promise.resolve({ data: {} }));
jest.mock('@/services/event/eventService', () => ({
  cancelEvent: (/** @type {any} */ data) => mockCancelEvent(data),
  // CORR-EVENEMENTS 123 : la réponse Présent / Absent du joueur convoqué.
  respondToEventRsvp: (/** @type {any[]} */ ...args) => mockRespondToEventRsvp(...args),
  updateEvent: jest.fn(),
}));

// 🚩 Le signalement part par le MÊME service que le téléphone (`useEventMutations`).
jest.mock('@/services/eventReport/eventReportService', () => ({
  createEventReport: (/** @type {any} */ data) => mockCreateEventReport(data),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
  deleteEventParticipation: jest.fn(),
}));

const mockCreateCustomTournamentTeam = jest.fn(() => Promise.resolve({ data: {} }));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: (/** @type {any[]} */ ...args) => mockCreateCustomTournamentTeam(...args),
  registerClubTeamToTournament: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({ share: jest.fn() }));

// CORR-EVENEMENTS 119 : la feuille « série » s'ouvre par une BottomModal ; sa doublure rend
// en-tête, corps et pied tels quels quand elle est visible.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return react.createElement(
      rn.View,
      { testID: 'bottom-modal' },
      props.headerComponent,
      props.children,
      props.footerComponent,
    );
  };
});

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

const CLUB = { documentId: 'club-1', name: 'AS Montrivage' };
const COACH = { documentId: 'user-1', firstname: 'Karim', lastname: 'Benali' };

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  club: CLUB,
  date: '2099-09-05T17:00:00.000Z',
  documentId: 'event-1',
  endTime: '20:00',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  location: '12 rue de la Paix, 69001 Lyon',
  name: 'Entrainement du mardi',
  participations: [],
  startTime: '19:00',
  team: {
    club: CLUB,
    documentId: 'team-1',
    name: 'U15',
    players: [],
    trainers: [COACH],
  },
  type: { name: 'Entrainement' },
  ...overrides,
});

/** @type {any} */
let mounted = null;

const mountScreen = (/** @type {any} */ { auth = null, event, routeParams = {} } = {}) => {
  mockEventQuery.data = event;
  mockUseAuth.mockReturnValue(auth || {
    canEditClub: () => true,
    canEditEvent: () => true,
    canManageEvent: () => true,
    freeUsageSummary: null,
    subscriptionAccessLevel: 'FREE',
    userData: { ...COACH, role: { name: 'Dirigeant' } },
  });
  act(() => {
    mounted = renderer.create(
      <EventDetailsWeb
        navigation={{
          addListener: () => () => {},
          goBack: mockGoBack,
          navigate: mockNavigate,
          replace: mockReplace,
          setOptions: jest.fn(),
        }}
        route={{ params: { eventId: 'event-1', ...routeParams } }}
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

const ouvrirMenu = (/** @type {any} */ root) => {
  const [gerer] = root.findAll(
    (/** @type {any} */ n) => n.type === 'button' && n.props['aria-haspopup'] === 'menu',
  );
  expect(gerer).toBeDefined();
  act(() => gerer.props.onClick());
  return root.findAll((/** @type {any} */ n) => n.props?.role === 'menuitem');
};
const annuler = (/** @type {any} */ items) => items
  .find((/** @type {any} */ item) => textOf(item) === 'Annuler');

beforeEach(() => {
  jest.clearAllMocks();
  mockEventQuery.data = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
});

describe('RWDIRIG · annuler un événement depuis le site', () => {
  test.each([['Entrainement'], ['Match']])('🔴 %s : « Gérer l événement » propose « Annuler »', (typeName) => {
    const root = mountScreen({ event: buildEvent({ type: { name: typeName } }) });
    expect(annuler(ouvrirMenu(root))).toBeDefined();
  });

  test('🔴 « Annuler » demande confirmation, annule CETTE séance puis revient en arrière', async () => {
    window.confirm = jest.fn(() => true);
    const root = mountScreen({ event: buildEvent() });
    const bouton = annuler(ouvrirMenu(root));
    await act(async () => {
      bouton.props.onClick();
    });
    expect(window.confirm).toHaveBeenCalledWith(
      'Es-tu sûr·e de vouloir annuler cet événement ?\n\nUne fois annulé, l\'événement ne sera plus visible par les participant·e·s.',
    );
    expect(mockCancelEvent).toHaveBeenCalledWith({ documentId: 'event-1' });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('🔴 refuser la confirmation n annule rien', async () => {
    window.confirm = jest.fn(() => false);
    const root = mountScreen({ event: buildEvent() });
    const bouton = annuler(ouvrirMenu(root));
    await act(async () => {
      bouton.props.onClick();
    });
    expect(mockCancelEvent).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('protégé — sans droit de modifier : ni menu, ni « Annuler »', () => {
    const root = mountScreen({
      auth: {
        canEditClub: () => false,
        canEditEvent: () => false,
        canManageEvent: () => false,
        userData: { documentId: 'autre', role: { name: 'Joueur' } },
      },
      event: buildEvent(),
    });
    expect(root.findAll(
      (/** @type {any} */ n) => n.type === 'button' && n.props['aria-haspopup'] === 'menu',
    )).toHaveLength(0);
  });
});

// CORR-EVENEMENTS point 119 (recette du site, 29/10) — dans une série, « Annuler » n'annulait
// que la séance, sans le dire : le dirigeant croyait la saison arrêtée. Décision A : la feuille
// à trois choix du téléphone (cette séance, les suivantes, toutes).
describe('CORR-EVENEMENTS 119 · annuler une séance d une série', () => {
  const presser = async (/** @type {any} */ root, /** @type {string} */ libelle) => {
    const [cible] = root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
      && textOf(n) === libelle);
    expect(cible).toBeDefined();
    await act(async () => { cible.props.onPress(); });
  };

  test('🐞 une séance de série ouvre la feuille à trois choix, sans fenêtre du navigateur', async () => {
    window.confirm = jest.fn(() => true);
    const root = mountScreen({ event: buildEvent({ recurrenceGroupId: 'serie-1' }) });
    const bouton = annuler(ouvrirMenu(root));
    await act(async () => { bouton.props.onClick(); });
    expect(window.confirm).not.toHaveBeenCalled();
    const feuille = textOf(root.findByProps({ testID: 'bottom-modal' }));
    expect(feuille).toContain('Annulation d’un événement récurrent');
    const choix = root.findByProps({ testID: 'bottom-modal' })
      .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')
      .map(textOf);
    expect(choix).toEqual(expect.arrayContaining([
      'Cet événement', 'Cet événement et les suivants', 'Tous les événements', 'Ne rien annuler',
    ]));
    expect(mockCancelEvent).not.toHaveBeenCalled();
  });

  test.each([
    ['Cet événement', { documentId: 'event-1' }],
    ['Cet événement et les suivants', { documentId: 'event-1', recurrenceMode: 'future' }],
    ['Tous les événements', { documentId: 'event-1', recurrenceMode: 'all' }],
  ])('« %s » envoie la bonne portée au serveur', async (libelle, attendu) => {
    const root = mountScreen({ event: buildEvent({ recurrenceGroupId: 'serie-1' }) });
    const bouton = annuler(ouvrirMenu(root));
    await act(async () => { bouton.props.onClick(); });
    await presser(root, libelle);
    expect(mockCancelEvent).toHaveBeenCalledWith(attendu);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  test('« Ne rien annuler » ferme la feuille sans appel', async () => {
    const root = mountScreen({ event: buildEvent({ recurrenceGroupId: 'serie-1' }) });
    const bouton = annuler(ouvrirMenu(root));
    await act(async () => { bouton.props.onClick(); });
    await presser(root, 'Ne rien annuler');
    expect(root.findAllByProps({ testID: 'bottom-modal' })).toHaveLength(0);
    expect(mockCancelEvent).not.toHaveBeenCalled();
  });
});

// CORR-EVENEMENTS point 123 (recette du site, 30/10) — le joueur convoqué n'avait que
// « Participer » (une demande), sans « Absent ». Décision A : deux boutons « Présent / Absent ».
describe('CORR-EVENEMENTS 123 · le joueur convoqué répond Présent ou Absent', () => {
  const JOUEUR = { documentId: 'joueur-1', firstname: 'Joris', lastname: 'Recette' };
  const authJoueur = {
    canEditClub: () => false,
    canEditEvent: () => false,
    canManageEvent: () => false,
    userData: { ...JOUEUR, role: { name: 'Joueur' } },
  };
  const matchDuJoueur = () => buildEvent({
    team: {
      club: CLUB, documentId: 'team-1', name: 'U15', players: [JOUEUR], trainers: [COACH],
    },
    type: { name: 'Match' },
  });
  const bouton = (/** @type {any} */ root, /** @type {string} */ libelle) => root.findAll(
    (/** @type {any} */ n) => n.type === 'button' && textOf(n) === libelle,
  )[0];

  test('🐞 « Présent » et « Absent » remplacent « Participer »', async () => {
    const root = mountScreen({ auth: authJoueur, event: matchDuJoueur() });

    expect(bouton(root, 'Participer')).toBeUndefined();
    expect(bouton(root, 'Présent')).toBeDefined();
    await act(async () => { bouton(root, 'Absent').props.onClick(); });
    expect(mockRespondToEventRsvp).toHaveBeenCalledWith('event-1', 'absent');
  });

  // REPRISE-EVENEMENTS 123 — la contre-recette voyait encore « Session fermée » et
  // « Annuler ma demande » sous Présent / Absent : deux façons de répondre, dont une de coach.
  test('🐞 avec Présent / Absent : ni « Session fermée » ni « Annuler ma demande »', () => {
    const root = mountScreen({
      auth: authJoueur,
      event: {
        ...matchDuJoueur(),
        participationRequests: [{
          documentId: 'demande-1', isActive: true, participationStatus: 'pending', user: JOUEUR,
        }],
        sessionStatus: 'closed',
      },
    });

    expect(bouton(root, 'Présent')).toBeDefined();
    expect(bouton(root, 'Annuler ma demande')).toBeUndefined();
    // La pastille rend « Session », « », « fermée » en trois morceaux.
    expect(JSON.stringify(mounted.toJSON())).not.toContain('"Session"');
  });

  // REPRISE-EVENEMENTS 123 (additif) — au-dessus de Présent / Absent, « Mon statut » disait
  // « En attente de validation » (la vieille demande) : il dit maintenant la réponse.
  test('🐞 « Mon statut » dit la réponse Présent / Absent, pas la demande en attente', () => {
    mountScreen({
      auth: authJoueur,
      event: {
        ...matchDuJoueur(),
        participationRequests: [{
          documentId: 'demande-1', isActive: true, participationStatus: 'pending', user: JOUEUR,
        }],
      },
    });
    const sansReponse = JSON.stringify(mounted.toJSON());
    expect(sansReponse).not.toContain('En attente de validation');
    expect(sansReponse).toContain('Aucune réponse');
  });

  test('🐞 « Mon statut » d un joueur absent dit « Absent », comme son bouton', () => {
    mountScreen({ auth: authJoueur, event: { ...matchDuJoueur(), missings: [JOUEUR] } });

    expect(JSON.stringify(mounted.toJSON())).not.toContain('Tu es signalé absent');
  });
});

// CORR-EVENEMENTS point 126 (recette du site, 30/10) — « Validation auto » s'affichait, mais un
// joueur extérieur et un enfant inscrit par son parent restaient « en attente ». Le serveur ne
// valide seul que les membres des équipes conviées (event-participation.ts, « isInternalParticipant » ;
// child-registration-rules.js : un enfant est toujours une demande hors réservation).
// Décision A : dire la vraie règle à l'écran.
describe('FIN-EVENEMENTS p131 · un tournoi clôturé', () => {
  const TOURNOI_CLOS = () => buildEvent({
    name: 'Tournoi de la Toussaint',
    sessionStatus: 'closed',
    tournamentTeams: [{
      archivedAt: '2026-10-31T10:00:00.000Z',
      documentId: 'tt-lions',
      members: [],
      name: 'Les Lions',
      status: 'archived',
    }],
    type: { name: 'Tournoi' },
  });
  const texteDe = () => JSON.stringify(mounted.toJSON());

  test('🐞 le bandeau daté est en haut de la fiche, avant la carte de l événement', () => {
    mountScreen({ event: TOURNOI_CLOS() });
    const texte = texteDe();

    expect(texte).toContain('tournoi-cloture');
    expect(texte.indexOf('tournoi-cloture')).toBeLessThan(texte.indexOf('"data-event-section":"overview"'));
  });

  test('🐞 ni « Gérer l’événement » ni « Modifier »', () => {
    mountScreen({ event: TOURNOI_CLOS() });
    const texte = texteDe();

    expect(texte).not.toContain('"aria-haspopup":"menu"');
    expect(texte).not.toContain('"Modifier"');
    expect(texte).not.toMatch(/Composition d.[eé]quipes/);
  });

  test('🐞 un tournoi « Privé » neuf n’est pas clôturé : menu gardé, sans bandeau', () => {
    mountScreen({
      event: buildEvent({
        name: 'Tournoi privé', sessionStatus: 'closed', tournamentTeams: [], type: { name: 'Tournoi' },
      }),
    });
    const texte = texteDe();

    expect(texte).toContain('"aria-haspopup":"menu"');
    expect(texte).not.toContain('tournoi-cloture');
  });

  test('protégé : un tournoi en cours garde « Gérer l’événement », sans bandeau', () => {
    mountScreen({
      event: buildEvent({ name: 'Tournoi de printemps', type: { name: 'Tournoi' } }),
    });
    const texte = texteDe();

    expect(texte).toContain('"aria-haspopup":"menu"');
    expect(texte).not.toContain('tournoi-cloture');
    expect(texte).toMatch(/Composition d.[eé]quipes/);
  });
});

describe('CORR-EVENEMENTS 126 · la pastille de validation dit la vraie règle', () => {
  test('🐞 « Validation auto » précise qu elle ne vaut que pour les membres des équipes', () => {
    mountScreen({ event: buildEvent({ validationMode: 'auto' }) });
    const texte = JSON.stringify(mounted.toJSON());

    expect(texte).toContain('Validation auto pour les membres des équipes');
  });

  test('« Validation manuelle » reste', () => {
    mountScreen({ event: buildEvent({ validationMode: 'manual' }) });

    expect(JSON.stringify(mounted.toJSON())).toContain('Validation manuelle');
  });
});

// CORR-EVENEMENTS point 128 (recette du site, 30/10) — un stage de 31 jours : la fiche n'affichait
// que le premier jour, ni date de fin ni programme. Décision A : un bloc « Programme », repliable
// au-delà de 7 jours.
describe('CORR-EVENEMENTS 128 · le programme d un stage sur la fiche', () => {
  const jours = Array.from({ length: 10 }, (_v, index) => ({
    date: `2099-11-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
    documentId: `jour-${index + 1}`,
    endTime: '17:00:00.000',
    isActive: true,
    startTime: '09:00:00.000',
  }));
  const stage = () => buildEvent({
    childStageEvents: jours,
    eventFormat: 'stage_parent',
    stageDefaultEndTime: '17:00:00.000',
    stageDefaultStartTime: '09:00:00.000',
    stageEndDate: '2099-11-10',
    stageStartDate: '2099-11-01',
    type: { name: 'Stage' },
  });
  const programme = (/** @type {any} */ root) => root.findAll(
    (/** @type {any} */ n) => n.props?.['data-event-section'] === 'stage-programme',
  )[0];

  test('🐞 la fiche montre la période et les 7 premiers jours, le reste se déplie', () => {
    const root = mountScreen({ event: stage() });
    const bloc = programme(root);
    expect(bloc).toBeDefined();
    // Les jours sont un tableau d'enfants : on lit le rendu hôte du bloc, pas `textOf`.
    const lire = () => JSON.stringify(mounted.toJSON());
    let texte = lire();
    expect(texte).toContain('Programme du stage');
    expect(texte).toContain('Jour 7');
    expect(texte).not.toContain('Jour 8');
    expect(texte).toContain('09:00 – 17:00');

    const deplier = root.findAll(
      (/** @type {any} */ n) => n.type === 'button' && textOf(n) === 'Voir les 3 autres jours',
    )[0];
    expect(deplier).toBeDefined();
    act(() => deplier.props.onClick());
    texte = lire();
    expect(texte).toContain('Jour 10');
  });

  test('un événement d un seul jour n a pas de bloc programme', () => {
    const root = mountScreen({ event: buildEvent() });
    expect(programme(root)).toBeUndefined();
  });
});

// CORR-EVENEMENTS point 130 (recette du site, 30/10) — le nom d'une équipe de tournoi se tapait
// dans une fenêtre grise du navigateur, et le parent voyait « Inscrire mon équipe » et « Créer une
// équipe ». Décision A : une vraie feuille « Nom de l'équipe » pour tous, ces boutons cachés au parent.
describe('CORR-EVENEMENTS 130 · la feuille d équipe du tournoi', () => {
  const tournoi = () => buildEvent({
    tournamentConfig: { allowCustomTeams: true },
    tournamentTeams: [],
    type: { name: 'Tournoi' },
  });
  const bouton = (/** @type {any} */ root, /** @type {string} */ libelle) => root.findAll(
    (/** @type {any} */ n) => n.type === 'button' && textOf(n) === libelle,
  )[0];

  test('🐞 « Créer une équipe » ouvre une feuille, sans fenêtre du navigateur', async () => {
    window.prompt = jest.fn(() => 'Les Lions');
    const root = mountScreen({ event: tournoi() });
    await act(async () => { bouton(root, 'Créer une équipe').props.onClick(); });

    expect(window.prompt).not.toHaveBeenCalled();
    const champ = root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Nom de l’équipe' && typeof n.props?.onChangeText === 'function')[0];
    expect(champ).toBeDefined();
    const creer = () => root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function' && textOf(n) === 'Créer mon équipe')[0];

    // Vide : refusé, et dit.
    await act(async () => { creer().props.onPress(); });
    expect(mockCreateCustomTournamentTeam).not.toHaveBeenCalled();
    expect(JSON.stringify(mounted.toJSON())).toContain('Ajoute un nom d’équipe avant de continuer.');

    await act(async () => { champ.props.onChangeText('  Les Lions  '); });
    await act(async () => { creer().props.onPress(); });
    expect(mockCreateCustomTournamentTeam).toHaveBeenCalledWith('event-1', { name: 'Les Lions' });
  });

  test('🐞 le parent ne voit ni « Inscrire mon équipe » ni « Créer une équipe »', () => {
    const root = mountScreen({
      auth: {
        canEditClub: () => false,
        canEditEvent: () => false,
        canManageEvent: () => false,
        userData: {
          documentId: 'parent-1', firstname: 'Papa', lastname: 'Test', role: { name: 'Parent' }, trainedTeams: [{ documentId: 'team-9', name: 'U9' }],
        },
      },
      event: tournoi(),
    });

    expect(bouton(root, 'Créer une équipe')).toBeUndefined();
    expect(bouton(root, 'Inscrire mon équipe')).toBeUndefined();
  });

  // REPRISE-EVENEMENTS 130 — « Réponse pour Lina » débordait à droite à 390 : le bloc était un
  // élément de la rangée de boutons, à la largeur de son contenu.
  test('🐞 le bloc des enfants prend toute la largeur de la rangée', () => {
    const root = mountScreen({
      auth: {
        canEditClub: () => false,
        canEditEvent: () => false,
        canManageEvent: () => false,
        userData: {
          documentId: 'parent-1', firstname: 'Paola', lastname: 'Recette', role: { name: 'Parent' },
        },
      },
      event: tournoi(),
    });
    const BlocDesEnfants = jest.requireMock('@/views/event/components/EventChildRegistration').default;

    expect(root.findByType(BlocDesEnfants).parent?.props.style)
      .toEqual(expect.objectContaining({ flexBasis: '100%', minWidth: 0 }));
  });

  // REPRISE-EVENEMENTS 131 — la fiche d'un tournoi clôturé proposait encore « Modifier les
  // paramètres », « Gérer mon équipe » et « Créer une équipe ». Décision A : lecture seule,
  // avec un bandeau « Clôturé le … » (la date de l'archivage des équipes, comme au pilotage).
  test('🐞 tournoi clôturé : plus aucun geste, un bandeau daté', () => {
    const root = mountScreen({
      event: {
        ...tournoi(),
        sessionStatus: 'closed',
        tournamentTeams: [{
          archivedAt: '2026-10-31T10:00:00.000Z',
          captainUser: { documentId: COACH.documentId },
          documentId: 'tt-1',
          members: [],
          name: 'Les Lions',
          status: 'archived',
        }],
      },
    });

    expect(bouton(root, 'Modifier les paramètres')).toBeUndefined();
    expect(bouton(root, 'Gérer mon équipe')).toBeUndefined();
    expect(bouton(root, 'Créer une équipe')).toBeUndefined();
    expect(JSON.stringify(mounted.toJSON())).toContain('Tournoi clôturé le');
    expect(bouton(root, 'Piloter la compétition')).toBeDefined();
  });
});

// REPRISE-CHEMINS (02/11, point 41, revue « modifier ») : sur le site, une fiche annulée montre le
// bandeau « Annulé » EN TÊTE (avant la carte de l'événement), et plus « Gérer l'événement », ni
// « Tu participes », ni « Aucune réponse ».
describe('REPRISE-CHEMINS 41 · une fiche annulée, sur le site', () => {
  const annulee = () => buildEvent({
    isActive: false, status: 'cancelled', updatedAt: '2026-10-29T18:00:00.000Z',
  });
  const sections = (/** @type {any} */ root) => root.findAll(
    (/** @type {any} */ n) => typeof n.type === 'string'
      && (n.props['data-testid'] === 'event-cancelled-banner'
        || n.props['data-event-section'] === 'overview'),
  ).map((/** @type {any} */ n) => n.props['data-testid'] || n.props['data-event-section']);

  test('🔴 le bandeau vient avant la carte, sans « Gérer l événement »', () => {
    const root = mountScreen({ event: annulee() });
    expect(sections(root)).toEqual(['event-cancelled-banner', 'overview']);
    expect(root.findAll(
      (/** @type {any} */ n) => n.type === 'button' && n.props['aria-haspopup'] === 'menu',
    )).toHaveLength(0);
    const texte = textOf(root);
    expect(texte).not.toMatch(/Tu participes|Aucune réponse/);
    // La recette du site (02/11) : sans le menu, le bouton « Modifier » seul revenait.
    expect(root.findAll((/** @type {any} */ n) => n.type === 'button' && textOf(n) === 'Modifier'))
      .toHaveLength(0);
  });

  test('une fiche active garde « Gérer l événement » et pas de bandeau', () => {
    const root = mountScreen({ event: buildEvent() });
    expect(sections(root)).toEqual(['overview']);
  });
});

// FIN-CHEMINS (02/11, 94, contre-recette 07:0x) — sur le site, la séance qu'on vient de créer a
// l'assistant derrière elle dans l'historique : « C'est annulé · OK » y ramenait. Comme la sortie
// du téléphone après une création (`handleBackAfterCreation`) : « Mes événements ». ROUGE avant.
describe('FIN-CHEMINS 94 · annuler la séance qu on vient de créer', () => {
  const annulerLaSeance = async (/** @type {any} */ root) => {
    window.confirm = jest.fn(() => true);
    const bouton = annuler(ouvrirMenu(root));
    await act(async () => {
      bouton.props.onClick();
    });
  };

  test('🔴 sans Ville : « Mes événements », pas l assistant', async () => {
    const root = mountScreen({ event: buildEvent(), routeParams: { fromEventCreation: true } });
    await annulerLaSeance(root);
    expect(mockReplace).toHaveBeenCalledWith('MyEventList');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('🔴 Ville prévenue : « OK » mène à « Mes événements », pas à l assistant', async () => {
    mockCancelEvent.mockImplementationOnce(() => Promise.resolve({
      data: {}, meta: { collectivitePrevenue: { collectiviteName: 'Ville de Montrivage' } },
    }));
    const root = mountScreen({ event: buildEvent(), routeParams: { fromEventCreation: true } });
    await annulerLaSeance(root);
    expect(mockVillePrevenue.props.message).toContain('Ville de Montrivage');
    expect(mockReplace).not.toHaveBeenCalled();
    act(() => mockVillePrevenue.props.onClose());
    expect(mockReplace).toHaveBeenCalledWith('MyEventList');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  test('🔒 une séance ouverte d ailleurs : « OK » revient en arrière', async () => {
    mockCancelEvent.mockImplementationOnce(() => Promise.resolve({
      data: {}, meta: { collectivitePrevenue: { collectiviteName: 'Ville de Montrivage' } },
    }));
    const root = mountScreen({ event: buildEvent() });
    await annulerLaSeance(root);
    act(() => mockVillePrevenue.props.onClose());
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
