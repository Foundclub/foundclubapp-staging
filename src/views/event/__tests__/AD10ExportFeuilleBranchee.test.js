import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// AD10 (E6) — LA FEUILLE D EXPORT CESSE D ETRE INATTEIGNABLE.
//
// 🧨 LE DEFAUT, MESURE LE 2026-08-21 :
//
//   grep -rn "EventExportSheet" src --include=*.js | grep -v __tests__
//   -> 2 lignes, toutes deux DANS le composant lui-meme.
//
// Le lot AD05 a livre 162 lignes de feuille + 284 lignes de temoins verts, et
// AUCUN bouton ne l ouvrait. Pendant ce temps, « Exporter la liste (Excel/CSV) »
// telechargeait DIRECTEMENT un classeur de 8 colonnes — e-mail et telephone de
// tout le monde compris — sans un mot et sans choix.
//
// ⇒ Du code livre que personne ne peut atteindre coute exactement aussi cher
//   qu un bug : il a ete paye, et il ne sert a rien.
//
// 📏 CE QUE CES TEMOINS TIENNENT — LA CHAINE ENTIERE, MAILLON PAR MAILLON :
//
//   0. le VRAI bouton d `EventParticipants` appelle bien son declencheur
//      (sans ce maillon, les 4 suivants prouveraient un cablage fantome)
//   1. 🥇 appuyer sur « Exporter » OUVRE la feuille et ne telecharge RIEN
//   2. 🥇 confirmer AVEC la bascule demande un fichier SANS coordonnees
//   3. 🔒 confirmer SANS la bascule redemande EXACTEMENT le fichier d avant
//   4. annuler la feuille ne telecharge rien
//
// 🔤 `t` lit le VRAI `fr.js` (motif AD06) : les libelles sur lesquels ces
// temoins appuient — « Telecharger le fichier », « Retirer e-mails et
// telephones », « Annuler » — sont donc ceux du dictionnaire. Un temoin qui
// appuierait sur la clef brute resterait vert avec un ecran qui affiche
// « eventDetails.export.confirm » a l utilisateur.
// ==========================================================================

const mockUseAuth = jest.fn();
const mockEventQuery = { data: null };
const mockExportEventParticipants = jest.fn();

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ chemin) => String(chemin)
    .split('.')
    .reduce(
      (noeud, clef) => (noeud === null || noeud === undefined ? undefined : noeud[clef]),
      traductions,
    );
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ clef, /** @type {any} */ options) => {
        const valeur = lire(clef);
        if (typeof valeur === 'string') {
          return options && typeof options.count === 'number'
            ? valeur.replace('{{count}}', String(options.count))
            : valeur;
        }
        return typeof options === 'string' ? options : clef;
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

jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => {} }));

jest.mock('@tanstack/react-query', () => ({
  useIsMutating: () => 0,
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    options,
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    android: { actionViewIntent: jest.fn(() => Promise.resolve()) },
    config: jest.fn(),
    fs: { dirs: {} },
  },
}));

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockUseAuth() }));
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ sendMessage: jest.fn() }),
}));

const emptyQuery = () => ({
  data: null, isFetching: false, isLoading: false, refetch: jest.fn(),
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
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => emptyQuery(),
  useGetEventMyMatchResponse: () => emptyQuery(),
}));

// 🎯 LE MOUCHARD DU LOT : c est lui qui dit si un fichier part, et avec quoi.
jest.mock('@/services/event/eventService', () => ({
  approveFeatured: jest.fn(),
  exportEventParticipants: (/** @type {any[]} */ ...args) => mockExportEventParticipants(...args),
  rejectFeatured: jest.fn(),
}));

jest.mock('@/services/recruitment/recruitmentService', () => ({ applyToRecruitmentAd: jest.fn() }));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createCustomTournamentTeam: jest.fn(),
  registerClubTeamToTournament: jest.fn(),
  requestJoinTournamentTeam: jest.fn(),
  respondToTournamentTeam: jest.fn(),
  reviewTournamentTeamRegistration: jest.fn(),
}));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));
// ⚠️ Sous jest, `Platform.OS` vaut 'ios' : le chemin d export passe par le
// partage natif, et `share()` y est suivi d un `.catch`. Une doublure qui rend
// `undefined` fait exploser le processus 500 ms APRES la fin du fichier, hors
// de tout test — un plantage illisible. Elle rend donc une promesse.
jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: jest.fn(() => Promise.resolve()) },
}));
jest.mock('@/utils/performance/eventDetailsPerformance', () => ({
  markEventDetailsPerf: jest.fn(),
}));

