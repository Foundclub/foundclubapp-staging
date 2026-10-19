// ==========================================================================
// RESA-L6B-1 (19/10/2026) — APPLICATION OUVERTE : N-20 « Tu confirmes ta réservation de demain ? »
// s'affiche AVEC « J'annule » / « Je confirme », et un appui sur un bouton répond par
// `handleResaVeilleActionPress` puis retire la notification (comme la réponse rapide).
// Banc repris de useNotifications.FINITIONS7.compteurAuRetour.test.js (mêmes doublures).
// ==========================================================================
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

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
/** @type {((message: any) => Promise<void>) | null} */
let mockRecevoir = null;
/** @type {((evenement: any) => Promise<void>) | null} */
let mockPremierPlan = null;
const mockAfficherVeille = jest.fn(async () => undefined);
const mockRepondreVeille = jest.fn(async () => ({ handled: true, success: true }));
const mockReponsePresence = jest.fn(async () => ({ handled: false }));
const mockAnnulerNotification = jest.fn(async () => undefined);

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
  onMessage: (/** @type {any} */ _messagerie, /** @type {any} */ ecouter) => {
    mockRecevoir = ecouter;
    return () => {};
  },
  onNotificationOpenedApp: () => () => {},
  onTokenRefresh: () => () => {},
  requestPermission: jest.fn(),
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    cancelNotification: (...args) => mockAnnulerNotification(...args),
    createChannel: jest.fn(),
    displayNotification: jest.fn(),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    onForegroundEvent: (/** @type {any} */ ecouter) => {
      mockPremierPlan = ecouter;
      return () => {};
    },
  },
  EventType: { ACTION_PRESS: 2, DISMISSED: 0, PRESS: 1 },
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
  handleEventRsvpActionPress: (...args) => mockReponsePresence(...args),
  // RESA-L6B-1 — les boutons de N-20 : ce que ce témoin vérifie.
  displayResaVeilleActionableNotification: (...args) => mockAfficherVeille(...args),
  handleResaVeilleActionPress: (...args) => mockRepondreVeille(...args),
  isChatReplyActionablePayload: () => false,
  isEventRsvpActionablePayload: () => false,
  isResaVeilleActionablePayload: (/** @type {any} */ data) => data?.change === 'veille',
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

const VEILLE = {
  actionContext: 'resa_veille',
  change: 'veille',
  reservationId: 'r-1',
  type: 'complexeReservationJoueur',
};

/** @type {any} */
let arbre;

const vider = async () => {
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};

/**
 * Monte l'amorce des notifications, comme l'app.
 * @returns {null} Aucun rendu.
 */
function Amorce() {
  useNotifications({ navigate: () => true });
  return null;
}

beforeEach(async () => {
  mockRecevoir = null;
  mockPremierPlan = null;
  mockAfficherVeille.mockClear();
  mockRepondreVeille.mockClear();
  mockReponsePresence.mockClear();
  mockAnnulerNotification.mockClear();
  mockGetToken.mockResolvedValue('FCM-TOKEN-DE-TEST-0123456789');
  mockAddDeviceTokenForSession.mockResolvedValue({ ok: true });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => /** @type {any} */ ({
    remove: () => {},
  }));
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <Amorce />
      </QueryClientProvider>,
    );
  });
  await vider();
});

afterEach(() => {
  act(() => arbre.unmount());
  jest.restoreAllMocks();
});

describe('RESA-L6B-1 — N-20 au premier plan', () => {
  test('le message reçu s’affiche avec ses deux boutons', async () => {
    expect(typeof mockRecevoir).toBe('function');
    await act(async () => {
      await /** @type {any} */ (mockRecevoir)({
        data: VEILLE,
        messageId: 'm-veille-1',
        notification: { body: 'Tu confirmes ta réservation de demain 19 h ?', title: 'FoundClub' },
      });
    });
    await vider();
    expect(mockAfficherVeille).toHaveBeenCalledWith({
      body: 'Tu confirmes ta réservation de demain 19 h ?',
      data: expect.objectContaining({ change: 'veille', reservationId: 'r-1' }),
      title: 'FoundClub',
    });
  });

  test('« Je confirme » : la réponse part, la notification se retire', async () => {
    expect(typeof mockPremierPlan).toBe('function');
    await act(async () => {
      await /** @type {any} */ (mockPremierPlan)({
        detail: {
          notification: { data: VEILLE, id: 'notif-veille' },
          pressAction: { id: 'resa_veille_confirmer' },
        },
        type: 2,
      });
    });
    expect(mockRepondreVeille).toHaveBeenCalledWith({
      notificationData: VEILLE,
      pressActionId: 'resa_veille_confirmer',
    });
    expect(mockAnnulerNotification).toHaveBeenCalledWith('notif-veille');
    expect(mockReponsePresence).not.toHaveBeenCalled();
  });

  test('un bouton de présence passe son chemin jusqu’à la présence', async () => {
    mockRepondreVeille.mockResolvedValueOnce({ handled: false });
    await act(async () => {
      await /** @type {any} */ (mockPremierPlan)({
        detail: {
          notification: { data: { eventId: 'e-1', type: 'eventReminder' }, id: 'notif-rappel' },
          pressAction: { id: 'event_rsvp_present' },
        },
        type: 2,
      });
    });
    expect(mockReponsePresence).toHaveBeenCalledTimes(1);
  });
});
