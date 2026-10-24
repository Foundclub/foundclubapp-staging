import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

// BH03 · P14-10 — une section creee n'apparaissait pas dans le tableau de bord
// multisport tant qu'on ne rafraichissait pas : ses listes ['cm-clubs'] et
// ['cm-teams'] n'etaient pas invalidees.

const mockInvalidate = jest.fn(() => Promise.resolve());
let mockMutationOptions;

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    mockMutationOptions = options;
    return { isPending: false, mutate: jest.fn() };
  },
  useQuery: () => ({ data: [], isLoading: false }),
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@/theme/themeContext', () => {
  const mockToutStyle = new Proxy({}, { get: () => mockToutStyle });
  return () => mockToutStyle;
});
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/molecules/input/Input', () => () => null);
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => ({ children }) => children);
jest.mock('@/services/activity/activityService', () => ({ getActivities: jest.fn() }));
jest.mock('@/services/multisportClub/multisportClubService', () => ({ createCMSection: jest.fn() }));
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

describe('BH03 · P14-10 — CreateSectionScreen', () => {
  it('apres la creation, les listes du tableau de bord sont invalidees', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    act(() => {
      TestRenderer.create(<CreateSectionScreen navigation={{ goBack: jest.fn() }} route={{ params: { cmId: 'cm-1' } }} />);
    });

    await mockMutationOptions.onSuccess({ data: { name: 'Basket' } });

    const cles = mockInvalidate.mock.calls.map(([arg]) => arg.queryKey);
    expect(cles).toEqual(expect.arrayContaining([['cm-clubs', 'cm-1'], ['cm-teams', 'cm-1']]));
  });
});
