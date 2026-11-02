import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TourTeamChoice from '../TourTeamChoice';

// FIN-GUIDE, point 1 (Adel, 02/11) : « si y'a des équipes ça pose la question êtes vous
// entraîneurs de une de ces équipes, sinon créer la vôtre ». Un club sur l'app n'a pas forcément
// d'équipe : sans équipe, la question ne se pose pas.

let mockTour;
let mockClub;
let mockUser;
const mockRequest = jest.fn(() => Promise.resolve({}));
const mockClaim = jest.fn(() => Promise.resolve({}));
const mockRefetch = jest.fn(() => Promise.resolve());
const mockAction = jest.fn();
const mockRefusal = jest.fn();

jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ refetchUserData: mockRefetch, userData: mockUser }),
}));
jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: (...args) => mockAction(...args),
  emitGuidanceRefusal: (...args) => mockRefusal(...args),
}));
jest.mock('@/services/club/clubQueries', () => ({ useGetClub: () => mockClub }));
jest.mock('@/services/team/teamService', () => ({
  claimTeamAsCoach: (...args) => mockClaim(...args),
}));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: (...args) => mockRequest(...args),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback, values) => {
      const text = typeof fallback === 'string'
        ? fallback
        : fallback?.defaultValue_other || fallback?.defaultValue || key;
      return String(text).replace('{{count}}', String(values?.count ?? fallback?.count ?? ''));
    },
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  useMutation: (options) => ({
    isPending: false,
    mutate: (variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((result) => options.onSuccess?.(result, variables))
      .catch((error) => options.onError?.(error, variables)),
  }),
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  /**
   * Doublure SVG : une simple vue.
   * @param {{ children?: any }} props - Enfants.
   * @returns {any} Vue.
   */
  function Box({ children }) { return <View>{children}</View>; }
  return {
    __esModule: true, default: Box, Defs: Box, LinearGradient: Box, Rect: Box, Stop: Box,
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ disabled, onPress, title }) => (
      <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} testID={title}>
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock('@/components/molecules/wizardOptionCard/WizardOptionCard', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({
      onPress, selected, subtitle, title,
    }) => (
      <TouchableOpacity onPress={onPress} testID={`carte-${title}`}>
        <Text>{title}</Text>
        <Text>{subtitle}</Text>
        <Text>{selected ? 'choisie' : ''}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock('@/theme/colors', () => ({ withAlpha: (color) => color }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 16, lineHeight: 20 }) }),
  }),
}));

const SENIORS = {
  documentId: 't-1', name: 'Seniors A', trainers: [{ documentId: 'autre', firstname: 'Karim' }],
};
const ORPHAN = { documentId: 't-2', name: 'U15', trainers: [] };

let tree;
const mount = async () => {
  await act(async () => { tree = renderer.create(<TourTeamChoice />); });
};
const byTestId = (id) => tree.root.findAll((node) => node.props.testID === id
  && typeof node.props.onPress === 'function')[0];
const textOf = () => tree.root.findAll((node) => typeof node.type === 'string'
  && typeof node.props.children === 'string').map((node) => node.props.children).join(' | ');
