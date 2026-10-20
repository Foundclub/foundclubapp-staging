import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import useMessaging from '@/domains/messaging/useMessaging';

import { useGetChatMessages, useGetChats } from '@/services/chat/chatQueriesCompat';
import { disconnectSharedSocket } from '@/services/socket/socketManager';

import { buildNormalizedQueryKey } from '@/utils/queryKey';

import { resetReturnRefreshCooldown, startQueryRefreshBridge } from '@/app/queryRefreshOnReturn';
import useNotifications from '@/hooks/useNotifications';
import { creerQueryClientDeTest } from '@/testSupport/queryClientDeTest';

// ==========================================================================
// MSGNOTIF (20/10) — « QUAND ON OUVRE UNE NOTIFICATION ET QU'ON A L'APPLI DÉJÀ
// OUVERTE, D'UN MESSAGE, LE MESSAGE N'APPARAÎT PAS. IL FAUT REFRESH UN
// MILLIARD DE FOIS, IL FAUT FERMER L'APPLICATION ET LA RÉOUVRIR. » (Adel, 19/10)
//
// 🔬 CE QUI EST MONTÉ ICI EST LE VRAI CHEMIN, D'UN BOUT À L'AUTRE :
//   - la VRAIE couche du fil téléphonique (`socketManager` + `useSocket`) : seul
//     `socket.io-client` est doublé, par un faux serveur qui répond à `join-chat`
//     par `joined` comme le vrai (admin `src/socket/index.ts:224`) ;
//   - le VRAI crochet de messagerie (`useMessaging`) et la VRAIE requête des
//     messages (`useGetChatMessages`, réglages de `chatQueries.js`) — les deux
//     seules choses que `Conversation.js` utilise pour dessiner le fil
//     (`Conversation.js:1068-1077`, liste construite des pages en `:4129`) ;
//   - la VRAIE ouverture d'une notification (`useNotifications` →
//     `resolveNotificationDestination` → `navigate`) ;
//   - le VRAI pont du retour au premier plan (`startQueryRefreshBridge`, qui
//     réveille la socket).
// La navigation imite le routeur de pile v7 (`StackRouter`, cas NAVIGATE) :
// depuis la liste, `navigate('Conversation')` EMPILE un nouvel écran ; depuis
// une conversation, il REPREND le même écran et remplace ses paramètres.
//
// 📱 CE QUE FAIT UN iPHONE EN ARRIÈRE-PLAN : il suspend l'app et coupe la
// socket. Un message écrit pendant ce temps n'arrive PAS par le fil : le
// serveur l'émet à une socket qui n'existe plus. Seule une relecture HTTP peut
// le ramener.
//
// ⏱️ Les latences du faux réseau sont celles d'un téléphone : 200 ms pour une
// lecture HTTP, 30 ms pour la réponse `joined`. Sans elles, la lecture finirait
// toujours avant `joined`, ce qui n'arrive presque jamais en vrai.
// ==========================================================================

const mockServeur = {
  /** Chaque lecture HTTP des messages : `{ chatId, page, pageSize }`. */
  lectures: /** @type {any[]} */ ([]),
  /** Les messages de chaque fil, du plus récent au plus ancien (ordre du serveur). */
  messages: /** @type {Record<string, any[]>} */ ({}),
};

/** @type {((message: any) => void) | null} */
let mockOuvrirUneNotification = null;

