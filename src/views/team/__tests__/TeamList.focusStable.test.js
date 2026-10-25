/* eslint-disable max-len */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

// BH12 P12-08 : la fonction donnee a useFocusEffect doit rester la MEME d'un rendu a l'autre,
// sinon react-navigation la relance a chaque rendu (boucle d'appels tant que get-me echoue).
const mockFocus = [];
const mockRefetch = jest.fn();
const mockAuth = { canManageTeam: false, refetchUserData: mockRefetch, userData: { club: { documentId: 'c1' } } };
const mockPopup = { canShow: false, descriptor: { id: 'x', priority: 1 }, markShown: jest.fn() };

jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { mockFocus.push(cb); } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k, r) => (typeof r === 'string' ? r : k) }) }));
jest.mock('@/domains/auth/useAuth', () => () => mockAuth);
jest.mock('@/context/ClubScopeContext', () => ({ useClubScope: () => ({}) }));
jest.mock('@/navigation/commonOptions', () => ({ getFloatingActionContainerStyle: () => ({}) }));
jest.mock('@/navigation/useBottomDockLayout', () => () => ({ floatingActionBottomOffset: 0 }));
jest.mock('@/context/PopupManagerContext', () => ({ usePopupEligibility: () => mockPopup }));
jest.mock('@/context/BlockingOverlayContext', () => ({ useBlockingOverlayPrompt: () => false }));
jest.mock('@/theme/themeContext', () => {
  const p = new Proxy(() => p, { get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : p) });
  return () => p;
});
jest.mock('@/components/atoms/webFloatingOverlay/WebFloatingOverlay', () => () => null);
jest.mock('@/components/molecules/header/LeagueHeaderSwitch', () => () => null);
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => () => null);
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => () => null);
jest.mock('@/components/organisms/teamListContent/TeamListContent', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => () => null);

const TeamList = require('../TeamList').default;

test('P12-08 : useFocusEffect reçoit une fonction stable', () => {
  const props = { navigation: { navigate: jest.fn(), setOptions: jest.fn() }, route: { params: {} } };
  let racine;
  act(() => { racine = renderer.create(createElement(TeamList, props)); });
  act(() => { racine.update(createElement(TeamList, { ...props })); });
  expect(mockFocus.length).toBeGreaterThanOrEqual(2);
  expect(mockFocus[mockFocus.length - 1]).toBe(mockFocus[0]);
});
