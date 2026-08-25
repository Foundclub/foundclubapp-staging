import {
  Alert, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

// C2 (E6) — LE RAPPEL DE COMPO, ET LES QUATRE CAS OU IL DOIT SE TAIRE.
//
// Demande d'Adel : « apres la creation d'un evenement MATCH, proposer de creer
// la composition ». L'etude D88 (docs/REFLEXION_AFFICHES_ET_POPUP_COMPO.md
// §2.6-2.7) a ecarte la fenetre modale et retenu un bandeau permanent sur la
// page du match, tant que la compo n'existe pas.
//
// Ce fichier est le FILET, pose AVANT le bandeau. Il caracterise d'abord les
// etats qui doivent rester silencieux — c'est la moitie qui coute cher :
//   1. un match sans compo AFFICHE le rappel, et il mene a la compo qui existe ;
//   2. un match AVEC une compo ne l'affiche pas (non-regression) ;
//   3. un match passe ne l'affiche plus ;
//   4. qui n'a pas le droit d'agir ne se voit rien promettre.
//
// LA COUTURE est celle de `EventDetailsManagePanel.test.js` : le TEXTE VISIBLE
// et l'ACTION ATTEIGNABLE, jamais la forme de l'arbre. Le seul `testID` sert a
// MESURER la hauteur declaree du bandeau — pas a le trouver.
//
// 🔒 CE QUE CE FICHIER VERROUILLE SURTOUT : « pas de compo » se lit sur
// l'EXISTENCE de `draft` / `published`, jamais sur le CONTENU d'une liste de
// joueurs. Un brouillon dont la selection est vide (`[]`) reste un brouillon —
// confondre « absent » et « vide » ferait reapparaitre le rappel sur un match
// dont le coach a deja commence la compo.

const mockUseAuth = jest.fn();
const mockNavigate = jest.fn();
// L4-B : partage, pour pouvoir relire le `headerRight` que l ecran y depose.
const mockSetOptions = jest.fn();
const mockEventQuery = { data: null };
const mockTeamCompositionQuery = { data: null };
const mockCompositionFetching = { value: false };

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

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
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
  // AC10 : depuis que « le match est fini » se decide sur l horloge du SERVEUR
  // et non sur celle du telephone, l ecran a besoin qu on la lui donne. Sans
  // elle il repond « pas fini », par securite. On rend donc l heure courante :
  // les evenements dates 2020 restent passes, ceux dates 2099 restent a venir,
  // et chaque temoin garde exactement le sens qu il avait.
  useGetEventAttendance: () => ({
    ...emptyQuery(),
    data: { data: { serverNow: new Date().toISOString() } },
  }),
  useGetEventConvocation: () => emptyQuery(),
  useGetEventTeamComposition: () => ({
    ...emptyQuery(),
    data: mockTeamCompositionQuery.data,
    isFetching: mockCompositionFetching.value,
  }),
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

// La doublure de Button rend un VRAI pressable portant son titre : c'est ce qui
// permet de piloter une chip et le bouton du bandeau de la meme facon.
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityLabel: props.accessibilityLabel,
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        onPress: props.onPress,
        // 🔘 S5 (vague S) : la doublure relaie le VARIANT. Sans lui, « c est un
        // vrai bouton » ne se mesure pas — un lien texte et un Button rendent
        // tous les deux un pressable portant un libelle.
        variant: props.variant,
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

// 🎛️ L4-A — LA DOUBLURE DES ONGLETS, ET ELLE N'EST PAS FACULTATIVE.
// `SegmentedControl` importe `react-native-gesture-handler`, dont
// `lib/commonjs/specs/NativeRNGestureHandlerModule.ts` n'est PAS couvert par le
// `transformIgnorePatterns` du depot : sans doublure, la SUITE ENTIERE meurt au
// chargement (« Cannot use import statement outside a module ») et AUCUN test
// ne s'execute. C'est pour ca que les 16 autres appelants du composant le
// doublent aussi (motif ClubDetails.deuxPortes.test.js:299).
// La doublure rend un pressable par onglet, portant son libelle : le dessin est
// verifie chez le composant (201 lignes de test), ce qui se verifie ici c'est
// CE QU'ON LUI DONNE et CE QU'IL COMMANDE.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SegmentedControlDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.View,
      { testID: 'doublure-onglets' },
      (props.options || []).map((/** @type {any} */ option) => react.createElement(
        rn.TouchableOpacity,
        {
          key: option.value,
          onPress: () => props.onChange(option.value),
          testID: `onglet-${option.value}`,
        },
        react.createElement(rn.Text, null, option.label),
      )),
    );
  };
});

