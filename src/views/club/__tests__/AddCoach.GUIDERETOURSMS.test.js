import { AppState, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceInteraction,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import { RouteNames } from '@/navigation/routeNames';

import { createTrainer } from '@/services/auth/authService';

import { TourProvider, useTour } from '../../../context/TourContext';
import AddCoach from '../AddCoach';

// GUIDE-RETOUR-SMS (M1181, iPhone 2.6.99, 12/11 17:07) : guide Dirigeant·e, M2. « Inviter » ouvre
// la messagerie ; au retour dans l'app, la mission était revenue à « Touche le « + » » (25 %).
// Cause : le numéro saisi avait déjà un compte. Dans la 2.6.99, ce cas (« déjà inscrit ») ouvre la
// feuille SANS rien dire au guide ; « Inviter » revient sur Staff (route `Club`), et cette sortie
// du formulaire renvoie le guide à `m2-add`. L'arrière-plan n'y est pour rien.
// Le témoin joue l'ÉCRAN RÉEL dans le VRAI guide, chaque version contre la réponse de SON serveur :
// la 2.6.99 appelle `createTrainer` (refus PHONE_NUMBER_TAKEN pour un numéro inscrit) ; le
// train 9 appelle `sendStaffInvitation` (INVITE-STAFF : même réponse, inscrit ou non).

const mockNavigate = jest.fn(() => true);
jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
}));
jest.mock('@/domains/tour/presidentGuideSettings', () => {
  const actual = jest.requireActual('@/domains/tour/presidentGuideSettings');
  const settings = { ...actual.PRESIDENT_GUIDE_SETTINGS, enabled: true };
  return { __esModule: true, default: settings, PRESIDENT_GUIDE_SETTINGS: settings };
});

const mockStore = new Map();
jest.mock('@/store/appContext', () => ({
  storage: {
    delete: (key) => mockStore.delete(key),
    getString: (key) => (mockStore.has(key) ? mockStore.get(key) : undefined),
    set: (key, value) => mockStore.set(key, value),
  },
}));

/** @type {any[]} */
const mockPhoneProps = [];
/** @type {any[]} */
const mockInvitedModalProps = [];
/** @type {any} */
let mockNavigation;

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const t = (/** @type {string} */ cle, /** @type {any} */ repli) => {
    const valeur = String(cle).split('.').reduce(
      (/** @type {any} */ noeud, /** @type {string} */ segment) => (
        noeud === null || noeud === undefined ? undefined : noeud[segment]
      ),
      traductions,
    );
    if (typeof valeur === 'string') return valeur;
    return typeof repli === 'string' ? repli : cle;
  };
  return { useTranslation: () => ({ t }) };
});

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
      Images: { camera: 1, plus: 1, trash: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/theme/strings', () => ({ Joi: jest.requireActual('joi') }));

const mockAuth = {
  formatBirthdateToDisplay: (/** @type {string} */ texte) => texte,
  invitationDuStaff: () => ({ message: 'Rejoins le club' }),
  inviteTrainer: jest.fn(),
  subscriptionAccessLevel: 'CLUB',
  userData: {
    club: { documentId: 'club-1', name: 'SMUC' },
    documentId: 'user-1',
    firstname: 'Sam',
    role: { name: 'President', type: 'president' },
  },
};
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((/** @type {any} */ data) => options.onSuccess?.(data, variables))
      .catch((/** @type {any} */ error) => options.onError?.(error, variables)),
  }),
}));

jest.mock('@/services/auth/authService', () => ({
  createManager: jest.fn(),
  createTrainer: jest.fn(),
  linkManagerToClub: jest.fn(),
  linkTrainerToClub: jest.fn(),
}));

