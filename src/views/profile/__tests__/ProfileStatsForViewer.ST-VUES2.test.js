import { readFileSync } from 'fs';
import { join } from 'path';

import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ProfileStatsForViewer from '../stats/ProfileStatsForViewer';

// ST-VUES2 (02/10) — ÉCRAN 17, « VU PAR SON ENTRAÎNEUR » : LE LIEN « SES RETOURS DE MATCH
// DANS LA FEUILLE ».
//
// Sous la carte « Dans ton équipe · U15 » (décision « b oui »), la planche pose un lien vers
// la feuille de match, où l'entraîneur lit les retours du joueur. Il mène à la feuille du
// dernier match du joueur dans SON équipe (le serveur ne rend à l'entraîneur que les matchs
// de ses équipes : `scope.teams`, admin ST-VUES). Personne d'autre n'a le lien.

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
const lien = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ n) => n.props.accessibilityRole === 'link');

// Hugo, vu par Karim : deux matchs de l'U15, le plus récent d'abord (ordre du serveur).
const VU_PAR_SON_ENTRAINEUR = {
  overall: { football: { goals: 1 }, matches: 2, minutesPlayed: 180 },
  recentMatches: [
    {
      documentId: 'match-12-09', sourceType: 'event', sport: 'football', teamName: 'U15',
    },
    {
      documentId: 'match-05-09', sourceType: 'event', sport: 'football', teamName: 'U15',
    },
  ],
  scope: { teams: [{ documentId: 'u15', name: 'U15' }], viewer: 'coach' },
};

describe('ST-VUES2 écran 17 — « Ses retours de match dans la feuille »', () => {
  test('chez son entraîneur : le lien ouvre la feuille du dernier match, pour SON équipe', () => {
    const ouvrir = jest.fn();
    const arbre = monter(
      <ProfileStatsForViewer onOpenMatchSheet={ouvrir} stats={VU_PAR_SON_ENTRAINEUR} />,
    );

    expect(arbre.root.findAllByType(Text).map((n) => n.props.children))
      .toContain('Ses retours de match dans la feuille');
    act(() => lien(arbre).props.onPress());
    expect(ouvrir).toHaveBeenCalledWith({
      eventId: 'match-12-09',
      sport: 'football',
      teamId: 'u15',
      teamName: 'U15',
    });
  });

  test('sans match encore : pas de lien vers une feuille vide', () => {
    const arbre = monter(
      <ProfileStatsForViewer
        onOpenMatchSheet={jest.fn()}
        stats={{ ...VU_PAR_SON_ENTRAINEUR, recentMatches: [] }}
      />,
    );

    expect(lien(arbre)).toBeUndefined();
  });

  test('🔒 personne d autre n a le lien : ni l aperçu, ni le SuperAdmin, ni un autre membre', () => {
    const { scope, ...sansPortee } = VU_PAR_SON_ENTRAINEUR;
    expect(scope.viewer).toBe('coach');
    [
      { isSelfPreview: true, stats: VU_PAR_SON_ENTRAINEUR },
      { isSelfPreview: false, stats: sansPortee },
      { isSelfPreview: false, stats: undefined },
    ].forEach((props) => {
      const arbre = monter(
        <ProfileStatsForViewer
          isSelfPreview={props.isSelfPreview}
          onOpenMatchSheet={jest.fn()}
          stats={props.stats}
        />,
      );
      expect(lien(arbre)).toBeUndefined();
    });
  });

  test('le profil branche le lien sur la feuille du match (pile des événements)', () => {
    const page = readFileSync(join(__dirname, '..', 'UserDetails.js'), 'utf8');

    expect(page).toContain('onOpenMatchSheet={openMatchSheet}');
    expect(page).toContain('screen: RouteNames.MatchStatsEditor');
  });
});

// BH03 · P11-19 — le dernier match du joueur, joue avec une AUTRE equipe que celle du coach,
// etait rattache a l'equipe du coach (repli « une seule equipe ») : feuille d'un autre match.
describe('BH03 · P11-19 — resolveMatchSheetTarget', () => {
  it('un match d une autre equipe n est pas rattache a l equipe du coach', () => {
    // eslint-disable-next-line global-require
    const { resolveMatchSheetTarget } = require('../stats/ProfileStatsForViewer');
    const stats = {
      recentMatches: [
        { documentId: 'match-seniors', sourceType: 'event', sport: 'football', teamName: 'Seniors' },
        { documentId: 'match-u15', sourceType: 'event', sport: 'football', teamName: 'U15' },
      ],
      scope: { teams: [{ documentId: 'u15', name: 'U15' }], viewer: 'coach' },
    };

    expect(resolveMatchSheetTarget(stats)?.eventId).toBe('match-u15');
  });
});
