import { createElement } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal.web';

// ⌨️ CLAVREGLE (23/10) — la même règle sur le SITE : un champ touché reste au-dessus du clavier.
// La feuille du site est fixée au bas de la page (`position: fixed; bottom: 0`). Sur un
// téléphone, le clavier ne réduit que la zone VISIBLE (`window.visualViewport`), pas la page :
// la feuille, et son champ, restaient dessous. Elle se pose désormais au bas de la zone visible.
// Rouge avant : `bottom` restait à 0 clavier ouvert.

// `react-dom` n'existe que dans le dépôt du site : doublure virtuelle.
jest.mock('react-dom', () => ({ createPortal: (/** @type {any} */ enfant) => enfant }), { virtual: true });

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

/** Une zone visible de téléphone (iPhone 15 : 844 pt), clavier fermé. */
const zone = {
  /** @type {Record<string, Function>} */
  ecouteurs: {},
  height: 844,
  offsetTop: 0,
  scale: 1,
  addEventListener(/** @type {string} */ nom, /** @type {Function} */ rappel) { this.ecouteurs[nom] = rappel; },
  removeEventListener(/** @type {string} */ nom) { delete this.ecouteurs[nom]; },
};

const globalAvant = { innerHeight: global.window?.innerHeight, visualViewport: global.window?.visualViewport };

beforeEach(() => {
  Object.assign(zone, { ecouteurs: {}, height: 844, offsetTop: 0, scale: 1 });
  /** @type {any} */ (global.window).innerHeight = 844;
  /** @type {any} */ (global.window).visualViewport = zone;
});

afterAll(() => {
  Object.assign(/** @type {any} */ (global.window), globalAvant);
});

const basDeLaFeuille = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => StyleSheet.flatten(noeud.props?.style)?.position === 'fixed')[0]
  .props.style.flat(Infinity).reduce((bas, morceau) => (morceau && 'bottom' in morceau ? morceau.bottom : bas), undefined);

const ouvrir = (/** @type {string} */ presentation) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      { close: () => {}, isVisible: true, webPresentation: presentation },
      createElement(Text, null, 'Nommer l\'adversaire'),
      createElement(TextInput, null),
    ));
  });
  return arbre;
};

const clavier = (/** @type {number} */ hauteur) => act(() => {
  zone.height = 844 - hauteur;
  zone.ecouteurs.resize?.();
});

describe.each(['sheet', 'dialog'])('CLAVREGLE (site, %s) — la feuille se pose au bas de la zone visible', (presentation) => {
  it('clavier ouvert (336) : la feuille remonte de 336 ; fermé : retour à 0', () => {
    const arbre = ouvrir(presentation);
    expect(basDeLaFeuille(arbre)).toBe(0);
    clavier(336);
    expect(basDeLaFeuille(arbre)).toBe(336);
    clavier(0);
    expect(basDeLaFeuille(arbre)).toBe(0);
    act(() => arbre.unmount());
    expect(zone.ecouteurs.resize).toBeUndefined();
  });

  it('zoom au doigt (zone visible réduite, échelle ≠ 1) : la feuille ne bouge pas', () => {
    const arbre = ouvrir(presentation);
    act(() => {
      zone.scale = 2;
      zone.height = 422;
      zone.ecouteurs.resize?.();
    });
    expect(basDeLaFeuille(arbre)).toBe(0);
    act(() => arbre.unmount());
  });
});