// Serveur du train 9 (INVITE-STAFF) : la même réponse, que le numéro ait un compte ou non.
// `virtual` : le module n'existe pas dans la 2.6.99, où le témoin tourne aussi.
jest.mock('@/services/staffInvitation/staffInvitationService', () => ({
  sendStaffInvitation: jest.fn(async () => ({
    invitation: { expiresAt: '2026-11-19T12:00:00.000Z', phoneHint: '33' },
    sent: true,
  })),
}), { virtual: true });

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({
    data: { documentId: 'club-1', name: 'SMUC' }, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock(/** @type {any} */ props) { return props.children; },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/input/Input', () => function InputMock() { return null; });
jest.mock('@/components/organisms/phoneInput/PhoneInput', () => function PhoneInputMock(
  /** @type {any} */ props,
) {
  mockPhoneProps.push(props);
  return null;
});
jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => function SelectAvatarMock() {
  return null;
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);
jest.mock(
  '@/components/organisms/trainerInvitedModal/TrainerInvitedModal',
  () => function TrainerInvitedModalMock(/** @type {any} */ props) {
    mockInvitedModalProps.push(props);
    return null;
  },
);
// Récolte T10 : AddCoach importe Select depuis INVITE-STAFF-DESIGN (doublure comme
// AddCoach.GUIDEDCORR3).
jest.mock('@/components/molecules/select/Select', () => () => null);
jest.mock('@/views/club/components/ClubStateView', () => function ClubStateViewMock() {
  return null;
});

/** @type {any} */
let tour;
/**
 * Sonde : lit le guide.
 * @returns {null} Rien à rendre.
 */
function Probe() {
  tour = useTour();
  return null;
}

/** @type {Array<(state: string) => void>} */
let appStateHandlers;
/** @type {any} */
let tree;

const dernieres = (/** @type {any[]} */ journal) => journal[journal.length - 1];
const stepId = () => tour.currentStep?.id;
const next = () => act(() => { tour.completeCurrentStep(); });

/**
 * Le dirigeant joue M2 jusqu'à « Envoyer l'invitation », sur l'écran réel.
 * @returns {Promise<void>}
 */
const jouerJusquAEnvoi = async () => {
  await act(async () => {
    tree = renderer.create(
      <TourProvider>
        <Probe />
        <AddCoach
          navigation={mockNavigation}
          route={{ name: RouteNames.AddCoach, params: { clubId: 'club-1' } }}
        />
      </TourProvider>,
    );
  });
  act(() => { tour.startTour('president', { fromMission: 'president_m2' }); });
  // Staff ouvert, puis « + » : l'écran du formulaire.
  act(() => { emitGuidanceInteraction('club.section.staff'); });
  act(() => { emitGuidanceRouteVisit(RouteNames.AddCoach); });
  next();
  await act(async () => { dernieres(mockPhoneProps).onChange('06 33 33 33 33'); });
  next();
  expect(stepId()).toBe('m2-send');
  const envoyer = tree.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .find((/** @type {any} */ noeud) => noeud.findAllByType(Text)
      .some((/** @type {any} */ texte) => String(texte.props.children).startsWith('Envoyer')));
  await act(async () => { envoyer.props.onPress(); });
};

/**
 * « Inviter », la messagerie s'ouvre, l'app revient sur Staff, puis au premier plan.
 * @returns {Promise<void>}
 */
const inviterPuisRevenir = async () => {
  const feuille = dernieres(mockInvitedModalProps);
  expect(feuille.isVisible).toBe(true);
  await act(async () => { feuille.onInvite(); });
  act(() => {
    appStateHandlers.forEach((handler) => handler('inactive'));
    appStateHandlers.forEach((handler) => handler('background'));
    appStateHandlers.forEach((handler) => handler('active'));
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockStore.clear();
  mockNavigate.mockClear();
  mockPhoneProps.length = 0;
  mockInvitedModalProps.length = 0;
  resetGuidanceRuntimeForTests();
  resetTourTargetsForTests();
  tour = undefined;
  appStateHandlers = [];
  // La flèche de retour de la pile : l'app revient sur Staff (`onStateChange` de App.js).
  mockNavigation = {
    goBack: jest.fn(() => emitGuidanceRouteVisit(RouteNames.Club)),
    navigate: jest.fn(),
  };
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, handler) => {
    appStateHandlers.push(/** @type {any} */ (handler));
    return /** @type {any} */ ({ remove: jest.fn() });
  });
});

afterEach(() => {
  act(() => { jest.runOnlyPendingTimers(); });
  act(() => tree?.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('GUIDE-RETOUR-SMS : M2 ne repart pas du début au retour de la messagerie', () => {
  it('numéro déjà inscrit (cas d Adel) : M2 comptée, la suite est M3, pas « + »', async () => {
    /** @type {any} */ (createTrainer).mockRejectedValue(Object.assign(new Error('taken'), {
      details: { code: 'PHONE_NUMBER_TAKEN', sameClub: false },
    }));
    await jouerJusquAEnvoi();
    await inviterPuisRevenir();
    expect(stepId()).not.toBe('m2-add');
    expect(tour.missionStatus.president_m2).toBe('done');
    act(() => { jest.runOnlyPendingTimers(); });
    expect(stepId()).toBe('m2-back');
  });

  it('numéro sans compte : même issue', async () => {
    /** @type {any} */ (createTrainer).mockResolvedValue({ documentId: 'u-1', firstname: 'Luc' });
    await jouerJusquAEnvoi();
    await inviterPuisRevenir();
    expect(tour.missionStatus.president_m2).toBe('done');
    act(() => { jest.runOnlyPendingTimers(); });
    expect(stepId()).toBe('m2-back');
  });
});