jest.mock('socket.io-client', () => {
  const banc = {
    envois: /** @type {any[]} */ ([]),
    /** Le fil peut-il (re)partir ? Faux pendant la suspension iOS. */
    reseau: true,
    socket: /** @type {any} */ (null),
  };

  const creer = () => {
    const ecouteurs = new Map();
    /** @type {any[]} */
    const tampon = [];
    const jouer = (/** @type {string} */ nom, /** @type {any[]} */ ...args) => {
      [...(ecouteurs.get(nom) || [])].forEach((fn) => fn(...args));
    };
    const socket = {
      connect: () => {
        if (!socket.connected && banc.reseau) banc.ouvrir();
        return socket;
      },
      connected: false,
      disconnect: () => {
        const etaitBranche = socket.connected;
        socket.connected = false;
        if (etaitBranche) jouer('disconnect', 'io client disconnect');
        return socket;
      },
      jouerEvenement: jouer,
      tamponDEnvois: tampon,
      // Comme socket.io : un envoi fait fil coupé attend dans un tampon, et part
      // à la reconnexion.
      emit: (/** @type {string} */ nom, /** @type {any} */ charge, /** @type {any} */ ack) => {
        if (!socket.connected) {
          tampon.push([nom, charge, ack]);
          return socket;
        }
        banc.recevoir(nom, charge);
        return socket;
      },
      io: { off: () => {}, on: () => {} },
      off: (/** @type {string} */ nom, /** @type {Function} */ fn) => {
        if (!fn) {
          ecouteurs.delete(nom);
          return socket;
        }
        ecouteurs.set(nom, (ecouteurs.get(nom) || []).filter((/** @type {any} */ e) => e !== fn));
        return socket;
      },
      on: (/** @type {string} */ nom, /** @type {Function} */ fn) => {
        ecouteurs.set(nom, [...(ecouteurs.get(nom) || []), fn]);
        return socket;
      },
    };
    return socket;
  };

  banc.ouvrir = () => {
    const { socket } = banc;
    socket.connected = true;
    socket.jouerEvenement('connect');
    socket.tamponDEnvois.splice(0).forEach(([nom, charge]) => banc.recevoir(nom, charge));
  };
  banc.recevoir = (/** @type {string} */ nom, /** @type {any} */ charge) => {
    banc.envois.push({ charge, nom });
    if (nom !== 'join-chat') return;
    const { socket } = banc;
    setTimeout(() => {
      if (!socket.connected) return;
      socket.jouerEvenement('joined', { chatDocumentId: charge.chatDocumentId });
    }, 30);
  };
  banc.couper = () => {
    const { socket } = banc;
    if (!socket?.connected) return;
    socket.connected = false;
    socket.jouerEvenement('disconnect', 'transport close');
  };

  return {
    bancDeTest: banc,
    io: () => {
      banc.socket = creer();
      const { socket } = banc;
      if (banc.reseau) Promise.resolve().then(() => { if (!socket.connected) banc.ouvrir(); });
      return socket;
    },
  };
});

