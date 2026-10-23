/* eslint-disable max-len -- titres et attendus en francais, lus tels quels (ST-MATCH) */
import renderer, { act } from 'react-test-renderer';

// Lot N3 — CE QUE L'ECRAN CALCULE POUR LA CARTE DU MATCH (planche 03, A/B/I).
//
// L'entete ne fait que PEINDRE : c'est ici que se decide quoi peindre, et la
// separation vient d'une decision, pas d'un gout — D3. L'orientation de la
// pastille (« À domicile » pour l'organisateur, « À l'extérieur » pour le meme
// match lu par l'equipe INVITEE) a besoin de savoir QUI regarde, et seul
// l'ecran le sait. Le score le fait deja (`shouldInvertStoredScore`) ; la
// pastille suit exactement le meme chemin.
//
// Ce que ce filet couvre :
//   · D1/D2 — la pastille de type porte le lieu, sur une source TRI-ETAT
//     (`event.isHome` true / false / null) avec repli sur l'ancien parc.
//   · D3 — l'orientation pour un lecteur de l'equipe invitee.
//   · D8 — un match fini dit « TERMINÉ » et se tait sur le lieu.
//   · D5/D6 — l'encart et le verdict, passes a l'entete par `matchScoreSummary`.
//   · D9/D10 — la feuille « Nommer l'adversaire » et le PUT qu'elle envoie.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : que le serveur SERT `isHome`. Le champ
// existe cote admin (AE03, `3e7dd58`) mais n'est pas deploye sur la recette au
// 23/08 — d'ici la, seul le repli s'affichera en vrai. C'est pour cela que le
// temoin 2 existe.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };
const mockAttendance = { data: null };
const mockMatchStats = { appels: /** @type {any[]} */ ([]), data: /** @type {any} */ (null) };
const mockHeaderProps = { value: null };
const mockTagProps = { value: null };
const mockUpdateNoNav = jest.fn();

// 🧨 R9 — CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService`
// importe `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent
// — et `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute des que l ecran importe le
// service (piege documente, deja paye plusieurs fois).
// 👪 PAR-L11b (13/10) — le bloc « Inscrire mes enfants » charge ses propres services : double ici,
// comme chaque service de l ecran (EventDetails.js:123-128).
jest.mock('@/views/event/components/EventChildRegistration', () => ({
  __esModule: true,
  default: () => null,
  EventChildRegistrationsForOrganizer: () => null,
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  inviteToTeam: () => Promise.resolve(null),
  resolveTeamInvitationAvailability: () => ({
    candidateId: '',
    canInvite: false,
    reason: 'missing-team',
  }),
}));

jest.mock('react-i18next', () => {
  const askedKeys = /** @type {string[]} */ ([]);
  const rendre = (/** @type {any} */ modele, /** @type {any} */ options) => String(modele)
    .replace(
      /\{\{(\w+)\}\}/g,
      (/** @type {any} */ _tout, /** @type {any} */ nom) => (
        options && nom in options ? String(options[nom]) : `{{${nom}}}`
      ),
    );
  return {
    ...jest.requireActual('react-i18next'),
    askedKeys,
    useTranslation: () => ({
      t: (
        /** @type {string} */ key,
        /** @type {any} */ fallback,
        /** @type {any} */ options,
      ) => {
        askedKeys.push(key);
        const modele = typeof fallback === 'string' ? fallback : key;
        const reglages = typeof fallback === 'string' ? options : fallback;
        return rendre(modele, reglages);
      },
    }),
  };
});

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

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

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

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: {} } },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockUseAuth(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendMessage: jest.fn() }),
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
  useGetEventAttendance: () => ({
    data: mockAttendance.data,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => emptyQuery(),
}));

jest.mock('@/services/eventParticipation/eventParticipationQueries', () => ({
  useGetEventParticipations: () => emptyQuery(),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseCampaigns: () => ({ ...emptyQuery(), data: { data: [] } }),
}));

// 🏆 N7 item 5 (vague P, 23/08) — le fil du tournoi lit `useGetTournamentDashboard`,
// qui tire `@/services/client`. Sans cette doublure MUETTE, la suite entiere
// tombe a 0 test (piege connu : un import de service de plus). `data: undefined`
// = le calcul de repli de la page, identique a ce que ces temoins decrivaient.
jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({ data: undefined, isLoading: false }),
}));

// ST-MATCH (02/10) — la feuille de stats devient pilotable par un temoin. `null` par
// defaut : les temoins N3 et R2 lisent la meme chose qu'avant.
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  // DECISIONS-SOIR — la doublure retient ce que l'écran DEMANDE (équipe, `enabled`).
  useGetEventMatchStats: (/** @type {any[]} */ ...args) => {
    mockMatchStats.appels.push(args);
    return { ...emptyQuery(), data: mockMatchStats.data };
  },
  useGetEventMyMatchResponse: () => emptyQuery(),
}));

jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  exportEventParticipants: jest.fn(),
  rejectFeatured: jest.fn(),
}));

jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
}));

jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: jest.fn(),
  registerClubTeamToTournament: jest.fn(),
  requestJoinTournamentTeam: jest.fn(),
  respondToTournamentTeam: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: jest.fn() },
}));

jest.mock('@/utils/performance/eventDetailsPerformance', () => ({
  markEventDetailsPerf: jest.fn(),
}));

