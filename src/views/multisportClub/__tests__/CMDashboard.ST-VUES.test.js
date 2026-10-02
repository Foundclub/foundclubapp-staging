import { readFileSync } from 'fs';
import { join } from 'path';

import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MultisportStatsRow from '../components/MultisportStatsRow';

// ST-VUES (02/10) — « GESTION DU CLUB », PLANCHE 18 DU DESIGN VALIDE, PARTIE CLIENT.
//
// « Les trois chiffres se touchent tous » : « Sections » ne se touchait pas (Équipes et
// Membres ouvraient deja leur liste). Et « Les stats de chaque équipe » mene aux fiches,
// dont l onglet Stats est ouvert au dirigeant depuis STATS-ENQUETE (defaut 3).
// ⚠️ PARTIEL, nomme : la carte « Résultats du week-end » et « Relancer Karim » attendent
// une route serveur par club, qui n existe pas.
//
// 🧪 `CMDashboard.js` n avait AUCUN temoin (E6) : ce fichier en pose un, sur le rendu du
// rang de chiffres et sur le branchement dans la source.

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

const SOURCE = readFileSync(join(__dirname, '..', 'CMDashboard.js'), 'utf8');

describe('ST-VUES planche 18 — les trois chiffres se touchent tous', () => {
  test('le rang de chiffres rend un bouton par chiffre qui a une destination', () => {
    const appui = jest.fn();
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <MultisportStatsRow
          items={[
            { key: 'sections', label: 'Sections', onPress: appui, value: 2 },
            { key: 'teams', label: 'Équipes', onPress: appui, value: 2 },
            { key: 'members', label: 'Membres', onPress: appui, value: 9 },
          ]}
        />,
      );
    });

    expect(arbre.root.findAllByType(TouchableOpacity)).toHaveLength(3);
    act(() => arbre.unmount());
  });

  test('« Sections » a enfin sa destination : la liste « Mes sections », sur la page', () => {
    const sections = SOURCE.slice(SOURCE.indexOf("key: 'sections'"), SOURCE.indexOf("key: 'teams'"));

    expect(sections).toContain('onPress: () => scrollRef.current?.scrollTo(');
    expect(SOURCE).toContain('sectionsOffsetRef.current = event?.nativeEvent?.layout?.y || 0;');
  });

  test('« Les stats de chaque équipe » mene a la liste des equipes du club', () => {
    expect(SOURCE).toContain("{t('clubStatsView.eachTeamStats', 'Les stats de chaque équipe')}");
    expect(SOURCE).toContain('onPress={() => navigation.navigate(RouteNames.CMTeams, { cmId: resolvedCmId })}');
  });
});
