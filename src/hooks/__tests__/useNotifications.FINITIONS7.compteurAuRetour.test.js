import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { useNotificationController } from '../useNotificationController';
import useNotifications from '../useNotifications';

// ==========================================================================
// FINITIONS7 · POINT 2 (tournee 8, 🟡 reseau) — LE COMPTEUR DE LA CLOCHE SE
// RELISAIT EN DOUBLE A CHAQUE RETOUR AU PREMIER PLAN.
//
// 📏 Journal du relais T8 (T8_relay.log, 01/10) : 409 appels a
// `notifications/count-unread` pour 200 retours au premier plan — TOUJOURS par
// paires a la meme seconde, juste apres `in-app-popup-campaigns/active?trigger=
// app_foreground`, meme 8 s apres la paire precedente.
// 🧭 Cause : `invalidateNotificationQueries` (useNotifications.js) invalidait
// `['notifications']` — qui COUVRE aussi `['notifications', 'unread-count']`
// (correspondance par prefixe) — puis invalidait le compteur une seconde fois :
// la seconde invalidation ANNULE la lecture en vol et en relance une. Le serveur
// recoit donc deux requetes. Meme defaut que les deux hotes de rappels corriges
// par FINITIONS6 (`PromptHosts.FINITIONS6.appelsAuRetour.test.js`).
// ✅ Attendu : au retour, UNE lecture du compteur, et seulement s'il a plus de
// 45 s (la regle que la cloche applique deja quand on revient sur un ecran,
// `UNREAD_FOCUS_REFRESH_MIN_AGE_MS`). Une notification ouverte : une lecture.
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
  onMessage: () => () => {},
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

const vider = async () => {
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};

/**
 * Le telephone passe en arriere-plan puis revient, `secondes` apres le dernier geste.
 * @param {number} secondes - Le temps ecoule depuis le geste precedent.
 * @returns {Promise<void>}
 */
const sortirEtRevenir = async (secondes) => {
  jest.setSystemTime(Date.now() + (secondes * 1000));
  act(() => { ecouteurs.forEach((ecouter) => ecouter('background')); });
  act(() => { ecouteurs.forEach((ecouter) => ecouter('active')); });
  await vider();
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
  const client = new QueryClient({
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

describe('FINITIONS7 · point 2 — la cloche : une lecture au retour, pas deux', () => {
  test('au demarrage : une lecture du compteur, et l ecouteur de retour est pose', () => {
    expect(mockLireCompteur).toHaveBeenCalledTimes(1);
    expect(ecouteurs.length).toBeGreaterThan(0);
  });

  test('🚨 retour apres 60 s (compteur perime) : UNE seule lecture', async () => {
    await sortirEtRevenir(60);
    expect(mockLireCompteur).toHaveBeenCalledTimes(2);
  });

  test('🚨 retour 5 s apres une lecture (compteur frais) : AUCUNE lecture', async () => {
    await sortirEtRevenir(60);
    await sortirEtRevenir(5);
    expect(mockLireCompteur).toHaveBeenCalledTimes(2);
  });

  test('🚨 une notification ouverte depuis la barre : UNE lecture du compteur', async () => {
    expect(typeof mockOuvrirUneNotification).toBe('function');
    await act(async () => {
      /** @type {any} */ (mockOuvrirUneNotification)({ data: { type: 'event_reminder' } });
    });
    await vider();
    expect(mockLireCompteur).toHaveBeenCalledTimes(2);
  });

  test('la liste, qui n est pas a l ecran, n est jamais relue', async () => {
    await sortirEtRevenir(60);
    expect(mockLireListe).toHaveBeenCalledTimes(0);
  });
});
