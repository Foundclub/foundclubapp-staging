import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

// BH12 P12-09 : sans `permissions.canManage === true`, pas de boutons Accepter / Refuser.
const mockBoutons = [];
let mockDemandes = [];

jest.mock('@shopify/flash-list', () => {
  const { createElement: ce, Fragment } = jest.requireActual('react');
  return { FlashList: ({ data, renderItem }) => ce(Fragment, null, data.map((item) => ce(Fragment, { key: item.documentId }, renderItem({ item })))) };
});
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ isPending: false, mutate: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k, r) => (typeof r === 'string' ? r : k) }) }));
jest.mock('@/domains/auth/useAuth', () => () => ({ userData: { documentId: 'moi' } }));
jest.mock('@/domains/requests/requestNavigation', () => ({ navigateToRequestsHub: jest.fn(), REQUESTS_HUB_LEGACY_REDIRECT: false }));
jest.mock('@/theme/themeContext', () => {
  const p = new Proxy(() => p, { get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : p) });
  return () => p;
});
jest.mock('@/components/atoms/button/Button', () => (props) => { mockBoutons.push(props.title); return null; });
jest.mock('@/components/atoms/tag/Tag', () => () => null);
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => () => null);
jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => ({ children }) => children);
jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => ({ children }) => children);
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => ({ children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => ({ children }) => children);
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestQueries', () => ({
  useGetTeamMembershipRequests: () => ({ data: { pages: [{ data: mockDemandes }] }, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({}));

const TeamMembershipRequestList = require('../TeamMembershipRequestList').default;

const monter = () => {
  mockBoutons.length = 0;
  act(() => {
    renderer.create(createElement(TeamMembershipRequestList, { navigation: {}, route: { params: { teamId: 'e1' } } }));
  });
};

test('P12-09 : le serveur ne dit rien ⇒ aucun bouton', () => {
  mockDemandes = [{ documentId: 'd1', team: { name: 'A' }, user: { firstname: 'Bo' } }];
  monter();
  expect(mockBoutons).toEqual([]);
});

test('P12-09 : canManage true ⇒ Accepter et Refuser', () => {
  mockDemandes = [{ documentId: 'd1', permissions: { canManage: true }, team: { name: 'A' }, user: { firstname: 'Bo' } }];
  monter();
  expect(mockBoutons.length).toBe(2);
});
