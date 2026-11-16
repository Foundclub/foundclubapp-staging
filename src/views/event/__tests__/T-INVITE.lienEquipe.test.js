/* eslint-disable max-len -- les témoins se lisent en entier. */
import renderer, { act } from 'react-test-renderer';

import TournamentTeamDetails from '../TournamentTeamDetails';

// T-INVITE (15/11/2026, tournoi du 19/12, Adel D37 « B ») — LE LIEN D'UNE ÉQUIPE DE TOURNOI, côté app.
// - Fiche d'équipe (« Ton inscription ») : le tournoi, sa date et son lieu en tête ; le capitaine a
//   « Inviter des joueurs par lien » → le lien `/i/tournament/<tournoi>?c=<code>` part avec la phrase de repli.
// - La fenêtre d'un lien reçu (InvitationLinkHost) : « Rejoindre l'équipe » connecté, l'invitation attend sinon.

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
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());
const bouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.accessibilityLabel === titre && typeof n.props?.onPress === 'function' && n.type !== 'View',
)[0];

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
  mockShare.mockClear();
  mockCreateLink.mockClear();
});

describe('T-INVITE — la fiche d équipe', () => {
  test('🔴 en tête : le tournoi, sa date et son lieu', async () => {
    const arbre = await monter();
    expect(texte(arbre)).toContain('FoundClub x AR Soccer · sam 19/12/2026 · AR Soccer');
  });

  test('🔴 capitaine : « Partager le lien » envoie /i/tournament/<tournoi>?c=<code> avec la phrase de repli', async () => {
    const arbre = await monter();
    expect(texte(arbre)).toContain('Inviter des joueurs par lien');
    await act(async () => { await bouton(arbre, 'Partager le lien').props.onPress(); });
    expect(mockCreateLink).toHaveBeenCalledWith('tt-1');
    const [{ message, url }] = mockShare.mock.calls[0];
    expect(url).toMatch(/\/i\/tournament\/evt-1\?c=Abcdefghijklmnopqrstuvwx$/);
    expect(message).toContain("Rejoins l'équipe Les Rapides pour le tournoi FoundClub x AR Soccer sur FoundClub :");
    expect(message).toContain(url);
    expect(message.split('\n').pop()).toBe("Si l'app s'ouvre sans t'inscrire, mets-la à jour ou ouvre ce lien dans ton navigateur.");
  });
});

describe('T-INVITE — la fenêtre d un lien d équipe de tournoi', () => {
  const { describeCodedTournamentInvite } = jest.requireActual('@/domains/invitations/InvitationLinkHost');
  const t = (/** @type {string} */ _cle, /** @type {string} */ repli, /** @type {any} */ valeurs = {}) => repli.replace(/\{\{(\w+)\}\}/g, (_m, k) => valeurs[k] ?? '');
  const apercu = { event: { name: 'FoundClub x AR Soccer' }, status: 'active', team: { name: 'Les Rapides' } };

  test('🔴 connecté : « Rejoindre l équipe »', () => {
    const fenetre = describeCodedTournamentInvite({ isSignedIn: true, preview: apercu, t });
    expect(fenetre.title).toBe('Rejoindre Les Rapides');
    expect(fenetre.body).toBe("Tu es invité·e à rejoindre l'équipe Les Rapides pour le tournoi FoundClub x AR Soccer.");
    expect(fenetre.primary).toBe("Rejoindre l'équipe");
  });

  test('🔴 déconnecté : l invitation attend le compte', () => {
    const fenetre = describeCodedTournamentInvite({ isSignedIn: false, preview: apercu, t });
    expect(fenetre.body).toContain("l'invitation t'attendra");
    expect(fenetre.primary).toBe('Continuer');
  });

  test('🔴 tournoi clos : « Voir le tournoi »', () => {
    const fenetre = describeCodedTournamentInvite({ isSignedIn: true, preview: { ...apercu, status: 'closed' }, t });
    expect(fenetre.closed).toBe(true);
    expect(fenetre.primary).toBe('Voir le tournoi');
  });
});

// T-FINITIONS2 (16/11) — le lieu vient de `locationDetails` (lieu choisi au complexe) : la fiche
// d'équipe le lisait tel quel et montrait le JSON brut à tous les joueurs.
describe('T-FINITIONS2 — le lieu de la fiche d équipe', () => {
  test('🔴 locationDetails en JSON : l adresse lisible, jamais « {" »', async () => {
    const base = equipe;
    mockAuth = { accountRoleKey: 'player', userData: { documentId: 'u-cap' } };
    mockTeam = base();
    mockTeam.event = {
      ...mockTeam.event,
      location: null,
      locationDetails: JSON.stringify({ address: { description: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier' } }),
    };
    /** @type {any} */
    let arbre = null;
    await act(async () => {
      arbre = renderer.create(
        <TournamentTeamDetails navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: { eventId: 'evt-1', teamId: 'tt-1' } }} />,
      );
    });
    montes.push(arbre);
    const textes = arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.children === 'string').map((/** @type {any} */ n) => n.props.children);
    expect(textes.join('\n')).toContain('FoundClub x AR Soccer · sam 19/12/2026 · AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier');
    expect(textes.filter((/** @type {string} */ x) => x.includes('{"'))).toEqual([]);
  });
});

test('🔴 T-FINITIONS2 — la fiche d équipe nomme le tournoi par son nom donné (T-NOM)', async () => {
  mockAuth = { accountRoleKey: 'player', userData: { documentId: 'u-cap' } };
  mockTeam = equipe();
  mockTeam.event = { ...mockTeam.event, customName: 'TEST — FoundClub x AR Soccer', name: 'Tournoi - 05/12/2026', type: { name: 'Tournoi' } };
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <TournamentTeamDetails navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: { eventId: 'evt-1', teamId: 'tt-1' } }} />,
    );
  });
  montes.push(arbre);
  expect(texte(arbre)).toContain('TEST — FoundClub x AR Soccer · sam 19/12/2026');
  expect(texte(arbre)).not.toContain('Tournoi - 05/12/2026');
});
