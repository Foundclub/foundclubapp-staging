/* eslint-disable max-len -- les témoins se lisent en entier. */
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentManagement from '../TournamentManagement';

// IMPL-3-ORGA (18/11/2026, page 1 des planches T-DESIGN-TOURNOI, Adel D261 « 1- A ») — LA PAGE DE L ORGANISATEUR.
// Check-list page 1 : 1 inscrites + places libres, 2 « N payés sur 5 » par équipe, 3 encaissé, 4 relancer,
// 5 refuser avec la règle de remboursement, 6 écrire au capitaine / à tous les capitaines, 7 réglages, 8 interrupteur
// des inscriptions, 9 partager, 10 à la une, 11 jour J, 12 exporter. Maquettes 1a à 1f.

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
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());
const parLibelle = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.accessibilityLabel === libelle && typeof n.props?.onPress === 'function',
)[0];
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === id && (typeof n.props?.onPress === 'function' || typeof n.props?.onValueChange === 'function'),
)[0];
const toucher = async (/** @type {any} */ noeud) => { await act(async () => { await noeud.props.onPress(); }); };

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  [mockReview, mockRemind, mockRegistrations, mockCaptainsChat, mockExport, mockSave, mockWhisper, mockRequestFeatured, navigation.navigate]
    .forEach((espion) => espion.mockClear());
});

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
  jest.restoreAllMocks();
});

describe('IMPL-3 1a — le tableau de bord', () => {
  test('🔴 en haut : le tournoi, l interrupteur, les quatre chiffres, les trois boutons', async () => {
    const rendu = texte(await monter());
    ['Gérer le tournoi', 'FoundClub x AR Soccer', 'AR Soccer · Montpellier', 'Inscriptions ouvertes', 'Les joueurs peuvent s’inscrire',
      '3 sur 24', '21 places libres', 'équipes validées (5 payés)', 'places payées', '420 €', 'encaissé',
      'Partager le tournoi', 'Écrire à tous les capitaines', 'Exporter la liste'].forEach((attendu) => {
      expect(rendu).toContain(attendu);
    });
  });

  test('🔴 une ligne par équipe : capitaine, « N payés sur 5 », état ; 6 payés sur 7 joueurs', async () => {
    const rendu = texte(await monter());
    expect(rendu).toContain('Capitaine : Yanis Roux');
    expect(rendu).toContain('3 payés sur 5');
    expect(rendu).toContain('En attente des paiements');
    expect(rendu).toContain('5 payés sur 5');
    expect(rendu).toContain('6 payés · 7 joueurs');
    expect(rendu).toContain('Validée');
    expect(rendu).toContain('Refusée');
    expect(rendu).toContain('1 place payée remboursée');
  });

  test('🔴 « Voir l équipe » ouvre la page de l équipe', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-voir-eq-rauze'));
    expect(navigation.navigate).toHaveBeenCalledWith('TournamentTeamDetails', { eventId: 'evt-1', teamId: 'eq-rauze' });
  });

  test('1e : aucune équipe => un seul geste, « Partager le tournoi »', async () => {
    const arbre = await monter(tableau({ teams: [] }), resume({ registeredTeamsCount: 0, teams: [] }));
    expect(texte(arbre)).toContain('Aucune équipe pour l’instant');
    expect(texte(arbre)).toContain('Partage le tournoi : les équipes apparaîtront ici dès leur inscription.');
  });
});