jest.mock('../hooks/useEventMutations', () => {
  const idleMutation = () => ({ isPending: false, mutate: jest.fn() });
  return {
    useEventMutations: () => new Proxy({}, { get: () => idleMutation() }),
  };
});

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

// ⚠️ La feuille d export monte une VRAIE `BottomModal` : elle est doublee ici
// comme partout ailleurs (@gorhom/bottom-sheet ne monte pas sous jest). Elle
// ne rend ses enfants QUE si elle est visible — c est ce qui permet au temoin 1
// de distinguer « feuille ouverte » de « feuille absente ».
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

// 🪢 LE MAILLON 0. `EventParticipants` fait 784 lignes et monte toute la liste :
// on le double POUR L ECRAN, mais la doublure rend le MEME bouton que le vrai
// et le branche sur la MEME propriete. Le temoin 0 ci-dessous compare ensuite
// la doublure au vrai composant, monte pour de bon : c est ce qui interdit que
// cette doublure devienne un mensonge le jour ou le vrai bouton change de nom.
const LIBELLE_EXPORT = 'Exporter la liste (Excel/CSV)';

jest.mock('../components/EventParticipants', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function EventParticipantsDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { onPress: props.handleExportParticipants, testID: 'bouton-export' },
      react.createElement(rn.Text, null, 'Exporter la liste (Excel/CSV)'),
    );
  };
});

// eslint-disable-next-line import/first
import EventDetails from '../EventDetails';

jest.setTimeout(30000);

const CLUB_ID = 'club-1';
const TEAM_ID = 'team-1';
const COACH = 'coach-1';

const evenement = () => ({
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
  team: {
    club: { documentId: CLUB_ID },
    documentId: TEAM_ID,
    name: 'U15',
    players: [{ documentId: 'joueur-1' }],
    trainers: [{ documentId: COACH }],
  },
  type: { name: 'Match' },
});

const authCoach = () => ({
  canEditClub: () => true,
  canEditEvent: () => true,
  canManageEvent: () => true,
  freeUsageSummary: null,
  subscriptionAccessLevel: 'FREE',
  userData: { documentId: COACH, role: { name: 'Dirigeant' } },
});

/** @type {any[]} */
const montes = [];

const monter = () => {
  mockEventQuery.data = evenement();
  mockUseAuth.mockReturnValue(authCoach());
  /** @type {any} */
  let monte = null;
  act(() => {
    monte = renderer.create(
      <EventDetails
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: jest.fn(),
          setOptions: jest.fn(),
        }}
        route={{ params: { eventId: 'event-1' } }}
      />,
    );
  });
  montes.push(monte);
  return monte.root;
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

const textesVisibles = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node))
  .filter(Boolean);

const boutonPortant = (/** @type {any} */ root, /** @type {string} */ libelle) => root
  .findAllByProps({ accessibilityRole: 'button' })
  .find((/** @type {any} */ node) => textOf(node).includes(libelle));

const appuyer = (/** @type {any} */ root, /** @type {string} */ libelle) => {
  const bouton = boutonPortant(root, libelle);
  if (!bouton) {
    throw new Error(
      `Aucun bouton ne porte « ${libelle} ». Vu : ${textesVisibles(root).join(' | ')}`,
    );
  }
  act(() => { bouton.props.onPress(); });
};

const ouvrirLaFeuille = (/** @type {any} */ root) => {
  const bouton = root.findByProps({ testID: 'bouton-export' });
  act(() => { bouton.props.onPress(); });
};

const laCase = (/** @type {any} */ root) => root
  .findAllByProps({ accessibilityRole: 'checkbox' })
  .find((/** @type {any} */ node) => typeof node.props.onPress === 'function');

let alerte;

beforeEach(() => {
  mockExportEventParticipants.mockReset();
  mockExportEventParticipants.mockResolvedValue('/chemin/participants.xlsx');
  alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alerte.mockRestore();
  montes.splice(0).forEach((monte) => act(() => { monte.unmount(); }));
});

