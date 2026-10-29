// NOTIF-PREDEMANDE (29/10/2026, decision d'Adel « 2- A ») — plus AUCUNE demande systeme a la
// connexion : la fenetre systeme ne s'ouvre qu'apres « Activer » sur notre ecran.
// Banc repris de useNotifications.BH01.preautorisation.test.js (memes doublures).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PermissionsAndroid, Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { forgetDeviceRegistrationsExcept } from '@/utils/notifications/deviceRegistrationMemory';
import { lireMemoirePreDemande } from '@/utils/notifications/preDemandeNotifications';

import { setItem } from '@/platform/storage';
import useNotifications from '../useNotifications';
// et fait tomber la SUITE ENTIERE (0 test execute).

const mockAddDeviceToken = jest.fn();
const mockAddDeviceTokenForSession = jest.fn();
const mockGetToken = jest.fn();
const mockRequestPermission = jest.fn();
const mockReglagesIos = jest.fn();

const mockUserData = { documentId: 'user-doc-1', id: 1 };
// Les sessions du telephone au montage (FCMSYNC) ; vide pour les temoins FCMSTORM.
let mockSessions = [];
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/services/auth/authService', () => ({
  addDeviceToken: (...args) => mockAddDeviceToken(...args),
  addDeviceTokenForSession: (...args) => mockAddDeviceTokenForSession(...args),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: () => ({ name: '[DEFAULT]' }),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({
    isDeviceRegisteredForRemoteMessages: true,
    registerDeviceForRemoteMessages: jest.fn(),
  }),
  getToken: (...args) => mockGetToken(...args),
  onMessage: () => () => {},
  onNotificationOpenedApp: () => () => {},
  onTokenRefresh: () => () => {},
  requestPermission: (...args) => mockRequestPermission(...args),
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    cancelNotification: jest.fn(),
    createChannel: jest.fn(),
    displayNotification: jest.fn(),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    getNotificationSettings: (...args) => mockReglagesIos(...args),
    onForegroundEvent: jest.fn(() => () => {}),
  },
  EventType: { DISMISSED: 0, PRESS: 1 },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  activateSessionByDocumentId: jest.fn(),
  NOTIFICATION_TYPES: {},
}));

jest.mock('@/domains/refresh/afterAction', () => ({
  invalidateAfterAction: jest.fn(() => Promise.resolve()),
  resolveNotificationRefreshAction: () => null,
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  emitCelebrationFromNotificationPayload: jest.fn(),
}));

jest.mock('@/services/notificationActions/rsvpActions', () => ({
  consumePendingOpenNotification: () => null,
  displayChatReplyActionableNotification: jest.fn(),
  displayEventRsvpActionableNotification: jest.fn(),
  ensureNotificationActionSetup: () => Promise.resolve(),
  handleChatReplyActionPress: jest.fn(),
  handleEventRsvpActionPress: jest.fn(),
  // RESA-L6B-1 — les boutons de N-20.
  displayResaVeilleActionableNotification: jest.fn(),
  handleResaVeilleActionPress: jest.fn(async () => ({ handled: false })),
  isChatReplyActionablePayload: () => false,
  isEventRsvpActionablePayload: () => false,
  isResaVeilleActionablePayload: () => false,
}));

jest.mock('@/utils/bootDiagnostics', () => ({
  persistDiagnosticError: jest.fn(),
}));

// En test, `ENABLE_PUSH_NOTIFICATIONS` retombe sur false (aucune variable
// d'environnement) : sans ce mock le hook sort avant meme d'aller chercher un
// jeton, et les quatre temoins mesureraient zero appel pour la mauvaise raison.
jest.mock('@/constants/runtimeFlags', () => ({
  ...jest.requireActual('@/constants/runtimeFlags'),
  APP_RUNTIME_ENV: 'staging',
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_SMART_NOTIFICATIONS: false,
}));

// `useNotificationController` tire `notificationService` -> `client.native.js`,
// qui exige API_URL : absent de tout worktree (`.env` est gitignore). Sans ce
// mock, la SUITE ENTIERE meurt avant d'executer un seul test.
jest.mock('@/hooks/useNotificationController', () => ({
  NOTIFICATIONS_QUERY_KEY: ['notifications'],
  UNREAD_COUNT_QUERY_KEY: ['notifications', 'unread-count'],
}));