/**
 * Bascule sur l'onglet demande. Sans effet sur un evenement qui n'a pas
 * d'onglets (tout type autre que le match) : la colonne y est entiere.
 * @param {any} root - Racine du rendu.
 * @param {string} valeur - 'overview' | 'participants' | 'callUp'.
 * @returns {void}
 */
const allerSurLOnglet = (root, valeur) => {
  const [onglet] = root.findAll(
    (/** @type {any} */ node) => node.props?.testID === `onglet-${valeur}`,
    { deep: false },
  );
  if (!onglet) return;
  act(() => {
    onglet.props.onPress();
  });
};

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

// Le premier montage transpile tout le graphe d'imports de l'ecran (6 184 lignes).
jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const REMINDER_ID = 'event-compo-reminder';

// Les mots que l'organisateur lit. Ils vivent ici en un seul endroit : un lot
// qui les reecrit doit voir ce fichier dans son diff.
// ⚠️ Apostrophe TYPOGRAPHIQUE (’), celle des libelles recents du depot : une
// apostrophe droite ne trouverait rien et le rouge accuserait le code.
// 🗣️ N4 (D1) — LES MOTS DU BANDEAU, APRES LA DISPARITION DE « COMPO ».
// Le bandeau disait « compo », un mot de metier que personne qui decouvre
// l'app ne comprend. Il dit desormais « convocation », comme la rangee du menu
// vers laquelle il mene. ⛔ Le bandeau, sa condition d'affichage, sa hauteur et
// sa destination n'ont pas bouge d'un pouce : SEULS LES MOTS changent, et ces
// trois chaines vivent maintenant dans `fr.js` (clefs `eventDetails.compoReminder`).
const TITRE_RAPPEL = 'Ce match n’a pas encore de convocation';
const ACTION_RAPPEL = 'Préparer la convocation';
const TITRE_OFFRE = 'La convocation est incluse dans l’offre Équipe';
const ACTION_OFFRE = 'Voir l’offre Équipe';
// 🕳️ R6 (vague R) — LE TROISIEME ETAT, celui qui manquait. Entre « rien » et
// « publie » il y a le BROUILLON, et c'est l'etat le plus frequent : un coach
// ouvre sa convocation, coche trois joueurs, et revient le lendemain.
// ♻️ S5 (vague S) — LES MOTS D ADEL, MOT POUR MOT. Il en prepare PLUSIEURS (une
// par equipe conviee), d ou le pluriel ; et « brouillon » est un mot d outil,
// pas un mot de terrain. « Continuer » dit ce qui se passe au doigt.
const TITRE_BROUILLON = 'Tes convocations sont commencées';
const ACTION_BROUILLON = 'Continuer mes convocations';

// 🚧 Le plafond de hauteur DECLAREE du bandeau. Ce n'est pas une mesure a
// l'ecran (il faudrait un appareil) mais la somme des valeurs que le style
// impose, comptee au PIRE — verifiable, et c'est ce qui interdit qu'un rappel
// repousse le contenu du match hors de vue sur un petit telephone.
//
// D'ou vient 120 : un iPhone SE fait 667 pt. En-tete de navigation (~90),
// en-tete d'evenement (~150) et panneau « Gerer l'evenement » (60 declares,
// EventDetailsManagePanel.test.js, + 12 de marge) laissent ~355 pt de contenu.
// Un bandeau de 120 pt en prend un tiers et laisse voir le debut du match.
// Au-dela, il devient l'ecran au lieu d'etre un rappel.
const PLAFOND_HAUTEUR_DECLAREE = 120;

const buildMatch = (/** @type {any} */ overrides = {}) => ({
  club: { documentId: CLUB_ID },
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'event-1',
  featuredRequests: [],
  id: 1,
  invitedTeams: [],
  isActive: true,
  name: 'Match contre Saint-Julien',
  participations: [],
  startTime: '10:00',
  team: { club: { documentId: CLUB_ID }, documentId: TEAM_ID, name: 'U15' },
  type: { name: 'Match' },
  ...overrides,
});

