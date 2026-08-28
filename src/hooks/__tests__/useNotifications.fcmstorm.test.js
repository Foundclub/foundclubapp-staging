import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { TOKEN_SYNC_MAX_ATTEMPTS } from '@/utils/notifications/tokenSyncBackoff';

import useNotifications from '../useNotifications';

// FCMSTORM (28/08) — L'APP MARTELE LE SERVEUR POUR ENREGISTRER SON JETON.
//
// MESURE DU CHEF sur les journaux de la RECETTE :
//   06:35:53.248  POST /api/user-fcm-token/me/device  429
//   06:35:53.680  POST /api/user-fcm-token/me/device  429
//   06:35:54.113  POST /api/user-fcm-token/me/device  429
//   … 27 refus dans la fenetre observee, plusieurs par seconde, EN CONTINU.
// La veille, le meme appel rendait 403 six fois d'affilee.
//
// CE FICHIER N'AVAIT AUCUN TEST (1 048 lignes) : E6 impose donc le filet AVANT
// la correction. Les quatre temoins ci-dessous decrivent le comportement VOULU ;
// ils sont ROUGES sur le code d'origine.
//
// ⚠️ Aucun service reel n'est charge ici (`@/services/auth/authService` est
// mocke) : un service reellement importe lit `.env`, absent de tout worktree,
// et fait tomber la SUITE ENTIERE (0 test execute).

const mockAddDeviceToken = jest.fn();
const mockAddDeviceTokenForSession = jest.fn();
const mockGetToken = jest.fn();

let mockUserData = { documentId: 'user-doc-1', id: 1 };

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
  isChatReplyActionablePayload: () => false,
  isEventRsvpActionablePayload: () => false,
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
    useAppContext: () => useReducer(reducteur, etatInitial),
  };
});

// `usePopupEligibility` rend un objet MEMOISE — mais sa memo depend de
// `recordPopupEvent`, lui-meme refait des que `currentRouteName` ou
// `startupPhase` change (PopupManagerContext.js:79-87, :166-183). Autrement dit :
// A CHAQUE CHANGEMENT D'ECRAN, l'objet est neuf.
// C'est la pompe de production, et `mockEligibiliteInstable` la rallume.
let mockEligibiliteInstable = false;

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

/**
 * Erreur HTTP telle que la rend le client de l'app.
 * @param {number} status - Code HTTP renvoye par le serveur.
 * @param {Record<string, string>} [headers] - En-tetes de la reponse.
 * @returns {any} - Erreur portant `status` et `response`.
 */
const httpError = (status, headers = {}) => {
  const error = /** @type {any} */ (new Error(`HTTP ${status}`));
  error.status = status;
  error.response = { headers, status };
  return error;
};

/**
 * Erreur reseau : aucun code HTTP, un message « network ».
 * @returns {any} - Erreur reseau.
 */
const networkError = () => {
  const error = /** @type {any} */ (new Error('Network request failed'));
  return error;
};

// PLAFOND DE TEMPETE. Sur le code d'origine la boucle ne s'arrete JAMAIS : le
// temoin partait en timeout (32 s mesurees) au lieu de rendre un chiffre. Au
// dela de ce plafond le serveur simule accepte, la boucle se calme, et le
// compteur reste lisible : « 31 appels » dit la tempete aussi bien qu'un
// blocage, et en une seconde.
const PLAFOND_TEMPETE = 30;

// Un temoin ROUGE jette AVANT sa ligne de demontage : sans ce registre, le hook
// de la tempete precedente survit et continue d'appeler pendant le test suivant.
// (Mesure : le chemin normal comptait 3 appels au lieu de 1 pour cette raison.)
let montageEnCours = null;

/**
 * Le serveur refuse, jusqu'au plafond de tempete.
 * @param {number} status - Code HTTP du refus (403, 429...).
 * @returns {void}
 */
const refuser = (status) => {
  mockAddDeviceToken.mockImplementation(() => (
    mockAddDeviceToken.mock.calls.length > PLAFOND_TEMPETE
      ? Promise.resolve({ data: { documentId: 'plafond-tempete' } })
      : Promise.reject(httpError(status))
  ));
};

/**
 * Le reseau est coupe, jusqu'au plafond de tempete.
 * @returns {void}
 */
const couperLeReseau = () => {
  mockAddDeviceToken.mockImplementation(() => (
    mockAddDeviceToken.mock.calls.length > PLAFOND_TEMPETE
      ? Promise.resolve({ data: { documentId: 'plafond-tempete' } })
      : Promise.reject(networkError())
  ));
};

/**
 * Monte le hook et laisse la boucle tourner le temps demande.
 *
 * Le compteur d'appels EST la mesure : c'est lui qui dit s'il y a
 * martellement. `jest.advanceTimersByTime` fait avancer les minuteries
 * (`useSafeTimers`) sans attendre en vrai.
 * @param {{ dureeMs?: number }} [options] - Duree simulee apres le montage.
 * @returns {Promise<{ demonter: () => void }>} - Poignee de demontage.
 */
