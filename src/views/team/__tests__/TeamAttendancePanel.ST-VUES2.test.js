import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamAttendancePanel from '../performance/TeamAttendancePanel';

// ST-VUES2 (02/10) — 🔒 LA MOYENNE DE PRESENCE NE REVELE PLUS UN COEQUIPIER.
//
// Dans une equipe de 2 joueurs pointes, la moyenne moins ma presence EST celle de
// l autre. Le serveur ne la rend plus au joueur sous 3 joueurs pointes, ni les totaux
// (temoin admin ST-VUES2-moyenne-de-presence) : `teamAverageHidden`, `totals: null`.
// L ecran le dit, au lieu d un « — » muet ; et il ne prend plus l absence des totaux
// pour « Pas encore de présence ».

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
  /** @type {string[]} */
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
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.type === Text, { deep: false })
  .map(texteDe);

// Hugo, dans une equipe ou un seul coequipier est pointe : 3 presences sur 3.
const MOI_A_DEUX = {
  data: [{
    absenceCount: 0,
    attendanceCount: 3,
    lateCount: 0,
    matchAttendanceCount: 1,
    matchCount: 1,
    recentAbsences: [],
    trainingAttendanceCount: 2,
    trainingCount: 2,
    user: { documentId: 'hugo', firstname: 'Hugo', lastname: 'Fictif' },
  }],
  periodStartAt: '2026-09-01T18:00:00.000Z',
  teamAverage: { matchRate: null, presenceRate: null, trainingRate: null },
  teamAverageHidden: true,
  teamAverageMinPlayers: 3,
  totals: null,
  viewerScope: 'self',
};

describe('ST-VUES2 — la moyenne de presence protegee sous 3 joueurs pointes', () => {
  test('🔒 le joueur lit SA presence, et la phrase qui dit pourquoi la moyenne manque', () => {
    const lus = textes(monter(<TeamAttendancePanel stats={MOI_A_DEUX} />));

    expect(lus).toEqual(expect.arrayContaining([
      'Ma présence',
      '100 %',
      'L’équipe : moyenne dès 3 joueurs pointés.',
    ]));
    expect(lus.some((texte) => texte.includes('en moyenne'))).toBe(false);
  });

  test('sans totaux, la carte du joueur ne se prend pas pour « Pas encore de présence »', () => {
    const lus = textes(monter(<TeamAttendancePanel stats={MOI_A_DEUX} />));

    expect(lus).not.toContain('Pas encore de présence');
  });
});
