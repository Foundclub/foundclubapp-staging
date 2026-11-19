/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamDetails from '../TournamentTeamDetails';

// T-FIL-EQUIPE (15/11/2026, tournoi du 19/12, Adel D25 « B ») — « Discussion de l'équipe » sur la fiche d'équipe.
// Le serveur pose `discussion` : `{ chat, ecriture }` pour qui est dans le fil, `{ ferme, message }` pour un membre
// que la règle des mineurs en tient dehors, rien sinon. Harnais repris de T-INVITE.lienEquipe.test.js.

/** @type {any} */
let mockTeam = null;
/** @type {any} */
let mockAuth = {};
const mockShare = jest.fn(async () => ({ action: 'sharedAction' }));
const mockCopier = jest.fn(async () => true);
const mockCreateLink = jest.fn(async () => ({ code: 'Abcdefghijklmnopqrstuvwx', eventDocumentId: 'evt-1', teamDocumentId: 'tt-1' }));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
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
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  createTournamentTeamInviteLink: (...args) => mockCreateLink(...args),
}));
jest.mock('@/services/teamInvite/teamInviteService', () => ({ claimTeamInvite: jest.fn(), createTeamInviteLink: jest.fn(), getTeamInvitePreview: jest.fn() }));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({}));
jest.mock('@/services/user/userService', () => ({ searchScopedUsers: jest.fn(), searchUsers: jest.fn() }));
jest.mock('@/platform/share', () => ({
  __esModule: true,
  copier: (...args) => mockCopier(...args),
  default: { copier: (...args) => mockCopier(...args), share: (...args) => mockShare(...args) },
}));
jest.mock('@/responsive/isDesktopWeb', () => ({ isDesktopWeb: () => false }));
jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceAction: jest.fn(), emitGuidanceInteraction: jest.fn() }));

const equipe = () => ({
  adminUsers: [{ documentId: 'u-cap' }],
  archivedAt: null,
  captainUser: { documentId: 'u-cap', firstname: 'Capi' },
  club: null,
  documentId: 'tt-1',
  event: {
    club: { documentId: 'club-ar', name: 'AR Soccer' },
    date: '2026-12-19T18:00:00.000Z',
    documentId: 'evt-1',
    isActive: true,
    location: { name: 'AR Soccer' },
    name: 'FoundClub x AR Soccer',
    sessionStatus: 'open',
    tournamentConfig: { allowCrossClubPlayers: true },
  },
  isOpenToJoinRequests: false,
  members: [
    {
      documentId: 'mb-1', origin: 'external_addition', responseStatus: 'present', role: 'captain', user: { documentId: 'u-cap', firstname: 'Capi' },
    },
  ],
  name: 'Les Rapides',
  sourceTeam: null,
  sourceType: 'custom_team',
  status: 'pending',
});

/** @type {any[]} */
const montes = [];
/** @type {any} */
let navigation = null;
const monter = async (/** @type {any} */ discussion) => {
  mockAuth = { accountRoleKey: 'player', userData: { documentId: 'u-cap' } };
  mockTeam = { ...equipe(), ...(discussion === undefined ? {} : { discussion }) };
  navigation = { goBack: jest.fn(), navigate: jest.fn() };
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <TournamentTeamDetails navigation={navigation} route={{ params: { eventId: 'evt-1', teamId: 'tt-1' } }} />,
    );
  });
  montes.push(arbre);
  return arbre;
};
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());
// ADAPTÉ PAR PAGE-EQUIPE (19/11, planche 4c) : sur la page d'équipe, le bouton dit aussi le nombre de
// membres (« Discussion de l’équipe · 2 membres ») ; on le reconnaît à son début.
const DEBUTS = { "Discussion de l'équipe": ["Discussion de l'équipe", 'Discussion de l’équipe'] };
const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => (DEBUTS[titre] || [titre]).some((debut) => String(n.props?.accessibilityLabel || '').startsWith(debut)) && typeof n.props?.onPress === 'function' && n.type !== 'View',
)[0];

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
  mockShare.mockClear();
  mockCreateLink.mockClear();
});

describe('T-FIL-EQUIPE — « Discussion de l équipe »', () => {
  test('🔴 dans le fil : le bouton ouvre la conversation de l équipe', async () => {
    const arbre = await monter({ chat: 'fil-1', ecriture: true });
    const ouvrir = bouton(arbre, "Discussion de l'équipe");
    expect(ouvrir).toBeTruthy();
    await act(async () => { ouvrir.props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', { chatId: 'fil-1' });
  });

  test('🔴 tenu dehors par la règle des mineurs : la phrase du serveur, pas de bouton', async () => {
    const message = 'La discussion de l’équipe ne t’est pas ouverte : il faut que ton parent ait un compte relié au tien, ou qu’un encadrant de ton club puisse la rejoindre. Tu restes dans l’équipe et tu paies ta place normalement.';
    const arbre = await monter({ ferme: true, message });
    expect(bouton(arbre, "Discussion de l'équipe")).toBeUndefined();
    expect(texte(arbre)).toContain(message);
  });

  test('🔴 équipe archivée : le bouton reste (relecture) avec sa phrase ; sans `discussion` (vieux serveur, tiers) : rien', async () => {
    const lecture = await monter({ chat: 'fil-1', ecriture: false });
    expect(bouton(lecture, "Discussion de l'équipe")).toBeTruthy();
    expect(texte(lecture)).toContain('La discussion est fermée : tu peux la relire.');
    const rien = await monter();
    expect(bouton(rien, "Discussion de l'équipe")).toBeUndefined();
  });
});
