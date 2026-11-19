/* eslint-disable max-len -- les témoins se lisent en entier. */
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { lirePageDuSite } from '@/components/templates/pageDuSite';

import TournamentManagement from '../TournamentManagement';

// CORR-EVENEMENTS (recette du site, 30/10) — le cockpit du tournoi n'avait AUCUN test (E6).
// · 129 C : « Générer les matchs » ne disait rien ; décision : dire combien de matchs sont créés.
// · 131 A : après « Clôturer », le cockpit disait « en brouillon » et proposait tirer, modifier,
//   clôturer ; décision : lecture seule, avec un bandeau « Clôturé ».
// Le premier bloc décrit l'existant d'un tournoi ouvert, qui ne doit pas bouger.

// Le premier rendu charge tout l écran (jusqu à 7 s sous charge, rouge par délai le 19/11) : délai large.
jest.setTimeout(30000);

/** @type {any} */
let mockDashboard = null;
const mockErreurDuTableau = { value: /** @type {any} */ (null) };
const mockGenerate = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options?.mutationFn?.(variables)).then(
      (resultat) => options?.onSuccess?.(resultat, variables),
      (erreur) => options?.onError?.(erreur, variables),
    ),
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(() => Promise.resolve()) }),
}));

jest.mock('../TournamentInvites', () => function InvitesDouble() { return null; });
jest.mock('../TournamentInvitationRequest', () => function DemandeDouble() { return null; });
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

// REPRISE-EVENEMENTS 130 : `mockPeutGerer` bascule l'organisateur en simple lecteur (parent).
const mockPeutGerer = { value: true };
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ canManageEvent: () => mockPeutGerer.value }),
}));
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, { accessibilityLabel: props.title, disabled: props.disabled, onPress: props.onPress }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (/** @type {any} */ { children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => (/** @type {any} */ { children }) => children);
jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentDashboard: () => ({
    data: mockDashboard, error: mockErreurDuTableau.value, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/tournamentCompetition/tournamentCompetitionService', () => ({
  drawTournamentGroups: jest.fn(() => Promise.resolve({})),
  generateTournamentKnockout: jest.fn(() => Promise.resolve({})),
  generateTournamentMatches: (/** @type {any[]} */ ...args) => mockGenerate(...args),
  publishTournamentCompetition: jest.fn(() => Promise.resolve({})),
  setupTournamentCompetition: jest.fn(() => Promise.resolve({})),
}));
// IMPL-3-ORGA (18/11) : le tableau de bord de l organisateur lit sa route à lui ; ici, aucun résumé.
jest.mock('@/services/tournamentTeam/tournamentOrganizerService', () => ({
  tournamentOrganizerSummaryKey: (/** @type {string} */ id) => ['tournament-organizer', id],
  useTournamentOrganizerSummary: () => ({ data: null, refetch: jest.fn() }),
}));
jest.mock('@/services/chat/chatService', () => ({ createChatMessage: jest.fn(), createWhisperChat: jest.fn() }));
jest.mock('@/components/organisms/shareEventModal/ShareEventModal', () => function PartageDouble() { return null; });
jest.mock('@/services/tournamentTeam/tournamentTeamService', () => ({
  closeTournament: jest.fn(() => Promise.resolve({})),
  reviewTournamentTeamRegistration: jest.fn(() => Promise.resolve({})),
}));

const tableau = (/** @type {any} */ surcharge = {}) => ({
  bracket: null,
  config: { competitionState: 'draft', formatMode: 'groups_only' },
  event: { documentId: 'evt-1', sessionStatus: 'open' },
  groups: [],
  matches: [],
  overview: { groups: 1, totalMatches: 0 },
  standings: [],
  teams: [
    { documentId: 'eq-1', name: 'Alpha', status: 'accepted' },
    { documentId: 'eq-2', name: 'Bravo', status: 'accepted' },
  ],
  ...surcharge,
});

/** @type {any[]} */
const montes = [];

