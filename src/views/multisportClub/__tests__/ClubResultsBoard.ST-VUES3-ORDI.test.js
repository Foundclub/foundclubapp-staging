import { readFileSync } from 'fs';
import { join } from 'path';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubResultsBoard from '../components/ClubResultsBoard';
import ClubTeamsCard from '../components/ClubTeamsCard';
import MultisportStatsRow from '../components/MultisportStatsRow';
import WeekendResultsCard from '../components/WeekendResultsCard';

// ST-VUES3-ORDI (03/10) — ÉCRAN 18 SUR ORDINATEUR, LA PLANCHE À 2 COLONNES
// (« FoundClub — Statistiques », page 5, P5-club-ordi : « Le club du dirigeant — ordinateur »).
//
// Notes de la planche : « Les résultats de toutes les équipes en tableau, à gauche ; les
// équipes et le lien vers leurs stats, à droite. Le dirigeant suit son club sans ouvrir
// chaque équipe. » Avant ce lot, le site ne montrait que la carte du téléphone, seule.
//
//   - à gauche : « Résultats du week-end » en TABLEAU (Équipe, Match, Score), « Voir » sur
//     un score saisi, « Saisir » chez l'entraîneur, « Relancer Karim » chez le dirigeant
//     qui n'entraîne pas (« score A ») ;
//   - à droite : les trois chiffres qui se touchent, puis « Les équipes » : chacune avec son
//     bilan (« 1 victoire · 0 nul · 0 défaite ») ou, pour un sport sans score de match, sa
//     présence (« Présence : pas encore d’appel »), et « Stats » qui ouvre son onglet Stats.

jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(colors),
      Colors: colors,
      Fonts: jest.requireActual('@/theme/fonts').default(colors),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

// L'écusson partagé (D62) mesure ses images : sa doublure ne rend rien.
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => function ClubLogoMarkMock() {
  return null;
});

const mockGetTeamPerformanceStats = jest.fn();
const mockGetTeamStats = jest.fn();
jest.mock('@/services/matchStats/matchStatsService', () => ({
  getTeamPerformanceStats: (/** @type {string} */ teamId) => mockGetTeamPerformanceStats(teamId),
}));
jest.mock('@/services/stats/statsService', () => ({
  getTeamStats: (/** @type {string} */ teamId) => mockGetTeamStats(teamId),
}));

/** @type {any[]} */
const montes = [];
/** @type {QueryClient[]} */
const clients = [];
const monter = (/** @type {any} */ element) => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  clients.push(client);
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>{element}</QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};
afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  clients.splice(0).forEach((client) => client.clear());
  jest.clearAllMocks();
});

const textes = (/** @type {any} */ noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
const bouton = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ n) => n.props.accessibilityLabel === libelle);
const styleDe = (/** @type {any} */ noeud) => Object.assign(
  {},
  ...[].concat(noeud.props.style).flat(Infinity).filter(Boolean),
);

// Attente bornée en TEMPS, jamais en tours (React Query publie par minuteur).
const attendre = async (/** @type {() => boolean} */ condition) => {
  const limite = Date.now() + 5000;
  const verifier = () => {
    try {
      return condition();
    } catch {
      return false;
    }
  };
  while (!verifier() && Date.now() < limite) {
    // eslint-disable-next-line no-await-in-loop
    await act(() => new Promise((fin) => { setTimeout(fin, 5); }));
  }
};

// L'heure d'un match comme l'écran l'écrit (heure de l'appareil).
const heure = (/** @type {string} */ iso) => new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(iso));

const SAMEDI = { saturday: '2026-09-05', sunday: '2026-09-06' };
const ligne = (/** @type {any} */ extra) => ({
  canRemind: false,
  date: '2026-09-05T17:00:00.000Z',
  eventId: 'e1',
  opponentName: 'Test-COMPO',
  result: null,
  scoreAgainst: null,
  scoreFor: null,
  sport: 'Football',
  status: 'scored',
  teamId: 'u15',
  teamName: 'U15',
  trainers: [{ documentId: 'karim', firstname: 'Karim' }],
  viewerIsTrainer: true,
  ...extra,
});
const RESULTATS = {
  nextMatch: null,
  rows: [
    ligne({ result: 'win', scoreAgainst: 1, scoreFor: 2 }),
    ligne({
      date: '2026-09-05T19:00:00.000Z', eventId: 'e2', opponentName: null, status: 'missing',
    }),
    ligne({
      canRemind: true,
      date: '2026-09-05T19:00:00.000Z',
      eventId: 'e3',
      opponentName: null,
      status: 'missing',
      teamId: 'u15b',
      teamName: 'U15 B',
      trainers: [{ documentId: 'leo', firstname: 'Léo' }],
      viewerIsTrainer: false,
    }),
  ],
  teamCount: 3,
  teamsWithoutMatchScores: [{ sport: 'Arts martiaux', teamId: 'u13', teamName: 'U13' }],
  weekend: SAMEDI,
};

