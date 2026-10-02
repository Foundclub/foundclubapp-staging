import { readFileSync } from 'fs';
import { join } from 'path';

import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamAttendancePanel, { TeamAttendanceSheetSummary } from '../performance/TeamAttendancePanel';

// ST-VUES (02/10) — « VIE D'ÉQUIPE », PLANCHE 14 DU DESIGN VALIDE.
//
// L encadrement : trois tuiles (Presence, Entrainements, Matchs), « À surveiller »
// sous 85 %, « Les autres », « Depuis le … ». Le JOUEUR : SA presence et la
// moyenne — decision d Adel du 02/10, « a non » ; c est le serveur qui ne lui
// envoie pas les lignes des autres (`viewerScope: 'self'`, temoin cote admin).
//
// 🧪 Meme compromis que la planche 13 : le panneau est rendu pour de vrai, son
// branchement dans `TeamDetails.js` (6 000 lignes) est verifie dans la source.

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

const texteDe = (/** @type {any} */ noeud) => {
  const morceaux = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    parcourir(enfant?.props?.children);
  };
  parcourir(noeud?.props?.children);
  return morceaux.join('');
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.type === Text, { deep: false }).map(texteDe);

const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id, { deep: false });

const ligne = (
  /** @type {string} */ id,
  /** @type {string} */ prenom,
  /** @type {any} */ chiffres,
) => ({
  absenceCount: chiffres.absent,
  attendanceCount: chiffres.present,
  lateCount: chiffres.retards || 0,
  lateMinutesTotal: chiffres.minutes || 0,
  matchAttendanceCount: chiffres.matchPresent || 0,
  matchCount: chiffres.matchTotal || 0,
  recentAbsences: chiffres.absences || [],
  trainingAttendanceCount: chiffres.entrPresent || 0,
  trainingCount: chiffres.entrTotal || 0,
  user: { documentId: id, firstname: prenom, lastname: 'Fictif' },
});

// Les Seniors A de la planche (etat 1) : Leo 58 %, Nino 70 %, Enzo 92 %.
const EQUIPE = {
  data: [
    ligne('enzo', 'Enzo', { absent: 2, present: 23, retards: 1 }),
    ligne('leo', 'Leo', {
      absences: [{ date: '2026-09-29T18:00:00.000Z', documentId: 'e-29', kind: 'training' }],
      absent: 10,
      entrPresent: 10,
      entrTotal: 18,
      matchPresent: 5,
      matchTotal: 6,
      minutes: 12,
      present: 14,
      retards: 3,
    }),
    ligne('nino', 'Nino', { absent: 6, present: 14 }),
  ],
  periodStartAt: '2026-09-01T18:00:00.000Z',
  teamAverage: { matchRate: 0.96, presenceRate: 0.87, trainingRate: 0.84 },
  totals: { absenceCount: 18, attendanceCount: 51 },
  viewerScope: 'team',
};

describe('ST-VUES planche 14 — l encadrement', () => {
  test('les tuiles d abord, puis « À surveiller » du plus bas au plus haut, puis les autres', () => {
    const lus = textes(monter(<TeamAttendancePanel stats={EQUIPE} />));
    const rang = (/** @type {string} */ texte) => lus.indexOf(texte);

    expect(lus.slice(0, 6)).toEqual([
      '87 %',
      'Présence',
      '84 %',
      'Entraînements',
      '96 %',
      'Matchs',
    ]);
    expect(rang('À surveiller · 2')).toBeGreaterThan(rang('Matchs'));
    expect(rang('Leo Fictif')).toBeLessThan(rang('Nino Fictif'));
    expect(rang('Les autres · 1')).toBeGreaterThan(rang('Nino Fictif'));
    expect(rang('Enzo Fictif')).toBeGreaterThan(rang('Les autres · 1'));
    expect(lus).toEqual(expect.arrayContaining(['58 %', '3 retards', 'Depuis le 1 septembre.']));
  });

  test('toucher un joueur ouvre sa feuille, avec sa ligne entiere', () => {
    const ouvert = jest.fn();
    const arbre = monter(<TeamAttendancePanel onPressPlayer={ouvert} stats={EQUIPE} />);

    act(() => {
      parTestID(arbre, 'team-attendance-player-leo')[0].props.onPress();
    });
    expect(ouvert).toHaveBeenCalledWith(
      expect.objectContaining({ lateCount: 3, name: 'Leo Fictif', trainingTotal: 18 }),
    );
  });
});

