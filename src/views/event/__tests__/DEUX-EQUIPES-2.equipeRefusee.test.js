/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamDetails from '../TournamentTeamDetails';

/** @type {any} */
let mockTeam = null;
/** @type {any} */
let mockAuth = {};
const mockCopier = jest.fn(async () => true);
const mockOpenUrl = jest.fn(async () => true);

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
jest.mock('@/platform/share', () => ({ __esModule: true, copier: (...args) => mockCopier(...args), default: { copier: (...args) => mockCopier(...args) } }));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: (...args) => mockOpenUrl(...args), openUrlHere: (...args) => mockOpenUrl(...args) } }));

// ==========================================================================
// DEUX-EQUIPES-2 (19/11/2026, point 5 du chef) — LA PAGE D'UNE ÉQUIPE REFUSÉE. Le serveur ne fait plus
// payer une place d'une équipe refusée (TOURNAMENT_TEAM_CLOSED) ; la page ne montre donc plus « Payer »,
// ni « Inviter », ni « Partager le lien », ni la carte « Recrutement » (chercher un joueur). Elle garde
// « Retirer mon équipe » (capitaine) et dit « Ton équipe … a été refusée par l'organisateur. »
// (bandeau TournamentDeclinedTeamNotice, clé tournamentUtils.ownTeamDeclined).
// ==========================================================================

const LIEN_CAP = 'https://foundclub.app/licenses/pay/jeton-capitaine';
const LIEN_2 = 'https://foundclub.app/licenses/pay/jeton-joueur-2';

const equipe = (/** @type {'declined' | 'pending'} */ status, /** @type {'capitaine' | 'joueur'} */ lecteur) => ({
  adminUsers: [{ documentId: 'u-cap' }],
  archivedAt: null,
  captainUser: { documentId: 'u-cap', firstname: 'Capi' },
  documentId: 'tt-33',
  event: {
    date: '2026-12-19T18:00:00.000Z', documentId: 'evt-1', isActive: true, sessionStatus: 'open', tournamentConfig: { entryFeeCents: 2000 },
  },
  isOpenToJoinRequests: false,
  members: [
    {
      documentId: 'mb-1',
      origin: 'external_addition',
      responseStatus: 'present',
      role: 'captain',
      user: { documentId: 'u-cap', firstname: 'Capi' },
    },
    {
      documentId: 'mb-2',
      origin: 'invited',
      responseStatus: 'pending',
      role: 'member',
      user: { documentId: 'u-2', firstname: 'Deux' },
    },
  ],
  name: 'EMU Test 002',
  // Le serveur rend encore un lien pour une place annulée (statut « due ») : la page ne doit pas l'offrir.
  payment: {
    currency: 'EUR',
    entryFeeCents: 2000,
    members: [
      {
        isSelf: lecteur === 'capitaine',
        memberDocumentId: 'mb-1',
        paymentUrl: LIEN_CAP,
        status: 'due',
      },
      {
        isSelf: lecteur === 'joueur',
        memberDocumentId: 'mb-2',
        paymentUrl: LIEN_2,
        status: 'due',
      },
    ],
    paidCount: 0,
    paidMembersToValidate: 5,
  },
  sourceTeam: null,
  sourceType: 'custom_team',
  status,
});

/** @type {any[]} */
const montes = [];
const monter = async (/** @type {'declined' | 'pending'} */ status, /** @type {'capitaine' | 'joueur'} */ lecteur) => {
  mockAuth = { accountRoleKey: 'player', userData: { documentId: lecteur === 'joueur' ? 'u-2' : 'u-cap' } };
  mockTeam = equipe(status, lecteur);
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <TournamentTeamDetails navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: { eventId: 'evt-1', teamId: 'tt-33' } }} />,
    );
  });
  montes.push(arbre);
  return arbre;
};
const titres = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.accessibilityLabel === 'string' && typeof n.props?.onPress === 'function',
).map((/** @type {any} */ n) => n.props.accessibilityLabel);
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id);

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
});

describe('DEUX-EQUIPES-2 — la page d’une équipe refusée', () => {
  test('🔴 capitaine : ni Payer, ni Inviter, ni Partager le lien, ni Recrutement ; « Retirer mon équipe » et le bandeau restent', async () => {
    const arbre = await monter('declined', 'capitaine');
    const vus = titres(arbre);
    expect(vus.filter((titre) => /^Payer/.test(titre))).toEqual([]);
    expect(vus.filter((titre) => /^Inviter/.test(titre))).toEqual([]);
    expect(vus).not.toContain('Partager le lien');
    expect(vus).not.toContain('Copier le lien de paiement');
    expect(parId(arbre, 'tournament-team-recruitment')).toHaveLength(0);
    expect(parId(arbre, 'tournament-team-invite-button')).toHaveLength(0);
    expect(vus).toContain('Retirer mon équipe');
    expect(parId(arbre, 'tournament-declined-team-notice').length).toBeGreaterThan(0);
    expect(JSON.stringify(arbre.toJSON())).toContain('a été refusée');
  });

  test('🔴 joueur de l’équipe refusée : pas de « Payer ma place », le bandeau est là', async () => {
    const arbre = await monter('declined', 'joueur');
    expect(titres(arbre).filter((titre) => /^Payer/.test(titre))).toEqual([]);
    expect(parId(arbre, 'tournament-declined-team-notice').length).toBeGreaterThan(0);
  });

  test('équipe en attente (témoin) : le capitaine invite, partage, recrute ; le joueur paie ; pas de bandeau', async () => {
    const capitaine = await monter('pending', 'capitaine');
    const vus = titres(capitaine);
    expect(vus).toContain('Inviter un joueur');
    expect(vus).toContain('Retirer mon équipe');
    expect(parId(capitaine, 'tournament-team-recruitment').length).toBeGreaterThan(0);
    expect(parId(capitaine, 'tournament-declined-team-notice')).toHaveLength(0);
    const joueur = await monter('pending', 'joueur');
    expect(titres(joueur).filter((titre) => /^Payer/.test(titre)).length).toBeGreaterThan(0);
  });
});