describe('ST-VUES3-ORDI écran 18 — « Résultats du week-end » en tableau (ordinateur)', () => {
  test('les colonnes de la planche, « Voir », « Saisir » et « Relancer Léo »', () => {
    const ouvrir = jest.fn();
    const saisir = jest.fn();
    const relancer = jest.fn();
    const arbre = monter(
      <WeekendResultsCard
        data={RESULTATS}
        onEnterScore={saisir}
        onOpenMatch={ouvrir}
        onRemind={relancer}
        variant="table"
      />,
    );

    expect(textes(arbre.root)).toEqual([
      'Résultats du week-end',
      'Sam. 5 sept.',
      'Équipe',
      'Match',
      'Score',
      'V',
      'U15',
      `contre Test-COMPO · ${heure('2026-09-05T17:00:00.000Z')}`,
      '2 - 1',
      'Voir',
      '?',
      'U15',
      `adversaire à confirmer · ${heure('2026-09-05T19:00:00.000Z')}`,
      'à saisir',
      'Saisir',
      '?',
      'U15 B',
      `adversaire à confirmer · ${heure('2026-09-05T19:00:00.000Z')}`,
      'à saisir',
      'Relancer Léo',
      'Les U13 (arts martiaux) n’ont pas de score de match.',
    ]);

    act(() => bouton(arbre, 'U15 contre Test-COMPO : victoire 2 - 1. Ouvrir le match.')
      .props.onPress());
    expect(ouvrir).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e1' }));
    act(() => bouton(arbre, 'Saisir le score de U15').props.onPress());
    expect(saisir).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e2' }));
    act(() => bouton(arbre, 'Relancer Léo pour le score').props.onPress());
    expect(relancer).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'e3', teamId: 'u15b' }),
    );
  });

  test('le téléphone ne change pas : sans `variant`, la carte reste empilée', () => {
    const arbre = monter(
      <WeekendResultsCard
        data={RESULTATS}
        onEnterScore={jest.fn()}
        onOpenMatch={jest.fn()}
        onRemind={jest.fn()}
      />,
    );

    expect(textes(arbre.root)).toEqual(expect.arrayContaining([
      'U15 — Test-COMPO',
      'Score à saisir · Léo',
      'Relancer',
    ]));
    expect(textes(arbre.root)).not.toContain('Voir');
    expect(textes(arbre.root)).not.toContain('Équipe');
  });
});

describe('ST-VUES3-ORDI écran 18 — « Les équipes », la colonne de droite', () => {
  const EQUIPES = [
    { documentId: 'u15', name: 'U15', sport: 'Football' },
    { documentId: 'u13', name: 'U13', sport: 'Arts martiaux' },
    { documentId: 'seniors', name: 'Seniors', sport: 'Basketball' },
    { documentId: 'yoga', name: 'Yoga', sport: 'Yoga' },
  ];

  test('bilan des sports à score, présence des autres, « Stats » ouvre l équipe', async () => {
    const bilan = (/** @type {number} */ victoires) => ({
      totals: {
        draws: 0,
        losses: 0,
        matches: victoires,
        wins: victoires,
      },
    });
    mockGetTeamPerformanceStats.mockImplementation((teamId) => Promise.resolve(
      bilan(teamId === 'u15' ? 1 : 0),
    ));
    mockGetTeamStats.mockImplementation((teamId) => Promise.resolve(
      teamId === 'u13'
        ? { data: [{ absenceCount: 0, attendanceCount: 0, user: { firstname: 'Hugo' } }] }
        : {
          data: [
            { absenceCount: 1, attendanceCount: 3, user: { firstname: 'Léa' } },
            { absenceCount: 0, attendanceCount: 4, user: { firstname: 'Max' } },
          ],
          teamAverage: { presenceRate: 0.875 },
        },
    ));
    const ouvrirStats = jest.fn();
    const arbre = monter(<ClubTeamsCard onOpenTeamStats={ouvrirStats} teams={EQUIPES} />);

    await attendre(() => textes(arbre.root).includes('Présence : 88 %')
      && textes(arbre.root).includes('1 victoire · 0 nul · 0 défaite'));

    expect(textes(arbre.root)).toEqual([
      'Les équipes',
      'U15 · football',
      '1 victoire · 0 nul · 0 défaite',
      'Stats',
      'U13 · arts martiaux',
      'Présence : pas encore d’appel',
      'Stats',
      'Seniors · basketball',
      'Pas encore de résultat',
      'Stats',
      'Yoga · yoga',
      'Présence : 88 %',
      'Stats',
    ]);
    // Un sport sans score de match ne demande JAMAIS le bilan (le serveur répond 400).
    const demandes = (/** @type {jest.Mock} */ appel) => appel.mock.calls
      .map(([id]) => id)
      .sort();
    expect(demandes(mockGetTeamPerformanceStats)).toEqual(['seniors', 'u15']);
    expect(demandes(mockGetTeamStats)).toEqual(['u13', 'yoga']);

    act(() => bouton(arbre, 'U15 : ouvrir ses stats').props.onPress());
    expect(ouvrirStats).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'u15' }));
  });

  test('une lecture refusée ne casse pas la carte : l équipe reste, sans bilan', async () => {
    mockGetTeamPerformanceStats.mockImplementation(() => Promise.reject(new Error('403')));
    const arbre = monter(
      <ClubTeamsCard onOpenTeamStats={jest.fn()} teams={[EQUIPES[0]]} />,
    );

    await attendre(() => mockGetTeamPerformanceStats.mock.calls.length > 0);
    await act(() => new Promise((fin) => { setTimeout(fin, 50); }));

    expect(textes(arbre.root)).toEqual(['Les équipes', 'U15 · football', 'Stats']);
  });
});

