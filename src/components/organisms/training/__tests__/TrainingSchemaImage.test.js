import renderer, { act } from 'react-test-renderer';

import TrainingSchemaImage, {
  desamorcerLeSchema,
  ratioDuSchema,
} from '../TrainingSchemaImage';

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

describe('🔴 LE DESSIN QUI FERMAIT L APPLICATION', () => {
  /*
   * Mesure du 2026-09-08, en ouvrant le parcours guide de T0 sur l emulateur :
   * l app disparaissait, ecran d accueil Android. Le journal :
   *
   *   java.lang.NumberFormatException: For input string: "auto-start-reverse"
   *       at com.horcrux.svg.MarkerView.renderMarker(MarkerView.java:125)
   *
   * La bibliotheque lit `orient` comme ceci, et ne connait QUE le mot « auto » :
   *   double markerAngle = "auto".equals(mOrient) ? -1 : Double.parseDouble(mOrient);
   *
   * ⛔ Ce n est PAS une erreur JavaScript : c est une exception native levee pendant
   * le dessin. Aucune barriere React ne la rattrape, le processus meurt. 10 des 27
   * dessins du programme la portaient — dont le tout premier.
   */
  const AVEC_MARQUEUR = '<svg viewBox="0 0 600 300">'
    + '<marker id="a" refX="9" refY="5" orient="auto-start-reverse"><path d="M0,0" /></marker>'
    + '</svg>';

  it('neutralise la valeur qui fait planter, AVANT de la donner au dessin', () => {
    expect(desamorcerLeSchema(AVEC_MARQUEUR)).not.toContain('auto-start-reverse');
    expect(desamorcerLeSchema(AVEC_MARQUEUR)).toContain('orient="auto"');
  });

  it('le dessin monte a l ecran deja desamorce', () => {
    const enfant = cadre({ xml: AVEC_MARQUEUR }).children[0];

    expect(enfant.props.xml).not.toContain('auto-start-reverse');
  });

  it('laisse tranquille les deux formes que la bibliotheque SAIT lire', () => {
    // « auto » est le seul mot accepte ; un angle en degres passe par parseDouble.
    expect(desamorcerLeSchema('<svg orient="auto" />')).toContain('orient="auto"');
    expect(desamorcerLeSchema('<svg orient="45" />')).toContain('orient="45"');
    expect(desamorcerLeSchema("<svg orient='-90.5' />")).toContain("orient='-90.5'");
  });

  it('rabat TOUTE autre valeur, pas seulement celle qu on a rencontree', () => {
    // Les dessins viennent du serveur : un programme publie demain peut porter
    // n importe quoi. Le garde-fou ne connait pas la liste des valeurs fautives,
    // il connait la liste des DEUX valeurs sures.
    expect(desamorcerLeSchema('<svg orient="auto-start-reverse" />')).toContain('orient="auto"');
    expect(desamorcerLeSchema('<svg orient="" />')).toContain('orient="auto"');
    expect(desamorcerLeSchema('<svg orient="12deg" />')).toContain('orient="auto"');
    expect(desamorcerLeSchema('<svg orient = "n importe quoi" />')).toContain('orient="auto"');
  });

  it('ne touche a rien d autre dans le dessin', () => {
    const propre = desamorcerLeSchema(AVEC_MARQUEUR);

    expect(propre).toContain('viewBox="0 0 600 300"');
    expect(propre).toContain('refX="9"');
    expect(propre).toContain('<path d="M0,0" />');
  });
});
