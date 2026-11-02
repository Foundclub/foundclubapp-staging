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

/** @type {any} */
let mockDashboard = null;
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
    data: mockDashboard, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/tournamentCompetition/tournamentCompetitionService', () => ({
  drawTournamentGroups: jest.fn(() => Promise.resolve({})),
  generateTournamentKnockout: jest.fn(() => Promise.resolve({})),
  generateTournamentMatches: (/** @type {any[]} */ ...args) => mockGenerate(...args),
  publishTournamentCompetition: jest.fn(() => Promise.resolve({})),
  setupTournamentCompetition: jest.fn(() => Promise.resolve({})),
}));
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

    expect(texte(arbre)).toContain('Compétition en brouillon');
    expect(boutons(arbre)).toEqual(expect.arrayContaining([
      'Tirer les poules', 'Générer les matchs', 'Modifier les paramètres', 'Clôturer le tournoi',
    ]));
  });
});

describe('CORR-EVENEMENTS 129 C — « Générer les matchs » dit ce qu il a créé', () => {
  test('🐞 après la génération, le nombre de matchs créés est annoncé', async () => {
    mockGenerate.mockResolvedValue({ overview: { groups: 1, totalMatches: 6 } });
    const arbre = await monter(tableau());
    const generer = arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Générer les matchs')[0];

    await act(async () => { await generer.props.onPress(); });

    const appels = Alert.alert.mock.calls.map((/** @type {any[]} */ appel) => `${appel[0]} ${appel[1] || ''}`);
    expect(appels.join(' | ')).toContain('6 matchs créés');
  });

  test('🐞 aucun match créé : la cause est dite', async () => {
    mockGenerate.mockResolvedValue({ overview: { groups: 2, totalMatches: 0 } });
    const arbre = await monter(tableau());
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
        { archivedAt: '2026-10-30T18:12:00.000Z', documentId: 'eq-1', name: 'Alpha', status: 'archived' },
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
    expect(texte(arbre)).not.toContain('Tire les poules');
  });

  test('l organisateur garde son titre de pilotage', async () => {
    const arbre = await monter(tableau());

    expect(texte(arbre)).toContain('Pilotage du tournoi');
  });
});

// CORR-EVENEMENTS point 133 (recette du site, 30/10) — textes du tournoi sans accents, « (s) » et
// mots anglais. Les textes écrits en dur dans le cockpit passent par le catalogue.
describe('CORR-EVENEMENTS 133 — le cockpit parle français', () => {
  test('🐞 plus de « poule(s) », « match(s) », « Equipes », « Aleatoire » ni « roster »', async () => {
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

  test('🔴 un parent y lit le nom du tournoi', async () => {
    mockPeutGerer.value = false;
    const donnees = tableau();
    await monter({ ...donnees, event: { ...donnees.event, name: 'Tournoi de Noël' } });

    expect(lirePageDuSite().titre).toBe('Tournoi de Noël');
  });

  test('🔴 sans nom de tournoi, le parent lit « Compétition », jamais le pilotage', async () => {
    mockPeutGerer.value = false;
    const donnees = tableau();
    const arbre = await monter({ ...donnees, event: { ...donnees.event, name: '' } });

    expect(lirePageDuSite().titre).toBe('Compétition');
    expect(texte(arbre)).not.toContain('Pilotage du tournoi');
  });

  test('l organisateur garde la barre de pilotage du registre', async () => {
    await monter(tableau());

    expect(lirePageDuSite().titre).toBeNull();
  });
});
