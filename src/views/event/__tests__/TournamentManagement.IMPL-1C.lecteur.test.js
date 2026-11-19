/* eslint-disable max-len -- les témoins se lisent en entier. */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentManagement from '../TournamentManagement';

// IMPL-1C (19/11/2026, recette 48, écart 4) — « VOIR LA COMPÉTITION » LU PAR QUI N'ORGANISE PAS.
// Planche page 8 : un joueur ne voit que les équipes inscrites (en attente ou validées), avec la
// seule pastille « Validée », sans état interne (refusée, archivée, effectif à revoir, présents,
// demandes) ; le compteur « Équipes » compte les cartes affichées. Le serveur rend aujourd'hui
// toutes les équipes à un tiers (tournament-competition.js:544, lot serveur IMPL-5) : l'app ne les
// montre plus.

// Le premier rendu charge tout l écran (jusqu à 7 s sous charge, rouge par délai le 19/11) : délai large.
jest.setTimeout(30000);

/** @type {any} */
let mockDashboard = null;
const mockGerant = { value: false };
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options?.mutationFn?.(variables)).then(
      (resultat) => options?.onSuccess?.(resultat, variables),
      (erreur) => options?.onError?.(erreur, variables),
    ),
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(() => Promise.resolve()), setQueryData: jest.fn() }),
}));

jest.mock('../TournamentInvites', () => function InvitesDouble() { return null; });
jest.mock('../TournamentInvitationRequest', () => function DemandeDouble() { return null; });
jest.mock('@/components/organisms/shareEventModal/ShareEventModal', () => function PartageDouble(/** @type {any} */ props) {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return props.isVisible ? react.createElement(rn.Text, null, 'FEUILLE DE PARTAGE') : null;
});
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
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ canManageEvent: () => mockGerant.value, userData: { documentId: 'moi' } }),
}));
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, {
      accessibilityLabel: props.title, disabled: props.disabled, onPress: props.onPress, testID: props.testID,
    }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (/** @type {any} */ { children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => (/** @type {any} */ { children }) => children);
jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({
    data: mockDashboard, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/tournamentCompetition/tournamentCompetitionService', () => ({
  drawTournamentGroups: jest.fn(() => Promise.resolve({})),
  generateTournamentKnockout: jest.fn(() => Promise.resolve({})),
  generateTournamentMatches: jest.fn(() => Promise.resolve({})),
  publishTournamentCompetition: jest.fn(() => Promise.resolve({})),
  setupTournamentCompetition: jest.fn(() => Promise.resolve({})),
}));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  closeTournament: jest.fn(() => Promise.resolve({})),
  reviewTournamentTeamRegistration: jest.fn(),
}));
jest.mock('@/services/tournamentTeam/tournamentOrganizerService', () => ({
  exportTournamentPlayers: jest.fn(),
  openTournamentCaptainsChat: jest.fn(),
  remindTournamentTeamUnpaid: jest.fn(),
  setTournamentRegistrations: jest.fn(),
  tournamentOrganizerSummaryKey: (/** @type {string} */ id) => ['tournament-organizer', id],
  useTournamentOrganizerSummary: () => ({
    data: null, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/platform/media/saveTextFile', () => ({
  saveTextFile: jest.fn(),
}));
jest.mock('@/services/chat/chatService', () => ({
  createChatMessage: jest.fn(() => Promise.resolve({})),
  createWhisperChat: jest.fn(),
}));
jest.mock('@/services/event/eventService', () => ({
  requestFeatured: jest.fn(),
}));

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

const MEMBRES = (/** @type {number} */ n, /** @type {string} */ reponse = 'present') => Array.from({ length: n }, () => ({ responseStatus: reponse }));
const tableau = (/** @type {any[] | null} */ equipes = null) => ({
  bracket: null,
  config: {
    competitionState: 'draft', entryFeeCents: 2000, formatMode: 'groups_only', minRosterSize: 5, paidMembersToValidate: 5, registrationMode: 'manual',
  },
  event: {
    date: '2099-12-19', documentId: 'evt-1', endTime: '23:00', name: 'FoundClub x AR Soccer', sessionStatus: 'open', startTime: '19:00',
  },
  groups: [],
  matches: [],
  overview: { groups: 0, totalMatches: 0 },
  standings: [],
  teams: equipes || [
    {
      documentId: 'eq-rauze', members: MEMBRES(2, 'pending'), name: 'FC Rauze', sourceType: 'custom_team', status: 'pending',
    },
    {
      documentId: 'eq-pantheres', members: MEMBRES(5), name: 'Les Panthères', sourceType: 'custom_team', status: 'accepted',
    },
    {
      documentId: 'eq-nord', members: MEMBRES(6), name: 'Montpellier Nord', sourceType: 'custom_team', status: 'accepted',
    },
    {
      documentId: 'eq-sami', members: MEMBRES(5), name: 'Team Sami', sourceType: 'custom_team', status: 'declined',
    },
    {
      documentId: 'eq-vieux', members: MEMBRES(5), name: 'Les Anciens', sourceType: 'custom_team', status: 'archived',
    },
  ],
});

/** @type {any[]} */
const montes = [];
const monter = async (/** @type {boolean} */ gerant = false, /** @type {any[] | null} */ equipes = null) => {
  mockGerant.value = gerant;
  mockDashboard = tableau(equipes);
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(<TournamentManagement navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: { eventId: 'evt-1' } }} />);
  });
  montes.push(arbre);
  return arbre.root;
};
afterEach(() => { while (montes.length) { const a = montes.pop(); act(() => a.unmount()); } });
const textes = (/** @type {any} */ root) => root.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const ouvrirLesEquipes = async (/** @type {any} */ root) => {
  const [onglet] = root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournoi-onglet-teams' && typeof n.props.onPress === 'function');
  await act(async () => { onglet.props.onPress(); });
};

