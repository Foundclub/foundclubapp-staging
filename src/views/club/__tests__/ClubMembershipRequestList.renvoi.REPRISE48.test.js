/* eslint-disable max-len */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

const mockBoutons = [];
const mockMutate = jest.fn();
const mockDemandes = [];

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
let mockRole = 'Dirigeant';
jest.mock('@/domains/auth/useAuth', () => () => ({ userData: { documentId: 'moi', role: { type: mockRole } } }));
const mockVersDemandes = jest.fn();
jest.mock('@/domains/requests/requestNavigation', () => ({
  navigateToRequestsHub: (...args) => mockVersDemandes(...args),
  REQUESTS_HUB_LEGACY_REDIRECT: false,
}));
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
jest.mock('@/services/clubMembershipRequest/clubMembershipRequestQueries', () => ({
  useGetClubMembershipRequests: () => ({ data: { pages: [{ data: mockDemandes }] }, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({}));

// REPRISE-MESSAGERIE p48 (01/11, revue « modifier », Dirigeant) — l'ancienne page des demandes du
// CLUB affichait encore « Ce flux a été migré vers Demandes » et attendait un clic ; celle de
// l'équipe renvoie seule. Elle renvoie seule aussi, sauf chez le SuperAdmin : la notification
// d'une revendication de club l'y mène, et lui seul peut la trancher ici.
const ouvrir = () => {
  mockVersDemandes.mockClear();
  // eslint-disable-next-line global-require
  const Ecran = require('../ClubMembershipRequestList').default;
  act(() => {
    renderer.create(createElement(Ecran, { navigation: { navigate: jest.fn() }, route: { params: { clubId: 'c1' } } }));
  });
};

test('un dirigeant qui ouvre l ancienne page part seul vers Demandes (filtre Club), sans retour possible', () => {
  mockRole = 'Dirigeant';
  ouvrir();
  expect(mockVersDemandes).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ initialFilter: 'club' }),
    { remplacer: true },
  );
});

test('le SuperAdmin reste sur la page : il y tranche les revendications', () => {
  mockRole = 'SuperAdmin';
  ouvrir();
  expect(mockVersDemandes).not.toHaveBeenCalled();
});
