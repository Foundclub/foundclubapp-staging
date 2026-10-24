// LOT COACH1 (E6) — CARACTERISATION de la notification poussee « Present / Absent ».
//
// Ce fichier n avait AUCUN test. Il decrit ce qui existe, et le verrouille :
// les boutons de la notification ne lisent NI role, NI equipe — seulement
// « c est un rappel d evenement » (`eventReminder`). Un entraineur qui en
// recoit un a donc les deux boutons, et son appui part sur la MEME porte que
// la fiche (`POST /events/:id/rsvp`), sans filtre dans l app.
//
// 🎯 CE QUI BLOQUAIT L ENTRAINEUR N ETAIT PAS ICI : c etait le refus du serveur
// (`EVENT_STAFF_DOES_NOT_RSVP`, lot Y07), retire par COACH1 cote `admin`
// (`tests/authz/COACH1-encadrants-presence-convocation.test.js`, S1 a S7).
// ⇒ Ces temoins sont VERTS avant comme apres : c est voulu, ils prouvent que la
// surface suit deja la regle de la fiche, sans second garde-fou a maintenir.

const mockPost = jest.fn();

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => 'canal'),
    displayNotification: jest.fn(async () => undefined),
    setNotificationCategories: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  ...jest.requireActual('@/domains/auth/authUseCases'),
  activateSessionForNotificationPayload: jest.fn(async () => ({
    session: { token: 'jeton-entraineur' },
  })),
}));

// eslint-disable-next-line import/first
import { activateSessionForNotificationPayload } from '@/domains/auth/authUseCases';
// eslint-disable-next-line import/first
import { EVENT_RSVP_ACTION_ABSENT, EVENT_RSVP_ACTION_PRESENT } from '../constants';
// eslint-disable-next-line import/first
import {
  handleEventRsvpActionPress,
  isEventRsvpActionablePayload,
} from '../rsvpActions';

/**
 * Le rappel TEL QUE le serveur l envoie (`send-notifications.ts`,
 * `resolveActionablePushConfig`) — ici recu par un ENTRAINEUR. Rien dans la
 * charge ne dit le role du destinataire : c est ce que ces temoins verifient.
 * @returns {Record<string, string>} La charge.
 */
const rappelRecuParUnEntraineur = () => ({
  actionContext: 'event_rsvp',
  eventId: 'event-1',
  notificationId: 'notif-1',
  phase: 'manual',
  type: 'eventReminder',
});

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: { success: true } });
});

test('COACH1/N1 — un rappel d evenement recu par un entraineur porte les deux boutons', () => {
  expect(isEventRsvpActionablePayload(rappelRecuParUnEntraineur())).toBe(true);
});

test('COACH1/N2 — « Present » part sur `/events/:id/rsvp`, sans filtre de role', async () => {
  const result = await handleEventRsvpActionPress({
    notificationData: rappelRecuParUnEntraineur(),
    pressActionId: EVENT_RSVP_ACTION_PRESENT,
  });

  expect(result).toEqual({ handled: true, success: true });
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost.mock.calls[0][0]).toBe('/events/event-1/rsvp');
  expect(mockPost.mock.calls[0][1]).toEqual({
    answer: 'present',
    notificationId: 'notif-1',
    source: 'push_action',
  });
});

test('COACH1/N3 — « Absent » aussi', async () => {
  await handleEventRsvpActionPress({
    notificationData: rappelRecuParUnEntraineur(),
    pressActionId: EVENT_RSVP_ACTION_ABSENT,
  });

  expect(mockPost.mock.calls[0][1]).toMatchObject({ answer: 'absent' });
});

test('COACH1/N4 🔒 — une autre notification que le rappel n a PAS de boutons', () => {
  const autre = { ...rappelRecuParUnEntraineur(), type: 'eventPublished' };
  expect(isEventRsvpActionablePayload(autre)).toBe(false);
});

test('BH01/P2-01 🔒 — sans session pour le compte vise, la presence ne part PAS', async () => {
  activateSessionForNotificationPayload.mockResolvedValueOnce({
    activated: false,
    reason: 'session_not_found',
  });

  const result = await handleEventRsvpActionPress({
    notificationData: rappelRecuParUnEntraineur(),
    pressActionId: EVENT_RSVP_ACTION_PRESENT,
  });

  expect(mockPost).not.toHaveBeenCalled();
  expect(result).toMatchObject({ handled: true, success: false });
});
