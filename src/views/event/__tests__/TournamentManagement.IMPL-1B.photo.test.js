/* eslint-disable max-len -- les témoins se lisent en entier. */
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentManagement from '../TournamentManagement';

// IMPL-1B-PHOTO (19/11/2026, décision d'Adel du 19/11, écran 1a : « la photo de l'événement avec le
// ballon » = la photo du complexe) — LA PHOTO DU COMPLEXE DANS LA CARTE DU TOURNOI DE « GÉRER LE
// TOURNOI ». Le tableau de bord ne rend pas le lieu : la page lit la fiche du tournoi (même clé de cache
// que la fiche, `['event', id]`), où le serveur (IMPL-5B) rattache les photos sous `facility`.
// Les doubles sont ceux de TournamentManagement.IMPL3ORGA.test.js, plus la fiche.

/** @type {any} */
let mockFiche = null;
const mockUseGetEvent = jest.fn(() => ({ data: mockFiche }));
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: (/** @type {any[]} */ ...args) => mockUseGetEvent(...args),
}));

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
const photos = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === 'orga-venue-photo' && typeof n.type === 'string',
);

const media = (/** @type {string} */ nom) => ({
  alternativeText: null, formats: { medium: { url: `https://cdn.test/medium_${nom}.jpg` } }, url: `https://cdn.test/${nom}.jpg`,
});
const COMPLEXE = (/** @type {any[]} */ liste) => ({
  documentId: 'cx1', name: 'AR Soccer', photos: liste, slug: 'ar-soccer',
});

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockUseGetEvent.mockClear();
  mockFiche = null;
});

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
  jest.restoreAllMocks();
});

describe('IMPL-1B (1a) — la photo du complexe dans la carte de « Gérer le tournoi »', () => {
  test('🔴 la photo du complexe (taille medium) en tête de la carte, lue sur la fiche du tournoi', async () => {
    mockFiche = { documentId: 'evt-1', facility: { complexe: COMPLEXE([media('ballon')]), documentId: 'f1', photos: [] } };
    const arbre = await monter();
    expect(mockUseGetEvent).toHaveBeenCalledWith('evt-1');
    const [photo] = photos(arbre);
    expect(photo).toBeDefined();
    expect(photo.props.source).toEqual({ uri: 'https://cdn.test/medium_ballon.jpg' });
    expect(photo.props.accessibilityLabel).toBe('AR Soccer');
    // Rien de ce que la carte montrait ne disparaît.
    const json = JSON.stringify(arbre.toJSON());
    ['TOURNOI', 'FoundClub x AR Soccer', 'AR Soccer · Montpellier'].forEach((mot) => expect(json).toContain(mot));
  });

  test.each([
    ['fiche pas encore lue', null],
    ['complexe absent (suspendu)', { documentId: 'evt-1', facility: { documentId: 'f1', name: 'Terrain A' } }],
    ['aucune photo', { documentId: 'evt-1', facility: { complexe: COMPLEXE([]), documentId: 'f1', photos: [] } }],
  ])('%s : la carte d avant, sans image', async (_cas, fiche) => {
    mockFiche = fiche;
    const arbre = await monter();
    expect(photos(arbre)).toHaveLength(0);
    expect(JSON.stringify(arbre.toJSON())).toContain('FoundClub x AR Soccer');
  });
});
