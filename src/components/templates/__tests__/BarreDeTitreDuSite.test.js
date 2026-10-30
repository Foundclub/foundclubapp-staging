import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BarreDeTitreDuSite from '../BarreDeTitreDuSite';
import ScreenContainerWeb from '../ScreenContainer.web';

// CORR-SOCLE (30/10, points 5 et 7 de la recette du site) — la barre de titre fine du site
// (retour + titre, 56 px) que le registre pose sur les écrans dont le téléphone tient le titre de
// l'en-tête natif ; sous elle, le conteneur d'écran ne pose plus ses 20 px du haut.

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle) => `«${cle}»` }),
}));

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return { __esModule: true, default: () => creer(Texte, null, 'RETOUR') };
});

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const aplatir = (/** @type {any} */ style) => [style].flat(Infinity)
  .reduce((/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...(s || {}) }), {});

/**
 * Monte un élément.
 * @param {import('react').ReactElement} element - L'élément.
 * @returns {any} L'arbre.
 */
const rendre = (element) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(element); });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));

describe('CORR-SOCLE — barre de titre fine du site', () => {
  test('retour + titre traduit, 56 px, collée en haut', () => {
    const arbre = rendre(
      <BarreDeTitreDuSite cleDuTitre="profile.titles.edit">
        <Text>CONTENU</Text>
      </BarreDeTitreDuSite>,
    );
    expect(textes(arbre)).toEqual(['RETOUR', '«profile.titles.edit»', 'CONTENU']);
    const barre = arbre.root.findAll((/** @type {any} */ n) => (
      n.props.testID === 'barre-de-titre-du-site'
    ))[0];
    expect(aplatir(barre.props.style)).toEqual(expect.objectContaining({
      height: 56, position: 'sticky', top: 0,
    }));
  });

  test('sans titre : le retour seul, comme `headerTitle: \'\'` au téléphone', () => {
    const arbre = rendre(
      <BarreDeTitreDuSite cleDuTitre=""><Text>CONTENU</Text></BarreDeTitreDuSite>,
    );
    expect(textes(arbre)).toEqual(['RETOUR', '', 'CONTENU']);
  });

  test('sous la barre, le conteneur ne pose plus ses 20 px du haut ; ailleurs, inchangé', () => {
    const hautDeLaPage = (/** @type {any} */ arbre) => aplatir(arbre.root.findAllByType(View)
      .find((/** @type {any} */ v) => 'minHeight' in aplatir(v.props.style))
      .props.style).paddingTop;
    expect(hautDeLaPage(rendre(<ScreenContainerWeb><Text>A</Text></ScreenContainerWeb>))).toBe(20);
    expect(hautDeLaPage(rendre(
      <BarreDeTitreDuSite cleDuTitre="">
        <ScreenContainerWeb><Text>A</Text></ScreenContainerWeb>
      </BarreDeTitreDuSite>,
    ))).toBe(0);
  });
});