jest.mock('@/services/chat/chatService', () => ({
  addGroupMembers: jest.fn(),
  archiveChat: jest.fn(),
  createClubChat: jest.fn(),
  createGroupChat: jest.fn(),
  createTeamChat: jest.fn(),
  createWhisperChat: jest.fn(),
  deleteMessage: jest.fn(),
  editMessage: jest.fn(),
  getChatById: jest.fn(() => Promise.resolve({})),
  getChatMessageReactions: jest.fn(() => Promise.resolve({ data: [] })),
  // 🎯 LE SERVEUR : il rend toujours son état DU MOMENT, page par page.
  getChatMessages: (/** @type {string} */ chatId, page = 1, pageSize = 20) => {
    mockServeur.lectures.push({ chatId, page, pageSize });
    const tous = mockServeur.messages[chatId] || [];
    const instantane = tous.slice((page - 1) * pageSize, page * pageSize);
    return new Promise((resolve) => {
      setTimeout(() => resolve({
        data: instantane,
        meta: {
          pagination: {
            page,
            pageCount: Math.max(1, Math.ceil(tous.length / pageSize)),
            pageSize,
            total: tous.length,
          },
        },
      }), 200);
    });
  },
  // La liste des fils, avec l'aperçu (le dernier message) de chacun, telle que le
  // serveur la tient À CET INSTANT.
  getChats: jest.fn(() => new Promise((resolve) => {
    setTimeout(() => resolve({
      data: Object.entries(mockServeur.messages).map(([documentId, messages]) => ({
        documentId,
        messages: messages.slice(0, 1),
      })),
      meta: { pagination: { page: 1, pageCount: 1 } },
    }), 200);
  })),
  getPollVoterProfiles: jest.fn(() => Promise.resolve({ data: [] })),
  markChatUnread: jest.fn(),
  pinChat: jest.fn(),
  reactToChatMessage: jest.fn(),
  removeGroupMember: jest.fn(),
  respondProposalMessage: jest.fn(),
  unarchiveChat: jest.fn(),
  unpinChat: jest.fn(),
  updateGroupMeta: jest.fn(),
  votePollMessage: jest.fn(),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

jest.mock('@/services/notification/notificationService', () => ({
  deleteNotification: jest.fn(),
  getNotifications: jest.fn(async () => ({
    data: [], meta: { pagination: { page: 1, pageCount: 1 } },
  })),
  getUnreadCount: jest.fn(async () => ({ count: 0 })),
  markAllAsRead: jest.fn(),
  markAsRead: jest.fn(),
}));

jest.mock('@/services/auth/authService', () => ({
  addDeviceToken: jest.fn(async () => ({ data: { documentId: 'inst-1' } })),
  addDeviceTokenForSession: jest.fn(async () => ({ ok: true })),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: () => ({ name: '[DEFAULT]' }),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({
    isDeviceRegisteredForRemoteMessages: true,
    registerDeviceForRemoteMessages: jest.fn(),
  }),
  getToken: jest.fn(async () => 'FCM-TOKEN-DE-TEST-0123456789'),
  onMessage: () => () => {},
  // iPhone : toucher une notification quand l'app vivait en arrière-plan.
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
  EventType: { ACTION_PRESS: 2, DISMISSED: 0, PRESS: 1 },
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ allMyTeams: [], userData: { documentId: 'moi', firstname: 'Adel', id: 1 } }),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  ...jest.requireActual('@/domains/auth/authUseCases'),
  activateSessionByDocumentId: jest.fn(),
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
    auth: { token: 'jwt-de-test' },
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
  const memoire = new Map();
  return {
    storage: {
      getString: (/** @type {string} */ clef) => memoire.get(clef),
      set: (/** @type {string} */ clef, /** @type {any} */ valeur) => {
        memoire.set(clef, valeur);
      },
    },
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

// eslint-disable-next-line global-require
const banc = () => require('socket.io-client').bancDeTest;
// eslint-disable-next-line global-require
const lireLaListe = () => require('@/services/chat/chatService').getChats;

/**
 * La clé de cache des messages d'un fil, telle que `Conversation.js` la pose.
 * @param {string} chatId Le fil.
 * @returns {any[]} La clé.
 */
const clefDesMessages = (chatId) => buildNormalizedQueryKey(['chat-messages', chatId], {
  pageSize: undefined,
  payload: 'light',
});

const DEPART = new Date('2026-10-20T08:00:00.000Z').getTime();
let compteurDeMessages = 0;

/**
 * Un message tel que le serveur le rend (charge « light »).
 * @param {string} chatId Le fil.
 * @param {string} texte Le texte.
 * @param {string} [auteur] L'expéditeur.
 * @returns {any} Le message.
 */
const unMessage = (chatId, texte, auteur = 'marc') => {
  compteurDeMessages += 1;
  return {
    chat: { documentId: chatId },
    createdAt: new Date(Date.now() + compteurDeMessages).toISOString(),
    documentId: `${chatId}-m${compteurDeMessages}`,
    id: `${chatId}-m${compteurDeMessages}`,
    message: texte,
    readBy: [],
    sender: { documentId: auteur, firstname: auteur },
  };
};

// ---------------------------------------------------------------------------
// LA PETITE APPLI : la liste des conversations (toujours montée, au fond de la
// pile) et, par-dessus, les écrans de conversation empilés.
// ---------------------------------------------------------------------------

/** @type {Record<string, { chatId: string, textes: string[] }>} */
const vues = {};
/** @type {Record<string, string>} */
const apercus = {};
/** @type {Array<{ cle: string, chatId: string }>} */
let pileAffichee = [];
// Le routeur de la pile, posé par l'appli montée.
const routeur = { naviguer: /** @type {null | ((nom: string, params?: any) => boolean)} */ (null) };
let compteurDEcrans = 0;

/**
 * Le même routeur que `navigationService.navigate` → `navigationRef.navigate`.
 * @param {string} nom La route.
 * @param {any} [params] Ses paramètres.
 * @returns {boolean} Vrai : la navigation a eu lieu.
 */
const naviguer = (nom, params) => routeur.naviguer?.(nom, params) ?? false;

/**
 * L'écran de la liste : `Messaging.js` appelle `useMessaging()` sans fil, et lit
 * la liste des fils (`useGetChats`) ; l'aperçu de chaque fil est relevé dans `apercus`.
 * @returns {null} Rien à dessiner.
 */
function Liste() {
  useMessaging();
  const { data } = useGetChats({ currentUserId: 'moi' });
  useEffect(() => {
    (/** @type {any} */ (data)?.pages || [])
      .flatMap((/** @type {any} */ page) => page?.data || [])
      .forEach((/** @type {any} */ fil) => {
        apercus[fil.documentId] = fil.messages?.[0]?.message || '';
      });
  });
  return null;
}

/**
 * L'écran d'une conversation : exactement les deux crochets de `Conversation.js`.
 * @param {{ cle: string, chatId: string }} props L'écran.
 * @returns {null} Rien à dessiner ; ce qui serait affiché est relevé dans `vues`.
 */
function Fil({ chatId, cle }) {
  useMessaging(chatId);
  const { data } = useGetChatMessages({ chatId });
  const textes = (/** @type {any} */ (data)?.pages || [])
    .flatMap((/** @type {any} */ page) => page?.data || [])
    .map((/** @type {any} */ message) => message?.message);
  useEffect(() => {
    vues[cle] = { chatId, textes };
  });
  return null;
}

/**
 * L'appli : l'amorce des notifications, la liste, et la pile des conversations.
 * @param {{ pileInitiale: Array<{ cle: string, chatId: string }> }} props La pile au départ.
 * @returns {any} L'arbre.
 */
function Appli({ pileInitiale }) {
  const [pile, setPile] = useState(pileInitiale);
  useEffect(() => {
    pileAffichee = pile;
  }, [pile]);
  useEffect(() => {
    routeur.naviguer = (nom, params) => {
      if (nom !== 'Conversation') return true;
      setPile((avant) => {
        const haut = avant[avant.length - 1];
        // StackRouter v7 : la route du HAUT a le même nom ⇒ même écran, nouveaux paramètres.
        if (haut) return [...avant.slice(0, -1), { ...haut, chatId: String(params?.chatId) }];
        compteurDEcrans += 1;
        return [...avant, { chatId: String(params?.chatId), cle: `ecran-${compteurDEcrans}` }];
      });
      return true;
    };
  }, []);
  useNotifications({ navigate: naviguer });
  return (
    <>
      <Liste />
      {pile.map((ecran) => <Fil chatId={ecran.chatId} cle={ecran.cle} key={ecran.cle} />)}
    </>
  );
}

/** @type {Array<(etat: string) => void>} */
let ecouteursAppState = [];
/** @type {any} */
let arbre;
/** @type {any} */
let client;
/** Débranche le pont du retour au premier plan. @type {() => void} */
let arreterLePont = () => {};

/**
 * Laisse passer le temps (minuteurs de react-query, latences du faux réseau).
 * @param {number} [millisecondes] La durée.
 * @returns {Promise<void>}
 */
const laisserPasser = async (millisecondes = 1000) => {
  const pas = 10;
  for (let ecoule = 0; ecoule < millisecondes; ecoule += pas) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(pas);
      await Promise.resolve();
      await Promise.resolve();
    });
  }
};

/**
 * Monte l'appli, la socket branchée, puis laisse tout se poser.
 * @param {Array<{ cle: string, chatId: string }>} pileInitiale Les conversations ouvertes.
 * @returns {Promise<void>}
 */
const monterLAppli = async (pileInitiale) => {
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <Appli pileInitiale={pileInitiale} />
      </QueryClientProvider>,
    );
  });
  await laisserPasser(1000);
};

