/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamDetails from '../TournamentTeamDetails';

// T-REJOINDRE (17/11/2026, Clément D50, registre D210) — « le capitaine consulte le profil, peut envoyer un
// message direct avant d'accepter la demande ». Sur chaque demande reçue, le capitaine a « Voir le profil »
// (l'écran de profil existant) et « Écrire » (une conversation directe), PUIS « Accepter » / « Refuser ».
// MINEURS : « Écrire » suit le garde existant des tête-à-tête (docs/DECISIONS_MINEURS.md 25, 36, 51) : le serveur
// rend `viewerCanWrite` sur la demande ; le bouton ne s'affiche que sur `true`. Un demandeur de 16 ans, ou un
// serveur ancien (marque absente), n'a pas de bouton « Écrire ».

/** @type {any} */
let mockTeam = null;
/** @type {any} */
let mockAuth = {};
const mockNavigate = jest.fn();
const mockCreateWhisperChat = jest.fn();

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
    return react.createElement(rn.TouchableOpacity, {
      accessibilityLabel: props.title, disabled: props.disabled, onPress: props.onPress, testID: props.testID,
    }, react.createElement(rn.Text, null, props.title || ''));
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
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({ reviewTournamentJoinRequest: jest.fn() }));
jest.mock('@/services/user/userService', () => ({ searchScopedUsers: jest.fn(), searchUsers: jest.fn() }));
jest.mock('@/services/chat/chatService', () => ({
  createWhisperChat: (/** @type {any[]} */ ...args) => mockCreateWhisperChat(...args),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, copier: jest.fn(), default: { copier: jest.fn() } }));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));

const demande = (/** @type {string} */ documentId, /** @type {string} */ userId, /** @type {any} */ extra = {}) => ({
  documentId, origin: 'join_request', responseStatus: 'requested', role: 'member', user: { documentId: userId, firstname: userId }, ...extra,
});
const equipe = (/** @type {any[]} */ demandes) => ({
  adminUsers: [{ documentId: 'u-cap' }],
  archivedAt: null,
  captainUser: { documentId: 'u-cap', firstname: 'Capi' },
  club: { documentId: 'club-1', name: 'AR Soccer' },
  documentId: 'tt-1',
  event: {
    club: { documentId: 'club-1', name: 'AR Soccer' }, documentId: 'evt-1', isActive: true, sessionStatus: 'open', tournamentConfig: { minAge: 16 },
  },
  isOpenToJoinRequests: true,
  members: [
    {
      documentId: 'mb-cap', origin: 'external_addition', responseStatus: 'present', role: 'captain', user: { documentId: 'u-cap', firstname: 'Capi' },
    },
    ...demandes,
  ],
  name: 'Les Seuls',
  sourceTeam: null,
  sourceType: 'custom_team',
  status: 'pending',
});

/** @type {any[]} */
const montes = [];
const monter = async (/** @type {any} */ equipeMontee, /** @type {string} */ lecteur = 'u-cap') => {
  mockAuth = { accountRoleKey: 'player', userData: { documentId: lecteur } };
  mockTeam = equipeMontee;
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <TournamentTeamDetails navigation={{ goBack: jest.fn(), navigate: mockNavigate }} route={{ params: { eventId: 'evt-1', teamId: 'tt-1' } }} />,
    );
  });
  montes.push(arbre);
  return arbre;
};
// L'identifiant est sur l'enveloppe du bouton : on rend le bouton qu'elle contient (0 ou 1).
const bouton = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === testID)
  .slice(0, 1)
  .flatMap((/** @type {any} */ enveloppe) => enveloppe.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function').slice(0, 1));

jest.setTimeout(30000);

beforeEach(() => {
  mockNavigate.mockReset();
  mockCreateWhisperChat.mockReset();
});
afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
});

describe('T-REJOINDRE — le capitaine voit qui demande, avant d’accepter', () => {
  test('🔴 « Voir le profil » ouvre l’écran de profil existant du demandeur', async () => {
    const arbre = await monter(equipe([demande('mb-18', 'u-18', { viewerCanWrite: true })]));
    const [profil] = bouton(arbre, 'tournament-request-profile-mb-18');
    expect(profil).toBeTruthy();
    act(() => { profil.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ProfileStack', { params: { userId: 'u-18' }, screen: 'UserDetails' });
    // « Accepter » et « Refuser » restent.
    const texte = JSON.stringify(arbre.toJSON());
    expect(texte).toContain('Accepter');
    expect(texte).toContain('Refuser');
  });

  test('🔴 « Écrire » ouvre une conversation directe avec le demandeur adulte (le serveur a dit oui)', async () => {
    mockCreateWhisperChat.mockResolvedValue({ documentId: 'chat-9' });
    const arbre = await monter(equipe([demande('mb-18', 'u-18', { viewerCanWrite: true })]));
    const [ecrire] = bouton(arbre, 'tournament-request-write-mb-18');
    expect(ecrire).toBeTruthy();
    await act(async () => { await ecrire.props.onPress(); });
    expect(mockCreateWhisperChat).toHaveBeenCalledWith(['u-18']);
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', { chatId: 'chat-9' });
  });

  test('🔴 MINEURS — pas de « Écrire » vers un demandeur que le garde refuse (16 ans), ni quand la marque est absente (serveur ancien) ; « Voir le profil » reste', async () => {
    const arbre = await monter(equipe([
      demande('mb-16', 'u-16', { viewerCanWrite: false }),
      demande('mb-vieux-serveur', 'u-x'),
    ]));
    expect(bouton(arbre, 'tournament-request-write-mb-16')).toHaveLength(0);
    expect(bouton(arbre, 'tournament-request-write-mb-vieux-serveur')).toHaveLength(0);
    expect(bouton(arbre, 'tournament-request-profile-mb-16').length).toBeGreaterThan(0);
  });

  test('un refus du serveur à l’ouverture du fil s’affiche tel quel, sans navigation', async () => {
    const { Alert } = jest.requireActual('react-native');
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockCreateWhisperChat.mockRejectedValue({
      response: { data: { error: { message: 'Cette personne est mineure : seuls les encadrants de son club peuvent lui écrire en privé.' } } },
    });
    const arbre = await monter(equipe([demande('mb-18', 'u-18', { viewerCanWrite: true })]));
    await act(async () => { await bouton(arbre, 'tournament-request-write-mb-18')[0].props.onPress(); });
    expect(alerte).toHaveBeenCalledWith(expect.any(String), 'Cette personne est mineure : seuls les encadrants de son club peuvent lui écrire en privé.');
    expect(mockNavigate).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  test('un simple membre (pas capitaine) ne voit ni « Voir le profil » ni « Écrire » sur une demande', async () => {
    const team = equipe([demande('mb-18', 'u-18', { viewerCanWrite: true })]);
    team.members.push({
      documentId: 'mb-j', origin: 'invited', responseStatus: 'pending', role: 'member', user: { documentId: 'u-joueur', firstname: 'Joueur' },
    });
    const arbre = await monter(team, 'u-joueur');
    expect(bouton(arbre, 'tournament-request-profile-mb-18')).toHaveLength(0);
    expect(bouton(arbre, 'tournament-request-write-mb-18')).toHaveLength(0);
  });
});
