/* eslint-disable max-len -- les témoins se lisent en entier. */
import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentManagement from '../TournamentManagement';
// RETOUCHES-R50 (20/11/2026, tournée de photos de la recette 50, écran 1b ; Adel « 2- A ») — l'écran
// dit « Retirer l'équipe », avec une confirmation ; derrière, c'est toujours l'archivage (statut
// `archived`), l'historique est gardé. La pastille et le filtre de la page de l'organisateur disent
// pareil (« Retirée », « Retirées »), sinon l'écran dirait « Retirer » puis « Archivée ».
// Et (file RETOUCHES-RECETTE-50) : une équipe retirée ne doit jamais se lire « Validée » chez
// l'organisateur, même si seule sa date d'archivage le dit (`archivedAt`).
// Le premier rendu charge tout l écran (jusqu à 7 s sous charge) : délai large, pas de faux rouge.
jest.setTimeout(30000);

/** @type {any} */
let mockDashboard = null;
/** @type {any} */
let mockSummary = null;
const mockErreurDuResume = { value: /** @type {any} */ (null) };
const mockReview = jest.fn(() => Promise.resolve({}));
const mockRemind = jest.fn();
const mockRegistrations = jest.fn();
const mockCaptainsChat = jest.fn();
const mockExport = jest.fn();
const mockSave = jest.fn(() => Promise.resolve({ opened: true, outcome: 'shared' }));
const mockWhisper = jest.fn();
const mockRequestFeatured = jest.fn(() => Promise.resolve({}));

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
  default: () => ({ canManageEvent: () => true }),
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
// IMPL-1B-PHOTO (19/11) : la page lit aussi la fiche du tournoi (photo du lieu, carte 1a) ; ici, pas de photo.
jest.mock('@/services/event/eventQueries', () => ({ useGetEvent: () => ({ data: null }) }));
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
  reviewTournamentTeamRegistration: (/** @type {any[]} */ ...args) => mockReview(...args),
}));
jest.mock('@/services/tournamentTeam/tournamentOrganizerService', () => ({
  exportTournamentPlayers: (/** @type {any[]} */ ...args) => mockExport(...args),
  openTournamentCaptainsChat: (/** @type {any[]} */ ...args) => mockCaptainsChat(...args),
  remindTournamentTeamUnpaid: (/** @type {any[]} */ ...args) => mockRemind(...args),
  setTournamentRegistrations: (/** @type {any[]} */ ...args) => mockRegistrations(...args),
  tournamentOrganizerSummaryKey: (/** @type {string} */ id) => ['tournament-organizer', id],
  useTournamentOrganizerSummary: () => ({
    data: mockSummary, error: mockErreurDuResume.value, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/platform/media/saveTextFile', () => ({
  saveTextFile: (/** @type {any[]} */ ...args) => mockSave(...args),
}));
jest.mock('@/services/chat/chatService', () => ({
  createChatMessage: jest.fn(() => Promise.resolve({})),
  createWhisperChat: (/** @type {any[]} */ ...args) => mockWhisper(...args),
}));
jest.mock('@/services/event/eventService', () => ({
  requestFeatured: (/** @type {any[]} */ ...args) => mockRequestFeatured(...args),
}));

const tableau = (/** @type {any} */ surcharge = {}) => ({
  bracket: null,
  config: {
    competitionState: 'draft', entryFeeCents: 2000, formatMode: 'groups_only', paidMembersToValidate: 5, registrationMode: 'manual',
  },
  event: {
    date: '2026-12-19', documentId: 'evt-1', endTime: '23:00', name: 'FoundClub x AR Soccer', sessionStatus: 'open', startTime: '19:00',
  },
  groups: [],
  matches: [],
  overview: { groups: 0, totalMatches: 0 },
  standings: [],
  teams: [
    { documentId: 'eq-rauze', name: 'FC Rauze', status: 'pending' },
    { documentId: 'eq-pantheres', name: 'Les Panthères', status: 'accepted' },
    { documentId: 'eq-nord', name: 'Montpellier Nord', status: 'accepted' },
    { documentId: 'eq-sami', name: 'Team Sami', status: 'declined' },
  ],
  ...surcharge,
});

const ligne = (/** @type {any} */ sur) => ({
  captain: null, count: 5, paidCents: 0, paidCount: 0, paidPlacesCount: 0, refundedPlacesCount: 0, status: 'pending', unpaidCount: 0, ...sur,
});
const resume = (/** @type {any} */ surcharge = {}) => ({
  collectedCents: 42000,
  entryFeeCents: 2000,
  maxTeams: 24,
  paidPlacesCount: 21,
  paidThreshold: 5,
  place: 'AR Soccer · Montpellier',
  registeredTeamsCount: 3,
  registrationsOpen: true,
  teams: [
    ligne({
      captain: { documentId: 'u-11', firstName: 'Yanis', lastName: 'Roux' }, documentId: 'eq-rauze', paidCents: 6000, paidCount: 3, paidPlacesCount: 3, unpaidCount: 2,
    }),
    ligne({
      captain: { documentId: 'u-21', firstName: 'Karim', lastName: 'Benali' }, documentId: 'eq-pantheres', paidCount: 5, paidPlacesCount: 5, status: 'accepted',
    }),
    ligne({
      captain: { documentId: 'u-41', firstName: 'Inès', lastName: 'Morel' }, count: 7, documentId: 'eq-nord', paidCount: 6, paidPlacesCount: 6, status: 'accepted',
    }),
    ligne({
      captain: { documentId: 'u-31', firstName: 'Sami', lastName: 'Haddad' }, documentId: 'eq-sami', refundedPlacesCount: 1, status: 'declined',
    }),
  ],
  validatedTeamsCount: 2,
  ...surcharge,
});

/** @type {any[]} */
const montes = [];
const navigation = { goBack: jest.fn(), navigate: jest.fn() };

const monter = async (/** @type {any} */ donnees = tableau(), /** @type {any} */ chiffres = resume()) => {
  mockDashboard = donnees;
  mockSummary = chiffres;
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(<TournamentManagement navigation={navigation} route={{ params: { eventId: 'evt-1' } }} />);
  });
  montes.push(arbre);
  return arbre;
};
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && (typeof n.props?.onPress === 'function' || typeof n.props?.onValueChange === 'function'),
)[0];
const toucher = async (/** @type {any} */ noeud) => { await act(async () => { await noeud.props.onPress(); }); };

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  [mockReview, mockRemind, mockRegistrations, mockCaptainsChat, mockExport, mockSave, mockWhisper, mockRequestFeatured, navigation.navigate]
    .forEach((espion) => espion.mockClear());
});