/**
 * Ce qu'affiche l'écran du haut : une conversation, ou la liste.
 * @returns {{ chatId: string, textes: string[] } | null} L'écran affiché.
 */
const ecranDuHaut = () => {
  const haut = pileAffichee[pileAffichee.length - 1];
  return haut ? vues[haut.cle] || null : null;
};

/**
 * L'iPhone verrouillé : l'app est suspendue, la socket coupée, et elle ne peut
 * pas repartir tant que l'app dort.
 * @returns {Promise<void>}
 */
const passerEnArrierePlan = async () => {
  act(() => { ecouteursAppState.forEach((ecouter) => ecouter('background')); });
  banc().reseau = false;
  act(() => { banc().couper(); });
  await laisserPasser(100);
};

/**
 * L'app revient au premier plan, une minute plus tard.
 * @param {{ leFilRevient: boolean }} options La socket peut-elle repartir ?
 * @returns {Promise<void>}
 */
const revenirAuPremierPlan = async ({ leFilRevient }) => {
  jest.setSystemTime(Date.now() + 60_000);
  banc().reseau = leFilRevient;
  act(() => { ecouteursAppState.forEach((ecouter) => ecouter('active')); });
  await laisserPasser(100);
};

/**
 * Quelqu'un écrit dans un fil. La socket le pousse si elle est branchée ; sinon,
 * il n'existe QUE sur le serveur (et dans la notification).
 * @param {string} chatId Le fil.
 * @param {string} texte Le message.
 * @returns {Promise<any>} Le message.
 */
