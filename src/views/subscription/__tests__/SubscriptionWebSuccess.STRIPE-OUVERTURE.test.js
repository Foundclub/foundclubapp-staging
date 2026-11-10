import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import SubscriptionWebSuccess from '../SubscriptionWebSuccess';

// STRIPE-OUVERTURE / L0 (10/11) — au retour de la page de paiement, l'ecran
// affichait le message du serveur TEL QUEL (`error?.message`) : un client qui
// vient de payer pouvait lire « Achat web transmis a Stripe mais pas a
// RevenueCat: … ». Il doit lire une phrase claire, qui dit que son paiement est recu.

const mockFinalize = jest.fn();

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
  scheduleSubscriptionStateRefresh: jest.fn(),
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

jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});

test('STRIPE-OUVERTURE / L0 — transmission ratee apres paiement : rien de technique', async () => {
  mockFinalize.mockRejectedValue({
    message: 'Achat web transmis a Stripe mais pas a RevenueCat: Service Unavailable',
  });
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SubscriptionWebSuccess
        navigation={{ replace: jest.fn(), reset: jest.fn() }}
        route={{ params: { session_id: 'cs_1' } }}
      />,
    );
  });

  // Un <Text> peut porter plusieurs enfants (message + phrase d aide) : on les lit tous.
  const textes = arbre.root.findAll((node) => node.type === 'Text')
    .flatMap((node) => [].concat(node.props.children))
    .filter((enfant) => typeof enfant === 'string')
    .join(' | ');
  expect(textes).not.toMatch(/stripe|revenuecat/i);
  expect(textes).toMatch(/paiement est bien reçu/i);
});
