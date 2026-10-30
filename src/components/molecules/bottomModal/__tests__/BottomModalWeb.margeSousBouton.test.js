import { createElement } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal.web';

// CORR-SOCLE (30/10, points 13 et 30 de la recette du site, ajout d'Adel : « sous le bouton
// Sélectionner il y a beaucoup trop de marge… il faut enlever ça partout »).
// Sur le SITE, une feuille qui reçoit une hauteur (`snapPoints`, ex. « 86 % » des listes de choix)
// gardait sa liste dans une boîte plafonnée à 420 px : à 844 px de haut, ~200 px restaient vides
// SOUS le bouton du pied. La liste prend désormais toute la hauteur libre : le pied finit au bas.
// Le téléphone n'est pas concerné (BottomModal.js : le pied de @gorhom est posé au bas de la
// feuille).
// Jest n'a pas de moteur de mise en page : on lit la règle de style, la mesure est au navigateur.

jest.mock('react-dom', () => ({
  createPortal: (/** @type {any} */ enfant) => enfant,
}), { virtual: true });

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const styleDeLaListe = (/** @type {Record<string, unknown>} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      {
        close: () => {},
        footerComponent: createElement(Text, null, 'Sélectionner'),
        isVisible: true,
        ...props,
      },
      createElement(Text, null, 'Marseille (13001)'),
    ));
  });
  const style = StyleSheet.flatten(arbre.root.findByType(ScrollView).props.style);
  act(() => arbre.unmount());
  return style;
};

describe('CORR-SOCLE (site) — pas de vide sous le bouton du pied', () => {
  it('feuille à hauteur donnée (86 %) : la liste remplit, aucun plafond de 420 px', () => {
    const style = styleDeLaListe({ snapPoints: ['86%'] });
    expect(style.maxHeight).toBeUndefined();
    expect(style.flex).toBe(1);
  });

  it('feuille sans hauteur donnée : elle suit son contenu, plafond de 420 px inchangé', () => {
    expect(styleDeLaListe({}).maxHeight).toBe(420);
  });

  it('fenêtre de dialogue : plafond de 520 px inchangé', () => {
    expect(styleDeLaListe({ snapPoints: ['86%'], webPresentation: 'dialog' }).maxHeight).toBe(520);
  });
});
