import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// Lot N1 — LES QUATRE PETITS BLOCS QUI SE TAISENT OU QUI TROMPENT.
//
// Constat du pack « detail evenement » (regle 5 : aucun bloc muet, aucun bouton
// muet). Quatre endroits de cette page ne disent pas ce qu'ils savent :
//
//   (a) une DETECTION sans poste n'affiche RIEN — l'organisateur ne sait pas si
//       c'est normal. Le branchement se temoigne ici ; l'etat vide lui-meme vit
//       dans le composant et se temoigne dans `EventDetectionSlotsN1.test.js`.
//   (b) « Accueille N joueurs de l'exterieur » n'existe que pour l'ORGANISATEUR.
//       Le joueur qui regarde un entrainement ouvert ne voit pas qu'il est
//       ouvert — c'est pourtant l'information qui le concerne.
//   (c) un evenement « Autre » a une capacite en base (`event.capacity`) que la
//       pastille de type n'affiche jamais.
//   (d) deux boutons desactives portent deja leur motif DANS leur titre. Rien a
//       corriger : on FIGE cette garantie avant que quelqu'un ne l'efface.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Il
// lit ce qui est MONTE et ce qui ne l'est pas. Le rendu reel se voit a la
// recette.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };

// Le `t` du mock rend le REPLI, INTERPOLE : c'est exactement ce que
// l'utilisateur voit tant que la clef n'existe pas dans fr.js. Sans
// l'interpolation, « Accueille {{count}} joueur·se·s » resterait litteral et le
// temoin de la ligne publique ne mesurerait aucun chiffre.
// Il note au passage les clefs demandees — sans ce releve, une clef mal
// orthographiee resterait invisible pour toujours.
// 🧨 R9 — CE MOCK N EST PAS DECORATIF. `teamMembershipRequestService`
// importe `@/services/client`, qui JETTE AU CHARGEMENT quand `.env` est absent
// — et `.env` est gitignore, donc absent de toute copie de travail. Sans cette
// doublure, la SUITE ENTIERE tombe a 0 test execute des que l ecran importe le
// service (piege documente, deja paye plusieurs fois).
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
  useGetEventAttendance: () => emptyQuery(),
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

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
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
      updateEventNoNavMutation: idleMutation(),
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

