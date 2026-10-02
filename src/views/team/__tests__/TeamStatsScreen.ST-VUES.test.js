import { readFileSync } from 'fs';
import { join } from 'path';

import renderer, { act } from 'react-test-renderer';

import TeamStatsScreen from '../TeamStatsScreen';

// ST-VUES (02/10) — L ECRAN « STATISTIQUES » (TeamStats), ABANDONNE PAR LE DESIGN
// VALIDE (planche 15). Son adresse `/teams/:teamId/stats` ouvre la fiche de l equipe,
// onglet Stats, sur « Vie d'équipe » — sans ecran mort.

/** @type {any[]} */
const montes = [];
const monter = (/** @type {any} */ params) => {
  const navigation = { replace: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TeamStatsScreen navigation={navigation} route={{ params }} />);
  });
  montes.push(arbre);
  return { arbre, navigation };
};
afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('ST-VUES planche 15 — l adresse de TeamStats mene a l onglet Stats', () => {
  test('/teams/:teamId/stats ouvre la fiche de l equipe, onglet Stats, et ne dessine RIEN', () => {
    const { arbre, navigation } = monter({ teamId: 'u15' });

    expect(navigation.replace).toHaveBeenCalledWith('TeamDetails', { initialTab: 'stats', teamId: 'u15' });
    expect(arbre.toJSON()).toBeNull();
  });

  test('sans equipe dans l adresse : la liste de mes equipes, pas un ecran vide', () => {
    const { navigation } = monter({});

    expect(navigation.replace).toHaveBeenCalledWith('MyTeamList');
  });

  test('la fiche ouvre l onglet Stats, sur « Vie d’équipe », quand on le lui demande', () => {
    const fiche = readFileSync(join(__dirname, '..', 'TeamDetails.js'), 'utf8');

    expect(fiche).toContain("if (initialTab !== 'stats' || !showStatsTab) return;");
    expect(fiche).toContain("setStatsMode('attendance');");
  });
});
