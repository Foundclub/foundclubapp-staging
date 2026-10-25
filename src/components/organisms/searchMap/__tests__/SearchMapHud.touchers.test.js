import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SearchMapHud from '@/components/organisms/searchMap/SearchMapHud';

import { pressable } from '@/testSupport/temoinComplexe';

// RESA-CARTE (20/10/2026) — LA BARRE D'OUTILS POSÉE SUR LA CARTE DE RECHERCHE (résumé
// « 2 complexes », zoom, « Recentrer », « Me localiser »). Fichier sans témoin (E6) : le premier
// témoin décrit ce qu'elle fait AUJOURD'HUI (le résumé, chaque bouton appelle sa fonction).
// Mesuré au navigateur le 20/10 (témoin web tests/components/resa-carte.spec.ts, 1 360 px) : son
// conteneur, une rangée « résumé à gauche, boutons à droite », couvrait TOUTE la largeur de la
// carte sur la hauteur de la colonne de boutons (~150 px) et avalait les touchers : une épingle
// posée dans cette bande ne se touchait pas (aucun choix, aucune erreur). Le conteneur laisse
// désormais passer les touchers (`box-none`) ; le résumé et les boutons gardent les leurs.
// Appelants (R2) : SearchMap.web.js, TomTomSearchMapNative.js, LegacySearchMapNative.js.

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const gestes = {
  onLocateMe: jest.fn(),
  onRecenter: jest.fn(),
  onZoomIn: jest.fn(),
  onZoomOut: jest.fn(),
};

/**
 * Monte la barre d'outils sur deux complexes.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SearchMapHud
        geolocatableCount={2}
        onLocateMe={gestes.onLocateMe}
        onRecenter={gestes.onRecenter}
        onZoomIn={gestes.onZoomIn}
        onZoomOut={gestes.onZoomOut}
        renderStats={{ clusterCount: 0, markerCount: 2 }}
        scope="complexes"
        totalCount={2}
      />,
    );
  });
  return arbre;
};

describe('RESA-CARTE — la barre d’outils de la carte de recherche', () => {
  it('le résumé, et chaque bouton appelle sa fonction (inchangé)', async () => {
    const arbre = await monter();
    const textes = arbre.root.findAllByType(Text).map((/** @type {any} */ noeud) => (
      [].concat(noeud.props.children).join('')
    ));
    expect(textes).toEqual(expect.arrayContaining(['2 complexes', '2 repères visibles']));
    const boutons = [
      ['+', 'onZoomIn'],
      ['-', 'onZoomOut'],
      ['Recentrer', 'onRecenter'],
      ['Me localiser', 'onLocateMe'],
    ];
    boutons.forEach(([libelle, geste]) => {
      act(() => {
        pressable(arbre, libelle).props.onPress();
      });
      expect(gestes[/** @type {'onZoomIn'} */ (geste)]).toHaveBeenCalledTimes(1);
    });
  });

  it('son conteneur laisse passer les touchers vers la carte (box-none)', async () => {
    const arbre = await monter();
    const racine = arbre.root.children[0];
    expect(racine.props.pointerEvents).toBe('box-none');
  });
});

// RESA-FIN-APP (20/10/2026) — tournée 2, vue Carte de E-P01 : « 1 complexe · 1 repères visibles ». Le nombre
// de repères s'accorde (« 1 repère visible », « 2 repères visibles »), comme le titre (« 1 complexe »).
describe('RESA-FIN-APP (3) — « 1 repère visible » au singulier', () => {
  it.each([[1, '1 repère visible'], [2, '2 repères visibles']])('%i repère(s) : « %s »', async (nombre, attendu) => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <SearchMapHud
          geolocatableCount={nombre}
          onLocateMe={gestes.onLocateMe}
          onRecenter={gestes.onRecenter}
          onZoomIn={gestes.onZoomIn}
          onZoomOut={gestes.onZoomOut}
          renderStats={{ clusterCount: 0, markerCount: nombre }}
          scope="complexes"
          totalCount={nombre}
        />,
      );
    });
    const textes = arbre.root.findAllByType(Text).map((/** @type {any} */ noeud) => (
      [].concat(noeud.props.children).join('')
    ));
    expect(textes).toContain(attendu);
  });
});