// 🪢 LA DOUBLURE BRANCHEE DES POSTES DE DETECTION — motif d'`AD10ExportFeuille
// Branchee`. Elle ne rend pas son nom : elle rend CE QUE L'ECRAN LUI DONNE.
// C'est le seul moyen de temoigner, depuis l'ecran, que le bloc est monte pour
// une detection SANS poste et qu'il recoit bien le drapeau `isDetection`.
jest.mock('../components/EventDetectionSlots', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventDetectionSlotsDouble(/** @type {any} */ props) {
    const drapeau = String(Boolean(props.isDetection));
    const nombre = String((props.slots || []).length);
    return react.createElement(
      rn.View,
      { testID: 'doublure-postes-detection' },
      react.createElement(rn.Text, null, `isDetection=${drapeau} postes=${nombre}`),
    );
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
  '../components/EventHeader',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventHeader'),
);
jest.mock(
  '../components/EventParticipants',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventParticipants'),
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
import { askedKeys } from 'react-i18next';

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const COACH = 'coach-1';
const JOUEUR = 'joueur-1';

// Trois personnes qui ne sont PAS de l'equipe : c'est ce qui en fait des
// « participants externes » au sens de l'ecran (l. 1878).
const EXT_UN = 'externe-1';
const EXT_DEUX = 'externe-2';
const EXT_TROIS = 'externe-3';

const buildEvent = (/** @type {any} */ overrides = {}) => ({
  capacity: 0,
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  description: 'Rendez-vous au stade a 9 h.',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Seance du samedi',
  participations: [],
  startTime: '10:00',
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [{ documentId: JOUEUR }],
    trainers: [{ documentId: COACH }],
  },
  type: { name: 'Entrainement' },
  ...overrides,
});

/**
 * Un entrainement ouvert, avec 2 places prises et 1 demande en attente.
 * @param {any} overrides - Ce qui change d'un cas a l'autre.
 * @returns {any} L'evenement.
 */
const entrainementOuvert = (overrides = {}) => buildEvent({
  externalParticipantLimit: 8,
  externalParticipantValidationMode: 'manual',
  participationRequests: [{
    documentId: 'req-1',
    isActive: true,
    participationStatus: 'pending',
    user: { documentId: EXT_TROIS, firstname: 'Sam' },
  }],
  participations: [
    { documentId: EXT_UN, firstname: 'Ana' },
    { documentId: EXT_DEUX, firstname: 'Bilal' },
  ],
  sessionStatus: 'open',
  type: { name: 'Entrainement' },
  ...overrides,
});

const authPour = (
  /** @type {string} */ documentId,
  /** @type {boolean} */ peutGerer = false,
) => ({
  canEditClub: () => peutGerer,
  canEditEvent: () => peutGerer,
  canManageEvent: () => peutGerer,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: {
    documentId,
    role: { name: peutGerer ? 'Dirigeant' : 'Joueur' },
  },
});

const ORGANISATEUR = () => authPour(COACH, true);
const SPECTATEUR = () => authPour('visiteur-1', false);

/** @type {any} */
let monte = null;

const demonter = () => {
  if (!monte) return;
  act(() => {
    monte.unmount();
  });
  monte = null;
};

const monter = (/** @type {any} */ { auth, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildEvent() : event;
  mockUseAuth.mockReturnValue(auth || ORGANISATEUR());

  demonter();
  askedKeys.length = 0;
  mockSetOptions.mockClear();

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

const texteDe = (/** @type {any} */ node) => {
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

const textesVisibles = (/** @type {any} */ racine) => racine
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => texteDe(noeud))
  .filter(Boolean);

const contient = (
  /** @type {any} */ racine,
  /** @type {string} */ extrait,
) => textesVisibles(racine).join(' | ').includes(extrait);

// ⋯ N7 item 4 (vague P, 23/08) — la bascule « Ouvrir / Fermer l'entraînement »
// vit desormais dans la feuille du menu ⋯, qui s'ouvre depuis l'EN-TETE de
// navigation. On va la chercher la ou elle est (motif L4MenuTroisPoints).
const chercherDansElements = (
  /** @type {any} */ element,
  /** @type {(n: any) => boolean} */ predicat,
) => {
  if (!element || typeof element !== 'object') return null;
  if (Array.isArray(element)) {
    return element.reduce(
      (/** @type {any} */ trouve, /** @type {any} */ enfant) => (
        trouve || chercherDansElements(enfant, predicat)
      ),
      null,
    );
  }
  if (element.props && predicat(element)) return element;
  return chercherDansElements(element.props?.children, predicat);
};

const ouvrirLeMenu = () => {
  const appels = mockSetOptions.mock.calls.filter(
    (/** @type {any} */ appel) => appel[0]?.headerRight,
  );
  const entete = appels.length ? appels[appels.length - 1][0].headerRight() : null;
  const bouton = chercherDansElements(
    entete,
    (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-actions-menu-button',
  );
  if (!bouton) throw new Error('Aucun bouton trois-points dans l en-tete de navigation');
  act(() => {
    bouton.props.onPress();
  });
};

const parTestID = (
  /** @type {any} */ racine,
  /** @type {string} */ id,
) => racine.findAll((/** @type {any} */ noeud) => noeud.props?.testID === id, { deep: false });

describe('N1 · (a) — le branchement du bloc des postes de detection', () => {
  const detectionSansPoste = () => buildEvent({ recruitmentAds: [], type: { name: 'Détection' } });

  test('un ENTRAINEMENT ne monte JAMAIS le bloc des postes', () => {
    // 🔒 Caracterisation : la portee du bloc ne s'elargit pas. Un entrainement
    // n'a pas de poste, il ne doit pas gagner un cadre vide.
    const racine = monter({ event: buildEvent({ type: { name: 'Entrainement' } }) });

    expect(parTestID(racine, 'doublure-postes-detection')).toHaveLength(0);
  });

  test('une DETECTION avec des postes monte le bloc, comme avant', () => {
    const racine = monter({
      event: buildEvent({
        recruitmentAds: [
          { documentId: 'ad-1', position: 'Gardien', quantity: 1 },
          { documentId: 'ad-2', position: 'Ailier', quantity: 2 },
        ],
        type: { name: 'Détection' },
      }),
    });

    expect(parTestID(racine, 'doublure-postes-detection')).toHaveLength(1);
    expect(contient(racine, 'postes=2')).toBe(true);
  });

  test('une DETECTION SANS poste monte le bloc quand meme', () => {
    // 🎯 LE DEFAUT REPARE : avant N1, `detectionSlots.length > 0` empechait le
    // montage, et le composant renvoyait `null` de son cote. Double garde, page
    // muette. Desormais l'ecran monte des qu'il s'agit d'une detection, et c'est
    // le composant qui decide quoi dire.
    const racine = monter({ event: detectionSansPoste() });

    expect(parTestID(racine, 'doublure-postes-detection')).toHaveLength(1);
    expect(contient(racine, 'postes=0')).toBe(true);
  });

  test('le bloc recoit le drapeau `isDetection`, pas une deviation par le compte', () => {
    const racine = monter({ event: detectionSansPoste() });

    expect(contient(racine, 'isDetection=true')).toBe(true);
  });
});

describe('N1 · (b) — l entrainement ouvert se dit a TOUT LE MONDE', () => {
  test('caracterisation : la bascule d organisation reste reservee a l organisateur', () => {
    // 🔒 Ce que N1 ne change PAS. La bascule « Ouvrir / Fermer l'entrainement »
    // porte une ACTION : elle n'a rien a faire chez un lecteur.
    // ♻️ REECRIT PAR N7 item 4 (vague P, 23/08) : la bascule a quitte sa carte
    // de l'Apercu pour la feuille du menu ⋯. Un lecteur n'a pas de menu ; un
    // organisateur l'y trouve, et ne la voit PLUS sur la page elle-meme.
    const spectateur = monter({ auth: SPECTATEUR(), event: entrainementOuvert() });
    expect(contient(spectateur, 'Fermer l\'entraînement')).toBe(false);

    const organisateur = monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });
    expect(contient(organisateur, 'Fermer l\'entraînement')).toBe(false);
    ouvrirLeMenu();
    expect(contient(organisateur, 'Fermer l\'entraînement')).toBe(true);
  });

  test('un SPECTATEUR voit enfin la ligne publique, avec ses deux chiffres', () => {
    // 🎯 8 places offertes, 2 deja prises. Avant N1, un joueur ne voyait rien.
    const racine = monter({ auth: SPECTATEUR(), event: entrainementOuvert() });

    expect(contient(racine, 'Accueille 8 joueur·se·s de l’extérieur')).toBe(true);
    expect(contient(racine, '2 place(s) prise(s)')).toBe(true);
  });

  test('un SPECTATEUR ne voit JAMAIS les demandes a verifier (Q14)', () => {
    // 🔒 Le compte des demandes est une information d'organisation. La ligne
    // publique ne porte QUE des nombres, et pas celui-la.
    const racine = monter({ auth: SPECTATEUR(), event: entrainementOuvert() });

    expect(contient(racine, 'demande(s) à vérifier')).toBe(false);
  });

  test('un ORGANISATEUR voit la ligne, son compte de demandes, ET sa bascule dans le menu', () => {
    const racine = monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });

    expect(contient(racine, 'Accueille 8 joueur·se·s de l’extérieur')).toBe(true);
    // ♻️ P8 (vague P, 23/08) : ce compte est toujours a l'ecran, mais il a
    // change d'endroit — il a quitte le SUFFIXE de la ligne publique pour la
    // carte d'ouverture, qui l'accompagne d'un bouton vers la file. Ce que ce
    // temoin garantit ne bouge pas : l'organisateur le voit, le lecteur non
    // (temoin precedent). Le detail est fige dans `EventDetailsP8Entrainement`.
    expect(contient(racine, '1 demande(s) à vérifier')).toBe(true);
    // ♻️ N7 item 4 (vague P, 23/08) : la bascule est dans la feuille ⋯, plus
    // dans une carte de l'Apercu — la ligne publique, elle, n'a pas bouge.
    ouvrirLeMenu();
    expect(contient(racine, 'Fermer l\'entraînement')).toBe(true);
  });

  test('un entrainement FERME ne montre aucune ligne publique', () => {
    const racine = monter({
      auth: SPECTATEUR(),
      event: entrainementOuvert({ sessionStatus: 'closed' }),
    });

    expect(contient(racine, 'Accueille')).toBe(false);
  });

  test('un entrainement ouvert SANS quota ne montre aucune ligne publique', () => {
    // 🪤 « Accueille 0 joueur·se·s » serait pire que le silence.
    const racine = monter({
      auth: SPECTATEUR(),
      event: entrainementOuvert({ capacity: 0, externalParticipantLimit: 0, totalPlayers: 0 }),
    });

    expect(contient(racine, 'Accueille')).toBe(false);
  });

  test('un MATCH ne gagne pas la ligne publique', () => {
    const racine = monter({
      auth: SPECTATEUR(),
      event: entrainementOuvert({ type: { name: 'Match' } }),
    });

    expect(contient(racine, 'Accueille')).toBe(false);
  });

  test('la ligne publique demande SES clefs a fr.js', () => {
    monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });

    expect(askedKeys).toContain('eventDetails.openTraining.publicLine');
    // ♻️ P8 : cette clef est demandee par la CARTE d'ouverture depuis la vague
    // P — elle n'est pas perdue, elle a change de demandeur.
    expect(askedKeys).toContain('eventDetails.openTraining.pendingSuffix');
  });
});