// 🪢 `updateEventNoNavMutation` est le SEUL de la liste qui doit repondre pour
// de vrai : c'est par lui que part le PUT { opponentName } (D9). Les autres
// restent au repos, comme dans les filets voisins.
jest.mock('../hooks/useEventMutations', () => {
  const idleMutation = () => ({ isPending: false, mutate: jest.fn() });
  return {
    useEventMutations: () => ({
      acceptParticipationMutation: idleMutation(),
      bookFullMutation: idleMutation(),
      cancelEventMutation: idleMutation(),
      coachArrivalMutation: idleMutation(),
      createEventParticipationMutation: idleMutation(),
      declineParticipationMutation: idleMutation(),
      deleteParticipationMutation: idleMutation(),
      joinReservationMutation: idleMutation(),
      missingEventMutation: idleMutation(),
      openForPlayersMutation: idleMutation(),
      remindEventMutation: idleMutation(),
      reportEventMutation: idleMutation(),
      requestFeaturedMutation: idleMutation(),
      resetAttendanceMutation: idleMutation(),
      respondToEventRsvpMutation: idleMutation(),
      selfArrivalMutation: idleMutation(),
      selfLateMutation: idleMutation(),
      sosAlertMutation: idleMutation(),
      updateEventMutation: idleMutation(),
      updateEventNoNavMutation: {
        isPending: false,
        mutate: jest.fn(),
        mutateAsync: (/** @type {any} */ payload) => mockUpdateNoNav(payload),
      },
      updateLateMinutesMutation: idleMutation(),
    }),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        onPress: props.onPress,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// 🏷️ LA PASTILLE DE TYPE — on capture son `text`, pas son rendu. C'est ce
// libelle-la que N1 a centralise dans `buildTypeTagLabel` et que N3 allonge.
jest.mock('@/components/atoms/tag/Tag', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function TagDouble(/** @type {any} */ props) {
    mockTagProps.value = props;
    return react.createElement(rn.Text, null, props.text || '');
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function WithDataWrapperDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible && !props.visible) return null;
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SegmentedControlDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.View,
      { testID: 'doublure-onglets' },
      (props.options || []).map((/** @type {any} */ option) => react.createElement(
        rn.TouchableOpacity,
        { key: option.value, onPress: () => props.onChange(option.value) },
        react.createElement(rn.Text, null, option.label),
      )),
    );
  };
});

// 🪢 LA DOUBLURE QUI CAPTURE — motif d'`EventDetailsComptesSupprimes.test.js`
// (`EventParticipantsCapture`). L'entete ne rend pas son nom : elle rend CE
// QU'ON LUI DONNE, et c'est exactement ce que ce lot calcule.
jest.mock('../components/EventHeader', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventHeaderCapture(/** @type {any} */ props) {
    mockHeaderProps.value = props;
    return react.createElement(rn.Text, null, 'DOUBLURE_EventHeader');
  };
});

/* eslint-disable global-require */
jest.mock(
  '@/components/molecules/eventAnswerButtons/EventAnswerButtons',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventAnswerButtons'),
);
jest.mock(
  '@/components/organisms/joinEventModal/JoinEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_JoinEventModal'),
);
jest.mock(
  '@/components/organisms/refuseParticipationModal/RefuseParticipationModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_RefuseParticipationModal'),
);
jest.mock(
  '@/components/organisms/reportEventModal/ReportEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_ReportEventModal'),
);
jest.mock(
  '@/components/organisms/shareEventModal/ShareEventModal',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_ShareEventModal'),
);
jest.mock(
  '../components/EventParticipants',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventParticipants'),
);
jest.mock(
  '../components/EventDetectionSlots',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventDetectionSlots'),
);
jest.mock(
  '../components/EventTasksSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksSection'),
);
jest.mock(
  '../components/EventTeamAudiencesSection',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesSection'),
);
jest.mock(
  '../components/EventReservationActions',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventReservationActions'),
);
/* eslint-enable global-require */

// eslint-disable-next-line import/first
import { TextInput } from 'react-native';

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const TEAM_INVITEE_ID = 'team-invitee';
const COACH = 'coach-1';
const COACH_INVITEE = 'coach-invitee';
const CLUB_NAME = 'Test FC';
const ADVERSAIRE = 'FC Bonneveine';

// Un match FINI a besoin de l'horloge du SERVEUR : sans elle
// `resolveIsMatchFinished` rend `false`, quelle que soit la date de
// l'evenement (`eventMatchClock.js:68`). C'est la regle AC10, pas un detail
// de montage — et c'est ce qui rend le temoin 4 possible.
const HORLOGE_SERVEUR = (/** @type {string} */ iso) => ({
  data: { serverNow: iso },
});

const buildMatch = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  endDate: '2099-01-01T12:00:00.000Z',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: `Match vs ${ADVERSAIRE}`,
  opponentName: ADVERSAIRE,
  participations: [],
  startTime: '10:00',
  team: {
    club: { documentId: CLUB_ID, name: CLUB_NAME },
    documentId: TEAM_ID,
    name: 'U15 A',
    players: [],
    trainers: [{ documentId: COACH }],
  },
  type: { name: 'Match' },
  ...overrides,
});

const authPour = (
  /** @type {string} */ documentId,
  /** @type {boolean} */ peutGerer = false,
  /** @type {any[]} */ trainedTeams = [],
) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: {
    documentId,
    role: { name: peutGerer ? 'Dirigeant' : 'Joueur' },
    trainedTeams,
  },
});

