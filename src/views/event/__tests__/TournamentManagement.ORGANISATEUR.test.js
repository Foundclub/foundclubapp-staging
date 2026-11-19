/* eslint-disable max-len -- les témoins se lisent en entier. */
import { Alert, Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentManagement from '../TournamentManagement';

// ORGANISATEUR (19/11/2026, décisions d'Adel, liste de travail FIDELITE-MAQUETTES, cartes 1a-1f et 11b) — LES
// FINITIONS DE « GÉRER LE TOURNOI ». 1 « Archiver l équipe » demande une confirmation (O9) ; 2 les anciens blocs
// « Structure sportive » et « Actions compétition » quittent la page, leurs gestes passent dans les lignes du Jour J
// (aucun n existait ailleurs : grep du 19/11) ; 3 « Refuser » une équipe VALIDÉE, fenêtre rouge et avis au
// SuperAdmin ; 4 la carte du tournoi (photo, lieu court, « 1 payé sur 5 », pas d « Effectif à revoir », trait avant
// l action rouge) ; 5 le bureau en lignes serrées ; 7 la phrase « Une équipe se valide seule dès 5 joueurs payés. »
// et « ton équipe ».

// Le premier rendu charge tout l écran (7 s mesurées sous charge) : délai large, pas de faux rouge.
jest.setTimeout(30000);

/** @type {any} */
let mockGerant = true;
const mockDraw = jest.fn(() => Promise.resolve({}));
const mockSync = jest.fn(() => Promise.resolve({}));
const mockKnockout = jest.fn(() => Promise.resolve({}));
const mockMatches = jest.fn(() => Promise.resolve({}));
const mockPublish = jest.fn(() => Promise.resolve({}));
const mockClose = jest.fn(() => Promise.resolve({}));
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
  default: () => ({ canManageEvent: () => mockGerant, userData: { documentId: 'u-21' } }),
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
// Récolte train 16 : IMPL-1B-PHOTO (e3954b46) fait lire la fiche du tournoi à la page (photo du lieu,
// carte 1a) ; ici, pas de photo (même doublure que les 3 autres témoins de TournamentManagement).
jest.mock('@/services/event/eventQueries', () => ({ useGetEvent: () => ({ data: null }) }));
jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({
    data: mockDashboard, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/tournamentCompetition/tournamentCompetitionService', () => ({
  drawTournamentGroups: (/** @type {any[]} */ ...args) => mockDraw(...args),
  generateTournamentKnockout: (/** @type {any[]} */ ...args) => mockKnockout(...args),
  generateTournamentMatches: (/** @type {any[]} */ ...args) => mockMatches(...args),
  publishTournamentCompetition: (/** @type {any[]} */ ...args) => mockPublish(...args),
  setupTournamentCompetition: (/** @type {any[]} */ ...args) => mockSync(...args),
}));
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  closeTournament: (/** @type {any[]} */ ...args) => mockClose(...args),
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
const mockCancelEvent = jest.fn(() => Promise.resolve({ data: {} }));
jest.mock('@/services/event/eventService', () => ({
  cancelEvent: (/** @type {any[]} */ ...args) => mockCancelEvent(...args),
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

beforeEach(() => {
  mockGerant = true;
  [mockDraw, mockSync, mockKnockout, mockMatches, mockPublish, mockClose].forEach((espion) => espion.mockClear());
});

/** Le bouton « confirmer » (non « cancel ») de la dernière fenêtre ouverte. */
const confirmerLaFenetre = async () => {
  const appels = /** @type {any} */ (Alert.alert).mock.calls;
  const boutons = appels[appels.length - 1][2];
  const confirmer = boutons.find((/** @type {any} */ bouton) => bouton.style !== 'cancel');
  await act(async () => { await confirmer.onPress(); });
};

describe('ORGANISATEUR 1 — « Archiver l équipe » demande une confirmation (O9)', () => {
  test('🔴 toucher « Archiver » n archive rien : une fenêtre demande, puis archive', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-pantheres'));
    await toucher(parTestID(arbre, 'orga-archiver-eq-pantheres'));
    expect(mockReview).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Archiver Les Panthères ?', expect.any(String), expect.any(Array));
    await confirmerLaFenetre();
    expect(mockReview).toHaveBeenCalledWith('eq-pantheres', 'archived');
  });

  test('« Annuler » dans la fenêtre : rien n est archivé', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-pantheres'));
    await toucher(parTestID(arbre, 'orga-archiver-eq-pantheres'));
    const boutons = /** @type {any} */ (Alert.alert).mock.calls[0][2];
    expect(boutons.find((/** @type {any} */ bouton) => bouton.style === 'cancel')).toBeDefined();
    expect(mockReview).not.toHaveBeenCalled();
  });
});

describe('ORGANISATEUR 2 — les anciens blocs quittent la page, leurs gestes passent dans le Jour J', () => {
  test('🔴 ni « Structure sportive » ni « Actions compétition » sur la page de l organisateur', async () => {
    const rendu = texte(await monter());
    expect(rendu).not.toContain('Structure sportive');
    expect(rendu).not.toContain('Actions compétition');
    expect(rendu).not.toContain('Validation des équipes');
  });

  test('🔴 « Poules » déplie « Tirer les poules » et « Synchroniser la structure », qui partent au serveur', async () => {
    const arbre = await monter();
    expect(parLibelle(arbre, 'Tirer les poules')).toBeUndefined();
    await toucher(parTestID(arbre, 'orga-jour-j-groups'));
    await toucher(parLibelle(arbre, 'Synchroniser la structure'));
    expect(mockSync).toHaveBeenCalledWith('evt-1', expect.any(Object));
    await toucher(parLibelle(arbre, 'Tirer les poules'));
    expect(mockDraw).toHaveBeenCalledWith('evt-1');
  });

  test('🔴 « Matchs » déplie « Générer les matchs » et « Publier la compétition »', async () => {
    const arbre = await monter(tableau({ overview: { groups: 2, totalMatches: 4 } }));
    expect(parLibelle(arbre, 'Générer les matchs')).toBeUndefined();
    await toucher(parTestID(arbre, 'orga-jour-j-matches'));
    await toucher(parLibelle(arbre, 'Générer les matchs'));
    expect(mockMatches).toHaveBeenCalledWith('evt-1');
    await toucher(parLibelle(arbre, 'Publier la compétition'));
    await confirmerLaFenetre();
    expect(mockPublish).toHaveBeenCalledWith('evt-1');
  });

  test('🔴 « Phases finales » déplie « Générer la phase finale »', async () => {
    const config = { ...tableau().config, formatMode: 'groups_to_knockout' };
    const arbre = await monter(tableau({ config }));
    expect(parLibelle(arbre, 'Générer la phase finale')).toBeUndefined();
    await toucher(parTestID(arbre, 'orga-jour-j-bracket'));
    await toucher(parLibelle(arbre, 'Générer la phase finale'));
    expect(mockKnockout).toHaveBeenCalledWith('evt-1');
  });

  test('🔴 « Clôturer le tournoi » reste sur la page, avec sa fenêtre, puis clôture', async () => {
    const arbre = await monter();
    await toucher(parLibelle(arbre, 'Clôturer le tournoi'));
    expect(mockClose).not.toHaveBeenCalled();
    await confirmerLaFenetre();
    expect(mockClose).toHaveBeenCalledWith('evt-1');
  });

  test('caractérisant : le lecteur (non organisateur) garde sa « Lecture compétition »', async () => {
    mockGerant = false;
    const rendu = texte(await monter());
    expect(rendu).toContain('Lecture compétition');
  });
});

describe('ORGANISATEUR 3 — « Refuser » une équipe VALIDÉE (décision du 19/11)', () => {
  test('🔴 le menu d une équipe validée propose « Refuser l équipe »', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-nord'));
    expect(parTestID(arbre, 'orga-refuser-eq-nord')).toBeDefined();
  });

  test('🔴 la fenêtre rouge dit les places à rembourser et que FoundClub est prévenu, puis refuse', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-nord'));
    await toucher(parTestID(arbre, 'orga-refuser-eq-nord'));
    const rendu = texte(arbre);
    expect(rendu).toContain('Refuser Montpellier Nord ?');
    expect(rendu).toContain('Les 6 places déjà payées sont remboursées en entier');
    expect(rendu).toContain('FoundClub est prévenu et s’occupe du remboursement.');
    expect(mockReview).not.toHaveBeenCalled();
    await toucher(parLibelle(arbre, 'Refuser l’équipe'));
    expect(mockReview).toHaveBeenCalledWith('eq-nord', 'declined');
  });

  test('caractérisant : une équipe refusée n a pas de « Refuser »', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-sami'));
    expect(parTestID(arbre, 'orga-refuser-eq-sami')).toBeUndefined();
  });
});

