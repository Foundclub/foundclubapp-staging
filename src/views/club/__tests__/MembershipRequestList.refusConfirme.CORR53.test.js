/* eslint-disable max-len */
import { createElement } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// CORR-ROBUSTESSE point 53 (recette du site, 30/10, « A ») — « Refuser » une demande
// d'adhésion partait d'un coup. Les deux anciennes listes (club, équipe), que les
// notifications ouvrent encore, demandent désormais confirmation, comme le hub.

const mockBoutons = [];
const mockMutate = jest.fn();
let mockDemandes = [];

jest.mock('@shopify/flash-list', () => {
  const { createElement: ce, Fragment } = jest.requireActual('react');
  return { FlashList: ({ data, renderItem }) => ce(Fragment, null, data.map((item) => ce(Fragment, { key: item.documentId }, renderItem({ item })))) };
});
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ isPending: false, mutate: mockMutate }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k, r) => {
      if (typeof r === 'string') return r;
      if (r && typeof r === 'object' && r.defaultValue) return r.defaultValue.replace(/\{\{(\w+)\}\}/g, (_m, c) => r[c] ?? '');
      return k;
    },
  }),
}));
jest.mock('@/domains/auth/useAuth', () => () => ({ userData: { documentId: 'moi' } }));
jest.mock('@/domains/requests/requestNavigation', () => ({ navigateToRequestsHub: jest.fn(), REQUESTS_HUB_LEGACY_REDIRECT: false }));
jest.mock('@/theme/themeContext', () => {
  const p = new Proxy(() => p, { get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : p) });
  return () => p;
});
jest.mock('@/components/atoms/button/Button', () => (props) => { mockBoutons.push(props); return null; });
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
jest.mock('@/services/clubMembershipRequest/clubMembershipRequestQueries', () => ({
  useGetClubMembershipRequests: () => ({ data: { pages: [{ data: mockDemandes }] }, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({}));

const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const refuserDans = (Ecran, params, titreRefuser) => {
  mockBoutons.length = 0;
  act(() => { renderer.create(createElement(Ecran, { navigation: { navigate: jest.fn() }, route: { params } })); });
  const refuser = mockBoutons.find((b) => b.title === titreRefuser);
  expect(refuser).toBeDefined();
  act(() => { refuser.onPress(); });
};

beforeEach(() => { jest.clearAllMocks(); });

test.each([
  // eslint-disable-next-line global-require
  ['club', () => require('../ClubMembershipRequestList').default, { clubId: 'c1' }, 'clubMembershipRequestList.actions.reject',
    {
      club: { name: 'FC' }, documentId: 'd1', permissions: { canManage: true }, type: 'join', user: { firstname: 'Bo', lastname: 'Dupont' },
    }],
  // eslint-disable-next-line global-require
  ['equipe', () => require('../../team/TeamMembershipRequestList').default, { teamId: 'e1' }, 'teamMembershipRequestList.actions.reject',
    {
      documentId: 'd1', permissions: { canManage: true }, team: { name: 'A' }, user: { firstname: 'Bo', lastname: 'Dupont' },
    }],
])('point 53 — liste %s : « Refuser » demande confirmation, puis envoie une fois', (_nom, ecran, params, titre, demande) => {
  mockDemandes = [demande];
  refuserDans(ecran(), params, titre);

  expect(mockMutate).not.toHaveBeenCalled();
  expect(alerte).toHaveBeenCalledTimes(1);
  expect(alerte.mock.calls[0][0]).toMatch(/^Refuser la demande de Bo/);
  const confirmer = alerte.mock.calls[0][2].find((b) => b.style === 'destructive');
  act(() => { confirmer.onPress(); });
  expect(mockMutate).toHaveBeenCalledTimes(1);
  expect(mockMutate).toHaveBeenCalledWith('d1');
});
