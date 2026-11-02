import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { lirePageDuSite, useDeclarerPageDuSite } from '../pageDuSite';

// REPRISE-PLACE (01/11, point 7 de la recette du site, revue « mettre le nom de la page dans la
// barre fine » et « rallumer l'onglet du club ») — un écran déclare le titre de sa barre fine et
// l'onglet à allumer ; la barre du site et la coque les lisent. L'écran parti, tout s'efface.

/**
 * Un écran qui déclare sa page.
 * @param {{ titre?: string | null, onglet?: string | null }} props - Ce qu'il déclare.
 * @returns {import('react').ReactElement} Le texte.
 */
function Ecran({ onglet = null, titre = null }) {
  useDeclarerPageDuSite({ onglet, titre });
  return createElement(Text, null, 'ECRAN');
}

describe('REPRISE-PLACE — la page du site (titre de la barre, onglet allumé)', () => {
  test('l’écran déclare son titre et son onglet ; parti, plus rien', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(Ecran, { onglet: 'main-team', titre: 'RWDIRIG' }));
    });
    expect(lirePageDuSite()).toEqual({ onglet: 'main-team', titre: 'RWDIRIG' });
    act(() => arbre.update(createElement(Ecran, { onglet: null, titre: 'AS Montrivage' })));
    expect(lirePageDuSite()).toEqual({ onglet: null, titre: 'AS Montrivage' });
    act(() => arbre.unmount());
    expect(lirePageDuSite()).toEqual({ onglet: null, titre: null });
  });
});
