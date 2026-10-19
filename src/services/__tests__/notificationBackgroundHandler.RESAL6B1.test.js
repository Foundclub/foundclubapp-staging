// RESA-L6B-1 (19/10/2026) — application FERMÉE ou en arrière-plan : les boutons de N-20
// (« Je confirme » / « J'annule ») répondent par le gestionnaire de fond, comme ceux du rappel
// d'événement (même banc que notificationBackgroundHandlerREPNOTIF.test.js).

const ecouteursDeFond = [];
const messagesDeFond = [];
const mockCancel = jest.fn(async () => undefined);

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    cancelNotification: (...args) => mockCancel(...args),
    onBackgroundEvent: (callback) => ecouteursDeFond.push(callback),
  },
  EventType: { ACTION_PRESS: 2, PRESS: 1 },
}));

jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
  setBackgroundMessageHandler: (_instance, callback) => messagesDeFond.push(callback),
}));

const mockHandleChatReply = jest.fn(async () => ({ handled: false }));
const mockHandleRsvp = jest.fn(async () => ({ handled: false }));
const mockHandleResaVeille = jest.fn(async () => ({ handled: true, success: true }));
const mockDisplayResaVeille = jest.fn(async () => undefined);
const mockDisplayRsvp = jest.fn(async () => undefined);

jest.mock('@/services/notificationActions/rsvpActions', () => ({
  displayChatReplyActionableNotification: jest.fn(async () => undefined),
  displayEventRsvpActionableNotification: (...args) => mockDisplayRsvp(...args),
  displayResaVeilleActionableNotification: (...args) => mockDisplayResaVeille(...args),
  ensureNotificationActionSetup: jest.fn(async () => undefined),
  handleChatReplyActionPress: (...args) => mockHandleChatReply(...args),
  handleEventRsvpActionPress: (...args) => mockHandleRsvp(...args),
  handleResaVeilleActionPress: (...args) => mockHandleResaVeille(...args),
  isChatReplyActionablePayload: () => false,
  isEventRsvpActionablePayload: (data) => String(data?.type || '') === 'eventReminder',
  isResaVeilleActionablePayload: (data) => String(data?.change || '') === 'veille',
  storePendingOpenNotification: jest.fn(),
}));

// eslint-disable-next-line import/first
import { Platform } from 'react-native';

// eslint-disable-next-line import/first
import { registerBackgroundHandler } from '@/services/notificationBackgroundHandler';

const VEILLE = {
  actionContext: 'resa_veille',
  change: 'veille',
  reservationId: 'r-1',
  type: 'complexeReservationJoueur',
};

beforeAll(() => {
  registerBackgroundHandler();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockHandleChatReply.mockResolvedValue({ handled: false });
  mockHandleRsvp.mockResolvedValue({ handled: false });
  mockHandleResaVeille.mockResolvedValue({ handled: true, success: true });
});

test('RESA-L6B-1/F1 — « Je confirme », appli fermée : réponse partie, notif retirée', async () => {
  await ecouteursDeFond[0]({
    detail: {
      notification: { data: VEILLE, id: 'notif-veille' },
      pressAction: { id: 'resa_veille_confirmer' },
    },
    type: 2,
  });
  expect(mockHandleResaVeille).toHaveBeenCalledWith({
    notificationData: VEILLE,
    pressActionId: 'resa_veille_confirmer',
  });
  expect(mockCancel).toHaveBeenCalledWith('notif-veille');
});

test('RESA-L6B-1/F2 — un bouton qui n’est pas le sien laisse la notification', async () => {
  mockHandleResaVeille.mockResolvedValueOnce({ handled: false });
  await ecouteursDeFond[0]({
    detail: {
      notification: { data: { eventId: 'e-1', type: 'eventReminder' }, id: 'notif-rappel' },
      pressAction: { id: 'event_rsvp_present' },
    },
    type: 2,
  });
  expect(mockHandleRsvp).toHaveBeenCalledTimes(1);
  expect(mockCancel).not.toHaveBeenCalled();
});

test('RESA-L6B-1/F3 — Android, message de fond N-20 : affichée AVEC ses boutons', async () => {
  const plateforme = Platform.OS;
  Platform.OS = 'android';
  try {
    await messagesDeFond[0]({
      data: VEILLE,
      notification: { body: 'Tu confirmes ta réservation de demain 19 h ?', title: 'FoundClub' },
    });
  } finally {
    Platform.OS = plateforme;
  }
  expect(mockDisplayResaVeille).toHaveBeenCalledWith({
    body: 'Tu confirmes ta réservation de demain 19 h ?',
    data: expect.objectContaining({ change: 'veille', reservationId: 'r-1' }),
    title: 'FoundClub',
  });
  expect(mockDisplayRsvp).not.toHaveBeenCalled();
});