// Le magasin global, reproduit A L'IDENTIQUE de `src/store/appReducer.js:207-211` :
// `SET_FCM_TOKEN` rend `{ ...state, fcmToken }`, donc un OBJET NEUF a chaque
// envoi — meme quand le jeton etait deja vide. C'est ce detail qui fait
// re-rendre le hook a chaque refus, et c'est la pompe du bombardement.
jest.mock('@/store/appContext', () => {
  // Une fabrique jest.mock ne peut pas fermer sur un import de haut niveau :
  // jest hisse les mocks au-dessus des imports.
  // eslint-disable-next-line global-require
  const { useReducer } = require('react');
  const etatInitial = {
    activeSessionDocumentId: null,
    authSessions: [],
    fcmToken: undefined,
    pendingNotification: null,
  };
  const reducteur = (state, action) => {
    if (action.type === 'SET_FCM_TOKEN') {
      const token = typeof action.payload === 'string' ? action.payload.trim() : '';
      const safeToken = token.length > 0 && token.length <= 8192 ? token : undefined;
      return { ...state, fcmToken: safeToken };
    }
    if (action.type === 'SET_PENDING_NOTIFICATION') {
      return { ...state, pendingNotification: action.payload };
    }
    return { ...state };
  };
  return {
    useAppContext: () => useReducer(reducteur, undefined, () => ({
      ...etatInitial,
      authSessions: mockSessions,
    })),
  };
});

// `usePopupEligibility` rend un objet MEMOISE — mais sa memo depend de
// `recordPopupEvent`, lui-meme refait des que `currentRouteName` ou
// `startupPhase` change (PopupManagerContext.js:79-87, :166-183). Autrement dit :
// A CHAQUE CHANGEMENT D'ECRAN, l'objet est neuf.
// C'est la pompe de production, et `mockEligibiliteInstable` la rallume.
const mockEligibiliteInstable = false;

jest.mock('@/context/PopupManagerContext', () => {
  const eligibiliteStable = {
    canShow: false,
    clearDismissal: () => {},
    descriptor: {},
    dismiss: () => {},
    isBlockedByStartupPhase: false,
    isDeferred: false,
    isDismissed: false,
    isRouteBlocked: false,
    isStartupWindowActive: false,
    markShown: () => {},
    trackEvent: () => {},
  };
  return {
    usePopupEligibility: () => (
      mockEligibiliteInstable ? { ...eligibiliteStable } : eligibiliteStable
    ),
    usePopupManager: () => ({ isStartupWindowActive: false }),
  };
});

let resultat;
/**
 * Sonde : fait vivre le hook et garde ce qu'il rend.
 * @returns {null} Aucun rendu.
 */
function Sonde() {
  resultat = useNotifications({ navigate: () => true });
  return null;
}

const monter = async () => {
  const queryClient = new QueryClient();
  let tree;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={queryClient}><Sonde /></QueryClientProvider>,
    );
  });
  await act(async () => { await Promise.resolve(); });
  return () => {
    act(() => tree.unmount());
    queryClient.clear();
  };
};

beforeEach(() => {
  jest.restoreAllMocks();
  mockRequestPermission.mockReset();
  mockReglagesIos.mockReset();
  mockGetToken.mockResolvedValue('FCM-TOKEN-DE-TEST-0123456789');
  mockAddDeviceTokenForSession.mockResolvedValue({ ok: true });
  mockSessions = [];
  forgetDeviceRegistrationsExcept([]);
  setItem('notif_predemande_v1', '');
});

test('iPhone, permission jamais demandee : la connexion n ouvre PAS la fenetre systeme', async () => {
  Platform.OS = 'ios';
  mockReglagesIos.mockResolvedValue({ authorizationStatus: -1 });
  const demonter = await monter();
  expect(mockRequestPermission).not.toHaveBeenCalled();
  expect(mockGetToken).not.toHaveBeenCalled();
  demonter();
});

test('Android, permission jamais demandee : la connexion n ouvre PAS la fenetre systeme', async () => {
  Platform.OS = 'android';
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  const demander = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
  const demonter = await monter();
  expect(demander).not.toHaveBeenCalled();
  demonter();
});

test('iPhone : « Activer » (activerNotifications) ouvre la fenetre systeme puis prend le jeton', async () => {
  Platform.OS = 'ios';
  mockReglagesIos.mockResolvedValue({ authorizationStatus: -1 });
  const demonter = await monter();
  mockRequestPermission.mockImplementation(async () => {
    mockReglagesIos.mockResolvedValue({ authorizationStatus: 1 });
    return 1;
  });
  let statut;
  await act(async () => { statut = await resultat.activerNotifications(); });
  expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  expect(mockGetToken).toHaveBeenCalled();
  expect(statut).toBe('success');
  demonter();
});

test('Android : « Activer » demande, et un « ne plus demander » est retenu', async () => {
  Platform.OS = 'android';
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  const demander = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('never_ask_again');
  const demonter = await monter();
  let statut;
  await act(async () => { statut = await resultat.activerNotifications(); });
  expect(demander).toHaveBeenCalledTimes(1);
  expect(statut).toBe('denied');
  expect(lireMemoirePreDemande().refusDefinitif).toBe(true);
  demonter();
});

test('permission deja accordee : la connexion prend le jeton sans rien demander', async () => {
  Platform.OS = 'ios';
  mockReglagesIos.mockResolvedValue({ authorizationStatus: 1 });
  const demonter = await monter();
  expect(mockRequestPermission).not.toHaveBeenCalled();
  expect(mockGetToken).toHaveBeenCalled();
  demonter();
});