const monterEtLaisserTourner = async ({ dureeMs = 120000 } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  /**
   * Composant sonde : il ne rend rien, il fait vivre le hook.
   * @returns {null} - Aucun rendu.
   */
  function Sonde() {
    useNotifications({ navigate: () => true });
    return null;
  }

  let tree;
  await act(async () => {
    tree = renderer.create(
      <QueryClientProvider client={queryClient}>
        <Sonde />
      </QueryClientProvider>,
    );
  });

  // 40 tours de boucle simules. Sur le code d'origine, chaque tour rend la main
  // au hook, qui repart aussitot : c'est exactement le martellement mesure.
  for (let tour = 0; tour < 40; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(Math.ceil(dureeMs / 40));
      await Promise.resolve();
    });
  }

  montageEnCours = () => {
    act(() => {
      tree.unmount();
    });
    queryClient.clear();
  };

  return { demonter: montageEnCours };
};

/**
 * Demonte ce qui traine, meme quand le temoin a jete avant sa derniere ligne.
 * @returns {void}
 */
const demonterCeQuiTraine = () => {
  if (!montageEnCours) return;
  const demonter = montageEnCours;
  montageEnCours = null;
  demonter();
};

describe('FCMSTORM — un refus ne doit JAMAIS devenir un bombardement', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockEligibiliteInstable = false;
    mockUserData = { documentId: 'user-doc-1', id: 1 };
    mockGetToken.mockResolvedValue('FCM-TOKEN-DE-TEST-0123456789');
    mockAddDeviceTokenForSession.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    demonterCeQuiTraine();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('F1 — un 403 (« tu n\'as pas le droit ») n\'entraine QU\'UN SEUL appel', async () => {
    refuser(403);

    await monterEtLaisserTourner();

    expect(mockAddDeviceToken).toHaveBeenCalledTimes(1);
    demonterCeQuiTraine();
  });

  it('F2 — un 429 (« tu tapes trop vite ») espace les essais puis S\'ARRETE', async () => {
    refuser(429);

    await monterEtLaisserTourner({ dureeMs: 600000 });

    // Attente qui double (1 s, 2 s, 4 s), plafonnee, et un nombre d'essais
    // maximum NOMME. Sur dix minutes simulees : quatre appels, pas un de plus.
    expect(mockAddDeviceToken).toHaveBeenCalledTimes(TOKEN_SYNC_MAX_ATTEMPTS);
    demonterCeQuiTraine();
  });

  it('F4a — une coupure reseau, elle, se REESSAIE', async () => {
    couperLeReseau();

    await monterEtLaisserTourner({ dureeMs: 120000 });

    expect(mockAddDeviceToken.mock.calls.length).toBeGreaterThanOrEqual(2);
    demonterCeQuiTraine();
  });

  it('F4b — le chemin normal reussit DU PREMIER COUP, sans delai ajoute', async () => {
    mockAddDeviceToken.mockResolvedValue({ data: { documentId: 'inst-1' } });

    await monterEtLaisserTourner();

    expect(mockAddDeviceToken).toHaveBeenCalledTimes(1);
    expect(mockAddDeviceToken).toHaveBeenCalledWith('FCM-TOKEN-DE-TEST-0123456789');
    demonterCeQuiTraine();
  });
});

describe('FCMSTORM — la vraie vie : le churn de rendu pendant le refus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockEligibiliteInstable = true;
    mockUserData = { documentId: 'user-doc-1', id: 1 };
    mockGetToken.mockResolvedValue('FCM-TOKEN-DE-TEST-0123456789');
    mockAddDeviceTokenForSession.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    demonterCeQuiTraine();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // C'EST CE TEMOIN QUI DECRIT LE DEFAUT MESURE LE 28/08.
  // Chaque changement d'ecran refait `pushPermissionPrompt`, donc
  // `requestPushPermissionPrePrompt`, donc `syncTokenIfNeeded` — et l'effet de
  // :860 repart. Il repart parce que son garde (`lastSyncedUserIdRef`, :865)
  // n'est ecrit QUE sur un succes (:874), et il appelle avec `force: true`
  // (:873), qui court-circuite le frein de 30 s (:467).
  it('F3 — 403 : meme apres 40 changements ecran, UN SEUL appel part', async () => {
    refuser(403);

    await monterEtLaisserTourner();

    expect(mockAddDeviceToken).toHaveBeenCalledTimes(1);
    demonterCeQuiTraine();
  });

  it('F3 bis — 429 : le martellement cesse, quoi que fasse ecran', async () => {
    refuser(429);

    await monterEtLaisserTourner({ dureeMs: 600000 });

    // Meme compte avec le churn que sans lui : le silencieux ne depend pas des rendus.
    expect(mockAddDeviceToken).toHaveBeenCalledTimes(TOKEN_SYNC_MAX_ATTEMPTS);
    demonterCeQuiTraine();
  });

  it('F4c — le chemin normal reste a UN SEUL appel malgre le churn', async () => {
    mockAddDeviceToken.mockResolvedValue({ data: { documentId: 'inst-1' } });

    await monterEtLaisserTourner();

    expect(mockAddDeviceToken).toHaveBeenCalledTimes(1);
    demonterCeQuiTraine();
  });
});