const defaultAuth = (/** @type {any} */ overrides = {}) => ({
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId: 'user-1', role: { name: 'Joueur' } },
  ...overrides,
});

// Ce que le serveur rend quand AUCUNE composition n'existe : `bootstrap` est
// toujours la (c'est une proposition de depart, pas une compo), `draft` et
// `published` sont nuls. Mesure : `GET /events/:id/composition`
// (eventService.js:500 — « composition data (draft + published) »).
const PAYLOAD_SANS_COMPO = {
  availablePresets: [],
  bootstrap: { composition: null, source: 'empty' },
  draft: null,
  eligiblePlayers: [],
  published: null,
};

/** @type {any} */
let mounted = null;

const mountScreen = (/** @type {any} */ {
  auth, composition, event, isFetching,
} = {}) => {
  mockEventQuery.data = event === undefined ? buildMatch() : event;
  mockTeamCompositionQuery.data = composition === undefined ? PAYLOAD_SANS_COMPO : composition;
  mockCompositionFetching.value = Boolean(isFetching);
  mockUseAuth.mockReturnValue(defaultAuth(auth));

  act(() => {
    mounted = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: mockSetOptions,
        }}
        route={{ params: { eventId: 'event-1' } }}
      />,
    );
  });

  // ⚠️ RENEGOCIATION ASSUMEE (L4-A, maquette planche 04) : le rappel de compo
  // n'ouvre plus la page, il ouvre l'ONGLET CONVOCATION dont il devient le
  // coeur. Le contrat passe donc de « 0 appui » a « 1 appui d'onglet ».
  // ⛔ CE N'EST PAS UNE DECISION DE CE FICHIER : elle vient du pack de design,
  // elle est ecrite dans le prompt du lot, et le temoin dedie juste sous le
  // bloc C2 · temoin 1 la dit a voix haute plutot que de la cacher ici.
  // ⛔ ET RIEN D'AUTRE NE CHANGE : tous les temoins de SILENCE ci-dessous — la
  // moitie qui coute cher — gardent exactement le sens qu'ils avaient.
  allerSurLOnglet(mounted.root, 'callUp');

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

const visibleTexts = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

const hasText = (/** @type {any} */ root, /** @type {string} */ label) => visibleTexts(root)
  .some((/** @type {string} */ value) => value.includes(label));

const pressableWithText = (/** @type {any} */ root, /** @type {string} */ label) => root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ node) => textOf(node).includes(label));

const banner = (/** @type {any} */ root) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === REMINDER_ID && node.type === View);

/**
 * 🔘 S5 — L action du bandeau, prise DANS le bandeau.
 *
 * ⛔ Pas `pressableWithText` : la page porte d autres pressables, et un libelle
 * qui changerait de mot ferait passer ce juge a cote sans rien dire.
 * @param {any} root - Racine du rendu.
 * @returns {any} - Le pressable de l action, ou undefined.
 */
const actionDuBandeau = (/** @type {any} */ root) => {
  const [node] = banner(root);
  if (!node) throw new Error('Le bandeau de rappel n est pas rendu');
  return node.findAllByType(TouchableOpacity)[0];
};

/**
 * Le rappel est-il rendu ? Un seul juge : le libelle que l'organisateur lit.
 * @param {any} root - Racine du rendu.
 * @returns {boolean} - Vrai si le rappel de compo est visible.
 */
const rappelVisible = (/** @type {any} */ root) => hasText(root, TITRE_RAPPEL)
  || hasText(root, TITRE_OFFRE)
  // 🕳️ R6 : sans cette troisieme phrase, ce juge dirait « le bandeau est
  // absent » alors qu'il est A L'ECRAN avec son texte de brouillon — et les
  // temoins qui exigent le SILENCE resteraient verts par accident.
  || hasText(root, TITRE_BROUILLON);

/**
 * Hauteur DECLAREE du bandeau, comptee AU PIRE : rembourrages, bordures et
 * interlignes imposes par le style, puis DEUX lignes par texte hors action
 * (hypothese petit telephone, ou une phrase de 40 signes se casse en deux), et
 * la cible tactile de l'action — 44 pt, le repere d'accessibilite du projet.
 * Le texte porte PAR l'action n'est pas compte deux fois : il vit dedans.
 * @param {any} root - Racine du rendu.
 * @returns {number} - La hauteur declaree, en points.
 */