const quelquUnEcrit = async (chatId, texte) => {
  const message = unMessage(chatId, texte);
  mockServeur.messages[chatId] = [message, ...(mockServeur.messages[chatId] || [])];
  if (banc().socket?.connected) {
    act(() => { banc().socket.jouerEvenement('message-received', message); });
  }
  await laisserPasser(50);
  return message;
};

/**
 * Toucher la notification du message (iPhone : `onNotificationOpenedApp`).
 * @param {string} chatId Le fil du message.
 * @returns {Promise<void>}
 */
const toucherLaNotification = async (chatId) => {
  expect(typeof mockOuvrirUneNotification).toBe('function');
  act(() => {
    /** @type {any} */ (mockOuvrirUneNotification)({
      data: { chatId, notificationId: `notif-${chatId}-${Date.now()}`, type: 'newWhisper' },
    });
  });
  // La notification en attente est rejouée toutes les 500 ms (useNotifications.js:1137).
  await laisserPasser(1500);
};

/**
 * Pose dans le cache un fil déjà lu plus tôt (une visite précédente).
 * @param {string} chatId Le fil.
 * @returns {void}
 */
const filDejaLuPlusTot = (chatId) => {
  const tous = mockServeur.messages[chatId] || [];
  client.setQueryData(clefDesMessages(chatId), {
    pageParams: [1],
    pages: [{
      data: [...tous],
      meta: {
        pagination: {
          page: 1, pageCount: 1, pageSize: 20, total: tous.length,
        },
      },
    }],
  });
};

/**
 * Les lectures HTTP des messages d'un fil.
 * @param {string} chatId Le fil.
 * @returns {number} Leur nombre.
 */
const lecturesDu = (chatId) => mockServeur.lectures
  .filter((lecture) => lecture.chatId === chatId).length;

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(DEPART);
  compteurDeMessages = 0;
  mockServeur.lectures = [];
  lireLaListe().mockClear();
  mockServeur.messages = {
    'chat-1': [unMessage('chat-1', 'Salut, ça va ?')],
    'chat-2': [unMessage('chat-2', 'Bonjour à tous')],
  };
  mockOuvrirUneNotification = null;
  banc().reseau = true;
  banc().envois = [];
  pileAffichee = [];
  Object.keys(vues).forEach((cle) => { delete vues[cle]; });
  Object.keys(apercus).forEach((cle) => { delete apercus[cle]; });
  ecouteursAppState = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, ecouter) => {
    ecouteursAppState.push(/** @type {any} */ (ecouter));
    return /** @type {any} */ ({
      remove: () => { ecouteursAppState = ecouteursAppState.filter((e) => e !== ecouter); },
    });
  });
  client = creerQueryClientDeTest({
    // Les réglages de l'app (app/queryClient.js:145-146).
    defaultOptions: { queries: { refetchOnReconnect: false, refetchOnWindowFocus: false } },
  });
  resetReturnRefreshCooldown();
  arreterLePont = startQueryRefreshBridge(client);
});