// ---------------------------------------------------------------------------
// 🪢 TEMOIN 0 — le VRAI bouton d `EventParticipants` appelle son declencheur.
// ---------------------------------------------------------------------------

describe('AD10 · temoin 0 — le maillon entre la liste et l ecran', () => {
  test('le vrai bouton « Exporter la liste » appelle handleExportParticipants', () => {
    const VraiEventParticipants = jest.requireActual('../components/EventParticipants').default;
    const declencheur = jest.fn();
    /** @type {any} */
    let monte = null;
    act(() => {
      monte = renderer.create(
        <VraiEventParticipants
          attendanceByUserId={{}}
          canApprovePendingRequests={false}
          canEdit
          event={evenement()}
          eventStartAt={null}
          externalParticipationSection={null}
          handleExportParticipants={declencheur}
          handleRemindPlayers={jest.fn()}
          handleShare={jest.fn()}
          handleUpdateParticipation={jest.fn()}
          handleUserPress={jest.fn()}
          nowMs={Date.parse('2026-08-21T10:00:00.000Z')}
          onCoachEditLate={jest.fn()}
          onCoachMarkArrival={jest.fn()}
          participantsSummary={{ capacity: 0, participatingCount: 0 }}
          participationsByStatus={{ missing: [], notAnswered: [], participating: [] }}
          pendingParticipations={[]}
          teamParticipationSections={[]}
        />,
      );
    });

    const bouton = monte.root
      .findAllByType(TouchableOpacity)
      .find((/** @type {any} */ node) => textOf(node).includes(LIBELLE_EXPORT));

    expect(bouton).toBeDefined();
    act(() => { bouton.props.onPress(); });
    expect(declencheur).toHaveBeenCalledTimes(1);

    act(() => { monte.unmount(); });
  });
});

// ---------------------------------------------------------------------------
// 🥇 TEMOIN 1 — appuyer OUVRE la feuille, et ne telecharge RIEN.
// ---------------------------------------------------------------------------

