import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ScreenContainerWeb from '../ScreenContainer.web';

// ==========================================================================
// E6 — TÉMOIN CARACTÉRISANT du gabarit d'écran du SITE, écrit AVANT d'y toucher
// (les 3 témoins de `ScreenContainer` montent la version NATIVE).
//
// Puis le témoin du lot COMPOMSG : sur le site, le cadre de contenu ne s'étire
// pas (largeur 100 %, aucun `flex`) — tout enfant en `flex: 1` y vaut 0 px.
// Mesuré au banc (23/09) : le terrain du plein écran de la composition,
// enveloppe 390 × 0, dessin 0 × 0. Un écran qui en a besoin le DEMANDE
// (`fillHeight`) : les 149 autres écrans du site ne bougent pas.
// ==========================================================================

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      Colors: colors(),
      Images: {},
    }),
  };
});

/** @type {any[]} */
const montes = [];

const rendre = (/** @type {any} */ props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      // eslint-disable-next-line react/jsx-props-no-spreading
      <ScreenContainerWeb {...props}><Text>CONTENU</Text></ScreenContainerWeb>,
    );
  });
  montes.push(arbre);
  return arbre;
};

/**
 * Le cadre de contenu. Structure du gabarit : page > voile > CADRE > porteur des
 * enfants. Les vues qui contiennent le texte, dans l'ordre de l'arbre, finissent
 * donc par [… cadre, porteur].
 * @param {any} arbre
 * @returns {any}
 */
const cadreDeContenu = (arbre) => {
  const vues = arbre.root.findAllByType(View).filter((v) => v.findAllByType(Text).length);
  expect(vues).toHaveLength(4);
  return vues[vues.length - 2];
};

const aplatir = (/** @type {any} */ style) => [style].flat(Infinity)
  .reduce((/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...(s || {}) }), {});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('E6 · ScreenContainer.web — ce qu’il fait aujourd’hui', () => {
  test('SAISIE : le minimum de page soustrait la place déjà réservée par la coque', () => {
    const page = rendre().root.findAllByType(View)[0];
    expect(aplatir(page.props.style).minHeight)
      .toBe('calc(100dvh - var(--fc-shell-bottom-space, 0px))');
  });

  test('le cadre de contenu prend toute la largeur, plafonnée à 1 180, et ne s’étire PAS', () => {
    const style = aplatir(cadreDeContenu(rendre()).props.style);

    expect(style.width).toBe('100%');
    expect(style.maxWidth).toBe(1180);
    expect(style.flexGrow).toBeUndefined();
  });

  test('les enfants sont rendus', () => {
    expect(rendre().root.findByType(Text).props.children).toBe('CONTENU');
  });
});

describe('COMPOMSG · un écran peut demander toute la hauteur', () => {
  test('🥇 avec `fillHeight`, le cadre de contenu s’étire sur la hauteur', () => {
    const style = aplatir(cadreDeContenu(rendre({ fillHeight: true })).props.style);

    expect(style.flexGrow).toBe(1);
  });

  test('🔒 sans `fillHeight`, rien ne change pour les autres écrans', () => {
    const style = aplatir(cadreDeContenu(rendre({ fillHeight: false })).props.style);

    expect(style.flexGrow).toBeUndefined();
  });
});