const ORGANISATEUR = () => authPour(COACH, true, [{ documentId: TEAM_ID }]);
const SPECTATEUR = () => authPour('visiteur-1', false);
// Le coach de l'equipe INVITEE : meme match, autre camp. C'est lui qui doit
// voir la pastille retournee (D3).
const COACH_DE_L_INVITEE = () => authPour(COACH_INVITEE, false, [{ documentId: TEAM_INVITEE_ID }]);

/** @type {any} */
let monte = null;

const demonter = () => {
  if (!monte) return;
  act(() => {
    monte.unmount();
  });
  monte = null;
};

const monter = (/** @type {any} */ {
  attendance = null, auth, event, matchStats = null,
} = {}) => {
  mockEventQuery.data = event === undefined ? buildMatch() : event;
  mockAttendance.data = attendance;
  mockMatchStats.data = matchStats;
  mockMatchStats.appels = [];
  mockUseAuth.mockReturnValue(auth || ORGANISATEUR());

  demonter();
  mockHeaderProps.value = null;
  mockTagProps.value = null;
  mockUpdateNoNav.mockClear();
  mockUpdateNoNav.mockResolvedValue({});

  act(() => {
    monte = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          getParent: () => undefined,
          getState: () => ({ routeNames: ['EventDetails', 'EventEdit'] }),
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: mockSetOptions,
        }}
        route={{ params: { eventId: 'event-1' } }}
      />,
    );
  });

  return monte.root;
};

afterEach(() => {
  demonter();
});

/**
 * Rassemble tout le texte porte par un noeud rendu et ses enfants.
 * @param {any} node Le noeud de depart.
 * @returns {string} Le texte, replie en une seule chaine.
 */
const texteDe = (node) => {
  const morceaux = /** @type {string[]} */ ([]);
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    const enfants = enfant?.props?.children;
    if (Array.isArray(enfants)) enfants.forEach(parcourir);
    else parcourir(enfants);
  };
  parcourir(node);
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Le libelle complet pose dans la pastille de type.
 * @returns {string} Le libelle.
 */
const pastille = () => String(/** @type {any} */ (mockTagProps.value)?.text || '');

/**
 * L'objet que l'ecran passe a l'entete pour peindre l'encart du match.
 * @returns {any} Le resume, ou null.
 */
const resume = () => /** @type {any} */ (mockHeaderProps.value)?.matchScoreSummary || null;

// AVIS (09/09) - EventDetails lit desormais les avis d entrainement. Sans ce
// double, l import tire `@/services/client`, qui JETTE sans `.env` et fait
// tomber la suite ENTIERE avant le premier temoin.
jest.mock('@/services/trainingReview/trainingReviewQueries', () => ({
  useGetTrainingReviews: () => ({ data: null }),
}));

