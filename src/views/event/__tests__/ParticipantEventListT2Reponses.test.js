import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';

// 🌊 LOT T2 (recette d Adel du 2026-08-26) — « les boutons Présent·e / Absent·e
// de la carte du planning ne répondent pas ».
//
// 🪤 POURQUOI UN FICHIER NEUF, ET PAS UN AJOUT DANS `ParticipantEventListS8`.
//
// Ce voisin double `@tanstack/react-query` EN BLOC et fait rendre
// `data: undefined` à `useGetEvents` : AUCUNE carte n y est montée, et sa
// doublure de `ParticipantEventListDeferred` remplace `EventCardNew` par un
// bout de texte. Il ne peut donc RIEN prouver sur un appui — même tout vert.
// Ici, on monte la VRAIE carte, avec ses VRAIS boutons de réponse, et on suit
// l appui jusqu au service : quelle route, quelles invalidations, quel état.
//
// 📏 CE QUI ÉTAIT MESURÉ AVANT CE LOT (26/08) :
//   D1 — « Présent » appelait `createEventParticipation` (porte des DEMANDES,
//        le serveur y pose `pending`) au lieu de `POST /events/:id/rsvp`.
//   D2 — « Absent » était branché sur `() => {}` : une fonction VIDE.
//   D3 — l invalidation oubliait `['eventAttendance', eventId]`.
//   D4 — `onEditAnswer` n était jamais passé ⇒ aucun retour en arrière.
//   D5 — aucun retour visuel pendant l appel.
//   D6 — un garde sans `else` : identité manquante = rien du tout, en silence.

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { linear: jest.fn() },
    useAnimatedStyle: (/** @type {any} */ f) => (typeof f === 'function' ? f() : {}),
    useSharedValue: (/** @type {any} */ value) => ({ value }),
    withTiming: (/** @type {any} */ value) => value,
  };
});

jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (/** @type {any} */ url) => url }));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {any} */ key, /** @type {any} */ repli) => repli || key,
  }),
}));

const mockUserData = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ canManageEvents: false, userData: mockUserData() }),
}));

const mockDejaJoint = jest.fn(() => false);
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: () => false,
    haveIAlreadyJoined: () => mockDejaJoint(),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

const mockEvenements = jest.fn(() => []);
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvents: () => ({
    data: { pages: [{ data: mockEvenements() }] },
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isError: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

// 🚪 LES DEUX PORTES, CÔTE À CÔTE. Tout le lot tient dans la question « laquelle
// a été frappée ? » : `respondToEventRsvp` inscrit tout de suite, alors que
// `createEventParticipation` dépose une demande que le serveur laisse `pending`.
const mockRepondreRsvp = jest.fn(() => Promise.resolve({}));
const mockDeclarerAbsent = jest.fn(() => Promise.resolve({}));
jest.mock('@/services/event/eventService', () => ({
  missingEvent: (/** @type {any} */ eventId) => mockDeclarerAbsent(eventId),
  respondToEventRsvp: (
    /** @type {any} */ eventId,
    /** @type {any} */ reponse,
  ) => mockRepondreRsvp(eventId, reponse),
}));

const mockCreerDemande = jest.fn(() => Promise.resolve({}));
jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: (/** @type {any} */ charge) => mockCreerDemande(charge),
}));

jest.mock('@/services/reservation/reservationService', () => ({
  joinReservation: jest.fn(() => Promise.resolve({})),
}));

// 🎛️ Le double de react-query joue VRAIMENT la mutation, puis son `onSuccess` :
// c est ce qui rend les invalidations observables. `mockEnVol` permet en plus
// de figer une mutation « en cours » pour constater l état de chargement.
const mockInvalider = jest.fn();
const mockEnVol = { cle: '', variables: undefined };
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    const cle = String(options?.mutationKey?.[1] || '');
    const enVol = Boolean(cle) && mockEnVol.cle === cle;
    const executer = async (/** @type {any} */ variables) => {
      const donnees = await options?.mutationFn?.(variables);
      options?.onSuccess?.(donnees, variables);
      return donnees;
    };
    return {
      isPending: enVol,
      mutate: (/** @type {any} */ variables) => { executer(variables); },
      mutateAsync: executer,
      variables: enVol ? mockEnVol.variables : undefined,
    };
  },
  useQueryClient: () => ({
    invalidateQueries: (/** @type {any} */ arg) => mockInvalider(arg),
    setQueryData: jest.fn(),
  }),
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingActionContainerStyle: () => ({}),
}));

// 🎯 LA DIFFÉRENCE AVEC LE TÉMOIN VOISIN : `EventCardNew` est le VRAI. Les six
// autres feuilles de ce module différé restent doublées — elles ne portent
// aucun bouton de réponse.
jest.mock('@/views/event/ParticipantEventListDeferred', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  const doublure = (/** @type {string} */ nom) => function Doublure() {
    return react.createElement(rn.Text, null, nom);
  };
  return {
    DateSlider: doublure('DOUBLURE_DateSlider'),
    EventCardNew: jest.requireActual('@/components/molecules/eventCard/EventCardNew').default,
    FeaturedEvents: doublure('DOUBLURE_FeaturedEvents'),
    JoinEventModal: doublure('DOUBLURE_JoinEventModal'),
    LeagueHeaderSwitch: doublure('DOUBLURE_LeagueHeaderSwitch'),
    NotificationBadge: doublure('DOUBLURE_NotificationBadge'),
    ProfileButton: doublure('DOUBLURE_ProfileButton'),
  };
});

