import { Platform } from 'react-native';

import { RouteNames } from '@/navigation/routeNames';

// C07 / Q2-14 — « Saisir le score » d'un rappel de ligue, depuis l'onglet
// Accueil : sur téléphone, `navigate` rend TOUJOURS true (navigationService),
// donc le repli imbriqué n'était jamais tenté et l'appel nu « EndMatchScreen »
// n'était traité par aucun navigateur (l'écran ne vit que dans la pile de la
// ligue). Le rappel était en plus fermé pour la session.

const mockNavigate = jest.fn(() => true);
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => null,
  getCurrentRouteTrail: () => [],
  navigate: (...args) => mockNavigate(...args),
  navigationRef: { isReady: () => true },
}));
jest.mock('@/domains/auth/useAuth', () => () => ({}));
jest.mock('@/domains/auth/authUseCases', () => ({ getUserRoleKey: () => '' }));
jest.mock('@/context/AppFeedbackContext', () => ({ useAppFeedback: () => ({}) }));
jest.mock('@/context/PopupManagerContext', () => ({ usePopupEligibility: () => ({}) }));
jest.mock('@/hooks/useLeagueLegalAcceptance', () => () => ({}));
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('@/components/organisms/venueProposalModal/VenueProposalModal', () => () => null);
jest.mock('@/components/molecules/header/LeagueModalHeader', () => () => null);
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(), get: jest.fn(), post: jest.fn(), put: jest.fn(),
  },
}));

const { openLeagueScoreFlow } = require('../LeagueActionPromptHost');

describe('openLeagueScoreFlow (Q2-14)', () => {
  const osAvant = Platform.OS;
  afterEach(() => {
    Platform.OS = osAvant;
    mockNavigate.mockClear();
  });

  it('sur telephone, passe par la pile de la ligue depuis la racine', () => {
    Platform.OS = 'ios';
    openLeagueScoreFlow('m1');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.LeagueHomeTab, {
      params: { params: { matchId: 'm1' }, screen: RouteNames.EndMatchScreen },
      screen: RouteNames.LeagueDashboard,
    });
  });

  it('sur le site, garde l adresse directe de la fin de match', () => {
    Platform.OS = 'web';
    openLeagueScoreFlow('m1');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EndMatchScreen, { matchId: 'm1' });
  });

  it('ne fait rien sans match', () => {
    openLeagueScoreFlow('');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
