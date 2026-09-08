import { ScrollView, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { familleDuSchema } from '@/components/organisms/training/TrainingBlocks';

import TrainingSchema from '../TrainingSchema';

/**
 * « LE SCHEMA EN GRAND » — LE FILET.
 *
 * 🔎 CE QU IL PROTEGE : ces dessins portent des cotes au centimetre — « telephone
 * a 5,00 m du mur », « plots hauts SUR l axe ballon ». Dans une carte de la largeur
 * d un telephone, un « 5,00 m » fait deux millimetres de haut : on ne le lit pas,
 * donc on installe au juge, donc la mesure ne vaut plus rien.
 *
 * 🔄 ET LE PIVOT N EST PAS UNE COQUETTERIE : un plan de terrain se lit accroupi, le
 * telephone pose, en regardant alternativement le dessin et le sol. Un quart de tour
 * aligne le dessin sur ce qu on a devant les yeux. C est pour ca qu il est ETEINT
 * sur une position du corps : faire tourner quelqu un debout ne rend pas le dessin
 * plus lisible, ca le rend faux.
 */

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = couleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Images: { chevronDown: 1 },
      Spaces,
    }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ options) => (
      options ? `${clef}|${JSON.stringify(options)}` : clef
    ),
  }),
}));

jest.mock('react-native-svg', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    SvgXml: (/** @type {any} */ props) => reactActuel.createElement(VueRN, props),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => reactActuel.createElement(VueRN, null, children),
  };
});

/** Un plan de terrain : plus LARGE que haut. */
const PLAN = '<svg viewBox="0 0 400 200"><rect /></svg>';
/** Une position du corps : plus HAUTE que large. */
const CORPS = '<svg viewBox="0 0 120 400"><rect /></svg>';

/**
 * Monte l ecran.
 * @param {object} [params] les parametres de la route
 * @param {any} [navigation] la navigation moquee
 * @returns {any} l arbre rendu
 */
const rendre = (params = { svg: PLAN, title: 'Sprint 10 m' }, navigation = {}) => {
  const nav = { goBack: jest.fn(), navigate: jest.fn(), ...navigation };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingSchema navigation={nav} route={{ params }} />);
  });
  return arbre;
};

/**
 * Tout le texte affiche, a plat.
 * @param {any} arbre l arbre rendu
 * @returns {string[]} les chaines rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud et empile ses chaines.
   * @param {any} noeud un noeud rendu
   * @returns {void} rien
   */
  const parcourir = (noeud) => {
    if (typeof noeud === 'string') { sortie.push(noeud); return; }
    if (Array.isArray(noeud)) { noeud.forEach(parcourir); return; }
    if (noeud && noeud.children) noeud.children.forEach(parcourir);
  };
  parcourir(arbre.toJSON());
  return sortie;
};

/**
 * Une commande, par le texte qu elle porte.
 * @param {any} arbre l arbre rendu
 * @param {string} texte la clef affichee
 * @returns {any} le noeud cliquable
 */
const commande = (arbre, texte) => arbre.root.findAll((n) => n.type === TouchableOpacity
  && n.props.accessibilityLabel === texte)[0];

describe('LA FAMILLE se deduit de la FORME du dessin', () => {
  it('un dessin LARGE est un plan de terrain', () => {
    expect(familleDuSchema(PLAN)).toBe('field');
  });

  it('un dessin HAUT est une position du corps', () => {
    expect(familleDuSchema(CORPS)).toBe('body');
  });

  it('🪤 se rabat sur « plan de terrain » quand la forme est illisible', () => {
    // Aucun champ du serveur ne dit la famille — verifie sur les 27 schemas du
    // programme. Sans viewBox, on ne peut pas deviner : on choisit le cas qui
    // ACTIVE le pivot, parce qu un pivot inutile se corrige d un appui, alors
    // qu un pivot absent laisse la personne se tordre le cou.
    expect(familleDuSchema('<svg><rect /></svg>')).toBe('field');
    expect(familleDuSchema(undefined)).toBe('field');
  });
});

describe('l entete', () => {
  it('annonce la famille et le nom du dessin', () => {
    const vus = textes(rendre());

    expect(vus).toContain('training.schema.family.field');
    expect(vus).toContain('Sprint 10 m');
  });

  it('ferme par la croix : c est un cul-de-sac volontaire', () => {
    const goBack = jest.fn();
    const arbre = rendre({ svg: PLAN }, { goBack });

    act(() => { commande(arbre, 'training.schema.close').props.onPress(); });

    expect(goBack).toHaveBeenCalled();
  });
});

describe('les commandes', () => {
  it('laisse PIVOTER un plan de terrain', () => {
    const arbre = rendre();
    const pivot = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityState?.disabled === false)[0];

    expect(pivot).toBeDefined();
    act(() => { pivot.props.onPress(); });
    expect(pivot.props.accessibilityState.selected).toBe(true);
  });

  it('⛔ ETEINT le pivot sur une position du corps', () => {
    const arbre = rendre({ svg: CORPS, title: 'Angle du genou' });
    const eteints = arbre.root.findAll((n) => n.type === TouchableOpacity
      && n.props.accessibilityState?.disabled === true);

    // Le pivot ET la video : ni l un ni l autre n a de sens ici.
    expect(eteints.length).toBeGreaterThanOrEqual(1);
    expect(textes(arbre)).toContain('training.schema.family.body');
  });

  it('grossit par paliers, et « 1:1 » remet tout a plat', () => {
    const arbre = rendre();
    const dessin = () => arbre.root.findByType(ScrollView).findAll(
      (n) => Array.isArray(n.props?.style?.transform),
    )[0];

    expect(dessin().props.style.transform[1].scale).toBe(1);
    act(() => { commande(arbre, 'training.schema.zoomIn').props.onPress(); });
    expect(dessin().props.style.transform[1].scale).toBe(1.5);

    act(() => { commande(arbre, 'training.schema.reset').props.onPress(); });
    expect(dessin().props.style.transform[1].scale).toBe(1);
    expect(dessin().props.style.transform[0].rotate).toBe('0deg');
  });

  it('laisse PINCER : le defilement porte ses bornes de grossissement', () => {
    const zone = rendre().root.findByType(ScrollView);

    expect(zone.props.maximumZoomScale).toBe(4);
    expect(zone.props.minimumZoomScale).toBe(1);
  });

  it('ETEINT le bouton de la video quand aucune video n est rattachee', () => {
    const arbre = rendre();
    expect(commande(arbre, 'training.schema.video').props.accessibilityState.disabled)
      .toBe(true);
  });

  it('l allume quand il y en a une', () => {
    const arbre = rendre({ svg: PLAN, video: 'https://exemple.test/geste' });
    expect(commande(arbre, 'training.schema.video').props.accessibilityState.disabled)
      .toBe(false);
  });
});

describe('la phrase du bas', () => {
  it('dit comment lire un plan de terrain', () => {
    expect(textes(rendre())).toContain('training.schema.hint.field');
  });

  it('dit autre chose pour une position du corps', () => {
    expect(textes(rendre({ svg: CORPS }))).toContain('training.schema.hint.body');
  });
});

describe('ce qui ne doit rien faire tomber', () => {
  it('le dit franchement quand le dessin n est pas arrive', () => {
    expect(textes(rendre({ svg: null, title: 'Sans dessin' })))
      .toContain('training.schema.missing');
  });

  it('traverse une route sans aucun parametre', () => {
    expect(() => rendre(undefined)).not.toThrow();
  });
});