/* eslint-disable global-require */
jest.mock(
  '@/views/event/PlanningOnboardingWrapper',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function PlanningOnboardingWrapperDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function ScreenContainerDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '@/components/atoms/errorWrapper/ErrorWrapper',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function ErrorWrapperDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '@/components/organisms/planning/PersonalPlanningContainer',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_PersonalPlanning'),
);
jest.mock(
  '@/components/atoms/emptyState/EmptyState',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EmptyState'),
);
jest.mock(
  '@/components/atoms/webFloatingOverlay/WebFloatingOverlay',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_WebFloatingOverlay'),
);
/* eslint-enable global-require */

// eslint-disable-next-line import/first
import ParticipantEventList from '../ParticipantEventList';

jest.setTimeout(30000);

const MOI = 'moi';
const joueurConvie = { documentId: MOI, role: { name: USER_ROLES.player } };

/**
 * Un entraînement de MON équipe : le cas du constat d Adel.
 *
 * `players` me contient ⇒ `resolveParticipationFlow` rend `rsvpPresent`, et
 * `sessionStatus: 'closed'` fait apparaître la rangée Présent·e / Absent·e.
 * @param {string} documentId - L identifiant de l événement.
 * @returns {any} - L événement.
 */
const entrainementDeMonEquipe = (documentId) => ({
  capacity: 14,
  date: '2099-08-26T17:00:00',
  documentId,
  endTime: '19:00:00',
  missings: [],
  name: `Entrainement ${documentId}`,
  participationRequests: [],
  participations: [],
  sessionStatus: 'closed',
  startTime: '17:00:00',
  team: {
    activities: [{ name: 'Football' }],
    club: { name: 'FC Marseille Nord' },
    documentId: 'team-1',
    name: 'Senior A',
    players: [{ documentId: MOI }],
    trainers: [],
  },
  type: { name: 'Entrainement' },
  validationMode: 'manual',
});

const navigationDouble = {
  addListener: () => () => {},
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
};

/** @type {any} */
let arbreMonte = null;

/**
 * Monte « Mon planning » avec les événements donnés.
 *
 * 🪤 L arbre est retenu ici pour être DÉMONTÉ après chaque témoin : la liste
 * virtualisée programme un `Batchinator` qui, s il tire après la fermeture de
 * l environnement Jest, fait tomber le processus entier (« InteractionManager
 * .runAfterInteractions is not a function ») — et aucun résultat n est alors
 * imprimé, même pour les témoins qui étaient passés.
 * @param {any[]} evenements - Les événements servis par la requête.
 * @returns {any} - L arbre rendu.
 */
const monter = (evenements) => {
  mockEvenements.mockImplementation(() => evenements);
  act(() => {
    arbreMonte = renderer.create(<ParticipantEventList navigation={navigationDouble} />);
  });
  return arbreMonte;
};

/**
 * Tous les boutons portant ce titre, dans l ordre du rendu.
 * @param {any} arbre - L arbre rendu.
 * @param {string} titre - Le titre du bouton.
 * @returns {any[]} - Les boutons trouvés.
 */
const boutons = (arbre, titre) => arbre.root
  .findAllByType(Button)
  .filter((/** @type {any} */ noeud) => noeud.props.title === titre);

describe('T2 — les boutons de réponse de la carte « Mon planning »', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserData.mockReturnValue(joueurConvie);
    mockDejaJoint.mockReturnValue(false);
    mockEnVol.cle = '';
    mockEnVol.variables = undefined;
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    if (arbreMonte) act(() => arbreMonte.unmount());
    arbreMonte = null;
  });

  it('D1 — « Présent » frappe la porte des RÉPONSES, pas celle des demandes', async () => {
    const arbre = monter([entrainementDeMonEquipe('evt-1')]);

    const present = boutons(arbre, 'eventList.actions.present');
    expect(present).toHaveLength(1);

    await act(async () => {
      present[0].props.onPress();
    });

    // La BONNE porte : `POST /events/evt-1/rsvp`, qui inscrit immédiatement.
    expect(mockRepondreRsvp).toHaveBeenCalledWith('evt-1', 'present');
    // ⛔ Et surtout PAS celle des demandes, qui rendait « Demande en attente ».
    expect(mockCreerDemande).not.toHaveBeenCalled();
  });

  it('D3 — répondre invalide AUSSI le pointage de cet événement', async () => {
    const arbre = monter([entrainementDeMonEquipe('evt-1')]);

    await act(async () => {
      boutons(arbre, 'eventList.actions.present')[0].props.onPress();
    });

    const clesInvalidees = mockInvalider.mock.calls
      .map((/** @type {any} */ appel) => JSON.stringify(appel[0]?.queryKey));

    expect(clesInvalidees).toContain(JSON.stringify(['events']));
    expect(clesInvalidees).toContain(JSON.stringify(['planning', 'personal']));
    // 🧊 Celle qui manquait : sans elle, le pointage garde son ancien
    // instantané et affiche « Arrivé » à qui vient de répondre.
    expect(clesInvalidees).toContain(JSON.stringify(['eventAttendance', 'evt-1']));
  });
});
