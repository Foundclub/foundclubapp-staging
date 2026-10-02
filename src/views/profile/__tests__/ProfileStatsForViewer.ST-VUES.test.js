import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ProfileStatsForViewer, { resolveProfileStatsMode } from '../stats/ProfileStatsForViewer';

// ST-VUES (02/10) — LE PROFIL D UN JOUEUR, VU PAR UN AUTRE (PLANCHE 17 DU DESIGN VALIDE).
//
// « profil A » : les stats d un joueur sont PRIVEES, sauf pour l entraineur de son
// equipe. « b oui » : l entraineur les voit, pour SON equipe (le serveur le dit par
// `scope`, temoins cote admin). Pour les autres, la carte « Ces statistiques ne sont
// visibles que par la personne elle-meme » DISPARAIT. Mon apercu ne montre plus mes
// chiffres (defaut 8) et dit qui les voit.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

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
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));

// Hugo, 14 ans, U15 : 1 match, 1 but, 90 minutes — vu par Karim, son entraineur.
const VU_PAR_SON_ENTRAINEUR = {
  overall: { football: { goals: 1 }, matches: 1, minutesPlayed: 90 },
  scope: { teams: [{ documentId: 'u15', name: 'U15' }], viewer: 'coach' },
};

describe('ST-VUES planche 17 — qui voit quoi', () => {
  test('« b oui » : son entraineur voit ses chiffres, pour SON equipe, et le profil le dit', () => {
    const arbre = monter(<ProfileStatsForViewer stats={VU_PAR_SON_ENTRAINEUR} />);

    expect(textes(arbre)).toEqual([
      'Dans ton équipe · U15', 'Entraîneur', '1', 'Match', '1', 'But', '90', 'Minutes',
      'Visible par toi, son entraîneur, pour l’équipe U15 seulement.',
    ]);
  });

  test('🔒 « profil A » : un autre membre (403 du serveur) ne voit RIEN, pas meme une carte « privé »', () => {
    const arbre = monter(<ProfileStatsForViewer stats={undefined} />);

    expect(arbre.toJSON()).toBeNull();
  });

  test('🔒 le parent d un mineur (le serveur ne lui rend que les retours) ne voit pas de chiffres ici', () => {
    expect(resolveProfileStatsMode({ stats: { recentCoachFeedback: [] } })).toBe('hidden');
  });

  test('mon apercu : PAS mes chiffres, une ligne dit qui les voit', () => {
    const arbre = monter(<ProfileStatsForViewer isSelfPreview stats={{ overall: { matches: 3 } }} />);

    expect(textes(arbre)).toEqual(['Tes stats de match ne sont visibles que par toi et ton entraîneur.']);
  });

  test('chargement : un squelette seulement pour celui qui pourrait etre son entraineur', () => {
    expect(monter(<ProfileStatsForViewer isLoading mayBeCoach />).root
      .findAll((/** @type {any} */ n) => n.props?.testID === 'profile-stats-loading', { deep: false })).toHaveLength(1);
    expect(monter(<ProfileStatsForViewer isLoading />).toJSON()).toBeNull();
  });
});

describe('ST-VUES planche 17 — la fiche branche la planche', () => {
  const FICHE = readFileSync(join(__dirname, '..', 'UserDetails.js'), 'utf8');

  test('le bloc remplace l ancienne carte, ses onglets Sport / Equipe et sa phrase « privé »', () => {
    expect(FICHE).toContain('<ProfileStatsForViewer');
    expect(FICHE).not.toContain("'userDetails.stats.privateToOwner'");
    expect(FICHE).not.toContain('selectedStatsSport');
  });
});