describe('N1 · (c) — la pastille de type porte la capacite d un « Autre »', () => {
  test('caracterisation : un MATCH garde une pastille nue', () => {
    const racine = monter({ event: buildEvent({ capacity: 20, type: { name: 'Match' } }) });

    expect(contient(racine, 'MATCH')).toBe(true);
    expect(contient(racine, 'PLACES')).toBe(false);
  });

  test('caracterisation : un « Autre » SANS capacite garde une pastille nue', () => {
    // ⛔ Surtout pas « Illimité » : on n'invente pas une regle que personne n'a
    // ecrite. Pas de capacite ⇒ on se tait.
    const racine = monter({ event: buildEvent({ capacity: 0, type: { name: 'Autre' } }) });

    expect(contient(racine, 'AUTRE')).toBe(true);
    expect(contient(racine, 'PLACES')).toBe(false);
  });

  test('un « Autre » AVEC capacite affiche « AUTRE · 3/12 PLACES »', () => {
    // 🎯 3 personnes presentes sur 12 places. La donnee existait depuis toujours
    // (`event.capacity`, schema Strapi) : elle n'etait simplement jamais dite.
    const racine = monter({
      event: buildEvent({
        capacity: 12,
        participations: [
          { documentId: EXT_UN, firstname: 'Ana' },
          { documentId: EXT_DEUX, firstname: 'Bilal' },
          { documentId: EXT_TROIS, firstname: 'Sam' },
        ],
        type: { name: 'Autre' },
      }),
    });

    expect(contient(racine, 'AUTRE · 3/12 PLACES')).toBe(true);
  });

  test('un ENTRAINEMENT avec capacite ne gagne PAS le segment', () => {
    // 🔒 La portee reste celle de la decision : le type « Autre », et lui seul.
    const racine = monter({ event: buildEvent({ capacity: 12, type: { name: 'Entrainement' } }) });

    expect(contient(racine, 'PLACES')).toBe(false);
  });

  test('la carte d information libre d un « Autre » est sa DESCRIPTION', () => {
    // 🧾 Le README dit lui-meme « le champ que l'organisateur remplit comme il
    // veut » : c'est `description`, deja rendue. Rien a construire — on le
    // TEMOIGNE, pour que personne ne rebatisse un champ serveur qui existe.
    const racine = monter({
      event: buildEvent({ description: 'Apporter un maillot clair.', type: { name: 'Autre' } }),
    });

    expect(contient(racine, 'Apporter un maillot clair.')).toBe(true);
  });
});

