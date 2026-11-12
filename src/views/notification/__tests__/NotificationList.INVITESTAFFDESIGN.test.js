import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { withAlpha } from '@/theme/colors';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import NotificationList from '../NotificationList';

// INVITE-STAFF-DESIGN (11/11/2026, maquette E validée le 10/11) — dans la cloche, l'invitation
// de staff qui attend une réponse porte la teinte or (bord, fond, icône) ; une fois répondue, ou
// pour toute autre notification, la ligne garde ses couleurs. Harnais repris de
// NotificationList.demandeATrancher.RESAFIN2.

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

jest.mock('@/services/client', () => ({ __esModule: true, default: { post: jest.fn() } }));

jest.mock('@/hooks/useNotificationController', () => ({
  useNotificationController: () => ({
    deleteNotification: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    loadMore: jest.fn(),
    markAllAsRead: jest.fn(),
    markAsRead: jest.fn(),
    notifications: mockNotifications.list,
    refreshNotifications: jest.fn(),
    unreadCount: 1,
  }),
}));

jest.mock(
  '@/components/organisms/invitationDeStaff/ActionsInvitationDeStaff',
  () => () => null,
);

const ligne = (
  /** @type {string} */ documentId,
  /** @type {string} */ type,
  /** @type {any} */ data = {},
) => ({
  body: 'Touche pour accepter ou refuser.',
  createdAt: new Date().toISOString(),
  data: { invitationId: `inv-${documentId}`, ...data },
  documentId,
  read: false,
  title: 'FC Lyon Est t’invite comme coach',
  type,
});

const monter = () => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(<NotificationList />);
  });
  return arbre;
};

const styleDe = (/** @type {any} */ arbre, /** @type {string} */ testID) => StyleSheet.flatten(
  arbre.root.find((/** @type {any} */ n) => n.props?.testID === testID).props.style,
);

const OR = 'couleur-gold500';

describe('INVITE-STAFF-DESIGN — E la teinte or de l invitation dans la cloche', () => {
  it('une invitation qui attend : bord or, fond teinté, icône or', () => {
    mockNotifications.list = [ligne('n1', 'staffInvitation')];
    const arbre = monter();
    const style = styleDe(arbre, 'cloche-ligne-n1');
    expect(style.borderColor).toBe(withAlpha(OR, 0.45));
    expect(style.borderWidth).toBe(1);
    expect(style.backgroundColor).toBe(withAlpha(OR, 0.08));
    expect(arbre.root.findAllByType(SvgIcon)[0].props.color).toBe(OR);
  });

  it('une invitation répondue, ou une autre notification : pas d or', () => {
    mockNotifications.list = [
      ligne('n2', 'staffInvitation', { answered: true }),
      ligne('n3', 'staffInvitationAccepted'),
    ];
    const arbre = monter();
    ['cloche-ligne-n2', 'cloche-ligne-n3'].forEach((testID) => {
      expect(styleDe(arbre, testID).borderColor).not.toBe(withAlpha(OR, 0.45));
    });
    arbre.root.findAllByType(SvgIcon).forEach((/** @type {any} */ icone) => {
      expect(icone.props.color).not.toBe(OR);
    });
  });
});
