import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

// SECU-RATTACHEMENT (06/11/2026, decision d Adel « 119- A ») : le numero d un tiers
// ne le rattache plus a la section. Le serveur repond `managerInvitation` ; l ecran
// propose alors le SMS d invitation, et la personne choisit de rejoindre ou non.
// Numeros fictifs (plage 06 39 98 reservee a la fiction).

const mockInviteTrainer = jest.fn();
let mockMutationOptions;

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    mockMutationOptions = options;
    return { isPending: false, mutate: jest.fn() };
  },
  useQuery: () => ({ data: [], isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(() => Promise.resolve()) }),
}));
jest.mock('@/domains/auth/useAuth', () => () => ({ inviteTrainer: mockInviteTrainer }));
jest.mock('@/theme/themeContext', () => {
  const mockToutStyle = new Proxy({}, { get: () => mockToutStyle });
  return () => mockToutStyle;
});
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/molecules/input/Input', () => () => null);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@/components/templates/ScreenContainer', () => ({ children }) => children);
jest.mock('@/services/activity/activityService', () => ({ getActivities: jest.fn() }));
jest.mock('@/services/multisportClub/multisportClubService', () => ({
  createCMSection: jest.fn(),
}));
jest.mock('../components/MultisportStateView', () => () => null);
jest.mock('../useResolvedMultisportClub', () => () => ({
  cmData: { documentId: 'cm-1', name: 'SMUC' },
  cmError: null,
  isLoadingCmData: false,
  isLoadingUserData: false,
  refetchCm: jest.fn(),
  refetchUserData: jest.fn(),
  resolvedCmId: 'cm-1',
  userDataError: null,
}));

// eslint-disable-next-line import/first
import CreateSectionScreen from '../CreateSectionScreen';

const monter = (goBack = jest.fn()) => {
  act(() => {
    TestRenderer.create(
      <CreateSectionScreen navigation={{ goBack }} route={{ params: { cmId: 'cm-1' } }} />,
    );
  });
  return goBack;
};

describe('SECU-RATTACHEMENT — CreateSectionScreen', () => {
  beforeEach(() => {
    mockInviteTrainer.mockClear();
  });

  it('numero d un tiers : l ecran propose l invitation par SMS, au numero saisi', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const goBack = monter();

    await mockMutationOptions.onSuccess(
      { data: { documentId: 'section-1', managerInvitation: true, name: 'Basket' } },
      { managerPhone: '+33639980001', name: 'Basket' },
    );

    const boutons = alerte.mock.calls.at(-1)[2];
    expect(boutons).toHaveLength(2);
    boutons[1].onPress();
    expect(mockInviteTrainer).toHaveBeenCalledWith(expect.objectContaining({
      clubId: 'section-1',
      isManager: true,
      phoneNumber: '+33639980001',
    }));
    expect(goBack).toHaveBeenCalled();
  });

  it('sans invitation : la meme alerte « Section créée » qu avant, un seul bouton', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    monter();

    await mockMutationOptions.onSuccess({ data: { name: 'Basket' } }, { name: 'Basket' });

    const boutons = alerte.mock.calls.at(-1)[2];
    expect(boutons).toHaveLength(1);
    expect(mockInviteTrainer).not.toHaveBeenCalled();
  });
});
