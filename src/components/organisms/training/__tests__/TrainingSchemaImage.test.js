import renderer, { act } from 'react-test-renderer';

import TrainingSchemaImage, { ratioDuSchema } from '../TrainingSchemaImage';

/**
 * LE SCHEMA COTE, ET SA HAUTEUR.
 *
 * 🚨 LE DEFAUT QUE CE FILET FERME, vu A L ECRAN le 2026-09-08 et par AUCUNE porte : les
 * 27 dessins du programme declarent `viewBox="0 0 600 300"` et `width="100%"` — mais
 * aucune hauteur. `react-native-svg` ne la devine pas : il rendait une bande de
 * quelques pixels. Les dessins partaient du serveur, arrivaient dans l app, et personne
 * ne les voyait depuis le 06/09.
 *
 * ⚠️ ET UN TEMOIN NE PEUT PAS VOIR UN DESSIN. `react-test-renderer` ne calcule aucune
 * mise en page : un SVG de hauteur nulle lui parait parfaitement rendu. Ce filet ne
 * verifie donc PAS l image — il verifie la seule chose qui separe un dessin visible d un
 * dessin ecrase : le RAPPORT pose sur son cadre. C est ce rapport qui donne sa hauteur.
 */

jest.mock('react-native-svg', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    SvgXml: (/** @type {any} */ props) => reactActuel.createElement(VueRN, props),
  };
});

/** Un plan de terrain : deux fois plus large que haut. */
const PLAN = '<svg viewBox="0 0 600 300" width="100%"><rect /></svg>';

/**
 * Monte le schema et rend son cadre.
 * @param {object} [options] ce qu on fait varier
 * @param {string} [options.rotate] la rotation demandee
 * @param {number} [options.scale] le grossissement demande
 * @param {string} [options.xml] le dessin
 * @returns {any} le cadre rendu, ou `null`
 */
const cadre = ({ rotate, scale, xml = PLAN } = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TrainingSchemaImage rotate={rotate} scale={scale} xml={xml} />,
    );
  });
  return arbre.toJSON();
};

describe('le rapport largeur / hauteur', () => {
  it('se lit dans le viewBox', () => {
    expect(ratioDuSchema(PLAN)).toBe(2);
    expect(ratioDuSchema('<svg viewBox="0 0 120 400"></svg>')).toBeCloseTo(0.3);
  });

  it('se rabat sur 2 quand le viewBox est absent ou illisible', () => {
    expect(ratioDuSchema('<svg width="100%"></svg>')).toBe(2);
    expect(ratioDuSchema('<svg viewBox="0 0 0 0"></svg>')).toBe(2);
    expect(ratioDuSchema(undefined)).toBe(2);
  });
});

describe('🚨 LE CADRE PORTE SA HAUTEUR', () => {
  it('pose un `aspectRatio` : c est LUI qui rend les 27 dessins visibles', () => {
    // Sans cette ligne, React Native n a aucune hauteur a donner au dessin, et le
    // SVG s ecrase a quelques pixels — exactement ce qu on a vu a l ecran.
    expect(cadre().props.style.aspectRatio).toBe(2);
    expect(cadre().props.style.width).toBe('100%');
  });

  it('demande au dessin de remplir son cadre, en hauteur AUSSI', () => {
    // `width="100%"` seul ne suffit pas : c est le couple qui compte.
    const enfant = cadre().children[0];

    expect(enfant.props.width).toBe('100%');
    expect(enfant.props.height).toBe('100%');
  });

  it('garde le rapport d une position du corps, plus haute que large', () => {
    expect(cadre({ xml: '<svg viewBox="0 0 120 400"></svg>' }).props.style.aspectRatio)
      .toBeCloseTo(0.3);
  });
});

describe('le pivot et le grossissement', () => {
  it('ne pivotent ni ne grossissent par defaut', () => {
    expect(cadre().props.style.transform).toEqual([{ rotate: '0deg' }, { scale: 1 }]);
  });

  it('appliquent ce qu on leur demande', () => {
    const { style } = cadre({ rotate: '90deg', scale: 1.5, xml: PLAN }).props;

    expect(style.transform).toEqual([{ rotate: '90deg' }, { scale: 1.5 }]);
  });
});

describe('ce qui ne doit rien faire tomber', () => {
  it('ne rend RIEN quand le dessin est illisible', () => {
    // Le SVG vient du serveur : un dessin casse ne doit pas casser l ecran.
    expect(cadre({ xml: null })).toBeNull();
    expect(cadre({ xml: 'ceci n est pas un dessin' })).toBeNull();
  });
});