describe('N3 - la carte du match : ce que l ecran calcule', () => {
  test('N3 · temoin 1 — la pastille porte le lieu, sur isHome TRI-ETAT (D1/D2)', () => {
    monter({ event: buildMatch({ isHome: true }) });
    expect(pastille()).toBe('MATCH · À DOMICILE');

    monter({ event: buildMatch({ isHome: false }) });
    expect(pastille()).toBe('MATCH · À L\'EXTÉRIEUR');

    // ⛔ `null` N'EST PAS `false`. Un match saisi a la main ne sait pas ou il se
    // joue : la pastille se tait plutot que de mentir. C'est tout l'interet du
    // tri-etat — `Boolean(isHome)` afficherait « À l'extérieur » a tort.
    monter({ event: buildMatch({ isHome: null }) });
    expect(pastille()).toBe('MATCH');
  });

  test('N3 · temoin 2 — sans isHome, le repli lit l\'ancien parc (D2)', () => {
    // Les matchs synchronises d'avant AE03 ne portent pas `isHome` : leur lieu
    // n'existe que dans la description, que `resolveExternalMatchDisplay` sait
    // deja lire. Tant que le serveur AE03 n'est pas deploye, c'est le SEUL
    // chemin qui affichera quoi que ce soit en recette.
    monter({
      event: buildMatch({
        description: 'Match vs FC Bonneveine - Domicile',
        isHome: null,
      }),
    });
    expect(pastille()).toBe('MATCH · À DOMICILE');

    monter({
      event: buildMatch({
        description: 'Match vs FC Bonneveine - Exterieur',
        isHome: null,
      }),
    });
    expect(pastille()).toBe('MATCH · À L\'EXTÉRIEUR');
  });

  test('N3 · temoin 3 — l\'equipe INVITEE voit la pastille retournee (D3)', () => {
    const match = buildMatch({
      invitedTeams: [{
        documentId: TEAM_INVITEE_ID,
        name: ADVERSAIRE,
        trainers: [{ documentId: COACH_INVITEE }],
      }],
      isHome: true,
    });

    monter({ auth: ORGANISATEUR(), event: match });
    expect(pastille()).toBe('MATCH · À DOMICILE');

    // Meme evenement, meme `isHome`, autre lecteur : le match qui est « a
    // domicile » pour l'organisateur est « a l'exterieur » pour son adversaire.
    // Le score se retourne deja ainsi (`shouldInvertStoredScore`) ; la pastille
    // ne peut pas dire le contraire du score juste au-dessus.
    monter({ auth: COACH_DE_L_INVITEE(), event: match });
    expect(pastille()).toBe('MATCH · À L\'EXTÉRIEUR');
  });

  test('N3 · temoin 4 — un match FINI dit « TERMINÉ » et se tait sur le lieu (D8)', () => {
    const matchPasse = buildMatch({
      date: '2026-01-01T10:00:00.000Z',
      endDate: '2026-01-01T12:00:00.000Z',
      isHome: true,
    });

    monter({
      attendance: HORLOGE_SERVEUR('2026-01-02T10:00:00.000Z'),
      event: matchPasse,
    });
    expect(pastille()).toBe('MATCH · TERMINÉ');

    // Sans horloge serveur, le match n'est PAS declare fini (AC10) : la
    // pastille retombe sur le lieu.
    monter({ event: matchPasse });
    expect(pastille()).toBe('MATCH · À DOMICILE');
  });

  test('N3 · temoin 5 — l\'encart existe AVANT le match (D5)', () => {
    monter({ event: buildMatch() });

    const resultat = resume();
    expect(resultat).not.toBeNull();
    // L'ecran rend la DONNEE ; le libelle « Test FC — FC Bonneveine » se
    // compose dans l'entete, ou `clubName` est deja resolu. La chaine rendue
    // est temoignee la-bas (EventHeaderN3CarteMatch, temoin 2).
    expect(resultat.opponentName).toBe(ADVERSAIRE);
    // 🆚 ST-MATCH (02/10) — ADAPTE : « Score en attente » devient « VS » et l'heure du coup
    // d'envoi au centre du face-à-face (design valide, ecran 1, etat 1). La regle de
    // FINITIONS7 (tournee 8) tient : « Score en attente » ne se dit jamais avant le match.
    expect(resultat.value).toBe('VS');
    expect(resultat.centerLabel).toBe('10:00');
    expect(resultat.verdict).toBeNull();
  });

  test('N3 · temoin 6 — le verdict suit le score, oriente comme lui (D6)', () => {
    const gagne = buildMatch({
      matchResult: {
        isFinal: true, scoreAgainst: 1, scoreFor: 3, source: 'manual',
      },
    });

    monter({ auth: ORGANISATEUR(), event: gagne });
    expect(resume().verdict).toBe('win');
    expect(resume().value).toBe('3 - 1');

    // Le meme 3-1 lu depuis l'autre camp est une DEFAITE : le score est stocke
    // du point de vue de l'equipe ORGANISATRICE, et l'ecran le retourne deja.
    // Un verdict qui ne se retournerait pas dirait « Victoire » au perdant.
    const avecInvitee = {
      ...gagne,
      invitedTeams: [{
        documentId: TEAM_INVITEE_ID,
        name: ADVERSAIRE,
        trainers: [{ documentId: COACH_INVITEE }],
      }],
    };
    monter({ auth: COACH_DE_L_INVITEE(), event: avecInvitee });
    expect(resume().verdict).toBe('loss');
    expect(resume().value).toBe('1 - 3');

    const nul = buildMatch({
      matchResult: {
        isFinal: true, scoreAgainst: 2, scoreFor: 2, source: 'manual',
      },
    });
    monter({ auth: ORGANISATEUR(), event: nul });
    expect(resume().verdict).toBe('draw');
  });

  test('N3 · temoin 7 — « Nommer l\'adversaire » envoie un PUT { opponentName } (D9)', async () => {
    const racine = monter({
      auth: ORGANISATEUR(),
      event: buildMatch({ name: 'Match', opponentName: null }),
    });

    // L'encart demande a l'organisateur de nommer l'adversaire, et c'est lui
    // qui ouvre la feuille.
    const resultat = resume();
    expect(resultat.awaitingOpponent).toBe(true);
    expect(typeof resultat.onNameOpponent).toBe('function');

    act(() => {
      resultat.onNameOpponent();
    });

    const champ = racine.findAllByType(TextInput)
      .find((/** @type {any} */ n) => n.props.placeholder === 'Nom de l\'équipe adverse');
    expect(champ).toBeDefined();

    act(() => {
      champ.props.onChangeText('US Marseille');
    });

    // ⛔ PAS de JSON.stringify sur des enfants React : l'arbre rendu porte un
    // `_owner` qui boucle sur lui-meme (« Converting circular structure »).
    // On descend par `props.children`, comme le fait `EventDetailsN1PetitsBlocs`.
    // 🚤 EGALITE STRICTE, ET C'EST N4 QUI L'IMPOSE : la carte-parcours de
    // l'apres-match porte desormais un bouton « Enregistrer le score ». Un
    // `includes('Enregistrer')` attrapait le PREMIER venu — celui de la carte —
    // et ce temoin verifiait alors un geste qu'il n'avait pas declenche.
    const valider = racine
      .findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'button')
      .find((/** @type {any} */ n) => texteDe(n).trim() === 'Enregistrer');
    expect(valider).toBeDefined();

    await act(async () => {
      await valider.props.onPress();
    });

    expect(mockUpdateNoNav).toHaveBeenCalledWith({
      documentId: 'event-1',
      eventData: { opponentName: 'US Marseille' },
    });
  });

  // ⌨️ CLAV-ADVERSAIRE (23/10) — sur iPhone, le clavier RECOUVRAIT le champ (capture d'Adel,
  // TestFlight 2.6.79). Le champ demandait le clavier AU MONTAGE (`autoFocus`), pendant que la
  // feuille montait : `@gorhom/bottom-sheet` 5.2.4 relance alors son animation vers le cran,
  // sans le clavier (regle lue dans son code : BottomModalCLAVADV.clavier.test.js). Le clavier
  // se demande donc quand la feuille est ARRIVEE (`onOpened`) — elle remonte alors au-dessus.
  test('N3 · temoin 7 bis — le clavier attend que la feuille de l\'adversaire soit arrivee', () => {
    const racine = monter({
      auth: ORGANISATEUR(),
      event: buildMatch({ name: 'Match', opponentName: null }),
    });
    act(() => {
      resume().onNameOpponent();
    });

    const champ = racine.findAllByType(TextInput)
      .find((/** @type {any} */ n) => n.props.placeholder === 'Nom de l\'équipe adverse');
    expect(champ).toBeDefined();
    // Pas de clavier au montage : il tomberait pendant l'animation d'ouverture.
    expect(champ.props.autoFocus).toBeFalsy();

    const feuille = racine
      .findAll((/** @type {any} */ n) => n.type?.name === 'BottomModalDouble' && n.props.isVisible)
      .find((/** @type {any} */ n) => n.findAllByType(TextInput).includes(champ));
    expect(typeof feuille?.props.onOpened).toBe('function');

    const focus = jest.spyOn(champ.instance, 'focus');
    act(() => {
      feuille.props.onOpened();
    });
    expect(focus).toHaveBeenCalledTimes(1);
  });

  test('N3 · temoin 8 — le lecteur qui n\'organise pas n\'a AUCUN bouton (D10)', () => {
    monter({
      auth: SPECTATEUR(),
      event: buildMatch({ name: 'Match', opponentName: null }),
    });

    const resultat = resume();
    expect(resultat.awaitingOpponent).toBe(true);
    // ⛔ Pas de rappel = pas de bouton dans l'entete. C'est la presence meme du
    // rappel qui porte le droit, plutot qu'un drapeau que l'entete pourrait
    // oublier de lire.
    expect(resultat.onNameOpponent).toBeNull();

    // Et l'organisateur qui a DEJA un adversaire n'a pas ce bouton non plus :
    // le raccourci sert a NOMMER ce qui manque. Renommer un adversaire connu
    // reste dans EventEdit, ou vit le champ complet (hors lot).
    monter({ auth: ORGANISATEUR(), event: buildMatch() });
    expect(resume().awaitingOpponent).toBe(false);
    expect(resume().onNameOpponent).toBeNull();
  });

  test('N3 · temoin 9 — rien de tout cela pour un evenement qui n\'est pas un match', () => {
    monter({ event: buildMatch({ type: { name: 'Entrainement' } }) });
    expect(pastille()).toBe('ENTRAINEMENT');
    expect(resume()).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* R2 — INVITER UNE EQUIPE DE SON PROPRE CLUB                          */
/* ------------------------------------------------------------------ */
//
// 🧨 Retour de recette de la 2.6.26 : inviter une equipe de SON PROPRE club sur
// un evenement le faisait basculer en match CONTRE elle — l evenement PRENAIT
// SON NOM, la pastille domicile/exterieur se retournait pour ses joueurs, et le
// score s inversait avec elle. La cause : la regle « toute equipe invitee
// differente de l organisatrice EST l adversaire » ne regardait que les
// EQUIPES, jamais leur CLUB.
//
// ⚖️ LA REGLE EXIGE LES DEUX CLUBS CONNUS ET EGAUX. Quand l un des deux manque
// — c est le cas des temoins N3 ci-dessus, dont les equipes invitees n ont pas
// de club — le comportement d avant reste : on ne devine pas.

/** Une equipe invitee du MEME club que l organisateur (le cas du bug R2). */
const EQUIPE_DU_MEME_CLUB = {
  club: { documentId: CLUB_ID },
  documentId: TEAM_INVITEE_ID,
  name: 'U15 B',
  trainers: [{ documentId: COACH_INVITEE }],
};

/** Une equipe invitee d un AUTRE club : le vrai adversaire, inchange. */
const EQUIPE_D_UN_AUTRE_CLUB = {
  club: { documentId: 'club-2' },
  documentId: TEAM_INVITEE_ID,
  name: ADVERSAIRE,
  trainers: [{ documentId: COACH_INVITEE }],
};

describe('R2 - une equipe de mon propre club n est pas un adversaire', () => {
  test('R2 · temoin 1 — l evenement ne prend PAS le nom de l equipe invitee (D2)', () => {
    monter({
      auth: ORGANISATEUR(),
      event: buildMatch({
        invitedTeams: [EQUIPE_DU_MEME_CLUB],
        name: 'Match - 01/01/2099 - U15 A',
        opponentName: null,
      }),
    });

    // Aucun adversaire : l encart le dit, et l ecran continue de proposer d en
    // nommer un. Avant R2, `opponentName` valait « U15 B » — notre propre equipe.
    expect(resume().opponentName).toBe('');
    expect(resume().awaitingOpponent).toBe(true);
  });

  test('R2 · temoin 2 — la pastille ne se retourne PAS pour l equipe du club (D3)', () => {
    const matchInterne = buildMatch({
      invitedTeams: [EQUIPE_DU_MEME_CLUB],
      isHome: true,
      opponentName: null,
    });

    monter({ auth: ORGANISATEUR(), event: matchInterne });
    expect(pastille()).toBe('MATCH · À DOMICILE');

    // Meme evenement, lu par le coach de l autre equipe DU MEME CLUB : les deux
    // equipes recoivent chez elles. Avant R2, il lisait « À L'EXTÉRIEUR ».
    monter({ auth: COACH_DE_L_INVITEE(), event: matchInterne });
    expect(pastille()).toBe('MATCH · À DOMICILE');
  });

  test('R2 · temoin 3 — le score NE s inverse PAS pour l equipe invitee du meme club (D3)', () => {
    const matchInterne = buildMatch({
      invitedTeams: [EQUIPE_DU_MEME_CLUB],
      matchResult: {
        isFinal: true, scoreAgainst: 1, scoreFor: 3, source: 'manual',
      },
      opponentName: null,
    });

    monter({ auth: ORGANISATEUR(), event: matchInterne });
    expect(resume().value).toBe('3 - 1');
    expect(resume().verdict).toBe('win');

    // Avant R2, le coach de l autre equipe du club lisait « 1 - 3 » et une
    // DEFAITE — pour un match que son propre club avait gagne.
    monter({ auth: COACH_DE_L_INVITEE(), event: matchInterne });
    expect(resume().value).toBe('3 - 1');
    expect(resume().verdict).toBe('win');
  });

  test('R2 · temoin 4 — un match contre un AUTRE club reste strictement inchange', () => {
    const vraiMatch = buildMatch({
      invitedTeams: [EQUIPE_D_UN_AUTRE_CLUB],
      isHome: true,
      matchResult: {
        isFinal: true, scoreAgainst: 1, scoreFor: 3, source: 'manual',
      },
      opponentName: null,
    });

    // AJUSTÉ PAR FINITIONS15 point 9e — motif : sans horloge du serveur, un score connu dit
    // désormais la fin (le parent, T14). L'organisateur et l'entraîneur invité, eux, lisent l'appel :
    // ils ONT l'horloge, et elle dit que ce match de 2099 n'est pas fini. Le témoin garde ainsi ce
    // qu'il prouve (le lieu, retourné ou non).
    const AVANT_LA_FIN = HORLOGE_SERVEUR('2026-01-01T10:00:00.000Z');
    monter({ attendance: AVANT_LA_FIN, auth: ORGANISATEUR(), event: vraiMatch });
    expect(pastille()).toBe('MATCH · À DOMICILE');
    expect(resume().opponentName).toBe(ADVERSAIRE);
    expect(resume().verdict).toBe('win');

    // L adversaire, lui, voit toujours le match retourne : c est le comportement
    // de N3, et R2 ne doit pas y toucher.
    monter({ attendance: AVANT_LA_FIN, auth: COACH_DE_L_INVITEE(), event: vraiMatch });
    expect(pastille()).toBe('MATCH · À L\'EXTÉRIEUR');
    expect(resume().value).toBe('1 - 3');
    expect(resume().verdict).toBe('loss');
  });

  test('R2 · temoin 5 — sans club connu, rien ne change (ancien parc)', () => {
    // Une equipe invitee sans club : impossible de savoir si elle est du club.
    // On garde le comportement d aujourd hui plutot que de deviner.
    const ancienParc = buildMatch({
      invitedTeams: [{
        documentId: TEAM_INVITEE_ID,
        name: ADVERSAIRE,
        trainers: [{ documentId: COACH_INVITEE }],
      }],
      isHome: true,
      opponentName: null,
    });

    monter({ auth: COACH_DE_L_INVITEE(), event: ancienParc });
    expect(pastille()).toBe('MATCH · À L\'EXTÉRIEUR');
  });
});

// ==========================================================================
// 🆚 ST-MATCH (02/10, design des statistiques validé) — L'ENCART DU SCORE,
// BRANCHÉ SUR L'ÉCRAN : ce que la page passe à l'entête, pour chaque lecteur.
// La règle de lecture elle-même est témoignée dans STMATCHEncartLignes.test.js ;
// ici on prouve que l'écran lui donne les BONNES données (rôle, auteur, horloge).
// ==========================================================================
describe('ST-MATCH - l encart du score, branché sur l écran', () => {
  const JOUEUR = 'joueur-hugo';
  const SAISI_LE = '2026-01-01T21:35:00.000Z';
  const KARIM = { documentId: COACH, firstname: 'Karim' };
  const FINI = HORLOGE_SERVEUR('2026-01-02T10:00:00.000Z');
  const matchFini = (/** @type {any} */ overrides = {}) => buildMatch({
    date: '2026-01-01T10:00:00.000Z',
    endDate: '2026-01-01T12:00:00.000Z',
    team: {
      club: { documentId: CLUB_ID, name: CLUB_NAME },
      documentId: TEAM_ID,
      name: 'U15 A',
      players: [{ documentId: JOUEUR }],
      trainers: [KARIM],
    },
    ...overrides,
  });
  const avecScore = (/** @type {any} */ overrides = {}) => matchFini({
    matchResult: {
      isFinal: true,
      savedAt: SAISI_LE,
      savedBy: KARIM,
      scoreAgainst: 1,
      scoreFor: 2,
      source: 'manual',
      teamDocumentId: TEAM_ID,
    },
    ...overrides,
  });
  const auteurAttendu = () => {
    const at = new Date(SAISI_LE);
    const date = at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const heure = at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `Saisi par Karim le ${date} à ${heure}`;
  };

  test('ST-MATCH écran 1 · état 3 — le JOUEUR lit « Karim n a pas encore saisi le score. »', () => {
    monter({ attendance: FINI, auth: authPour(JOUEUR, false), event: matchFini() });

    expect(resume().value).toBe('– –');
    expect(resume().centerLabel).toBe('Score en attente');
    expect(resume().statusLine).toEqual({ text: 'Karim n\'a pas encore saisi le score.', tone: 'neutral' });
    expect(resume().onEnterScore).toBeNull();
    expect(pastille()).toBe('MATCH · TERMINÉ');
  });

  test('ST-MATCH écran 1 · état 2 — l ENTRAÎNEUR a « Saisir le score » dans l encart, et l ouvre', () => {
    monter({
      attendance: FINI,
      auth: ORGANISATEUR(),
      event: matchFini(),
      matchStats: {
        permissions: { canManage: true, canView: true },
        report: null,
        score: {
          available: false, locked: false, scoreAgainst: null, scoreFor: null, waitingOfficial: false,
        },
        sport: 'football',
      },
    });

    expect(typeof resume().onEnterScore).toBe('function');
    expect(resume().statusLine).toBeNull();
  });

  test('ST-MATCH écran 1 · état 4 — score saisi : « 2 - 1 », « Score saisi », qui et quand ; la pastille dit VICTOIRE', () => {
    monter({ attendance: FINI, auth: authPour(JOUEUR, false), event: avecScore() });

    expect(resume().value).toBe('2 - 1');
    expect(resume().centerLabel).toBe('Score saisi');
    expect(resume().authorLine).toBe(auteurAttendu());
    expect(pastille()).toBe('MATCH · TERMINÉ · VICTOIRE');
  });

  test('ST-MATCH écran 1 · 🔒 état 7 — le VISITEUR voit le score et le résultat, jamais qui l a saisi', () => {
    monter({ attendance: FINI, auth: SPECTATEUR(), event: avecScore() });

    expect(resume().value).toBe('2 - 1');
    expect(pastille()).toBe('MATCH · TERMINÉ · VICTOIRE');
    expect(resume().authorLine).toBeNull();
    expect(resume().scorersLine).toBeNull();
    expect(resume().statusLine).toBeNull();
    expect(resume().onSeeStats).toBeNull();
  });

  test('ST-MATCH écran 1 · état 5 — feuille publiée : les buteurs ; « Voir les stats du match » existe', () => {
    monter({
      attendance: FINI,
      auth: authPour(JOUEUR, false),
      event: avecScore(),
      matchStats: {
        permissions: { canManage: false, canView: true },
        report: {
          playerLines: [{ sportPayload: { goals: 1 }, user: { firstname: 'Hugo', lastname: 'Lemaire' } }],
          status: 'final',
        },
        score: {
          available: true, recordedAt: SAISI_LE, recordedBy: KARIM, scoreAgainst: 0, scoreFor: 1, source: 'manual',
        },
        sport: 'football',
      },
    });

    // (« 1 but sans buteur » : témoigné dans STMATCHEncartLignes, la doublure de t() d'ici
    // ne sait pas les pluriels de i18next.)
    expect(resume().value).toBe('1 - 0');
    expect(resume().scorersLine).toBe('Hugo L.');
    expect(resume().authorLine).toBe(auteurAttendu());
    expect(typeof resume().onSeeStats).toBe('function');
  });
});

// DECISIONS-SOIR (02/10, « parents encart B », registre des mineurs ligne 15) — LE PARENT D'UN
// JOUEUR LIT L'ENCART DU SCORE COMME UN MEMBRE : buteurs et auteur compris. Le SERVEUR dit, sur la
// fiche d'un match, où joue son enfant (`viewerParentTeamDocumentIds`, sa règle du parent) et
// rejuge la lecture (`permissions.actorRole: 'parent'`) : l'app ne décide rien seule.
describe('DECISIONS-SOIR — le parent lit l encart du score comme un membre', () => {
  const SAISI_LE = '2026-01-01T21:35:00.000Z';
  const KARIM = { documentId: COACH, firstname: 'Karim' };
  const FINI = HORLOGE_SERVEUR('2026-01-02T10:00:00.000Z');
  const PARENT = () => authPour('parent-de-hugo', false);
  const match = (/** @type {any} */ overrides = {}) => buildMatch({
    date: '2026-01-01T10:00:00.000Z',
    endDate: '2026-01-01T12:00:00.000Z',
    matchResult: {
      isFinal: true, savedAt: SAISI_LE, savedBy: KARIM, scoreAgainst: 0, scoreFor: 1, source: 'manual', teamDocumentId: TEAM_ID,
    },
    team: {
      club: { documentId: CLUB_ID, name: CLUB_NAME },
      documentId: TEAM_ID,
      name: 'U15 A',
      players: [{ documentId: 'joueur-hugo' }],
      trainers: [KARIM],
    },
    ...overrides,
  });
  // Ce que GET /events/:id/match-stats rend au parent (admin DECISIONS-SOIR 2/2) : l'encart, rien d'autre.
  const ENCART_DU_PARENT = {
    availablePlayers: [],
    permissions: {
      actorRole: 'parent', canManage: false, canRespond: false, canView: false,
    },
    playerResponses: [],
    report: {
      playerLines: [{ sportPayload: { goals: 1 }, user: { firstname: 'Hugo', lastname: 'L' } }],
      status: 'final',
    },
    score: {
      available: true, recordedAt: SAISI_LE, recordedBy: KARIM, scoreAgainst: 0, scoreFor: 1, source: 'manual',
    },
    sport: 'football',
  };
  const auteurAttendu = () => {
    const at = new Date(SAISI_LE);
    const date = at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const heure = at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `Saisi par Karim le ${date} à ${heure}`;
  };
  const dernierAppel = () => mockMatchStats.appels[mockMatchStats.appels.length - 1] || [];
  // Les lectures secondaires (dont la feuille) partent après les interactions
  // (`InteractionManager.runAfterInteractions`) : on les laisse partir.
  const apresLesInteractions = async () => {
    await act(async () => { await new Promise((fin) => { setTimeout(fin, 0); }); });
  };

  test('le parent d un joueur : l ecran DEMANDE l encart pour l equipe de son enfant, et le lit en membre', async () => {
    monter({
      attendance: FINI, auth: PARENT(), event: match({ viewerParentTeamDocumentIds: [TEAM_ID] }), matchStats: ENCART_DU_PARENT,
    });
    await apresLesInteractions();

    const [eventId, teamId, options] = dernierAppel();
    expect([eventId, teamId, options?.enabled]).toEqual(['event-1', TEAM_ID, true]);
    expect(resume().value).toBe('1 - 0');
    expect(resume().authorLine).toBe(auteurAttendu());
    expect(resume().scorersLine).toBe('Hugo L.');
    // Rien d'autre : les stats du match restent aux membres de l'équipe.
    expect(resume().onSeeStats).toBeNull();
  });

  // 🎨 FINITIONS15 point 9e (tournée T14, S03f) — le parent lisait « MATCH » seul sur le match
  // terminé (Karim : « MATCH · TERMINÉ · VICTOIRE », planche Statistiques P1 états 4, 5 et 7 :
  // tout lecteur). La fin du match se décide à l'horloge du SERVEUR, que donne l'appel ; le parent
  // n'a pas accès à l'appel (`canAccessAttendance`) : jamais d'horloge, jamais « terminé ». Un
  // score connu prouve la fin (le serveur refuse de l'enregistrer avant, `ensureEventIsFinished`).
  // Ici, comme en vrai : AUCUNE horloge du serveur. ROUGE avant le lot.
  test('🔴 FIN15 9e — sans horloge du serveur, le score connu dit « MATCH · TERMINÉ · VICTOIRE »', async () => {
    monter({
      attendance: null, auth: PARENT(), event: match({ viewerParentTeamDocumentIds: [TEAM_ID] }), matchStats: ENCART_DU_PARENT,
    });
    await apresLesInteractions();

    expect(resume().value).toBe('1 - 0');
    expect(pastille()).toBe('MATCH · TERMINÉ · VICTOIRE');
  });

  test('son enfant joue dans l equipe INVITEE : l encart est demande pour CETTE equipe', async () => {
    monter({
      attendance: FINI,
      auth: PARENT(),
      event: match({
        invitedTeams: [{
          documentId: TEAM_INVITEE_ID, name: 'FC Voisin', players: [], trainers: [],
        }],
        viewerParentTeamDocumentIds: [TEAM_INVITEE_ID],
      }),
      matchStats: ENCART_DU_PARENT,
    });
    await apresLesInteractions();

    const [, teamId, options] = dernierAppel();
    expect([teamId, options?.enabled]).toEqual([TEAM_INVITEE_ID, true]);
  });

  test('🔒 un visiteur : rien n est demande, l encart reste celui d un visiteur', async () => {
    monter({ attendance: FINI, auth: SPECTATEUR(), event: match() });
    await apresLesInteractions();

    expect(dernierAppel()[2]?.enabled).toBe(false);
    expect(resume().authorLine).toBeNull();
    expect(resume().scorersLine).toBeNull();
  });

  test('🔒 le serveur n a pas reconnu le parent (pas de lecture « parent ») : l app ne decide rien seule', () => {
    monter({
      attendance: FINI, auth: PARENT(), event: match({ viewerParentTeamDocumentIds: [TEAM_ID] }), matchStats: null,
    });

    expect(resume().authorLine).toBeNull();
    expect(resume().scorersLine).toBeNull();
  });
});

// FINITIONS7 · POINT 7 (tournee 8) — « Score en attente » sur un match du 10/10 A VENIR. Il ne
// se dit qu apres le match : la fin se lit sur la MEME horloge serveur que la pastille « TERMINÉ »
// (`isMatchFinished`, AC10 — sans horloge serveur, le match n est jamais declare fini).
describe('FINITIONS7 · point 7 — « Score en attente » seulement apres le match', () => {
  // 🆚 ST-MATCH (écran 1) — ADAPTÉ : le design dit « VS » et l'heure du coup d'envoi ; la
  // règle tient (« Score en attente » n'apparaît pas avant le match).
  test('🚨 un match a venir, sans score : « VS » et l heure, jamais « Score en attente »', () => {
    monter({ attendance: HORLOGE_SERVEUR('2098-12-31T10:00:00.000Z'), event: buildMatch() });

    expect(resume().value).toBe('VS');
    expect(resume().centerLabel).not.toBe('Score en attente');
  });

  test('un match FINI, sans score : « Score en attente » — l entraineur doit le saisir', () => {
    const matchPasse = buildMatch({
      date: '2026-01-01T10:00:00.000Z',
      endDate: '2026-01-01T12:00:00.000Z',
    });
    monter({ attendance: HORLOGE_SERVEUR('2026-01-02T10:00:00.000Z'), event: matchPasse });

    // 🆚 ST-MATCH (écran 1) — ADAPTÉ : « – – » au centre, « Score en attente » dessous.
    expect(resume().value).toBe('– –');
    expect(resume().centerLabel).toBe('Score en attente');
  });

  test('un match avec son score garde son score, fini ou non', () => {
    monter({
      event: buildMatch({
        matchResult: {
          isFinal: true, scoreAgainst: 1, scoreFor: 3, source: 'manual',
        },
      }),
    });

    expect(resume().value).toBe('3 - 1');
  });
});
