import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// Lot P8 — LA CARTE D'OUVERTURE DE L'ENTRAINEMENT DIT ENFIN CE QU'ELLE SAIT.
//
// Pack « detail evenement », fiche 2 (ENTRAINEMENT), « ce que tu dois
// dessiner » : « La carte d'ouverture, plus claire : combien de places
// externes, qui valide, et surtout combien de demandes sont en attente — avec
// un acces direct a la file. »
//
// 🧨 CE QUI MANQUAIT. Avant P8, l'Apercu portait une carte qui melangeait un
// ETAT et une ACTION, et qui ne comptait RIEN : ni les places restantes, ni les
// demandes en attente. N7 (vague P, item 4) en a sorti l'ACTION vers le menu ⋯
// et a laisse la zone libre — expressement pour cette carte-ci.
//
// 🔒 CE QUE P8 NE REFAIT PAS : la ligne publique de N1 (« Accueille N
// joueur·se·s de l'exterieur »), qui parle a TOUT LE MONDE, ne bouge pas d'un
// mot pour un lecteur. La carte est la face ORGANISATEUR, et elle seule.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Le
// rail qui fait DEFILER la page jusqu'a la file des externes ne peut donc pas
// se temoigner ici — `measureLayout` ne rend rien sans mise en page. Ce qui se
// temoigne : le bouton existe, il ne s'affiche que s'il a une cible, et il ne
// casse rien quand on le presse. Le defilement reel se voit a la recette.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };

// Le `t` du mock rend le REPLI, INTERPOLE : c'est exactement ce que
// l'utilisateur voit tant que la clef n'existe pas dans fr.js. Il note au
// passage les clefs demandees — sans ce releve, une clef mal orthographiee
// resterait invisible pour toujours. (Motif N1.)
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

// 🏆 Doublure MUETTE imposee par N7 item 5 (vague P) : `useGetTournamentDashboard`
// tire `@/services/client`, et un import de service reel fait tomber la suite
// ENTIERE a 0 test (piege connu : `.env` absent d'une copie de travail).
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

// ⚠️ La doublure du bouton porte `accessibilityRole: 'button'` — c'est par la
// que le temoin retrouve LE bouton, et pas un cadre qui l'entoure. Le vrai
// `Button` du depot ne laisse PAS passer de `testID` (liste de props fermee,
// Button.js:30-47) : chercher par le titre est le seul chemin honnete.
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
import { askedKeys } from 'react-i18next';

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const COACH = 'coach-1';
const JOUEUR = 'joueur-1';

// Trois personnes qui ne sont PAS de l'equipe : c'est ce qui en fait des
// « participants externes » au sens de l'ecran.
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
 * Un entrainement ouvert : 8 places offertes, 2 prises, 1 demande en attente.
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

const parTestID = (
  /** @type {any} */ racine,
  /** @type {string} */ id,
) => racine.findAll((/** @type {any} */ noeud) => noeud.props?.testID === id, { deep: false });

// La carte entiere, telle qu'un organisateur la lit — un seul texte, pour que
// les temoins parlent de CE cadre, et pas de toute la page.
const texteDeLaCarte = (/** @type {any} */ racine) => {
  const cartes = parTestID(racine, 'p8-carte-ouverture-entrainement');
  return cartes.length ? texteDe(cartes[0]) : '';
};

// La ligne publique de N1, isolee : c'est la SEULE facon de prouver qu'elle ne
// porte plus le compte des demandes, sans la confondre avec la carte qui, elle,
// le porte desormais.
const lignePublique = (/** @type {any} */ racine) => textesVisibles(racine)
  .find((/** @type {string} */ texte) => texte.startsWith('Accueille')) || '';

const boutonAvecTitre = (
  /** @type {any} */ racine,
  /** @type {string} */ titre,
) => racine
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
    && texteDe(noeud).includes(titre));