const monter = async (/** @type {any} */ donnees) => {
  mockDashboard = donnees;
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <TournamentManagement navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: { eventId: 'evt-1' } }} />,
    );
  });
  montes.push(arbre);
  return arbre;
};
const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());
// ORGANISATEUR 2 (19/11) : les gestes de la compétition sont sous les lignes du Jour J ; on déplie la ligne.
const deplier = async (/** @type {any} */ arbre, /** @type {string} */ onglet) => {
  const ligne = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === `orga-jour-j-${onglet}` && typeof n.props?.onPress === 'function')[0];
  await act(async () => { await ligne.props.onPress(); });
};
const boutons = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.accessibilityLabel === 'string' && typeof n.props?.onPress === 'function',
).map((/** @type {any} */ n) => n.props.accessibilityLabel);

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGenerate.mockReset();
});

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
  jest.restoreAllMocks();
});

describe('existant — un tournoi ouvert garde ses gestes', () => {
  test('brouillon : tirer, générer, modifier et clôturer sont proposés', async () => {
    const arbre = await monter(tableau());

    // Avant : tout se lisait d'un coup dans « Actions compétition ». ORGANISATEUR 2 (19/11) : « Poules » déplie
    // l'état et le tirage, « Matchs » la génération ; « Réglages » et « Clôturer » restent sur la page.
    await deplier(arbre, 'groups');
    expect(texte(arbre)).toContain('Compétition en brouillon');
    expect(boutons(arbre)).toEqual(expect.arrayContaining([
      // IMPL-3-ORGA (planche 1c) : « Modifier les paramètres » est devenu la ligne « Réglages ».
      'Tirer les poules', 'Réglages', 'Clôturer le tournoi',
    ]));
    await deplier(arbre, 'matches');
    expect(boutons(arbre)).toContain('Générer les matchs');
  });
});

describe('CORR-EVENEMENTS 129 C — « Générer les matchs » dit ce qu il a créé', () => {
  test('🐞 après la génération, le nombre de matchs créés est annoncé', async () => {
    mockGenerate.mockResolvedValue({ overview: { groups: 1, totalMatches: 6 } });
    const arbre = await monter(tableau());
    await deplier(arbre, 'matches');
    const generer = arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Générer les matchs')[0];

    await act(async () => { await generer.props.onPress(); });

    const appels = Alert.alert.mock.calls.map((/** @type {any[]} */ appel) => `${appel[0]} ${appel[1] || ''}`);
    expect(appels.join(' | ')).toContain('6 matchs créés');
  });

  test('🐞 aucun match créé : la cause est dite', async () => {
    mockGenerate.mockResolvedValue({ overview: { groups: 2, totalMatches: 0 } });
    const arbre = await monter(tableau());
    await deplier(arbre, 'matches');
    const generer = arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Générer les matchs')[0];

    await act(async () => { await generer.props.onPress(); });

    const appels = Alert.alert.mock.calls.map((/** @type {any[]} */ appel) => `${appel[0]} ${appel[1] || ''}`);
    expect(appels.join(' | ')).toContain('Aucun match créé');
  });
});

describe('CORR-EVENEMENTS 131 — un tournoi clôturé se lit, il ne se pilote plus', () => {
  test('🐞 clôturé : bandeau « Tournoi clôturé », plus aucun geste, plus de « brouillon »', async () => {
    const arbre = await monter(tableau({
      event: { documentId: 'evt-1', sessionStatus: 'closed' },
      teams: [
        {
          archivedAt: '2026-10-30T18:12:00.000Z', documentId: 'eq-1', name: 'Alpha', status: 'archived',
        },
      ],
    }));

    expect(texte(arbre)).toContain('Tournoi clôturé');
    expect(texte(arbre)).not.toContain('Compétition en brouillon');
    expect(boutons(arbre)).not.toEqual(expect.arrayContaining(['Tirer les poules']));
    expect(boutons(arbre)).not.toContain('Modifier les paramètres');
    expect(boutons(arbre)).not.toContain('Clôturer le tournoi');
  });
});

// REPRISE-EVENEMENTS 130 — un parent lisait « Pilotage du tournoi : tire les poules, génère
// les matchs… », une phrase d'organisateur. Le lecteur lit le nom du tournoi.
describe('REPRISE-EVENEMENTS 130 — le titre du lecteur', () => {
  afterEach(() => { mockPeutGerer.value = true; });

  test('🐞 un parent lit le nom du tournoi, pas « Pilotage du tournoi »', async () => {
    mockPeutGerer.value = false;
    const donnees = tableau();
    const arbre = await monter({ ...donnees, event: { ...donnees.event, name: 'Tournoi de Noël' } });

    expect(texte(arbre)).toContain('Tournoi de Noël');
    expect(texte(arbre)).not.toContain('Pilotage du tournoi');
    expect(texte(arbre)).not.toContain('Gérer le tournoi');
    expect(texte(arbre)).not.toContain('Tire les poules');
  });

  // IMPL-3-ORGA (planche 1a) : « Pilotage du tournoi » est devenu « Gérer le tournoi ».
  test('l organisateur garde son titre de pilotage', async () => {
    const arbre = await monter(tableau());

    expect(texte(arbre)).toContain('Gérer le tournoi');
  });
});

