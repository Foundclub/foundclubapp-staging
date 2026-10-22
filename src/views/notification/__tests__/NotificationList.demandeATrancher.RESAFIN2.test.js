import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import NotificationList from '../NotificationList';

// RESA-FIN-APP-2 (22/10/2026) — plan E-G19 §3.3-4 : une ligne de DEMANDE (N-02, N-03) porte
// « Accepter » / « Refuser » dans la carte ; « Accepter » ⇒ comme E-G06 ; « Refuser » ⇒ la
// feuille du motif (celle de « Demandes », ouverte sur cette demande). SEULEMENT si la demande
// attend encore : `data.reservationStatus === 'en_attente'` (serveur RESAFINSRV2 64efe693). Sans
// le champ, rien (lecture tolérante ; le 409 d'état reste le filet). Harnais repris de
// NotificationList.COLL-C3B-BIS.

const mockNotifications = { list: [] };
const mockNavigate = jest.fn();
const mockDecider = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn(), navigate: mockNavigate }),
}));
jest.mock('@/config/fonctionsMasquees', () => ({
  ...jest.requireActual('@/config/fonctionsMasquees'),
  COMPLEXES_GERANT: true,
}));
jest.mock('@/services/complexe/complexeQueries', () => ({
  useDeciderDemande: () => ({ isPending: false, mutateAsync: mockDecider }),
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

const demande = (
  /** @type {string} */ documentId,
  /** @type {Record<string, any>} */ donnees = {},
) => ({
  body: 'Nouvelle demande : Terrain 2, mardi 20/10, 19 h, par Julien M. À accepter ou refuser.',
  createdAt: new Date().toISOString(),
  data: {
    change: 'demande',
    complexeId: 'cx-five',
    reservationId: `r-${documentId}`,
    type: 'complexeReservationGerant',
    ...donnees,
  },
  documentId,
  read: false,
  title: 'Nouvelle demande',
  type: 'complexeReservationGerant',
});

const monter = () => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(<NotificationList />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [noeud.props.children].flat().join(''));

const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const [noeud] = arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.testID === testID && typeof n.props?.onPress === 'function'
  ));
  await act(async () => {
    await noeud.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNotifications.list = [];
  mockDecider.mockResolvedValue({ data: {} });
});

describe('RESA-FIN-APP-2 — « Accepter » / « Refuser » dans la cloche du gérant', () => {
  it('seulement sur une demande en attente (N-02, N-03) ; jamais sans le champ', () => {
    mockNotifications.list = [
      demande('a', { reservationStatus: 'en_attente' }),
      demande('b', { change: 'expire-bientot', reservationStatus: 'en_attente' }),
      demande('c', { reservationStatus: 'confirmee' }),
      demande('d'),
      demande('e', { change: 'annulee', reservationStatus: 'en_attente' }),
    ];
    const arbre = monter();
    const boutons = (/** @type {string} */ id) => ['accepter', 'refuser']
      .map((geste) => arbre.root.findAll((/** @type {any} */ n) => (
        n.props?.testID === `cloche-${geste}-${id}` && typeof n.props?.onPress === 'function'
      )).length > 0);
    expect(boutons('a')).toEqual([true, true]);
    expect(boutons('b')).toEqual([true, true]);
    expect(boutons('c')).toEqual([false, false]);
    expect(boutons('d')).toEqual([false, false]);
    expect(boutons('e')).toEqual([false, false]);
  });

  it('« Accepter » tranche ; les boutons laissent place à « Demande acceptée. »', async () => {
    mockNotifications.list = [demande('a', { reservationStatus: 'en_attente' })];
    const arbre = monter();
    await appuyer(arbre, 'cloche-accepter-a');
    expect(mockDecider).toHaveBeenCalledWith({
      complexeId: 'cx-five', decision: 'accepter', reservationId: 'r-a',
    });
    expect(textes(arbre)).toContain('Demande acceptée.');
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'cloche-accepter-a'))
      .toHaveLength(0);
  });

  it('déjà tranchée ailleurs (409) : « Cette demande est déjà tranchée. »', async () => {
    mockDecider.mockRejectedValue({
      details: { code: 'COMPLEXE_RESERVATION_STATE' },
      message: 'Cette demande a expiré.',
      status: 409,
    });
    mockNotifications.list = [demande('a', { reservationStatus: 'en_attente' })];
    const arbre = monter();
    await appuyer(arbre, 'cloche-accepter-a');
    expect(textes(arbre)).toContain('Cette demande est déjà tranchée.');
  });

  it('« Refuser » ouvre « Demandes » sur la feuille du motif de cette demande', async () => {
    mockNotifications.list = [demande('a', { reservationStatus: 'en_attente' })];
    const arbre = monter();
    await appuyer(arbre, 'cloche-refuser-a');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ComplexeEspace, {
      params: { complexeId: 'cx-five', refuser: 'r-a' },
      screen: RouteNames.ComplexeDemandes,
    });
  });
});
