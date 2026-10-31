import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationList from '../NotificationList';

// LOT COACH1 (E6) — CARACTERISATION des boutons « Je participe / Je suis absent »
// de la LISTE des notifications.
//
// Ce fichier n avait AUCUN test. Il decrit ce qui existe : la ligne d un rappel
// d evenement (`eventReminder`) porte les deux boutons, quel que soit le role
// du lecteur, et leur appui part sur `POST /events/:id/rsvp` — la MEME porte
// que la fiche. Rien dans l app ne filtre l entraineur : c est le serveur qui
// le refusait (Y07), et COACH1 a retire ce refus cote `admin`.
// ⇒ VERT avant comme apres, et c est voulu : la surface suit deja la regle.

const mockPost = jest.fn();
const mockMarkAsRead = jest.fn(async () => undefined);
const mockNotifications = { list: [] };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }),
}));

jest.mock('react-native-gesture-handler/Swipeable', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function SwipeableDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('react-native-reanimated', () => {
  const rn = jest.requireActual('react-native');
  const chain = { delay: () => chain, duration: () => chain };
  return { __esModule: true, default: { View: rn.View }, FadeInDown: chain };
});

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: makeRamp(),
    }),
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (key, fallback) => (typeof fallback === 'string' ? fallback : key) }),
}));

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);

jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});

jest.mock('@/navigation/navigationService', () => ({ navigate: jest.fn() }));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    deleteNotification: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    loadMore: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: mockMarkAsRead,
    notifications: mockNotifications.list,
    refreshNotifications: jest.fn(),
    unreadCount: 1,
  }),
}));

/**
 * Le rappel tel qu il est range dans la liste d un ENTRAINEUR : rien n y dit le
 * role du destinataire.
 * @returns {object} La notification.
 */
const rappelDansLaListe = () => ({
  body: 'Tu n as pas encore repondu a Entrainement U15.',
  createdAt: new Date().toISOString(),
  data: { eventId: 'event-1', phase: 'manual', type: 'eventReminder' },
  documentId: 'notif-1',
  read: false,
  title: 'Reponse attendue',
  type: 'eventReminder',
});

const monter = () => {
  let tree = null;
  act(() => {
    tree = renderer.create(<NotificationList />);
  });
  return tree;
};

const boutonNomme = (tree, libelle) => tree.root.findAllByType(TouchableOpacity)
  .find((node) => node.findAllByType(Text).some((text) => text.props.children === libelle));

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: { success: true } });
  mockMarkAsRead.mockClear();
  mockNotifications.list = [rappelDansLaListe()];
});

test('COACH1/L1 — la ligne d un rappel porte « Je participe » et « Je suis absent »', () => {
  const tree = monter();

  expect(boutonNomme(tree, 'Je participe')).toBeTruthy();
  expect(boutonNomme(tree, 'Je suis absent')).toBeTruthy();
});

test('COACH1/L2 — « Je participe » part sur `/events/:id/rsvp`, sans filtre de role', async () => {
  const tree = monter();

  await act(async () => {
    await boutonNomme(tree, 'Je participe').props.onPress();
  });

  expect(mockPost).toHaveBeenCalledWith('/events/event-1/rsvp', {
    answer: 'present',
    notificationId: 'notif-1',
    source: 'in_app',
  });
});

test('COACH1/L3 🔒 — une notification qui n est pas un rappel n a pas ces boutons', () => {
  mockNotifications.list = [{
    ...rappelDansLaListe(),
    data: { eventId: 'event-1', type: 'eventPublished' },
    type: 'eventPublished',
  }];
  const tree = monter();

  expect(boutonNomme(tree, 'Je participe')).toBeFalsy();
});

test('BH01/P5-18 — la presence enregistree le dit, meme si « marquer lu » echoue', async () => {
  // eslint-disable-next-line global-require
  const { Alert } = require('react-native');
  const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  mockMarkAsRead.mockRejectedValueOnce(new Error('reseau'));
  const tree = monter();

  await act(async () => {
    await boutonNomme(tree, 'Je participe').props.onPress();
  });

  expect(alerte).toHaveBeenCalledWith('Notifications', 'Présence enregistrée.');
  alerte.mockRestore();
});

// CORR-ROBUSTESSE point 55 (recette du site, 30/10, « A ») — la ligne d'une notification se
// touche, mais n'était annoncée ni comme bouton, ni par son contenu.
test('point 55 — une ligne de notification est un bouton nommé (titre, texte)', () => {
  const tree = monter();
  const ligne = tree.root.findAllByType(TouchableOpacity)
    .find((node) => node.props.accessibilityLabel
      === 'Reponse attendue. Tu n as pas encore repondu a Entrainement U15.');

  expect(ligne).toBeTruthy();
  expect(ligne.props.accessibilityRole).toBe('button');
  expect(boutonNomme(tree, 'Je participe').props.accessibilityRole).toBe('button');
  expect(boutonNomme(tree, 'Je suis absent').props.accessibilityRole).toBe('button');
});