describe('AD10 · temoin 1 — « Exporter » ouvre la feuille au lieu de telecharger', () => {
  test('avant l appui, la feuille n existe pas a l ecran', () => {
    const root = monter();

    // On vise un texte que SEULE la feuille porte : le libelle du bouton de la
    // liste contient deja « Exporter la liste ».
    expect(textesVisibles(root).join(' | ')).not.toContain('Retirer e-mails et téléphones');
    expect(mockExportEventParticipants).not.toHaveBeenCalled();
  });

  test('l appui ouvre la feuille, nomme les 8 colonnes, et ne telecharge rien', () => {
    const root = monter();
    ouvrirLaFeuille(root);

    const vus = textesVisibles(root).join(' | ');
    expect(vus).toContain('Exporter la liste');
    expect(vus).toContain('Ce fichier contient des données personnelles');
    // Les 8 colonnes du classeur, nommees. Un avertissement vague ne permet a
    // personne de decider ; la liste nommee, si.
    ['Nom', 'Prénom', 'E-mail', 'Téléphone', 'Équipe', 'Statut', 'Portée', 'Poste']
      .forEach((colonne) => expect(vus).toContain(colonne));
    expect(vus).toContain('Retirer e-mails et téléphones');

    // 🥇 LE COEUR DU TEMOIN : aucun fichier n est parti.
    expect(mockExportEventParticipants).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 🥇 TEMOIN 2 — la bascule VOYAGE jusqu au tuyau.
// ---------------------------------------------------------------------------

describe('AD10 · temoin 2 — confirmer AVEC la bascule demande un fichier sans coordonnees', () => {
  test('cocher puis confirmer passe { withoutContacts: true } au tuyau', async () => {
    const root = monter();
    ouvrirLaFeuille(root);

    const caseACocher = laCase(root);
    expect(caseACocher).toBeDefined();
    expect(caseACocher.props.accessibilityState.checked).toBe(false);
    act(() => { caseACocher.props.onPress(); });
    expect(laCase(root).props.accessibilityState.checked).toBe(true);

    await act(async () => { appuyer(root, 'Télécharger le fichier'); });

    expect(mockExportEventParticipants).toHaveBeenCalledTimes(1);
    const [eventId, , options] = mockExportEventParticipants.mock.calls[0];
    expect(eventId).toBe('event-1');
    expect(options).toEqual({ withoutContacts: true });
  });

  test('la feuille se referme apres la confirmation', async () => {
    const root = monter();
    ouvrirLaFeuille(root);
    await act(async () => { appuyer(root, 'Télécharger le fichier'); });

    expect(textesVisibles(root).join(' | ')).not.toContain('Retirer e-mails et téléphones');
  });
});

// ---------------------------------------------------------------------------
// 🔒 TEMOIN 3 — NON-REGRESSION : sans la bascule, c est le fichier d avant.
// ---------------------------------------------------------------------------

describe('AD10 · temoin 3 — confirmer SANS la bascule redemande le fichier d avant', () => {
  test('sans cocher, le tuyau recoit { withoutContacts: false }', async () => {
    const root = monter();
    ouvrirLaFeuille(root);
    await act(async () => { appuyer(root, 'Télécharger le fichier'); });

    expect(mockExportEventParticipants).toHaveBeenCalledTimes(1);
    const [eventId, nom, options] = mockExportEventParticipants.mock.calls[0];
    expect(eventId).toBe('event-1');
    expect(nom).toBe('Match contre Saint-Julien');
    expect(options).toEqual({ withoutContacts: false });
  });

  test('la case repart DECOCHEE a chaque ouverture', async () => {
    const root = monter();

    ouvrirLaFeuille(root);
    act(() => { laCase(root).props.onPress(); });
    expect(laCase(root).props.accessibilityState.checked).toBe(true);
    appuyer(root, 'Annuler');

    ouvrirLaFeuille(root);
    expect(laCase(root).props.accessibilityState.checked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TEMOIN 4 — annuler ne telecharge rien.
// ---------------------------------------------------------------------------

describe('AD10 · temoin 4 — annuler la feuille ne telecharge rien', () => {
  test('« Annuler » referme la feuille sans aucun appel au tuyau', () => {
    const root = monter();
    ouvrirLaFeuille(root);

    appuyer(root, 'Annuler');

    expect(textesVisibles(root).join(' | ')).not.toContain('Retirer e-mails et téléphones');
    expect(mockExportEventParticipants).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// TEMOIN 5 — la clef qu AD06 avait posee D AVANCE pour AD01, et que personne
// n a jamais appelee.
//
// Compte rendu d AD06 (`git log`) : « eventDetails.attendanceBadge.selfArrived
// -> POUR AD01 : le libelle en dur vit dans EventDetails.js:1449, 1468, 1489,
// qui ne m appartient pas. La clef est posee, le site d appel n est PAS touche.
// Aucun garde-fou ne verifie les clefs inutilisees. »
//
// Mesure du 2026-08-21 : la clef existait, ACCENTUEE, avec ZERO appelant ; et
// les 3 boutons affichaient « Je suis arrive » — sans accent. C est le meme
// defaut que le reste du lot, pris par l autre bout : du travail livre que
// rien n atteint.
//
// 🔎 Ce temoin lit le TEXTE du fichier, il ne monte pas l ecran : les 3 sites
// vivent dans un `useMemo` qui ne se declenche que pour un joueur autorise a
// pointer son arrivee dans une fenetre de temps precise. Le monter couterait
// plus cher que ce qu il prouve. Assume, et dit.
// ---------------------------------------------------------------------------

describe('AD10 · temoin 5 — « Je suis arrivé·e » cesse d etre une chaine en dur', () => {
  test('aucun libelle « Je suis arrive » ne reste ecrit en dur dans EventDetails', () => {
    // eslint-disable-next-line global-require
    const fs = require('fs');
    // eslint-disable-next-line global-require
    const path = require('path');
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'EventDetails.js'),
      'utf8',
    );

    expect(source).not.toContain("'Je suis arrive'");
    expect(source.match(/t\('eventDetails\.attendanceBadge\.selfArrived'\)/g)).toHaveLength(3);
  });

  test('la clef existe et porte bien ses accents', () => {
    const fr = jest.requireActual('@/theme/strings/translations/fr').default;

    expect(fr.eventDetails.attendanceBadge.selfArrived).toBe('Je suis arrivé·e');
  });
});