// CORR-EVENEMENTS point 133 (recette du site, 30/10) — textes du tournoi sans accents, « (s) » et
// mots anglais. Les textes écrits en dur dans le cockpit passent par le catalogue.
describe('CORR-EVENEMENTS 133 — le cockpit parle français', () => {
  afterEach(() => { mockPeutGerer.value = true; });

  // Avant : lu par l'organisateur dans « Structure sportive ». ORGANISATEUR 2 (19/11) : ce bloc a quitté sa page ;
  // le lecteur le lit toujours dans la vue d'ensemble.
  test('🐞 plus de « poule(s) », « match(s) », « Equipes », « Aleatoire » ni « roster »', async () => {
    mockPeutGerer.value = false;
    const arbre = await monter(tableau({
      config: { competitionState: 'draft', formatMode: 'groups_only', seedingMode: 'random' },
    }));
    const rendu = texte(arbre);

    expect(rendu).toContain('1 poule');
    expect(rendu).toContain('0 match');
    expect(rendu).toContain('Équipes');
    expect(rendu).toContain('Aléatoire');
    expect(rendu).not.toMatch(/poule\(s\)|match\(s\)|"Equipes"|Aleatoire|Warnings|roster/);
  });
});

// FIN-TEXTES (02/11, PARENT 130) — le titre de l'écran était juste, mais la barre fine du site
// disait encore « Pilotage du tournoi » au lecteur : elle lit la clé du registre tant que l'écran
// ne déclare rien.
describe('FIN-TEXTES 130 — la barre fine du site', () => {
  afterEach(() => { mockPeutGerer.value = true; });

  // T3-PLACE (03/11) : à 390, un nom long se coupait dans la barre et se répétait juste dessous.
  // Le nom reste là où il tient (p130) ; sinon la barre dit « Compétition », le nom reste dans la page.
  const NOM_LONG = 'Tournoi - 14/11/2026 - U11 de Montrivage';
  test.each([
    ['nom court, 390', 'Tournoi de Noël', 390, 'Tournoi de Noël'],
    ['nom court, 1440', 'Tournoi de Noël', 1440, 'Tournoi de Noël'],
    ['nom long, 1440', NOM_LONG, 1440, NOM_LONG],
    ['nom long, 390', NOM_LONG, 390, 'Compétition'],
  ])('🔴 un parent, %s', async (_cas, nom, largeur, attendu) => {
    mockPeutGerer.value = false;
    const fenetre = jest.spyOn(
      jest.requireActual('react-native/Libraries/Utilities/useWindowDimensions'),
      'default',
    ).mockReturnValue({
      fontScale: 1, height: 844, scale: 1, width: largeur,
    });
    const donnees = tableau();
    const arbre = await monter({ ...donnees, event: { ...donnees.event, name: nom } });

    expect(lirePageDuSite().titre).toBe(attendu);
    expect(texte(arbre)).toContain(nom);
    fenetre.mockRestore();
  });

  test('🔴 sans nom de tournoi, le parent lit « Compétition », jamais le pilotage', async () => {
    mockPeutGerer.value = false;
    const donnees = tableau();
    const arbre = await monter({ ...donnees, event: { ...donnees.event, name: '' } });

    expect(lirePageDuSite().titre).toBe('Compétition');
    expect(texte(arbre)).not.toContain('Pilotage du tournoi');
    expect(texte(arbre)).not.toContain('Gérer le tournoi');
  });

  test('l organisateur garde la barre de pilotage du registre', async () => {
    await monter(tableau());

    expect(lirePageDuSite().titre).toBeNull();
  });
});

