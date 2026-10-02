import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamAttendancePanel from '../performance/TeamAttendancePanel';
import TeamPerformancePanel from '../performance/TeamPerformancePanel';

// ST-VUES (02/10) — « LES STATS DE L EQUIPE — ORDINATEUR » (planches 13 et 14, version
// site) : Performance et Vie d equipe COTE A COTE, et des TABLEAUX au lieu des cartes
// empilees — une colonne par chiffre.

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
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

/** @type {any[]} */
const montes = [];
const monter = (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(element);
  });
  montes.push(arbre);
  return arbre;
};
afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));

describe('ST-VUES ordinateur — Performance, en colonne', () => {
  const SAISON = {
    form: ['win', 'win', 'draw', 'loss', 'win'],
    players: [
      {
        assists: 2,
        documentId: 'leo',
        firstname: 'Léo',
        goals: 11,
        lastname: 'Diallo',
        minutesPlayed: 712,
      },
      {
        assists: 5,
        documentId: 'hugo',
        firstname: 'Hugo',
        goals: 7,
        lastname: 'Roux',
        minutesPlayed: 780,
      },
    ],
    sport: 'football',
    totals: {
      averageCollectiveRating: 7.6,
      draws: 1,
      losses: 2,
      matches: 9,
      playerCollectiveRatingAverage: 7.2,
      playerCollectiveRatingCount: 48,
      scoreAgainstTotal: 21,
      scoreForTotal: 34,
      wins: 6,
    },
  };

  test('le titre et la forme, quatre tuiles dont la difference, et un tableau Joueur / Buts / Passes / Min', () => {
    const lus = textes(monter(<TeamPerformancePanel stats={SAISON} variant="wide" />));

    expect(lus.slice(0, 2)).toEqual(['Performance · 9 matchs', 'V V N D V']);
    expect(lus).toEqual(
      expect.arrayContaining([
        '6',
        'Victoires',
        '+13',
        '34 - 21',
        '7,6/10',
        'Note des joueurs · 48',
      ]),
    );
    const entete = lus.indexOf('Joueur');
    expect(lus.slice(entete, entete + 4)).toEqual(['Joueur', 'Buts', 'Passes', 'Min']);
    expect(lus.slice(entete + 4, entete + 8)).toEqual(['Léo Diallo', '11', '2', '712']);
  });
});

describe('ST-VUES ordinateur — Vie d equipe, en colonne', () => {
  const EQUIPE = {
    data: [
      {
        absenceCount: 2,
        attendanceCount: 23,
        lateCount: 1,
        user: { documentId: 'enzo', firstname: 'Enzo', lastname: 'Petit' },
      },
      {
        absenceCount: 10,
        attendanceCount: 14,
        lateCount: 3,
        matchAttendanceCount: 5,
        matchCount: 6,
        trainingAttendanceCount: 10,
        trainingCount: 18,
        user: { documentId: 'leo', firstname: 'Léo', lastname: 'Diallo' },
      },
    ],
    periodStartAt: '2026-09-01T18:00:00.000Z',
    teamAverage: { matchRate: 0.96, presenceRate: 0.87, trainingRate: 0.84 },
    totals: { absenceCount: 12, attendanceCount: 37 },
    viewerScope: 'team',
  };

  test('les tuiles, un tableau trie du plus bas au plus haut, et ce qu il compte', () => {
    const lus = textes(monter(<TeamAttendancePanel stats={EQUIPE} variant="wide" />));
    const entete = lus.indexOf('Joueur');

    expect(lus[0]).toBe('Vie d’équipe');
    expect(lus.slice(entete, entete + 5)).toEqual([
      'Joueur',
      'Présence',
      'Entr.',
      'Matchs',
      'Retards',
    ]);
    expect(lus.slice(entete + 5, entete + 10)).toEqual(['Léo Diallo', '58 %', '10/18', '5/6', '3']);
    expect(lus[lus.length - 1]).toBe('Triée du plus bas au plus haut · depuis le 1 septembre.');
  });
});

describe('ST-VUES ordinateur — la fiche les met cote a cote', () => {
  test('sur grand ecran : deux colonnes, chaque panneau en variante « wide »', () => {
    const fiche = readFileSync(join(__dirname, '..', 'TeamDetails.js'), 'utf8');

    expect(fiche).toContain('testID="team-stats-columns"');
    expect(fiche.split('variant="wide"').length - 1).toBe(2);
    expect(fiche).toContain('const isDesktopStats = useIsDesktop();');
  });
});