describe('ST-VUES3-ORDI écran 18 — la planche à 2 colonnes', () => {
  test('à gauche le tableau du week-end, à droite les trois chiffres puis « Les équipes »', () => {
    mockGetTeamPerformanceStats.mockImplementation(() => new Promise(() => {}));
    const chiffres = [
      { key: 'sections', label: 'Sections', value: 2 },
      { key: 'teams', label: 'Équipes', value: 2 },
      { key: 'members', label: 'Membres', value: 9 },
    ];
    const equipes = [{ documentId: 'u15', name: 'U15', sport: 'Football' }];
    const ouvrirStats = jest.fn();
    const arbre = monter(
      <ClubResultsBoard
        onOpenTeamStats={ouvrirStats}
        statsItems={chiffres}
        teams={equipes}
        weekendCard={{
          data: RESULTATS,
          onEnterScore: jest.fn(),
          onOpenMatch: jest.fn(),
          onRemind: jest.fn(),
        }}
      />,
    );

    const [carte] = arbre.root.findAllByType(WeekendResultsCard);
    const [rang] = arbre.root.findAllByType(MultisportStatsRow);
    const [lesEquipes] = arbre.root.findAllByType(ClubTeamsCard);
    expect(carte.props.variant).toBe('table');
    expect(carte.props.data).toBe(RESULTATS);
    expect(rang.props.items).toBe(chiffres);
    expect(lesEquipes.props.teams).toBe(equipes);
    expect(lesEquipes.props.onOpenTeamStats).toBe(ouvrirStats);

    // Deux colonnes côte à côte : 3 parts à gauche, 2 à droite (planche, `colonnes c32`).
    const [planche] = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'club-results-board' && typeof n.type === 'string'
    ));
    expect(styleDe(planche).flexDirection).toBe('row');
    const [gauche, droite] = planche.children;
    expect([styleDe(gauche).flex, styleDe(droite).flex]).toEqual([3, 2]);
    expect(gauche.findAllByType(WeekendResultsCard)).toHaveLength(1);
    expect(droite.findAllByType(MultisportStatsRow)).toHaveLength(1);
    expect(droite.findAllByType(ClubTeamsCard)).toHaveLength(1);
  });
});

describe('ST-VUES3-ORDI écran 18 — branchement sur « Gestion du club » (club omnisport)', () => {
  const PAGE = readFileSync(join(__dirname, '..', 'CMDashboard.js'), 'utf8');

  test('sur ordinateur, la planche à 2 colonnes ; sur téléphone, la carte empilée', () => {
    expect(PAGE).toContain("import { useIsDesktop } from '@/responsive';");
    expect(PAGE).toMatch(/isDesktop && isCmAdmin \? \(\s*<ClubResultsBoard/);
    // La liste des équipes du club : la même lecture (et le même cache) que « Équipes ».
    expect(PAGE).toContain("queryKey: ['cm-teams', resolvedCmId]");
    expect(PAGE).toContain('enabled: Boolean(resolvedCmId) && isCmAdmin && isDesktop');
    expect(PAGE).toContain("initialTab: 'stats'");
  });
});
