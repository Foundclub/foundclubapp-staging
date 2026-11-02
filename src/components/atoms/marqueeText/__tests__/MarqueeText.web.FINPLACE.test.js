import { StyleSheet, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MarqueeText from '../MarqueeText.web';

// FIN-PLACE (02/11/2026) — à 390 px, la fiche d'une équipe au nom long débordait de 222 px, des
// deux côtés : dans une colonne centrée (l'en-tête de TeamDetails), l'enveloppe prenait la largeur
// de sa ligne sans retour. Le plafond doit être dans la brique, pour les ~40 appelants.
describe('FIN-PLACE — le nom long reste dans sa colonne, sur le site', () => {
  it('l enveloppe ne dépasse jamais la largeur de son parent', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(<MarqueeText text="Les Vétérans d’Aÿ-sur-Huveaune (2)" />);
    });
    expect(StyleSheet.flatten(arbre.root.findAllByType(View)[0].props.style).maxWidth).toBe('100%');
  });
});
