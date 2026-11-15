/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamDetails from '../TournamentTeamDetails';

// T-AGE (15/11) — tournoi ouvert dès 16 ans (Adel D6 B) : de 16 à 17 ans, le membre est marqué par le serveur
// `parentalConsentPending: true` (vue d'équipe, seulement pour qui voit les personnes). La fiche d'équipe
// affiche « Autorisation parentale attendue » sous son nom. Un refus du serveur (moins de 16 ans, âge inconnu)
// s'affiche tel quel : la mutation de l'invitation passe `error.message` à l'alerte.

/** @type {any} */
let mockTeam = null;
/** @type {any} */
let mockAuth = {};
const mockCopier = jest.fn(async () => true);
const mockOpenUrl = jest.fn(async () => true);

/** @type {any[]} */
const mockMutations = [];
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => { mockMutations.push(options); return { isPending: false, mutate: jest.fn() }; },
  useQuery: () => ({ data: [], isFetching: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(() => Promise.resolve()) }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, { accessibilityLabel: props.title, disabled: props.disabled, onPress: props.onPress }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => () => null);
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (/** @type {any} */ { children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => (/** @type {any} */ { children }) => children);
jest.mock('@/services/tournamentTeam/tournamentTeamQueries', () => ({
  useGetTournamentTeam: () => ({
    data: mockTeam, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({ respondToTournamentInvitation: jest.fn() }));
jest.mock('@/services/user/userService', () => ({ searchScopedUsers: jest.fn(), searchUsers: jest.fn() }));
jest.mock('@/platform/share', () => ({ __esModule: true, copier: (...args) => mockCopier(...args), default: { copier: (...args) => mockCopier(...args) } }));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: (...args) => mockOpenUrl(...args) } }));

const equipe = () => ({
  adminUsers: [{ documentId: 'u-cap' }],
  archivedAt: null,
  captainUser: { documentId: 'u-cap', firstname: 'Capi' },
  club: { documentId: 'club-1', name: 'FoundClub x AR Soccer' },
  documentId: 'tt-1',
  event: {
    club: { documentId: 'club-1', name: 'FoundClub x AR Soccer' }, documentId: 'evt-1', isActive: true, sessionStatus: 'open', tournamentConfig: { minAge: 16 },
  },
  isOpenToJoinRequests: false,
  members: [
    {
      documentId: 'mb-1', origin: 'external_addition', responseStatus: 'present', role: 'captain', user: { documentId: 'u-cap', firstname: 'Capi' },
    },
    {
      documentId: 'mb-2', origin: 'invited', parentalConsentPending: true, responseStatus: 'pending', role: 'member', user: { documentId: 'u-2', firstname: 'Ado' },
    },
    {
      documentId: 'mb-3', origin: 'invited', responseStatus: 'pending', role: 'member', user: { documentId: 'u-3', firstname: 'Majeur' },
    },
  ],
  name: 'Les Rapides',
  sourceTeam: null,
  sourceType: 'custom_team',
  status: 'pending',
});

/** @type {any[]} */
const montes = [];
const monter = async () => {
  mockAuth = { accountRoleKey: 'player', userData: { documentId: 'u-cap' } };
  mockTeam = equipe();
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <TournamentTeamDetails navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: { eventId: 'evt-1', teamId: 'tt-1' } }} />,
    );
  });
  montes.push(arbre);
  return arbre;
};

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
  mockMutations.splice(0);
});

describe('T-AGE — la fiche d équipe et les 16-17 ans', () => {
  test('🔴 le capitaine voit « Autorisation parentale attendue » sur la carte du membre marqué, et seulement la sienne', async () => {
    const arbre = await monter();
    const toutes = JSON.stringify(arbre.toJSON());
    expect(toutes.split('Autorisation parentale attendue')).toHaveLength(2);
    const ado = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-member-parental-consent-mb-2');
    expect(ado.length).toBeGreaterThan(0);
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-member-parental-consent-mb-3')).toHaveLength(0);
  });

  test('le refus du serveur à une invitation s affiche tel quel dans l alerte', async () => {
    const { Alert } = jest.requireActual('react-native');
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await monter();
    const invitation = mockMutations.find((options) => String(options.mutationFn).includes('respondToTournamentInvitation'));
    invitation.onError({ message: 'Ce tournoi est ouvert à partir de 16 ans' });
    expect(alerte).toHaveBeenCalledWith(expect.any(String), 'Ce tournoi est ouvert à partir de 16 ans');
    alerte.mockRestore();
  });
});