describe('N1 · (d) — les deux boutons desactives disent DEJA pourquoi', () => {
  const avecStatutALaUne = (/** @type {string} */ status) => buildEvent({
    featuredRequestsSummary: { PUBLIC: { requestId: 'req-une', status } },
  });

  test('« Demande en attente » est desactive et son titre porte le motif', () => {
    // 🔒 CE TEMOIN NE CHANGE RIEN — il FIGE. Un bouton gris sans explication est
    // interdit par la regle 5 du pack ; ces deux-la sont conformes, et ce filet
    // empeche qu'une refonte les vide de leur titre en le croyant decoratif.
    const racine = monter({ auth: ORGANISATEUR(), event: avecStatutALaUne('pending') });
    const boutons = racine
      .findAllByType(Text)
      .filter((/** @type {any} */ noeud) => texteDe(noeud) === 'Demande en attente');

    expect(boutons.length).toBeGreaterThan(0);
    expect(contient(racine, 'Demande en attente')).toBe(true);
  });

  test('« Déjà à la une » est desactive et son titre porte le motif', () => {
    const racine = monter({ auth: ORGANISATEUR(), event: avecStatutALaUne('approved') });

    expect(contient(racine, 'Déjà à la une')).toBe(true);
  });

  test('les deux motifs viennent de fr.js, pas de chaines en dur', () => {
    // 🔤 « Demande en attente » existait DEJA en deux clefs : on reprend celle du
    // domaine de la mise a la une (`reservation.featuredRequest.pending`) plutot
    // que d'en creer une troisieme.
    monter({ auth: ORGANISATEUR(), event: avecStatutALaUne('pending') });
    expect(askedKeys).toContain('reservation.featuredRequest.pending');

    monter({ auth: ORGANISATEUR(), event: avecStatutALaUne('approved') });
    expect(askedKeys).toContain('eventDetails.featuredRequest.alreadyFeatured');
  });
});