describe('IMPL-3 1b — le menu ⋯ d une équipe', () => {
  test('🔴 équipe en attente : relancer (2), écrire au capitaine, refuser ; jamais « Valider » (tournoi payant)', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-rauze'));
    const rendu = texte(arbre);
    expect(rendu).toContain('Relancer ceux qui n’ont pas payé (2)');
    expect(rendu).toContain('Écrire au capitaine');
    expect(rendu).toContain('Refuser l’équipe');
    expect(rendu).not.toContain('"Valider"');
  });

  test('🔴 équipe validée : pas de « Refuser l équipe » (CGV partie I § 3)', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-pantheres'));
    expect(parTestID(arbre, 'orga-refuser-eq-pantheres')).toBeUndefined();
    expect(parTestID(arbre, 'orga-ecrire-eq-pantheres')).toBeDefined();
  });

  test('caractérisant : un tournoi gratuit en validation manuelle garde « Valider l équipe » dans le menu', async () => {
    const gratuit = tableau({ config: { competitionState: 'draft', formatMode: 'groups_only', registrationMode: 'manual' } });
    const arbre = await monter(gratuit, resume({ entryFeeCents: 0 }));
    await toucher(parTestID(arbre, 'orga-menu-eq-rauze'));
    await toucher(parTestID(arbre, 'orga-valider-eq-rauze'));
    expect(mockReview).toHaveBeenCalledWith('eq-rauze', 'accepted');
  });

  test('🔴 « Relancer » : la relance part, la phrase dit combien de joueurs', async () => {
    mockRemind.mockResolvedValue({ sent: 2, skipped: 0 });
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-rauze'));
    await toucher(parTestID(arbre, 'orga-relancer-eq-rauze'));
    expect(mockRemind).toHaveBeenCalledWith('eq-rauze');
    expect(texte(arbre)).toContain('Relance envoyée aux 2 joueurs de FC Rauze qui n’ont pas payé.');
  });

  test('🔴 « Écrire au capitaine » ouvre le fil direct avec lui', async () => {
    mockWhisper.mockResolvedValue({ documentId: 'fil-11' });
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-rauze'));
    await toucher(parTestID(arbre, 'orga-ecrire-eq-rauze'));
    expect(mockWhisper).toHaveBeenCalledWith(['u-11']);
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', { chatId: 'fil-11' });
  });

  test('caractérisant : « Archiver l équipe » reste dans le menu', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-pantheres'));
    await toucher(parTestID(arbre, 'orga-archiver-eq-pantheres'));
    expect(mockReview).toHaveBeenCalledWith('eq-pantheres', 'archived');
  });
});

describe('IMPL-3 1d — refuser une équipe : la règle de remboursement avant le geste', () => {
  test('🔴 la fenêtre dit combien de places payées sont remboursées, puis refuse', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-rauze'));
    await toucher(parTestID(arbre, 'orga-refuser-eq-rauze'));
    const rendu = texte(arbre);
    expect(rendu).toContain('Refuser FC Rauze ?');
    expect(rendu).toContain('L’équipe quitte le tournoi et ses joueurs sont prévenus.');
    expect(rendu).toContain('Les 3 places déjà payées sont remboursées en entier (60 €), sous 14 jours.');
    expect(rendu).toContain('Le remboursement revient sur le moyen de paiement de chaque joueur.');
    expect(mockReview).not.toHaveBeenCalled();
    await toucher(parLibelle(arbre, 'Refuser l’équipe'));
    expect(mockReview).toHaveBeenCalledWith('eq-rauze', 'declined');
  });

  test('« Annuler » ferme la fenêtre sans rien refuser', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-rauze'));
    await toucher(parTestID(arbre, 'orga-refuser-eq-rauze'));
    await toucher(parLibelle(arbre, 'Annuler'));
    expect(texte(arbre)).not.toContain('Refuser FC Rauze ?');
    expect(mockReview).not.toHaveBeenCalled();
  });
});

describe('IMPL-3 8 — l interrupteur des inscriptions', () => {
  test('🔴 fermer : le serveur est appelé, l en-tête dit « Inscriptions fermées »', async () => {
    mockRegistrations.mockResolvedValue({ registrationsOpen: false });
    const arbre = await monter();
    const interrupteur = parTestID(arbre, 'orga-inscriptions');
    await act(async () => { await interrupteur.props.onValueChange(false); });
    expect(mockRegistrations).toHaveBeenCalledWith('evt-1', false);
    expect(texte(arbre)).toContain('Inscriptions fermées');
  });

  test('🔴 fermées au chargement : la phrase dit que le tournoi continue', async () => {
    const rendu = texte(await monter(tableau(), resume({ registrationsOpen: false })));
    expect(rendu).toContain('Inscriptions fermées');
    expect(rendu).toContain('Plus aucune équipe ne s’inscrit. Le tournoi continue.');
  });
});

