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
const mockHeaderProps = { value: null };
const mockTagProps = { value: null };
const mockUpdateNoNav = jest.fn();

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

const monter = (/** @type {any} */ { attendance = null, auth, event } = {}) => {
  mockEventQuery.data = event === undefined ? buildMatch() : event;
  mockAttendance.data = attendance;
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
    expect(resultat.value).toBe('Score en attente');
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
    const valider = racine
      .findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'button')
      .find((/** @type {any} */ n) => texteDe(n).includes('Enregistrer'));
    expect(valider).toBeDefined();

    await act(async () => {
      await valider.props.onPress();
    });

    expect(mockUpdateNoNav).toHaveBeenCalledWith({
      documentId: 'event-1',
      eventData: { opponentName: 'US Marseille' },
    });
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