describe('P8 · la carte d ouverture, face ORGANISATEUR', () => {
  test('(a) un entrainement OUVERT : l etat, les places restantes, les demandes', () => {
    // 🎯 8 places offertes, 2 prises ⇒ 6 restantes. 1 demande en attente.
    // Ces trois nombres existaient deja dans la page ; aucun ne s'affichait.
    const racine = monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });

    expect(parTestID(racine, 'p8-carte-ouverture-entrainement')).toHaveLength(1);
    expect(texteDeLaCarte(racine)).toContain('Entraînement ouvert');
    expect(texteDeLaCarte(racine)).toContain('6 place(s) externe(s) restante(s) sur 8');
    expect(texteDeLaCarte(racine)).toContain('1 demande(s) à vérifier');
  });

  test('(a bis) le bouton qui descend a la file existe, et il se presse', () => {
    // ⚠️ Jest n'a pas de mise en page : ce temoin prouve que le bouton est la,
    // et que le geste ne casse rien. Le defilement REEL se voit a la recette.
    const racine = monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });

    const bouton = boutonAvecTitre(racine, 'Voir les demandes');
    expect(bouton).toBeTruthy();

    expect(() => {
      act(() => {
        bouton.props.onPress();
      });
    }).not.toThrow();
  });

  test('(d) ZERO demande : la carte reste, le compteur disparait', () => {
    // ⛔ « 0 demande a verifier » serait un bloc qui parle pour ne rien dire.
    const racine = monter({
      auth: ORGANISATEUR(),
      event: entrainementOuvert({ participationRequests: [] }),
    });

    expect(parTestID(racine, 'p8-carte-ouverture-entrainement')).toHaveLength(1);
    expect(texteDeLaCarte(racine)).toContain('6 place(s) externe(s) restante(s) sur 8');
    expect(texteDeLaCarte(racine)).not.toContain('à vérifier');
  });

  test('aucun externe du tout : pas de bouton, il ne menerait nulle part', () => {
    // 🔒 Regle 5 du pack : aucun bouton muet. Sans participant externe et sans
    // demande, la file n'existe pas — le bouton non plus.
    const racine = monter({
      auth: ORGANISATEUR(),
      event: entrainementOuvert({ participationRequests: [], participations: [] }),
    });

    expect(parTestID(racine, 'p8-carte-ouverture-entrainement')).toHaveLength(1);
    expect(boutonAvecTitre(racine, 'Voir les demandes')).toBeFalsy();
    expect(boutonAvecTitre(racine, 'Voir les participants externes')).toBeFalsy();
  });

  test('des externes SANS demande : le bouton change de titre', () => {
    const racine = monter({
      auth: ORGANISATEUR(),
      event: entrainementOuvert({ participationRequests: [] }),
    });

    expect(boutonAvecTitre(racine, 'Voir les participants externes')).toBeTruthy();
    expect(boutonAvecTitre(racine, 'Voir les demandes')).toBeFalsy();
  });

  test('« qui valide » se dit en clair, et pas de la meme facon', () => {
    // 🎯 Pack fiche 2 : « combien de places externes, QUI VALIDE, et surtout
    // combien de demandes ». Le reglage brut vit dans le menu ⋯ (N7 item 4) ;
    // ici on dit ce qu'il CHANGE pour l'organisateur.
    const manuelle = monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });
    expect(texteDeLaCarte(manuelle)).toContain('c’est toi qui acceptes chaque demande');

    const auto = monter({
      auth: ORGANISATEUR(),
      event: entrainementOuvert({ externalParticipantValidationMode: 'auto' }),
    });
    expect(texteDeLaCarte(auto)).toContain('acceptées toutes seules');
  });

  test('un entrainement PRIVE dit qu il est reserve, et ne promet aucune place', () => {
    // 🪤 Le mot « ouvert » porte deux sens dans l'app (pack, defaut 🟠). La
    // carte tranche : elle dit A QUI c'est ouvert, pas seulement « ouvert ».
    const racine = monter({
      auth: ORGANISATEUR(),
      event: entrainementOuvert({ sessionStatus: 'closed' }),
    });

    expect(texteDeLaCarte(racine)).toContain('Entraînement privé');
    expect(texteDeLaCarte(racine)).toContain('Réservé à ton équipe');
    expect(texteDeLaCarte(racine)).not.toContain('restante(s)');
  });

  test('un entrainement FERME garde le compteur des demandes en attente', () => {
    // 🔒 Fermer la seance n'efface pas la file : les demandes deja recues
    // attendent toujours une reponse. Les cacher serait les perdre.
    const racine = monter({
      auth: ORGANISATEUR(),
      event: entrainementOuvert({ sessionStatus: 'closed' }),
    });

    expect(texteDeLaCarte(racine)).toContain('1 demande(s) à vérifier');
    expect(boutonAvecTitre(racine, 'Voir les demandes')).toBeTruthy();
  });
});

