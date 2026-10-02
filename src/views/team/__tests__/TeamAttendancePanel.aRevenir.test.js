import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamAttendancePanel from '../performance/TeamAttendancePanel';

// ST-VUES2 bis (02/10) — « A REVENIR » DANS « VIE D'ÉQUIPE ».
//
// Décision d'Adel du 02/10 vers 13 h 05 (registre docs/DECISIONS_MINEURS.md, décisions 11
// et 12), qui REMPLACE « a non » : un joueur voit de nouveau la présence, les absences et les
// retards de chaque coéquipier de SON équipe. Le serveur lui rend toutes les lignes (admin
// ST-VUES2-a-revenir) ; la porte garde l'équipe et le club. La vue « joueur seul » (« Ma
// présence » et la moyenne, « réservé à l'encadrement ») n'a plus lieu d'être : elle sort.

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

const ligne = (
  /** @type {string} */ id,
  /** @type {string} */ prenom,
  /** @type {number} */ present,
  /** @type {number} */ absent,
) => ({
  absenceCount: absent,
  attendanceCount: present,
  lateCount: 0,
  recentAbsences: [],
  user: { documentId: id, firstname: prenom, lastname: 'Fictif' },
});

// Ce que le serveur « a revenir » rend à Hugo, joueur de l'U15 : toutes les lignes.
const VU_PAR_HUGO = {
  data: [ligne('hugo', 'Hugo', 22, 1), ligne('leo', 'Leo', 14, 10)],
  periodStartAt: '2026-09-01T18:00:00.000Z',
  teamAverage: { matchRate: 0.9, presenceRate: 0.77, trainingRate: 0.7 },
  totals: { absenceCount: 11, attendanceCount: 36 },
};

describe('ST-VUES2 bis — « a revenir » : le joueur voit son équipe', () => {
  test('le joueur lit la présence de son coéquipier ; rien n est réservé à l encadrement', () => {
    const lus = textes(monter(<TeamAttendancePanel stats={VU_PAR_HUGO} />));

    expect(lus).toEqual(expect.arrayContaining(['Leo Fictif', 'Hugo Fictif', '58 %', '96 %']));
    expect(lus.join(' ')).not.toContain('réservé à l’encadrement');
  });

  test('la vue « joueur seul » n existe plus, même si un serveur d avant dit « self »', () => {
    const ancienServeur = { ...VU_PAR_HUGO, viewerScope: 'self' };
    const lus = textes(monter(<TeamAttendancePanel stats={ancienServeur} />));

    expect(lus).not.toContain('Ma présence');
    expect(lus).toContain('Leo Fictif');
  });
});