afterEach(async () => {
  act(() => arbre?.unmount());
  arbre = null;
  arreterLePont();
  act(() => disconnectSharedSocket());
  await laisserPasser(300);
  client.clear();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('MSGNOTIF — un message reçu pendant que l\'app dormait s\'affiche au retour', () => {
  test('(a) app sur la LISTE, notif touchée ⇒ le fil s\'ouvre AVEC le message', async () => {
    // Le fil a été lu une minute plus tôt : il est en cache.
    filDejaLuPlusTot('chat-1');
    jest.setSystemTime(Date.now() + 60_000);
    await monterLAppli([]);
    const lecturesDeLaListe = lireLaListe().mock.calls.length;

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await toucherLaNotification('chat-1');

    expect(ecranDuHaut()?.chatId).toBe('chat-1');
    expect(ecranDuHaut()?.textes).toEqual(['Tu viens ce soir ?', 'Salut, ça va ?']);
    // Et la liste, dessous, est relue : son aperçu et ses non-lus suivent.
    expect(lireLaListe().mock.calls.length).toBeGreaterThan(lecturesDeLaListe);
  });

  test('(a\') idem, la socket NE revient PAS : la notification suffit', async () => {
    filDejaLuPlusTot('chat-1');
    jest.setSystemTime(Date.now() + 60_000);
    await monterLAppli([]);

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: false });
    await toucherLaNotification('chat-1');

    expect(ecranDuHaut()?.chatId).toBe('chat-1');
    expect(ecranDuHaut()?.textes).toEqual(['Tu viens ce soir ?', 'Salut, ça va ?']);
  });

  test('(b) app sur CE fil, socket coupée, notif touchée ⇒ message là', async () => {
    await monterLAppli([{ chatId: 'chat-1', cle: 'ouvert' }]);
    expect(ecranDuHaut()?.textes).toEqual(['Salut, ça va ?']);

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await toucherLaNotification('chat-1');

    expect(ecranDuHaut()?.chatId).toBe('chat-1');
    expect(ecranDuHaut()?.textes).toEqual(['Tu viens ce soir ?', 'Salut, ça va ?']);
  });

  test('(b\') même chose quand la socket NE revient PAS', async () => {
    await monterLAppli([{ chatId: 'chat-1', cle: 'ouvert' }]);

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: false });
    await toucherLaNotification('chat-1');

    expect(ecranDuHaut()?.textes).toEqual(['Tu viens ce soir ?', 'Salut, ça va ?']);
  });

  test('(c) app sur un AUTRE fil ⇒ bascule, message affiché', async () => {
    filDejaLuPlusTot('chat-1');
    jest.setSystemTime(Date.now() + 60_000);
    await monterLAppli([{ chatId: 'chat-2', cle: 'ouvert' }]);
    expect(ecranDuHaut()?.textes).toEqual(['Bonjour à tous']);

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await toucherLaNotification('chat-1');

    expect(ecranDuHaut()?.chatId).toBe('chat-1');
    expect(ecranDuHaut()?.textes).toEqual(['Tu viens ce soir ?', 'Salut, ça va ?']);
  });

  test('(d) écrit pendant la suspension, SANS notif : là au retour', async () => {
    await monterLAppli([{ chatId: 'chat-1', cle: 'ouvert' }]);

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await laisserPasser(1500);

    expect(ecranDuHaut()?.textes).toEqual(['Tu viens ce soir ?', 'Salut, ça va ?']);
  });
});

describe('MSGNOTIF — ce que le rattrapage ne doit PAS casser', () => {
  test('(e) le direct reste du direct : fil branché, AUCUNE lecture HTTP', async () => {
    await monterLAppli([{ chatId: 'chat-1', cle: 'ouvert' }]);
    const lecturesAvant = lecturesDu('chat-1');

    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await laisserPasser(1000);

    expect(ecranDuHaut()?.textes).toEqual(['Tu viens ce soir ?', 'Salut, ça va ?']);
    expect(lecturesDu('chat-1')).toBe(lecturesAvant);
  });

  test('(f) première ouverture d\'un fil jamais lu : UNE seule lecture, pas deux', async () => {
    await monterLAppli([{ chatId: 'chat-1', cle: 'ouvert' }]);

    expect(ecranDuHaut()?.textes).toEqual(['Salut, ça va ?']);
    expect(lecturesDu('chat-1')).toBe(1);
  });

  test('(g) une bulle NON ENVOYÉE (échec) survit au rattrapage', async () => {
    await monterLAppli([{ chatId: 'chat-1', cle: 'ouvert' }]);
    // Une bulle en échec, telle que `markMessageState` la laisse (useMessaging.js:1282).
    act(() => {
      client.setQueryData(clefDesMessages('chat-1'), (/** @type {any} */ avant) => ({
        ...avant,
        pages: [{
          ...avant.pages[0],
          data: [{
            chat: { documentId: 'chat-1' },
            clientMessageId: 'cmid-non-parti',
            createdAt: new Date().toISOString(),
            documentId: 'temp-1',
            failed: true,
            id: 'temp-1',
            message: 'Je pars dans 5 min',
            pending: false,
            sender: { documentId: 'me' },
          }, ...avant.pages[0].data],
        }, ...avant.pages.slice(1)],
      }));
    });

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await laisserPasser(1500);

    const { textes } = /** @type {any} */ (ecranDuHaut());
    expect(textes).toContain('Je pars dans 5 min');
    expect(textes).toContain('Tu viens ce soir ?');
    expect(textes).toContain('Salut, ça va ?');
    expect(textes).toHaveLength(3);
  });

  test('(h) pas de doublon : un message reçu en direct n\'est pas doublé', async () => {
    await monterLAppli([{ chatId: 'chat-1', cle: 'ouvert' }]);
    await quelquUnEcrit('chat-1', 'Arrivé en direct');

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await toucherLaNotification('chat-1');

    expect(ecranDuHaut()?.textes)
      .toEqual(['Tu viens ce soir ?', 'Arrivé en direct', 'Salut, ça va ?']);
  });

  test('(i) liste ET fil montés : une reconnexion = UNE lecture', async () => {
    await monterLAppli([{ chatId: 'chat-1', cle: 'ouvert' }]);
    const lecturesAvant = lecturesDu('chat-1');

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await laisserPasser(1500);

    expect(lecturesDu('chat-1') - lecturesAvant).toBeLessThanOrEqual(1);
  });
});

