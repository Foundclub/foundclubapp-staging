import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import NotificationList from '../NotificationList';

// VILLE-NOTIFS (T18, point 2 — 07/10) : « VOIR TOUTES LES NOTIFICATIONS » DISAIT « AUCUNE
// NOTIFICATION » ALORS QUE LA LECTURE AVAIT ECHOUE (capture G53b_toutes_notifications_ville :
// `GET /notifications` ⇒ 400 pour un gestionnaire de Ville sans club, cloche a 4).
// Une erreur de lecture se dit, avec « Reessayer » ; une liste vraiment vide reste « Aucune
// notification ». Harnais repris de NotificationList.COLL-C3B-BIS.test.js.

const mockEtat = {
  isError: false,
  list: /** @type {any[]} */ ([]),
  refetch: jest.fn(),
  refreshNotifications: jest.fn(),
};

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
      ApplicationStyle: makeRamp(),
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

jest.mock('@/services/client', () => ({ __esModule: true, default: { post: jest.fn() } }));

jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    deleteNotification: jest.fn(),
    hasNextPage: false,
    isError: mockEtat.isError,
    isFetchingNextPage: false,
    isLoading: false,
    loadMore: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
    notifications: mockEtat.list,
    refetch: mockEtat.refetch,
    refreshNotifications: mockEtat.refreshNotifications,
    unreadCount: 4,
  }),
}));

const monter = () => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(<NotificationList />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .flatMap((/** @type {any} */ noeud) => [].concat(noeud.props.children))
  .filter((/** @type {any} */ v) => v !== null && v !== undefined && v !== false)
  .map(String);

beforeEach(() => {
  mockEtat.isError = false;
  mockEtat.list = [];
  mockEtat.refetch.mockClear();
  mockEtat.refreshNotifications.mockClear();
});

test('VILLE-NOTIFS/L1 — lecture en erreur et rien a montrer : l erreur et « Reessayer », jamais « Aucune notification »', () => {
  mockEtat.isError = true;
  const arbre = monter();
  const affiches = textes(arbre);
  expect(affiches).toContain('Impossible de charger les notifications.');
  expect(affiches).toContain('Réessayer');
  expect(affiches).not.toContain('Aucune notification');
});

test('VILLE-NOTIFS/L2 — « Reessayer » relance la lecture (liste et cloche)', () => {
  mockEtat.isError = true;
  const arbre = monter();
  const bouton = arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.accessibilityLabel === 'Réessayer' && typeof n.props?.onPress === 'function'
  ))[0];
  expect(bouton).toBeTruthy();
  act(() => { bouton.props.onPress(); });
  expect(mockEtat.refreshNotifications).toHaveBeenCalledTimes(1);
});

test('VILLE-NOTIFS/L3 — caracterise : une liste vraiment vide dit toujours « Aucune notification »', () => {
  const arbre = monter();
  const affiches = textes(arbre);
  expect(affiches).toContain('Aucune notification');
  expect(affiches).not.toContain('Impossible de charger les notifications.');
});
