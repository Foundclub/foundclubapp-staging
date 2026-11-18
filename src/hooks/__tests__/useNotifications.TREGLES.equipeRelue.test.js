import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { useNotificationController } from '../useNotificationController';
import useNotifications from '../useNotifications';

// ==========================================================================
// T-REGLES-EQUIPE (18/11/2026, point 9 B du chef, venu de T-NOTIFS-TOURNOI) — UNE
// NOTIFICATION DE TOURNOI QUI ARRIVE FAIT RELIRE L'EQUIPE QU'ELLE NOMME.
// Le capitaine a la page d'equipe ouverte dans la pile ; une « demande de rejoindre »
// arrive : sans invalidation de ['tournamentTeam', teamId], la demande n'est pas relue.
// Amorce copiee de useNotifications.FINITIONS7.compteurAuRetour.test.js (memes doubles).
// ==========================================================================

const mockLireCompteur = jest.fn(async () => ({ count: 2 }));
const mockLireListe = jest.fn(async () => ({
  data: [],
  meta: { pagination: { page: 1, pageCount: 1 } },
}));
const mockAddDeviceTokenForSession = jest.fn();
const mockGetToken = jest.fn();
/** @type {((message: any) => void) | null} */
let mockOuvrirUneNotification = null;
/** @type {((message: any) => Promise<void> | void) | null} */
let mockRecevoir = null;

jest.mock('@/services/notification/notificationService', () => ({
  deleteNotification: jest.fn(),
  getNotifications: () => mockLireListe(),
  getUnreadCount: () => mockLireCompteur(),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  // eslint-disable-next-line global-require
  const { useEffect } = require('react');
  return {
    // L ecran est deja au premier plan : l effet de focus tourne une fois au montage.
    useFocusEffect: (/** @type {() => void} */ effet) => { useEffect(effet, [effet]); },
  };
});

// MSGNOTIF (20/10) — useNotifications relit le fil du message qu'on ouvre
// (`rattrapageDuFil` → chatService → client HTTP) : le client est double, sinon
// sa configuration d'URL fait tomber la suite des son chargement.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/services/auth/authService', () => ({
  addDeviceToken: jest.fn(async () => ({ data: { documentId: 'inst-1' } })),
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
  onMessage: (/** @type {any} */ _messagerie, /** @type {any} */ ecouter) => {
    mockRecevoir = ecouter;
    return () => {};
  },
  onNotificationOpenedApp: (/** @type {any} */ _messagerie, /** @type {any} */ ecouter) => {
    mockOuvrirUneNotification = ecouter;
    return () => {};
  },
  onTokenRefresh: () => () => {},
  requestPermission: jest.fn(),
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    cancelNotification: jest.fn(),
    createChannel: jest.fn(),
    displayNotification: jest.fn(),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    onForegroundEvent: jest.fn(() => () => {}),
  },
  EventType: { DISMISSED: 0, PRESS: 1 },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'user-doc-1', id: 1 } }),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  activateSessionByDocumentId: jest.fn(),
  NOTIFICATION_TYPES: { TOURNAMENT_TEAM_JOIN_REQUEST: 'tournamentTeamJoinRequest' },
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

// Sans ce mock, `ENABLE_PUSH_NOTIFICATIONS` retombe sur false en test et le hook
// ne pose meme pas son ecouteur de retour au premier plan.
jest.mock('@/constants/runtimeFlags', () => ({
  ...jest.requireActual('@/constants/runtimeFlags'),
  APP_RUNTIME_ENV: 'staging',
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_SMART_NOTIFICATIONS: false,
}));

jest.mock('@/store/appContext', () => {
  // eslint-disable-next-line global-require
  const { useReducer } = require('react');
  const etatInitial = {
    activeSessionDocumentId: null,
    authSessions: [],
    fcmToken: undefined,
    pendingNotification: null,
  };
  const reducteur = (/** @type {any} */ state, /** @type {any} */ action) => {
    if (action.type === 'SET_FCM_TOKEN') return { ...state, fcmToken: action.payload };
    if (action.type === 'SET_PENDING_NOTIFICATION') {
      return { ...state, pendingNotification: action.payload };
    }
    return state;
  };
  return {
    useAppContext: () => useReducer(reducteur, etatInitial),
  };
});

jest.mock('@/context/PopupManagerContext', () => {
  const eligibilite = {
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
    usePopupEligibility: () => eligibilite,
    usePopupManager: () => ({ isStartupWindowActive: false }),
  };
});

const DEPART = new Date('2026-10-02T08:00:00.000Z').getTime();
/** @type {Array<(etat: string) => void>} */
let ecouteurs = [];
/** @type {any} */
let arbre;
/** @type {any} */
let client;

const vider = async () => {
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};

/**
 * Monte ce que l app monte : l amorce des notifications et la cloche.
 * @returns {null} Aucun rendu.
 */
function AmorceEtCloche() {
  useNotifications({ navigate: () => true });
  // Les options de `NotificationBadge` : la liste n est pas chargee, le compteur l est.
  useNotificationController({ notificationsEnabled: false, skipInitialFocusRefresh: true });
  return null;
}

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(DEPART);
  mockLireCompteur.mockClear();
  mockLireListe.mockClear();
  mockGetToken.mockResolvedValue('FCM-TOKEN-DE-TEST-0123456789');
  mockAddDeviceTokenForSession.mockResolvedValue({ ok: true });
  mockOuvrirUneNotification = null;
  ecouteurs = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, ecouter) => {
    ecouteurs.push(/** @type {any} */ (ecouter));
    return /** @type {any} */ ({
      remove: () => { ecouteurs = ecouteurs.filter((e) => e !== ecouter); },
    });
  });
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <AmorceEtCloche />
      </QueryClientProvider>,
    );
  });
  await vider();
});

afterEach(() => {
  act(() => arbre.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const CLE = (/** @type {string} */ teamId) => JSON.stringify(['tournamentTeam', teamId]);
const relitLEquipe = (/** @type {any} */ espion, /** @type {string} */ teamId) => espion.mock.calls
  .some(([options]) => JSON.stringify(options?.queryKey) === CLE(teamId));

describe('T-REGLES-EQUIPE point 9 B — la notification de tournoi relit son equipe', () => {
  test('🔴 au premier plan : « demande de rejoindre » pour tt-1 => son equipe relue', async () => {
    const espion = jest.spyOn(client, 'invalidateQueries');
    expect(typeof mockRecevoir).toBe('function');
    await act(async () => {
      await /** @type {any} */ (mockRecevoir)({
        data: { eventId: 'evt-1', teamId: 'tt-1', type: 'tournamentTeamJoinRequest' },
      });
    });
    await vider();
    expect(relitLEquipe(espion, 'tt-1')).toBe(true);
  });

  test('🔴 ouverte depuis la barre : la meme equipe est relue', async () => {
    const espion = jest.spyOn(client, 'invalidateQueries');
    await act(async () => {
      /** @type {any} */ (mockOuvrirUneNotification)({
        data: { eventId: 'evt-1', teamId: 'tt-2', type: 'tournamentTeamJoinRequest' },
      });
    });
    await vider();
    expect(relitLEquipe(espion, 'tt-2')).toBe(true);
  });

  test('une notification qui n est pas de tournoi ne relit aucune equipe de tournoi', async () => {
    const espion = jest.spyOn(client, 'invalidateQueries');
    await act(async () => {
      await /** @type {any} */ (mockRecevoir)({ data: { teamId: 'tt-1', type: 'event_reminder' } });
    });
    await vider();
    expect(relitLEquipe(espion, 'tt-1')).toBe(false);
  });
});