describe('P8 · ce que la carte ne montre PAS', () => {
  test('(b) un LECTEUR n a pas la carte — il garde la ligne publique de N1', () => {
    const racine = monter({ auth: SPECTATEUR(), event: entrainementOuvert() });

    expect(parTestID(racine, 'p8-carte-ouverture-entrainement')).toHaveLength(0);
    expect(contient(racine, 'Accueille 8 joueur·se·s de l’extérieur')).toBe(true);
    expect(contient(racine, '2 place(s) prise(s)')).toBe(true);
  });

  test('(b bis) un LECTEUR ne voit toujours JAMAIS les demandes (Q14)', () => {
    // 🔒 Le compte des demandes a change de place, pas de camp : il reste une
    // information d'organisation.
    const racine = monter({ auth: SPECTATEUR(), event: entrainementOuvert() });

    expect(contient(racine, 'demande(s) à vérifier')).toBe(false);
  });

  test('(c) un MATCH ne gagne pas la carte', () => {
    const racine = monter({
      auth: ORGANISATEUR(),
      event: entrainementOuvert({ type: { name: 'Match' } }),
    });

    expect(parTestID(racine, 'p8-carte-ouverture-entrainement')).toHaveLength(0);
  });

  test('(c bis) une DETECTION non plus', () => {
    const racine = monter({
      auth: ORGANISATEUR(),
      event: entrainementOuvert({ type: { name: 'Détection' } }),
    });

    expect(parTestID(racine, 'p8-carte-ouverture-entrainement')).toHaveLength(0);
  });
});

describe('P8 · l anti-doublon (D2)', () => {
  test('la ligne publique ne porte PLUS le compte des demandes', () => {
    // 🧨 LE DOUBLON EVITE : avant P8, la ligne publique ajoutait « N demande(s)
    // a verifier » pour l'organisateur SEUL. La carte le dit maintenant, mieux
    // et avec son bouton — le dire deux fois serait du bruit.
    const racine = monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });

    expect(lignePublique(racine)).toContain('Accueille 8 joueur·se·s de l’extérieur');
    expect(lignePublique(racine)).not.toContain('à vérifier');
  });

  test('...et le compte n a pas disparu : il est dans la carte', () => {
    const racine = monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });

    expect(texteDeLaCarte(racine)).toContain('1 demande(s) à vérifier');
  });
});

describe('P8 · le rail vers la file des externes', () => {
  test('l ancre du bas existe : le rail a une cible', () => {
    // 🧭 L'ancre est une vue vide posee JUSTE AU-DESSUS de la liste des
    // participants — la seule cible legale (le bloc lui-meme appartient a P2).
    const racine = monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });

    expect(racine.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'p8-ancre-participants',
      { deep: false },
    )).toHaveLength(1);
  });
});

describe('P8 · les clefs', () => {
  test('la carte demande SES clefs a fr.js', () => {
    monter({ auth: ORGANISATEUR(), event: entrainementOuvert() });

    expect(askedKeys).toContain('eventDetails.openTraining.cardOpenTitle');
    expect(askedKeys).toContain('eventDetails.openTraining.cardOpenMeaning');
    expect(askedKeys).toContain('eventDetails.openTraining.seatsLeft');
    expect(askedKeys).toContain('eventDetails.openTraining.validationManual');
    expect(askedKeys).toContain('eventDetails.openTraining.pendingSuffix');
    expect(askedKeys).toContain('eventDetails.openTraining.goToPending');
  });
});
