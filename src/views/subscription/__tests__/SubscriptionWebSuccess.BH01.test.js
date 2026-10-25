import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import SubscriptionWebSuccess from '../SubscriptionWebSuccess';

// BH01/P5-04 — un paiement Stripe pas encore confirmé ne doit pas fêter « C'est débloqué ».

const mockFinalize = jest.fn();
const mockScheduleRefresh = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ id: 'query-client-test' }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => (typeof fallback === 'string' ? fallback : key) }),
}));

jest.mock('@/services/subscription/subscriptionService', () => ({
  finalizeStripeWebCheckoutSession: (...args) => mockFinalize(...args),
  trackSubscriptionFunnelEvent: jest.fn(),
}));

jest.mock('@/domains/subscription/subscriptionRefresh', () => ({
  invalidateSubscriptionState: jest.fn(),
  scheduleSubscriptionStateRefresh: (...args) => mockScheduleRefresh(...args),
}));

jest.mock('@/theme/themeContext', () => {
  const makeRamp = () => new Proxy({}, { get: () => ({}) });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

const mockButtons = new Map();
jest.mock('@/components/atoms/button/Button', () => function ButtonMock({ onPress, title }) {
  mockButtons.set(title, onPress);
  return null;
});

const monter = async (navigation) => {
  await act(async () => {
    renderer.create(
      <SubscriptionWebSuccess navigation={navigation} route={{ params: { session_id: 'cs_1' } }} />,
    );
  });
};

test('BH01/P5-04 — paiement en attente : pas de célébration, retour accueil', async () => {
  mockFinalize.mockResolvedValue({ status: 'open' });
  const navigation = { replace: jest.fn(), reset: jest.fn() };
  await monter(navigation);

  expect(navigation.replace).not.toHaveBeenCalled();
  expect(mockScheduleRefresh).toHaveBeenCalled();
  await act(async () => { mockButtons.get("Retour à l'accueil")(); });
  expect(navigation.reset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: RouteNames.HomeTab }],
  });
});

test('BH01/P5-04 — paiement confirmé : la célébration reste', async () => {
  mockFinalize.mockResolvedValue({ status: 'submitted' });
  const navigation = { replace: jest.fn(), reset: jest.fn() };
  await monter(navigation);

  expect(navigation.replace)
    .toHaveBeenCalledWith(RouteNames.SubscriptionSuccess, expect.any(Object));
});