describe('ST-VUES planche 14 — « a non » : le joueur', () => {
  const MOI = {
    data: [ligne('hugo', 'Hugo', { absent: 1, present: 22, retards: 1 })],
    periodStartAt: '2026-09-01T18:00:00.000Z',
    teamAverage: { matchRate: 0.96, presenceRate: 0.87, trainingRate: 0.84 },
    totals: { absenceCount: 18, attendanceCount: 51 },
    viewerScope: 'self',
  };

  test('🔒 sa carte « Ma présence » et la moyenne de l equipe ; aucune liste', () => {
    const arbre = monter(<TeamAttendancePanel onPressPlayer={jest.fn()} stats={MOI} />);
    const lus = textes(arbre);

    expect(parTestID(arbre, 'team-attendance-self')).toHaveLength(1);
    expect(lus).toEqual(
      expect.arrayContaining([
        'Ma présence',
        '96 %',
        '22 sur 23 événements · 1 retard',
        'L’équipe : 87 % en moyenne.',
        'Le détail joueur par joueur est réservé à l’encadrement.',
      ]),
    );
    expect(lus.some((texte) => texte.startsWith('À surveiller'))).toBe(false);
    expect(arbre.root.findAllByType(TouchableOpacity)).toHaveLength(0);
  });
});

describe('ST-VUES planche 14 — les etats', () => {
  test('aucun appel : une phrase, pas de 0 %', () => {
    const arbre = monter(
      <TeamAttendancePanel stats={{ data: [], totals: {}, viewerScope: 'team' }} />,
    );

    expect(parTestID(arbre, 'team-attendance-empty')).toHaveLength(1);
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Pas encore de présence']));
    expect(textes(arbre).some((texte) => texte.includes('0 %'))).toBe(false);
  });

  test('juste apres une remise a zero : « Depuis le … » en tete, et des tirets', () => {
    const arbre = monter(
      <TeamAttendancePanel
        stats={{
          baselineAt: '2026-10-02T08:00:00.000Z',
          data: [],
          totals: {},
          viewerScope: 'team',
        }}
      />,
    );
    const lus = textes(arbre);

    expect(parTestID(arbre, 'team-attendance-after-reset')).toHaveLength(1);
    expect(lus[0]).toBe('Depuis le 2 oct.');
    expect(lus.filter((texte) => texte === '—')).toHaveLength(3);
  });

  test('un sport sans stats de match le dit, au-dessus de la presence', () => {
    const lus = textes(monter(<TeamAttendancePanel sportWithoutMatchStats stats={EQUIPE} />));

    expect(lus[0].startsWith('Pour ce sport, l’app suit la présence')).toBe(true);
  });

  test('chargement : des formes ; refus du serveur : la phrase du refus (VA1)', () => {
    expect(
      parTestID(monter(<TeamAttendancePanel isLoading />), 'team-attendance-loading'),
    ).toHaveLength(1);
    expect(textes(monter(<TeamAttendancePanel refusedMessage="Réservé" stats={EQUIPE} />))).toEqual(
      ['Réservé'],
    );
  });
});

describe('ST-VUES planche 14 — la feuille d un joueur (etat 2)', () => {
  test('entrainements et matchs separes, retards et minutes, dernieres absences', () => {
    const entree = {
      lateCount: 3,
      lateMinutesTotal: 12,
      matchAttended: 5,
      matchTotal: 6,
      name: 'Leo Fictif',
      ratio: 0.58,
      recentAbsences: [{ date: '2026-09-29T18:00:00.000Z', documentId: 'e-29', kind: 'training' }],
      trainingAttended: 10,
      trainingTotal: 18,
      user: { firstname: 'Leo', lastname: 'Fictif' },
    };
    const lus = textes(
      monter(
        <TeamAttendanceSheetSummary entry={entree} periodStartAt="2026-09-01T18:00:00.000Z" />,
      ),
    );

    expect(lus).toEqual(
      expect.arrayContaining([
        'Leo Fictif',
        'Depuis le 1 septembre',
        '58 %',
        '10/18',
        'Entraînements',
        '5/6',
        'Matchs',
        '3',
        'Retards · 12 min',
        'Dernières absences',
        'Entraînement',
      ]),
    );
  });
});

describe('ST-VUES planche 14 — TeamDetails branche la planche', () => {
  const SOURCE = readFileSync(join(__dirname, '..', 'TeamDetails.js'), 'utf8');

  test('le panneau et le haut de la feuille remplacent l ancien bloc', () => {
    expect(SOURCE).toContain('<TeamAttendancePanel');
    expect(SOURCE).toContain('<TeamAttendanceSheetSummary');
    expect(SOURCE).not.toContain("t('teamDetails.attendance.lateAverage', 'Retard moyen')");
  });

  test('« Remettre à zéro » quitte le bas de l onglet pour le menu ⋯, confirme en deux boutons', () => {
    expect(SOURCE).not.toContain(
      "title={t('teamDetails.stats.resetAction', 'Réinitialiser les statistiques')}",
    );
    expect(SOURCE).toContain(
      "label: t('teamStatsPanel.resetAction', 'Remettre la présence à zéro')",
    );
    expect(SOURCE).toContain("text: t('teamStatsPanel.resetConfirm', 'Remettre à zéro')");
  });
});
