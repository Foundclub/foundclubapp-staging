/* eslint-disable max-len -- les témoins se lisent en entier. */
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationList from '../NotificationList';

// RECETTE-WEB-DIRIGEANT n° 2 (30/10) — TOUCHER « Invitation d'équipe » DANS LA CLOCHE RELIT LE COMPTE
// AVANT D'OUVRIR LA FICHE, pour que « Accepter / Refuser » y soit (voir le témoin du contrôleur,
// hooks/__tests__/useNotificationController.RWDIRIG.ouvrirRelitLeCompte.test.js). Harnais repris de
// NotificationListCOACH1.test.js.

const mockPost = jest.fn();
const mockMarkAsRead = jest.fn(async () => undefined);
const mockRefreshAfterOpening = jest.fn();
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
    refreshAfterOpening: mockRefreshAfterOpening,
    refreshNotifications: jest.fn(),
    unreadCount: 1,
  }),
}));

const invitation = () => ({
  body: 'Dina Recette t invite a rejoindre l equipe U11 Tunnel.',
  createdAt: new Date().toISOString(),
  data: { teamId: 'team-1', type: 'teamMembershipInvitation' },
  documentId: 'notif-2',
  read: false,
  title: 'Invitation d equipe',
  type: 'teamMembershipInvitation',
});

test('🔴 toucher une invitation d équipe relit ce qu elle rend faux, avec son type', async () => {
  mockNotifications.list = [invitation()];
  /** @type {any} */
  let tree = null;
  act(() => {
    tree = renderer.create(<NotificationList />);
  });
  const ligne = tree.root.findAllByType(TouchableOpacity)
    .find((/** @type {any} */ node) => node.findAllByType(Text)
      .some((/** @type {any} */ text) => text.props.children === 'Invitation d equipe'));
  await act(async () => {
    await ligne.props.onPress();
  });
  expect(mockRefreshAfterOpening).toHaveBeenCalledWith('teamMembershipInvitation');
});
