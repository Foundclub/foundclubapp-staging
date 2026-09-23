// LOT REPNOTIF (suite, GO chef d orchestre du 2026-09-23) — LES LIBELLES DES
// BOUTONS DE NOTIFICATION, ET LE FAIT QUE LES DEUX PLATEFORMES DISENT PAREIL.
//
// 🧨 CE QUI ETAIT MESURE. Les boutons du rappel d evenement etaient ecrits DEUX
// FOIS, et pas de la meme facon :
//   · iOS  passait par les traductions (`i18next.t('rsvpActions.actions.…')`) ;
//   · Android les avait EN DUR dans le code : 'Present' et 'Absent'.
// Consequence : sur Android le bouton restait en francais meme pour un
// anglophone, et il restait SANS ACCENT pour tout le monde. Et le francais
// lui-meme disait « Present », alors que le reste de l app dit « Présent ».
//
// 🎯 CE QUE CE TEMOIN VERROUILLE. Pas seulement l accent : le fait que les deux
// plateformes lisent LA MEME SOURCE. Deux listes de libelles ecrites a la main
// derivent — c est exactement ce que REPNOTIF a trouve trois fois ailleurs.

const mockDisplay = jest.fn(async () => undefined);
const mockCategories = jest.fn(async () => undefined);

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => 'canal'),
    displayNotification: (...args) => mockDisplay(...args),
    setNotificationCategories: (...args) => mockCategories(...args),
  },
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

// eslint-disable-next-line import/first
import fr from '@/theme/strings/translations/fr';

// eslint-disable-next-line import/first
import { EVENT_RSVP_ACTION_ABSENT, EVENT_RSVP_ACTION_PRESENT } from '../constants';
// eslint-disable-next-line import/first
import { displayEventRsvpActionableNotification } from '../rsvpActions';

/**
 * Les libelles ranges dans les boutons Android de la derniere notification.
 * @returns {Array<{ id: string, titre: string }>} Les boutons, dans l ordre.
 */
const libellesAndroid = () => {
  const affichee = mockDisplay.mock.calls.at(-1)?.[0];
  return (affichee?.android?.actions || []).map((action) => ({
    id: action?.pressAction?.id,
    titre: action?.title,
  }));
};

/**
 * Les libelles de la categorie iOS du rappel d evenement.
 * @returns {Array<{ id: string, titre: string }>} Les boutons, dans l ordre.
 */
const libellesIos = () => {
  const categories = mockCategories.mock.calls.at(-1)?.[0] || [];
  const rappel = categories.find((categorie) => categorie?.id === 'EVENT_RSVP_CATEGORY');
  return (rappel?.actions || []).map((action) => ({ id: action?.id, titre: action?.title }));
};

beforeEach(async () => {
  mockDisplay.mockClear();
  mockCategories.mockClear();
  await displayEventRsvpActionableNotification({
    body: 'Entrainement demain 18h',
    data: { actionContext: 'event_rsvp', eventId: 'event-1', type: 'eventReminder' },
    title: 'U15 Garcons',
  });
});

test('REPNOTIF/L1 — les boutons Android sont TRADUITS, pas ecrits en dur', () => {
  expect(libellesAndroid()).toEqual([
    { id: EVENT_RSVP_ACTION_PRESENT, titre: fr.rsvpActions.actions.present },
    { id: EVENT_RSVP_ACTION_ABSENT, titre: fr.rsvpActions.actions.absent },
  ]);
});

test('REPNOTIF/L2 🔒 — iOS et Android disent EXACTEMENT la meme chose', () => {
  // C est ce controle-la qui empeche les deux listes de rediverger : l accent
  // se remet en une seconde, la divergence revient toute seule.
  expect(libellesAndroid()).toEqual(libellesIos());
});

test('REPNOTIF/L3 — et en francais, « Présent » porte son accent', () => {
  // Le reste de l app l ecrit avec son accent depuis toujours ; seul ce bouton
  // ne le faisait pas.
  expect(fr.rsvpActions.actions.present).toBe('Présent');
});