describe('T3-TOURNOI-PRIVE — le lien et les invités', () => {
  const doubles = (/** @type {any} */ arbre, /** @type {string} */ module) => arbre.root.findAllByType(jest.requireMock(module));
  afterEach(() => { mockErreurDuTableau.value = null; });

  test('🐞 un compte sans lien (403) voit la demande, jamais le contenu', async () => {
    mockErreurDuTableau.value = { message: 'Ce tournoi est réservé à ses participants', name: 'ForbiddenError', status: 403 };
    const arbre = await monter(null);
    expect(doubles(arbre, '../TournamentInvitationRequest')).toHaveLength(1);
  });

  test('une autre panne garde son message d erreur : pas de demande', async () => {
    mockErreurDuTableau.value = { message: 'panne', status: 500 };
    const arbre = await monter(null);
    expect(doubles(arbre, '../TournamentInvitationRequest')).toHaveLength(0);
  });
});

// T-PARCOURS-2 (17/11, point 11, recette 42 r42-app-05a) — « Voir le tournoi », vue d'ensemble : la
// ligne « Validation des équipes » suit la règle de la fiche (getTournamentPaidValidationLabel).
// Avant : lu aussi par l'organisateur (« Structure sportive », retirée de sa page le 19/11, ORGANISATEUR 2 : il lit
// « Une équipe se valide seule dès 5 joueurs payés. », TournamentManagement.ORGANISATEUR) ; le lecteur la lit encore.
describe('T-PARCOURS-2 point 11 — la validation des équipes d un tournoi payant', () => {
  beforeEach(() => { mockPeutGerer.value = false; });
  afterEach(() => { mockPeutGerer.value = true; });

  const config = (/** @type {any} */ sur = {}) => ({
    competitionState: 'draft', formatMode: 'groups_only', registrationMode: 'manual', ...sur,
  });

  test('🔴 payant en « manual » : « Équipe validée au 5ᵉ joueur payé »', async () => {
    const arbre = await monter(tableau({ config: config({ entryFeeCents: 2000 }) }));
    expect(texte(arbre)).toContain('Équipe validée au 5ᵉ joueur payé');
    expect(texte(arbre)).not.toContain('Manuelle');
  });

  test('caractérisant — gratuit : « Manuelle » ; « auto » : « Automatique »', async () => {
    expect(texte(await monter(tableau({ config: config() })))).toContain('Manuelle');
    const auto = await monter(tableau({
      config: config({ entryFeeCents: 2000, registrationMode: 'auto' }),
    }));
    expect(texte(auto)).toContain('Automatique');
    expect(texte(auto)).not.toContain('joueur payé');
  });
});

// T-REGLES-EQUIPE (18/11/2026, point 8 du chef, capture Android recette 45) — le compteur « Équipes »
// du cockpit comptait l'équipe refusée (6 pour « 1 validée · 4 en attente »). Même compte que le
// serveur (`maxTeams`, point 3) et la fiche (tournamentTeamsCount.js) : en attente + validées.
describe('T-REGLES-EQUIPE point 8 — le compteur « Équipes » du cockpit', () => {
  // IMPL-3-ORGA (planche 1a) : la carte « Équipes » est devenue le chiffre « équipes inscrites » du tableau
  // de bord ; même compte (en attente + validées).
  const inscrites = (/** @type {any} */ arbre) => arbre.root
    .findAll((/** @type {any} */ n) => n.props?.testID === 'orga-chiffre-inscrites' && typeof n.type !== 'string')[0]
    .findAll((/** @type {any} */ n) => typeof n.props?.children === 'string' && typeof n.type !== 'string')[0].props.children;

  test('🔴 1 validée, 4 en attente, 1 refusée, 1 archivée : « Équipes 5 »', async () => {
    const teams = [
      { documentId: 'eq-1', name: 'A', status: 'accepted' },
      ...[2, 3, 4, 5].map((n) => ({ documentId: `eq-${n}`, name: `P${n}`, status: 'pending' })),
      { documentId: 'eq-6', name: 'R', status: 'declined' },
      {
        archivedAt: '2026-11-17T10:00:00.000Z', documentId: 'eq-7', name: 'Z', status: 'archived',
      },
    ];
    const arbre = await monter(tableau({ teams }));
    expect(inscrites(arbre)).toBe('5');
  });

  test('caractérisant : deux équipes validées => « Équipes 2 »', async () => {
    expect(inscrites(await monter(tableau()))).toBe('2');
  });
});
