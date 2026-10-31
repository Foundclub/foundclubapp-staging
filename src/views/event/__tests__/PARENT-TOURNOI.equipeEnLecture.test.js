/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamDetails from '../TournamentTeamDetails';

// PARENT-TOURNOI-LECTURE-2 (31/10, Adel « 1- B ») — le Parent touche une équipe dans le tableau du
// tournoi et LIT son détail. L'écran n'avait AUCUN test (E6) : le premier bloc décrit l'existant
// pour un joueur sans lien avec l'équipe, qui ne doit pas bouger. Le serveur ne donne au Parent
// aucun geste d'équipe (carte Parent, admin SECU-TOURNOI-BORD 9) : l'écran ne lui en propose aucun.

/** @type {any} */
let mockTeam = null;
/** @type {any} */
let mockAuth = {};

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
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({}));
jest.mock('@/services/user/userService', () => ({ searchScopedUsers: jest.fn(), searchUsers: jest.fn() }));

/**
 * Une équipe libre, ouverte aux demandes, telle que le serveur la rend à qui n'a pas de lien avec elle.
 * @returns {any} L'équipe.
 */
const equipeSansPersonne = () => ({
  adminUsers: null,
  archivedAt: null,
  captainUser: null,
  club: { documentId: 'club-1', name: 'Club fictif' },
  documentId: 'tt-1',
  event: {
    club: { documentId: 'club-1', name: 'Club fictif' }, documentId: 'evt-1', isActive: true, sessionStatus: 'open', tournamentConfig: {},
  },
  isOpenToJoinRequests: true,
  members: [
    {
      documentId: 'mb-1', origin: 'creator', responseStatus: 'present', role: 'captain', user: null,
    },
    {
      documentId: 'mb-2', origin: 'invitation', responseStatus: 'pending', role: 'member', user: null,
    },
  ],
  name: 'Les Aigles',
  sourceTeam: null,
  sourceType: 'custom_team',
  status: 'accepted',
});

/** Les gestes d'une équipe : aucun ne doit apparaître chez qui ne la gère pas. */
const GESTES_DE_GESTION = ['Inviter', 'Retirer', 'Capitaine', 'Accepter', 'Refuser', "Annuler l'invitation", "Quitter l'équipe", 'Présent', 'Absent'];

/** @type {any[]} */
const montes = [];
const monter = async (/** @type {any} */ auth) => {
  mockAuth = auth;
  mockTeam = equipeSansPersonne();
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
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());
// Le double et son TouchableOpacity portent le même libellé : un bouton, une entrée.
const boutons = (/** @type {any} */ arbre) => [...new Set(arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.accessibilityLabel === 'string' && typeof n.props?.onPress === 'function',
).map((/** @type {any} */ n) => n.props.accessibilityLabel))];

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
});

describe('PARENT-TOURNOI-LECTURE-2 — le détail d une équipe, sans lien avec elle', () => {
  test('(E6, vert avant comme après) un joueur sans lien peut demander à rejoindre, sans aucun geste de gestion', async () => {
    const arbre = await monter({ accountRoleKey: 'player', userData: { documentId: 'u-joueur' } });
    const gestes = boutons(arbre);
    expect(gestes).toContain('Demander à rejoindre');
    GESTES_DE_GESTION.forEach((interdit) => expect(gestes).not.toContain(interdit));
    expect(texte(arbre)).toContain('Les Aigles');
  });

  test('👪 le Parent lit l équipe (effectif sans nom) et n a aucun bouton : ni rejoindre, ni gérer', async () => {
    const arbre = await monter({ accountRoleKey: 'parent', userData: { documentId: 'u-parent' } });
    const gestes = boutons(arbre);
    expect(gestes).not.toContain('Demander à rejoindre');
    GESTES_DE_GESTION.forEach((interdit) => expect(gestes).not.toContain(interdit));
    expect(texte(arbre)).toContain('Les Aigles');
    expect(texte(arbre)).toContain('Participant');
    expect(gestes).toEqual(['Revenir au tournoi']);
  });
});