describe('ORGANISATEUR 4 — la carte du tournoi et les cartes d équipe (1a, 1b)', () => {
  test('🔴 la carte porte la photo du tournoi et le lieu court « AR Soccer · Montpellier »', async () => {
    const arbre = await monter(tableau(), resume({ place: 'AR Soccer, 119 rue de la Rauze basse, 34070 Montpellier' }));
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'orga-photo-tournoi').length).toBeGreaterThan(0);
    const rendu = texte(arbre);
    expect(rendu).toContain('AR Soccer · Montpellier');
    expect(rendu).not.toContain('119 rue de la Rauze');
  });

  test('🔴 « 1 payé sur 5 », au singulier', async () => {
    const chiffres = resume();
    chiffres.teams[0] = { ...chiffres.teams[0], paidCount: 1, unpaidCount: 4 };
    const rendu = texte(await monter(tableau(), chiffres));
    expect(rendu).toContain('1 payé sur 5');
    expect(rendu).not.toContain('1 payés sur 5');
    expect(rendu).toContain('5 payés sur 5');
  });

  test('🔴 plus d étiquette « Effectif à revoir » sur les cartes ; le filtre « Effectifs à revoir » reste', async () => {
    const config = { ...tableau().config, minRosterSize: 5 };
    const rendu = texte(await monter(tableau({ config })));
    expect(rendu).not.toContain('"Effectif à revoir"');
    expect(rendu).toContain('Effectifs à revoir');
  });

  test('🔴 un trait sépare l action rouge du reste du menu', async () => {
    const arbre = await monter();
    await toucher(parTestID(arbre, 'orga-menu-eq-rauze'));
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'orga-menu-trait-eq-rauze').length).toBeGreaterThan(0);
  });

  test('🔴 le lecteur lit « Voir l équipe », plus « Ouvrir l équipe »', async () => {
    mockGerant = false;
    const arbre = await monter();
    await toucher(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournoi-onglet-teams' && typeof n.props?.onPress === 'function')[0]);
    const rendu = texte(arbre);
    expect(rendu).toContain('Voir l’équipe');
    expect(rendu).not.toContain('Ouvrir l');
  });
});