describe('IMPL-3 6, 9, 12 — les trois boutons', () => {
  test('🔴 « Écrire à tous les capitaines » ouvre le groupe des capitaines', async () => {
    mockCaptainsChat.mockResolvedValue({ chatId: 'groupe-cap', created: true, excludedCount: 0 });
    const arbre = await monter();
    await toucher(parLibelle(arbre, 'Écrire à tous les capitaines'));
    expect(mockCaptainsChat).toHaveBeenCalledWith('evt-1');
    expect(navigation.navigate).toHaveBeenCalledWith('Conversation', { chatId: 'groupe-cap' });
  });

  test('🔴 « Exporter la liste » enregistre le CSV des joueurs', async () => {
    mockExport.mockResolvedValue('Équipe;Prénom\r\n');
    const arbre = await monter();
    await toucher(parLibelle(arbre, 'Exporter la liste'));
    expect(mockExport).toHaveBeenCalledWith('evt-1');
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'joueurs_FoundClub_x_AR_Soccer.csv', mimeType: 'text/csv' }));
  });

  test('🔴 « Partager le tournoi » ouvre la feuille de partage existante', async () => {
    const arbre = await monter();
    await toucher(parLibelle(arbre, 'Partager le tournoi'));
    expect(texte(arbre)).toContain('FEUILLE DE PARTAGE');
  });
});

describe('IMPL-3 1c — Jour J, Réglages, À la une', () => {
  test('🔴 Jour J : Poules, Matchs, Classements ; « Réglages » ouvre les réglages', async () => {
    const arbre = await monter();
    const rendu = texte(arbre);
    ['Jour J', 'Poules', 'Matchs', 'Classements', 'Réglages', 'À la une', 'demander la mise en avant'].forEach((attendu) => {
      expect(rendu).toContain(attendu);
    });
    await toucher(parTestID(arbre, 'orga-reglages'));
    expect(navigation.navigate).toHaveBeenCalledWith('TournamentSettingsEdit', { eventId: 'evt-1' });
  });

  test('caractérisant : les gestes de la compétition restent (synchroniser, tirer, clôturer)', async () => {
    const arbre = await monter();
    expect(parLibelle(arbre, 'Synchroniser la structure')).toBeDefined();
    expect(parLibelle(arbre, 'Tirer les poules')).toBeDefined();
    expect(parLibelle(arbre, 'Clôturer le tournoi')).toBeDefined();
  });

  test('🔴 « À la une » : après confirmation, la demande de mise en avant publique part', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-a-la-une'));
    const confirmer = Alert.alert.mock.calls[0][2].find((/** @type {any} */ bouton) => bouton.style !== 'cancel');
    await act(async () => { await confirmer.onPress(); });
    expect(mockRequestFeatured).toHaveBeenCalledWith({ eventId: 'evt-1', scopes: ['PUBLIC'] });
  });
});

describe('IMPL-3 1f — le bureau', () => {
  test.each([
    [390, 'orga-une-colonne'],
    [1280, 'orga-deux-colonnes'],
  ])('🔴 à %i px : %s', async (largeur, attendu) => {
    const fenetre = jest.spyOn(
      jest.requireActual('react-native/Libraries/Utilities/useWindowDimensions'),
      'default',
    ).mockReturnValue({
      fontScale: 1, height: 900, scale: 1, width: largeur,
    });
    const arbre = await monter();
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === attendu).length).toBeGreaterThan(0);
    fenetre.mockRestore();
  });
});

// Relecture du 18/11 : le résumé peut manquer (chargement, panne, 403 d'un dirigeant du club porteur qui passe
// canManageEvent côté app mais pas la garde du serveur). Aucun chiffre de paiement n'est alors inventé.
describe('IMPL-3 — sans résumé de l organisateur', () => {
  afterEach(() => { mockErreurDuResume.value = null; });

  test('🔴 403 : ni « 0 € » ni « 0 payés sur 5 », l interrupteur est grisé, la raison est dite', async () => {
    mockErreurDuResume.value = { status: 403 };
    const arbre = await monter(tableau(), null);
    const rendu = texte(arbre);
    expect(rendu).not.toContain('0 €');
    expect(rendu).not.toContain('payés sur');
    expect(rendu).toContain('—');
    expect(rendu).toContain('Les paiements et l’interrupteur des inscriptions sont réservés à l’organisateur du tournoi.');
    expect(parTestID(arbre, 'orga-inscriptions').props.disabled).toBe(true);
  });

  test('🔴 sans résumé, la fenêtre de refus dit la règle, jamais « rien à rembourser »', async () => {
    const arbre = await monter(tableau(), null);
    await toucher(parTestID(arbre, 'orga-menu-eq-rauze'));
    await toucher(parTestID(arbre, 'orga-refuser-eq-rauze'));
    const rendu = texte(arbre);
    expect(rendu).toContain('Les places déjà payées sont remboursées en entier, sous 14 jours.');
    expect(rendu).not.toContain('rien à rembourser');
  });
});