describe('IMPL-1C · écart 4 — la compétition lue par un joueur', () => {
  test('🔴 seules les équipes inscrites (en attente, validées) ; ni refusée ni archivée', async () => {
    const root = await monter(false);
    await ouvrirLesEquipes(root);
    const lu = textes(root);
    expect(lu).toEqual(expect.arrayContaining(['FC Rauze', 'Les Panthères', 'Montpellier Nord']));
    expect(lu).not.toContain('Team Sami');
    expect(lu).not.toContain('Les Anciens');
  });

  test('🔴 aucun état interne : ni « Refusée », ni « En attente », ni « Effectif à revoir », ni les filtres ; « Validée » reste', async () => {
    const root = await monter(false);
    await ouvrirLesEquipes(root);
    const tout = textes(root).join(' | ');
    expect(tout).not.toMatch(/Refusée|Effectif à revoir|Effectifs à revoir|Archivée|présents?\b|demandes?\b|en attente|En attente|éphémère/);
    expect(textes(root)).not.toContain('Toutes');
    expect(textes(root).filter((x) => x === 'Validée')).toHaveLength(2);
  });

  test('🔴 le compteur « Équipes » compte les cartes affichées ; pas de « À revoir »', async () => {
    const root = await monter(false);
    const lu = textes(root);
    expect(lu[lu.indexOf('Équipes') + 1]).toBe('3');
    expect(lu).not.toContain('À revoir');
  });

  test('🔴 un membre d une équipe refusée voit SON équipe et son état ; pas celles des autres', async () => {
    const root = await monter(false, [
      {
        documentId: 'eq-moi', members: [{ responseStatus: 'present', user: { documentId: 'moi' } }], name: 'Mon Équipe', status: 'declined',
      },
      {
        documentId: 'eq-sami', members: [], name: 'Team Sami', status: 'declined',
      },
      {
        documentId: 'eq-nord', members: [], name: 'Montpellier Nord', status: 'accepted',
      },
    ]);
    await ouvrirLesEquipes(root);
    const lu = textes(root);
    expect(lu).toEqual(expect.arrayContaining(['Mon Équipe', 'Refusée', 'Montpellier Nord']));
    expect(lu).not.toContain('Team Sami');
    expect(lu[lu.indexOf('Équipes') + 1]).toBe('2');
  });

  test('🔴 serveur de demain (ni members[], ni résumé) : pas de « 0 joueur », le nombre rendu s il existe', async () => {
    const root = await monter(false, [
      {
        documentId: 'eq-a', memberCount: 4, name: 'Équipe A', sourceType: 'custom_team', status: 'pending',
      },
      {
        documentId: 'eq-b', name: 'Équipe B', sourceType: 'custom_team', status: 'accepted',
      },
    ]);
    await ouvrirLesEquipes(root);
    const lu = textes(root);
    expect(lu).toEqual(expect.arrayContaining(['Équipe A', '4 joueurs', 'Équipe B']));
    expect(lu.join(' | ')).not.toMatch(/\b0 joueur/);
  });

  test('🔴 contrat IMPL-5D : SA propre équipe (la seule avec members) reste visible, même refusée', async () => {
    const root = await monter(false, [
      {
        documentId: 'eq-moi', memberCount: 1, members: [{ responseStatus: 'present' }], name: 'Mon Équipe', status: 'declined',
      },
      {
        documentId: 'eq-a', memberCount: 5, name: 'Équipe A', status: 'accepted',
      },
    ]);
    await ouvrirLesEquipes(root);
    const lu = textes(root);
    expect(lu).toEqual(expect.arrayContaining(['Mon Équipe', 'Refusée', 'Équipe A', '5 joueurs']));
    expect(lu.join(' | ')).not.toContain('Effectif à revoir');
  });
});
