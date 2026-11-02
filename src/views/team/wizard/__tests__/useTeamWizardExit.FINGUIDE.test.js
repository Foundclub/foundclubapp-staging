import renderer, { act } from 'react-test-renderer';

import useTeamWizardExit from '../useTeamWizardExit';

// FIN-GUIDE, point 2 : fermer le tunnel équipe pendant l'inscription menait à l'accueil, en
// sautant `Welcome` : inscription jamais finie, guide jamais lancé.

let mockRoute;
const mockDispatch = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ getRouteAfterTeamCreated: () => mockRoute }),
}));
jest.mock('@/context/AppModeContext', () => ({ useAppMode: () => ({ isGold: false }) }));
jest.mock('@/views/team/wizard/TeamWizardContext', () => ({
  useTeamWizard: () => ({ dispatch: mockDispatch, state: { clubId: 'club-1' } }),
}));

let exit;
/**
 * Sonde : capture le geste de sortie.
 * @param {{ navigation: any }} props - Navigation.
 * @returns {null} Rien.
 */
function Probe({ navigation }) {
  exit = useTeamWizardExit(navigation);
  return null;
}

const mount = (parent) => {
  act(() => {
    renderer.create(<Probe navigation={{ getParent: () => parent, reset: jest.fn() }} />);
  });
};

describe('useTeamWizardExit', () => {
  it('pendant l’inscription : retour à l’étape qui a ouvert le tunnel', () => {
    mockRoute = 'Welcome';
    const parent = { canGoBack: () => true, goBack: jest.fn(), reset: jest.fn() };
    mount(parent);
    act(() => exit());
    expect(parent.goBack).toHaveBeenCalledTimes(1);
    expect(parent.reset).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'RESET' });
  });

  it('témoin : inscription finie, « Mes équipes » comme avant', () => {
    mockRoute = undefined;
    const parent = { canGoBack: () => true, goBack: jest.fn(), reset: jest.fn() };
    mount(parent);
    act(() => exit());
    expect(parent.goBack).not.toHaveBeenCalled();
    expect(parent.reset.mock.calls[0][0].routes[0].name).toBe('HomeTab');
  });
});