describe('ORGANISATEUR 4 — le titre une seule fois', () => {
  const OS_DEPART = Platform.OS;
  afterEach(() => { Platform.OS = OS_DEPART; });

  test('🔴 site : la barre dit « Gérer le tournoi », l écran ne le redit pas', async () => {
    Platform.OS = /** @type {any} */ ('web');
    const rendu = texte(await monter());
    expect(rendu).not.toContain('Gérer le tournoi');
  });

  test('caractérisant : téléphone, le titre est dit une fois (la pile n en a pas)', async () => {
    const rendu = texte(await monter());
    expect(rendu.split('Gérer le tournoi').length - 1).toBe(1);
  });
});

describe('ORGANISATEUR 5 — le bureau : des lignes serrées (1f)', () => {
  test('🔴 à 1280 px : une ligne par équipe, les filtres restent', async () => {
    const fenetre = jest.spyOn(
      jest.requireActual('react-native/Libraries/Utilities/useWindowDimensions'),
      'default',
    ).mockReturnValue({
      fontScale: 1, height: 900, scale: 1, width: 1280,
    });
    const arbre = await monter();
    ['eq-rauze', 'eq-pantheres', 'eq-nord', 'eq-sami'].forEach((id) => {
      expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === `orga-ligne-${id}`).length).toBeGreaterThan(0);
    });
    expect(texte(arbre)).toContain('Effectifs à revoir');
    expect(texte(arbre)).toContain('Cap. Yanis Roux');
    fenetre.mockRestore();
  });

  test('caractérisant : à 390 px, les cartes restent', async () => {
    const arbre = await monter();
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'orga-ligne-eq-rauze').length).toBe(0);
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'orga-equipe-eq-rauze').length).toBeGreaterThan(0);
  });
});

describe('ORGANISATEUR 7 — la règle des payés et « ton équipe » (11b)', () => {
  test('🔴 la phrase « Une équipe se valide seule dès 5 joueurs payés. »', async () => {
    expect(texte(await monter())).toContain('Une équipe se valide seule dès 5 joueurs payés.');
  });

  test('caractérisant : un tournoi gratuit ne dit pas cette phrase', async () => {
    const gratuit = tableau({ config: { competitionState: 'draft', formatMode: 'groups_only', registrationMode: 'manual' } });
    expect(texte(await monter(gratuit, resume({ entryFeeCents: 0 })))).not.toContain('se valide seule');
  });

  test('🔴 l équipe dont l organisateur est capitaine dit « ton équipe »', async () => {
    expect(texte(await monter())).toContain('Capitaine : Karim Benali · ton équipe');
  });
});

describe('ORGANISATEUR 8 (Adel Q5 « A ») — « Annuler l événement » sous Réglages, à côté de « Clôturer »', () => {
  beforeEach(() => { mockCancelEvent.mockClear(); });

  test('🔴 une fenêtre demande, puis l événement est annulé et l écran revient en arrière', async () => {
    const arbre = await monter();
    await toucher(parLibelle(arbre, 'Annuler l’événement'));
    expect(mockCancelEvent).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Es-tu sûr·e de vouloir annuler cet événement ?',
      'Une fois annulé, l\'événement ne sera plus visible par les participant·e·s.',
      expect.any(Array),
    );
    await confirmerLaFenetre();
    expect(mockCancelEvent).toHaveBeenCalledWith({ documentId: 'evt-1' });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  test('🔴 la Ville prévenue : le message est dit avant de revenir', async () => {
    mockCancelEvent.mockResolvedValueOnce({ meta: { collectivitePrevenue: { collectiviteName: 'Ville de Montpellier' } } });
    const arbre = await monter();
    await toucher(parLibelle(arbre, 'Annuler l’événement'));
    await confirmerLaFenetre();
    expect(Alert.alert).toHaveBeenCalledWith('C’est annulé', 'La Ville de Montpellier est prévenue : la place se libère.', expect.any(Array));
  });

  test('caractérisant : le lecteur n a pas « Annuler l événement »', async () => {
    mockGerant = false;
    const arbre = await monter();
    expect(parLibelle(arbre, 'Annuler l’événement')).toBeUndefined();
  });
});