describe('RETOUCHES-R50 1b : « Retirer l’équipe » chez l’organisateur', () => {
  test('🔴 le menu dit « Retirer l’équipe », la confirmation « Retirer … ? », puis archive', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-pantheres'));
    expect(texte(arbre)).toContain('Retirer l’équipe');
    expect(texte(arbre)).not.toContain('Archiver l’équipe');
    await toucher(parTestID(arbre, 'orga-archiver-eq-pantheres'));
    const [titre, corps, boutons] = Alert.alert.mock.calls[0];
    expect(titre).toBe('Retirer Les Panthères ?');
    expect(corps).toContain('historique est gardé');
    expect(corps).not.toContain('Archivées');
    const confirmer = boutons.find((/** @type {any} */ bouton) => bouton.style !== 'cancel');
    expect(confirmer.text).toBe('Retirer');
    await act(async () => { await confirmer.onPress(); });
    expect(mockReview).toHaveBeenCalledWith('eq-pantheres', 'archived');
  });

  test('🔴 une équipe archivée porte la pastille « Retirée » et le filtre dit « Retirées »', async () => {
    const donnees = tableau();
    donnees.teams.push({ documentId: 'eq-partie', name: 'Les Partis', status: 'archived' });
    const contenu = texte(await monter(donnees));
    expect(contenu).toContain('Retirée');
    expect(contenu).toContain('Retirées');
    expect(contenu).not.toContain('Archivée');
  });

  test('🔴 une équipe qui n’a que sa date d’archivage ne se lit pas « Validée »', async () => {
    const donnees = tableau({
      teams: [{
        archivedAt: '2026-11-20T10:27:00.000Z', documentId: 'eq-test', name: 'Test ouverte', status: 'accepted',
      }],
    });
    const arbre = await monter(donnees, resume({ teams: [] }));
    expect(texte(arbre)).toContain('Test ouverte');
    // Les textes exacts (le filtre « Validées » de la page contient « Validée »).
    const textes = arbre.root.findAll((/** @type {any} */ n) => n.type === Text)
      .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
    expect(textes).toContain('Retirée');
    expect(textes).not.toContain('Validée');
  });
});