const press = async (id) => {
  await act(async () => { byTestId(id).props.onPress(); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

let alertSpy;
beforeEach(() => {
  mockRequest.mockClear();
  mockClaim.mockClear();
  mockAction.mockClear();
  mockRefusal.mockClear();
  mockRefetch.mockClear();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockUser = {
    club: { documentId: 'club-7' }, documentId: 'moi', firstname: 'Sam', trainedTeams: [],
  };
  mockClub = { data: { teams: [SENIORS, ORPHAN] }, isError: false, isFetched: true };
  mockTour = { completeCurrentStep: jest.fn(), pauseTour: jest.fn() };
});
afterEach(() => {
  alertSpy.mockRestore();
  act(() => tree?.unmount());
});

describe('TourTeamChoice', () => {
  it('pose la question et liste les équipes du club', async () => {
    await mount();
    expect(textOf()).toMatch(/Es-tu entraîneur·e d’une de ces équipes/);
    expect(textOf()).toMatch(/Seniors A/);
    expect(textOf()).toMatch(/U15/);
  });

  it('club sans équipe : la question ne se pose pas, le guide continue', async () => {
    mockClub = { data: { teams: [] }, isError: false, isFetched: true };
    await mount();
    expect(mockTour.completeCurrentStep).toHaveBeenCalledTimes(1);
  });

  it('club illisible : le guide continue, jamais bloqué', async () => {
    mockClub = { data: undefined, isError: true, isFetched: true };
    await mount();
    expect(mockTour.completeCurrentStep).toHaveBeenCalledTimes(1);
  });

  it('pendant le chargement : rien n’est décidé', async () => {
    mockClub = { data: undefined, isError: false, isFetched: false };
    await mount();
    expect(mockTour.completeCurrentStep).not.toHaveBeenCalled();
    expect(textOf()).toMatch(/équipes de ton club/);
  });

  it('il entraîne déjà une équipe de la liste (source fraîche) : M1 validée sans question', async () => {
    mockClub = {
      data: { teams: [{ ...SENIORS, trainers: [{ documentId: 'moi' }] }] },
      isError: false,
      isFetched: true,
    };
    await mount();
    expect(mockAction).toHaveBeenCalledWith('team.trained', { teamName: 'Seniors A' });
  });

  it('« Non, je crée la mienne » : le guide continue vers la création', async () => {
    await mount();
    await press('Non, je crée la mienne');
    expect(mockTour.completeCurrentStep).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('sans choix, le bouton de demande reste inactif', async () => {
    await mount();
    expect(byTestId('Oui, c’est mon équipe').props.disabled).toBe(true);
  });

  it('équipe qui a déjà un·e entraîneur·e : une demande part, le guide le sait', async () => {
    await mount();
    await press('carte-Seniors A');
    await press('Oui, c’est mon équipe');
    expect(mockRequest).toHaveBeenCalledWith({ team: 't-1', user: 'moi' });
    expect(mockRefetch).toHaveBeenCalled();
    expect(mockAction).toHaveBeenCalledWith('team.requested', { teamName: 'Seniors A' });
  });

  it('équipe sans entraîneur·e : il la reprend tout de suite, M1 validée', async () => {
    await mount();
    await press('carte-U15');
    await press('Oui, c’est mon équipe');
    expect(mockClaim).toHaveBeenCalledWith('t-2');
    expect(mockRequest).not.toHaveBeenCalled();
    expect(mockAction).toHaveBeenCalledWith('team.trained', { teamName: 'U15' });
  });

  it('demande refusée par le serveur : un message, on reste sur la question', async () => {
    mockRequest.mockRejectedValueOnce(new Error('Déjà demandé'));
    await mount();
    await press('carte-Seniors A');
    await press('Oui, c’est mon équipe');
    expect(alertSpy).toHaveBeenCalled();
    expect(mockAction).not.toHaveBeenCalled();
  });

  it('reprise refusée par le quota : la mission l’apprend (carte du guide)', async () => {
    mockClaim.mockRejectedValueOnce({
      response: { data: { error: { details: { code: 'FREE_TEAM_LIMIT_REACHED' } } } },
      subscriptionDecision: { reason: 'team-limit' },
    });
    await mount();
    await press('carte-U15');
    await press('Oui, c’est mon équipe');
    expect(mockAction).not.toHaveBeenCalled();
    expect(alertSpy.mock.calls.length + mockRefusal.mock.calls.length).toBeGreaterThan(0);
  });

  it('« Plus tard » met le guide en pause', async () => {
    await mount();
    await press('Plus tard');
    expect(mockTour.pauseTour).toHaveBeenCalledTimes(1);
  });
});