describe('MSGNOTIF2 — la LISTE des conversations, seule à l\'écran, rattrape elle aussi', () => {
  test('(j) liste seule, écrit pendant la veille : au retour, le bon aperçu', async () => {
    await monterLAppli([]);
    expect(apercus['chat-1']).toBe('Salut, ça va ?');

    await passerEnArrierePlan();
    await quelquUnEcrit('chat-1', 'Tu viens ce soir ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await laisserPasser(1500);

    expect(apercus['chat-1']).toBe('Tu viens ce soir ?');
  });

  test('(k) démarrage : la 1re connexion ne relit PAS la liste (une seule lecture)', async () => {
    // Le fil se branche APRÈS que la liste a fini de se lire (réseau lent au
    // lancement) : sans cette attente, une relecture en trop se fondrait dans la
    // première, encore en vol, et le témoin ne verrait rien.
    banc().reseau = false;
    await monterLAppli([]);
    expect(lireLaListe().mock.calls).toHaveLength(1);

    banc().reseau = true;
    act(() => { banc().ouvrir(); });
    await laisserPasser(1000);

    expect(lireLaListe().mock.calls).toHaveLength(1);
  });

  test('(l) liste ET fil montés, reconnexion sans manque : liste lue UNE fois', async () => {
    await monterLAppli([{ chatId: 'chat-1', cle: 'ouvert' }]);
    const lecturesDeLaListe = lireLaListe().mock.calls.length;

    await passerEnArrierePlan();
    await revenirAuPremierPlan({ leFilRevient: true });
    await laisserPasser(1500);

    expect(lireLaListe().mock.calls.length - lecturesDeLaListe).toBe(1);
  });
});

// ==========================================================================
// MSG-SUPPORT (20/10/2026), point 4 — LA CONVERSATION « ASSISTANCE FOUNDCLUB » PROFITE DU MÊME
// RATTRAPAGE. Elle passe par les mêmes chemins que tout fil (useMessaging, useGetChatMessages,
// notification → Conversation) : rien n'a été écrit pour elle côté temps réel, et ce bloc le
// PROUVE avec ses vraies formes — la réponse de l'équipe arrive signée, l'expéditeur masqué par
// le serveur (`assistance-foundclub`), et la notification du titulaire est un `newWhisper`
// titré « Assistance FoundClub » ; celle d'un super-admin, un `newGroupMessage`.
// Témoin de CARACTÉRISATION : vert dès la base (c'est le but), il rougira si un jour le fil
// d'assistance quitte ces chemins.
// ==========================================================================
describe('MSG-SUPPORT — la conversation d\'assistance rattrape comme les autres', () => {
  const ASSISTANCE = 'assistance-1';
  const DEMANDE = 'Bonjour, je ne vois plus mon équipe';
  /**
   * L'équipe répond : la forme exacte que le serveur diffuse (expéditeur masqué, signature).
   * @param {string} texte La réponse.
   * @returns {Promise<any>} Le message.
   */
  const lAssistanceRepond = async (texte) => {
    const message = {
      ...unMessage(ASSISTANCE, texte),
      sender: {
        avatar: null,
        documentId: 'assistance-foundclub',
        firstname: 'Assistance',
        lastname: 'FoundClub',
      },
      senderSignature: { nom: 'Assistance FoundClub', voix: 'assistance' },
    };
    mockServeur.messages[ASSISTANCE] = [message, ...(mockServeur.messages[ASSISTANCE] || [])];
    if (banc().socket?.connected) {
      act(() => { banc().socket.jouerEvenement('message-received', message); });
    }
    await laisserPasser(50);
    return message;
  };
  /**
   * Toucher une notification d'un type donné (titulaire : newWhisper ; équipe : newGroupMessage).
   * @param {string} chatId Le fil.
   * @param {string} type Le type de la notification.
   * @returns {Promise<void>}
   */
  const toucher = async (chatId, type) => {
    act(() => {
      /** @type {any} */ (mockOuvrirUneNotification)({
        data: { chatId, notificationId: `notif-${type}-${Date.now()}`, type },
      });
    });
    await laisserPasser(1500);
  };

  beforeEach(() => {
    mockServeur.messages[ASSISTANCE] = [unMessage(ASSISTANCE, DEMANDE, 'moi')];
  });

  test('(m) liste endormie, l’équipe répond : la notif ouvre l’assistance', async () => {
    filDejaLuPlusTot(ASSISTANCE);
    jest.setSystemTime(Date.now() + 60_000);
    await monterLAppli([]);

    await passerEnArrierePlan();
    await lAssistanceRepond('On a remis ton équipe, tu peux vérifier ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await toucher(ASSISTANCE, 'newWhisper');

    expect(ecranDuHaut()?.chatId).toBe(ASSISTANCE);
    expect(ecranDuHaut()?.textes)
      .toEqual(['On a remis ton équipe, tu peux vérifier ?', DEMANDE]);
  });

  test('(n) assistance ouverte, coupée, réponse dans la veille, sans notif', async () => {
    await monterLAppli([{ chatId: ASSISTANCE, cle: 'ouvert' }]);

    await passerEnArrierePlan();
    await lAssistanceRepond('Réponse pendant la veille');
    await revenirAuPremierPlan({ leFilRevient: true });
    await laisserPasser(1500);

    expect(ecranDuHaut()?.textes).toEqual(['Réponse pendant la veille', DEMANDE]);
  });

  test('(o) le direct reste du direct : réponse par le fil, AUCUNE lecture HTTP', async () => {
    await monterLAppli([{ chatId: ASSISTANCE, cle: 'ouvert' }]);
    const lecturesAvant = lecturesDu(ASSISTANCE);

    await lAssistanceRepond('En direct');
    await laisserPasser(1000);

    expect(ecranDuHaut()?.textes).toEqual(['En direct', DEMANDE]);
    expect(lecturesDu(ASSISTANCE)).toBe(lecturesAvant);
    // … et le message reçu en direct GARDE sa signature : c'est elle qui le range du côté de
    // l'équipe et dit qui a répondu (sans elle, la console le croyait d'ailleurs).
    const enCache = client.getQueryData(clefDesMessages(ASSISTANCE))?.pages?.[0]?.data?.[0];
    expect(enCache?.senderSignature).toEqual({ nom: 'Assistance FoundClub', voix: 'assistance' });
  });

  test('(p) côté équipe : la notif « newGroupMessage » ouvre la conversation', async () => {
    filDejaLuPlusTot(ASSISTANCE);
    jest.setSystemTime(Date.now() + 60_000);
    await monterLAppli([]);

    await passerEnArrierePlan();
    await quelquUnEcrit(ASSISTANCE, 'Vous êtes là ?');
    await revenirAuPremierPlan({ leFilRevient: true });
    await toucher(ASSISTANCE, 'newGroupMessage');

    expect(ecranDuHaut()?.chatId).toBe(ASSISTANCE);
    expect(ecranDuHaut()?.textes).toEqual(['Vous êtes là ?', DEMANDE]);
  });
});