const hauteurDeclaree = (/** @type {any} */ root) => {
  const [node] = banner(root);
  if (!node) throw new Error('Le bandeau de rappel n est pas rendu');
  const style = StyleSheet.flatten(node.props.style) || {};
  const vertical = Number(style.paddingVertical || style.padding || 0);
  const top = Number(style.paddingTop || vertical);
  const bottom = Number(style.paddingBottom || vertical);
  const border = Number(style.borderWidth || 0) * 2;
  const gap = Number(style.gap || style.rowGap || 0);
  const actions = node.findAllByType(TouchableOpacity);
  const textesDansActions = actions
    .reduce((total, action) => total + action.findAllByType(Text).length, 0);
  const lignesHorsAction = node.findAllByType(Text).length - textesDansActions;
  return top + bottom + border + gap + (lignesHorsAction * 2 * 20) + (actions.length * 44);
};

const asOrganiser = (/** @type {any} */ extra = {}) => ({
  canEditEvent: () => true,
  canManageEvent: () => true,
  subscriptionAccessLevel: 'TEAM',
  userData: { documentId: 'user-1', role: { name: 'Entraineur' } },
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mounted = null;
});

afterEach(() => {
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
    mounted = null;
  }
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// L4-B — LE MENU D'ORGANISATION A QUITTE LA COLONNE POUR LA BARRE DU HAUT.
//
// L'accordeon « Gérer l'événement » est devenu un ⋯ pose dans l'en-tete de
// navigation, qui ouvre une feuille. Les actions, elles, n'ont pas bouge d'un
// pouce : meme liste, meme ordre, memes conditions.
//
// 🚨 LE PIEGE QUE CES TROIS FONCTIONS DEMINENT, et il est SILENCIEUX :
// `navigation.setOptions` est une DOUBLURE MUETTE ici, donc l'element
// `headerRight` n'entre JAMAIS dans l'arbre monte. Chercher le ⋯ par son
// `testID` dans le rendu trouverait le vide SANS RIEN DIRE — et tous les
// temoins d'actions ci-dessous deviendraient verts en ne testant plus rien.
// ⇒ On va le chercher la ou il est reellement : dans le dernier `headerRight`
// remis a `setOptions`, dont on parcourt l'arbre d'ELEMENTS non montes.
// Motif existant : `EventFilters.criteres.test.js:316-323`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cherche un element dans un arbre NON MONTE, par predicat sur ses props.
 * @param {any} element - Racine de l'arbre d'elements.
 * @param {any} predicat - Le test applique a chaque noeud.
 * @returns {any} - Le premier element qui satisfait le predicat, ou null.
 */
const chercherDansElements = (element, predicat) => {
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

/**
 * Le ⋯ de la barre du haut, ou null s'il n'y a rien a gerer.
 * @returns {any} - L'element du bouton, ou null.
 */
const boutonDeGestion = () => {
  const appels = mockSetOptions.mock.calls.filter(
    (/** @type {any} */ appel) => appel[0]?.headerRight,
  );
  if (!appels.length) return null;
  return chercherDansElements(
    appels[appels.length - 1][0].headerRight(),
    (/** @type {any} */ noeud) => noeud?.props?.testID === 'event-actions-menu-button',
  );
};

/**
 * Ouvre la feuille d'organisation. Remplace l'appui sur le texte « Gérer
 * l'événement » de l'accordeon d'avant L4-B : meme geste pour la personne qui
 * s'en sert, meme liste d'actions au bout.
 * TOLERANTE A DESSEIN, comme l'ancien helper : la ou il n'y a rien a gerer, il
 * n'y a pas de bouton, et l'inventaire doit pouvoir sortir vide sans jeter.
 * @returns {void}
 */
const ouvrirLaFeuilleDeGestion = () => {
  const bouton = boutonDeGestion();
  if (!bouton) return;
  act(() => {
    bouton.props.onPress();
  });
};

// ── L4-A — LE CONTRAT A CHANGE, ET IL EST ECRIT ICI ────────────────────────
// Avant L4-A, le rappel etait visible AU MONTAGE, sans aucun appui. La maquette
// (planche 04) en fait le COEUR de l'onglet Convocation : il coute donc
// desormais UN appui d'onglet. Ce temoin existe pour que ce prix soit VISIBLE
// dans le filet — pas enfoui dans un helper de montage.
describe('L4-A — le rappel de compo coute UN appui d onglet, et pas plus', () => {
  test('il n est PAS dans l onglet Aperçu, il EST dans l onglet Convocation', () => {
    const root = mountScreen({ auth: asOrganiser() });

    allerSurLOnglet(root, 'overview');
    expect(hasText(root, TITRE_RAPPEL)).toBe(false);

    allerSurLOnglet(root, 'callUp');
    expect(hasText(root, TITRE_RAPPEL)).toBe(true);
    // ⛔ ET IL EST EN TETE DE L'ONGLET : un rappel range au fond redemanderait
    // de defiler, et on aurait troque un defaut contre le meme.
    const textes = visibleTexts(root);
    const rangDuRappel = textes.findIndex((/** @type {string} */ t) => t.includes(TITRE_RAPPEL));
    const rangDuBloc = textes.findIndex((/** @type {string} */ t) => t.includes('Composition d'));
    expect(rangDuRappel).toBeGreaterThanOrEqual(0);
    if (rangDuBloc >= 0) expect(rangDuRappel).toBeLessThan(rangDuBloc);
  });
});

describe('C2 — temoin 1 : un match sans compo affiche le rappel', () => {
  test('le rappel est la, et il parle des mots du coach', () => {
    const root = mountScreen({ auth: asOrganiser() });

    expect(hasText(root, TITRE_RAPPEL)).toBe(true);
    expect(banner(root)).toHaveLength(1);
  });

  test('il mene a la composition QUI EXISTE DEJA, sans creer d ecran', () => {
    const root = mountScreen({ auth: asOrganiser() });
    const action = pressableWithText(root, ACTION_RAPPEL);
    expect(action).toBeTruthy();

    act(() => {
      action.props.onPress();
    });

    // La meme destination que la rangee « Convocation » du menu, prouvee par
    // EventDetailsManagePanel.test.js. Le bandeau est un raccourci vers une
    // porte existante, pas une porte de plus.
    expect(mockNavigate).toHaveBeenCalledWith(
      'MatchCallUpSelection',
      expect.objectContaining({ eventId: 'event-1' }),
    );
  });

  test('il n interrompt rien : aucune fenetre, aucune alerte au montage', () => {
    mountScreen({ auth: asOrganiser() });

    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('il ne pousse pas le match hors de vue sur un petit telephone', () => {
    const root = mountScreen({ auth: asOrganiser() });

    expect(hauteurDeclaree(root)).toBeLessThanOrEqual(PLAFOND_HAUTEUR_DECLAREE);
  });

  test('le menu d organisation garde sa rangee de convocation : aucun chemin supprime', () => {
    const root = mountScreen({ auth: asOrganiser() });
    ouvrirLaFeuilleDeGestion();

    // 🎯 N4 (D1/D2) — « Compo » est devenu « Convocation », et le releve passe
    // par la CLEF de la rangee : depuis L4 un ONGLET porte le meme mot, donc
    // `pressableWithText(root, 'Convocation')` serait vrai meme sans rangee.
    const [etiquette] = root.findAll(
      (/** @type {any} */ node) => node.props?.testID === 'event-manage-label-lineup',
      { deep: false },
    );
    expect(etiquette).toBeTruthy();
    expect(textOf(etiquette).trim()).toBe('Convocation');
  });
});

// ♻️ REECRIT PAR R6 (vague R). Ce bloc s'appelait « un match AVEC une compo ne
// l affiche pas » et CARACTERISAIT le silence du bandeau des qu'un brouillon
// existait.
//
// 🧨 La recette du 24/08 a montre que ce silence etait le DEFAUT, pas la regle.
// Un entraineur qui avait commence sa convocation ouvrait l'onglet
// « Convocation » et n'y trouvait PLUS RIEN : ni son travail en cours, ni une
// porte pour le reprendre. Le bandeau s'etait tu parce qu'une compo
// « existait », et le resume publie n'existait pas encore — l'onglet tombait
// entre les deux. La seule porte restante vivait dans un menu REPLIE par defaut.
//
// ⇒ Seul le PUBLIE fait taire le bandeau : a ce moment-la, le resume et la
// liste des convoques prennent le relais, et l'onglet n'est jamais vide.
describe('C2 + R6 — le bandeau se tait sur une compo PUBLIEE, jamais sur un brouillon', () => {
  test('🕳️ R6 : un BROUILLON ne le fait plus taire — il propose de le reprendre', () => {
    const root = mountScreen({
      auth: asOrganiser(),
      composition: { ...PAYLOAD_SANS_COMPO, draft: { mode: 'manual', teams: [] } },
    });

    expect(rappelVisible(root)).toBe(true);
    expect(hasText(root, TITRE_BROUILLON)).toBe(true);
    expect(hasText(root, ACTION_BROUILLON)).toBe(true);
    // ⛔ Et surtout PAS la phrase du vide : le coach a commence, lui redire
    // « ce match n'a pas encore de convocation » serait faux — c'est ce que
    // le temoin « ABSENT n'est pas VIDE » interdisait deja, et ca ne change pas.
    expect(hasText(root, TITRE_RAPPEL)).toBe(false);
  });

  test('une compo PUBLIEE le fait taire aussi', () => {
    const root = mountScreen({
      auth: asOrganiser(),
      composition: {
        ...PAYLOAD_SANS_COMPO,
        published: { mode: 'manual', publishedAt: '2099-01-01T09:00:00.000Z', teams: [] },
      },
    });

    expect(rappelVisible(root)).toBe(false);
  });

  test('🔘 S5 : l action du bandeau est un VRAI bouton, pas un lien texte', () => {
    // 🗣️ Adel, recette du 25/08 : « le lien texte devient un vrai bouton ».
    // Ce qu il y avait : un `TouchableOpacity` nu portant du texte primary500.
    // A l ecran, rien ne le designait comme la porte principale de l onglet —
    // il se lisait comme une note de bas de bloc.
    //
    // ⛔ LE JUGE PORTE SUR LE VARIANT DEMANDE AU COMPOSANT PARTAGE, pas sur le
    // texte : un lien et un `Button` rendent tous les deux un pressable portant
    // un libelle. Lire le texte ne distinguerait donc PAS les deux, et ce
    // temoin serait vert avant comme apres.
    const root = mountScreen({
      auth: asOrganiser(),
      composition: { ...PAYLOAD_SANS_COMPO, draft: { mode: 'manual', teams: [] } },
    });

    const action = actionDuBandeau(root);

    expect(action.props.variant).toBe('Primary');
    expect(textOf(action)).toContain(ACTION_BROUILLON);
  });

  test('🔒 « ABSENT » N EST PAS « VIDE » : un brouillon sans joueur reste un brouillon', () => {
    // Le piege que ce temoin interdit : lire le CONTENU (`selectedPlayerIds`)
    // au lieu de l'EXISTENCE. Un coach qui a ouvert la convocation et n'a
    // encore coche personne A commence sa compo — lui redire « tu n'as pas
    // encore de compo » serait faux.
    // ♻️ R6 : le juge sur l'EXISTENCE ne bouge pas, sa CONCLUSION change. Avant,
    // « c'est un brouillon » menait au silence ; desormais ca mene a la porte
    // qui le rouvre. C'est le meme etat, enfin dit a quelqu'un.
    const root = mountScreen({
      auth: asOrganiser(),
      composition: {
        ...PAYLOAD_SANS_COMPO,
        draft: { mode: 'manual', selectedPlayerIds: [], teams: [] },
      },
    });

    expect(hasText(root, TITRE_BROUILLON)).toBe(true);
    expect(hasText(root, TITRE_RAPPEL)).toBe(false);
  });

  test('la PROPOSITION de depart (`bootstrap`) n est pas une compo : le rappel reste', () => {
    // Contre-epreuve du temoin precedent. `bootstrap` est TOUJOURS rendu par le
    // serveur, meme quand rien n'existe : le prendre pour une compo eteindrait
    // le rappel partout, et le lot n'aurait aucun effet visible.
    const root = mountScreen({
      auth: asOrganiser(),
      composition: {
        ...PAYLOAD_SANS_COMPO,
        bootstrap: { composition: { teams: [{ id: 't1' }] }, source: 'last_match' },
      },
    });

    expect(hasText(root, TITRE_RAPPEL)).toBe(true);
  });

  test('tant que la reponse du serveur n est pas la, on ne dit rien', () => {
    // Anti-clignotement : un rappel qui s'affiche puis disparait a chaque
    // ouverture se lit comme un bug. Sans reponse, on ne SAIT pas.
    const root = mountScreen({
      auth: asOrganiser(),
      composition: null,
      isFetching: true,
    });

    expect(rappelVisible(root)).toBe(false);
  });
});

describe('C2 — temoin 3 : un match passe ne l affiche plus', () => {
  test('rappeler une compo pour un match d hier est absurde', () => {
    const root = mountScreen({
      auth: asOrganiser(),
      event: buildMatch({ date: '2020-03-01T10:00:00.000Z' }),
    });

    expect(rappelVisible(root)).toBe(false);
  });

  test('et le meme match, dans le futur, l affiche bien', () => {
    // Contre-epreuve : sans elle, un bandeau jamais rendu passerait le temoin
    // precedent pour de mauvaises raisons.
    const root = mountScreen({
      auth: asOrganiser(),
      event: buildMatch({ date: '2099-03-01T10:00:00.000Z' }),
    });

    expect(hasText(root, TITRE_RAPPEL)).toBe(true);
  });
});

describe('C2 — temoin 4 : qui n a pas le droit d agir ne se voit rien promettre', () => {
  test('un participant ne voit aucun rappel', () => {
    const root = mountScreen();

    expect(rappelVisible(root)).toBe(false);
  });

  test('un match sans equipe rattachee : aucun rappel, la compo n a pas de cible', () => {
    const root = mountScreen({
      auth: asOrganiser(),
      event: buildMatch({ invitedTeams: [], team: null }),
    });

    expect(rappelVisible(root)).toBe(false);
  });

  test('🔒 AU FORFAIT GRATUIT : le prix est SUR la proposition, et rien n est promis', () => {
    // Mesure D88 §2.2 : `composition.manage` est reserve aux offres TEAM et
    // CLUB (subscription-permission.ts:80), et le refus tombe aujourd'hui en
    // 403 AU MOMENT DE PUBLIER — apres que le coach a coche et place ses
    // joueurs. Un rappel muet laisserait ce mur entier ; un rappel qui dit
    // « prepare ta compo » le mettrait en vitrine. Il annonce donc l'offre.
    const root = mountScreen({
      auth: asOrganiser({ subscriptionAccessLevel: 'FREE' }),
    });

    expect(hasText(root, TITRE_OFFRE)).toBe(true);
    expect(hasText(root, TITRE_RAPPEL)).toBe(false);
    expect(pressableWithText(root, ACTION_RAPPEL)).toBeUndefined();
  });

  test('au forfait gratuit, l action mene aux offres — jamais au terrain', () => {
    const root = mountScreen({
      auth: asOrganiser({ subscriptionAccessLevel: 'FREE' }),
    });
    const action = pressableWithText(root, ACTION_OFFRE);
    expect(action).toBeTruthy();

    act(() => {
      action.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ProfileStack', expect.objectContaining({
      screen: 'SubscriptionOffers',
    }));
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'MatchCallUpSelection',
      expect.anything(),
    );
  });

  test('une offre Club NON VERIFIEE ouvre la compo : ce client a deja paye', () => {
    // Decision produit du 2026-07-17, cote serveur
    // (subscription-permission.ts:751-756) : un entitlement CLUB actif ouvre
    // l'acces meme sans club verifie. Lui revendre l'offre serait lui revendre
    // ce qu'il a deja.
    const root = mountScreen({
      auth: asOrganiser({ subscriptionAccessLevel: 'CLUB_UNVERIFIED' }),
    });

    expect(hasText(root, TITRE_RAPPEL)).toBe(true);
    expect(hasText(root, TITRE_OFFRE)).toBe(false);
  });

  test('niveau d abonnement encore inconnu : aucun argument de vente', () => {
    // Meme garde-fou que SubscriptionQuotaBanner.js:96 — pendant le bootstrap,
    // afficher « offre Équipe » a un abonne serait lui revendre son abonnement.
    const root = mountScreen({
      auth: asOrganiser({ subscriptionAccessLevel: undefined }),
    });

    expect(rappelVisible(root)).toBe(false);
  });

  test('un ENTRAINEMENT n est pas concerne : la compo n y est pas la norme', () => {
    const root = mountScreen({
      auth: asOrganiser(),
      event: buildMatch({ type: { name: 'Entrainement' } }),
    });

    expect(rappelVisible(root)).toBe(false);
  });
});
