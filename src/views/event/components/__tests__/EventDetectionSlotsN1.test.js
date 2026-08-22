import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventDetectionSlots from '../EventDetectionSlots';

// Lot N1 — (a) LA DETECTION QUI SE TAIT.
//
// 🕳️ LE TROU DE FILET (E6) : ce composant de 259 lignes n'avait AUCUN temoin a
// lui. Les 8 suites qui le croisent le remplacent par une doublure de texte
// (`makeTextDouble`), donc aucune ne monte une seule de ses lignes. Le filet
// manquait ici, il est pose ici — avant la moindre modification.
//
// 🧨 LE DEFAUT MESURE : une detection SANS poste n'affichait RIEN. Deux gardes
// se superposaient — `detectionSlots.length > 0` dans l'ecran, et un
// `return null` ici meme (l. 58-60). L'organisateur qui n'a pas encore saisi
// ses postes voyait donc une page muette, sans savoir si c'etait normal.
// La regle 5 du pack de design l'interdit : « aucun bloc muet ».
//
// 🎯 LA DECISION (chef d'orchestre, 23/08) : l'etat vide vit DANS le composant,
// commande par une propriete explicite `isDetection`. Un seul endroit, et
// testable sans monter les 6 900 lignes de l'ecran — c'est exactement ce que
// fait ce fichier.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page. Il
// lit ce qui est MONTE et les jetons de style demandes, pas des pixels.

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { accessibilityRole: 'button', disabled: Boolean(props.disabled) },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// Meme motif de theme qu'`EventHeaderAE01.test.js` : des Proxy a formes
// PRECISES, jamais un attrape-tout. Un attrape-tout rend les echecs illisibles
// (piege paye au lot paywall).
// 🔍 UNE PRECISION EN PLUS : ici les jetons de police NON colorimetriques
// rendent `{ fontToken: <nom> }`. Sans ca, `Fonts.h4Bold` et `Fonts.p3`
// seraient le MEME objet vide, et le temoin du motif AD06 ne prouverait rien.
jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const COLOR_TOKEN = /^(primary|secondary|neutral|success|error|warning|info|gold)/;
  const colorValue = (/** @type {any} */ key) => `couleur-${String(key)}`;
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, {
        get: (/** @type {any} */ _target, /** @type {any} */ group) => {
          if (group === 'backgroundColor') {
            return new Proxy({}, {
              get: (/** @type {any} */ _t, /** @type {any} */ key) => ({
                backgroundColor: colorValue(key),
              }),
            });
          }
          return makeRamp();
        },
      }),
      Colors: new Proxy({}, {
        get: (/** @type {any} */ _target, /** @type {any} */ key) => colorValue(key),
      }),
      Fonts: new Proxy({}, {
        get: (/** @type {any} */ _target, /** @type {any} */ key) => (
          COLOR_TOKEN.test(String(key))
            ? { color: colorValue(key) }
            : { fontToken: String(key) }
        ),
      }),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

// Le `t` du mock rend le REPLI : c'est exactement ce que l'utilisateur voit
// tant que la clef n'existe pas dans fr.js. Il note au passage les clefs
// demandees — sans ce releve, une clef mal orthographiee resterait invisible
// pour toujours, puisque le repli s'afficherait quand meme.
jest.mock('react-i18next', () => {
  const askedKeys = /** @type {string[]} */ ([]);
  return {
    askedKeys,
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ key, /** @type {any} */ fallback) => {
        askedKeys.push(key);
        return typeof fallback === 'string' ? fallback : key;
      },
    }),
  };
});

// eslint-disable-next-line import/first, import/order
import { askedKeys } from 'react-i18next';

/**
 * Fabrique un poste de detection tel que l'ecran le calcule.
 * @param {any} overrides - Ce qui change d'un poste a l'autre.
 * @returns {any} Le poste.
 */
const poste = (overrides = {}) => ({
  acceptedCount: 0,
  candidatesCount: 0,
  documentId: 'slot-1',
  isComplete: false,
  pendingCount: 0,
  position: 'Avant-centre',
  quantity: 2,
  remaining: 2,
  ...overrides,
});

/** @type {any} */
let monte = null;

const demonter = () => {
  if (!monte) return;
  act(() => {
    monte.unmount();
  });
  monte = null;
};

/**
 * Monte le composant et rend sa racine d'instance.
 *
 * ⛔ Pas de diffusion de proprietes (`{...props}`) : quand `isDetection` n'est
 * pas demande, la propriete doit etre ABSENTE et non pas `false`. C'est la
 * VALEUR PAR DEFAUT du composant qu'on temoigne alors — la seule chose qui
 * protege les autres appelants.
 * @param {{ isDetection?: boolean, slots?: any[] }} params - Ce que l'ecran donne.
 * @returns {any} La racine de test.
 */
const monter = ({ isDetection, slots = [] } = {}) => {
  demonter();
  askedKeys.length = 0;
  act(() => {
    monte = renderer.create(isDetection === undefined
      ? <EventDetectionSlots slots={slots} />
      : <EventDetectionSlots isDetection={isDetection} slots={slots} />);
  });
  return monte;
};

afterEach(() => {
  demonter();
});

/**
 * Rassemble tout le texte porte par un noeud rendu et ses enfants.
 *
 * 🪤 Deux formes d'arbre cohabitent ici et elles ne rangent PAS leurs enfants au
 * meme endroit : l'arbre JSON de `toJSON()` les met sur `node.children`, l'arbre
 * d'instances de `root` les met sur `node.props.children`. Un parcours qui n'en
 * connait qu'une rend « » sur l'autre — et un temoin qui compare « » a « » est
 * vert sans rien avoir mesure.
 * @param {any} node - Le noeud rendu, JSON ou instance.
 * @returns {string} Le texte, espaces normalises.
 */
const texteDe = (node) => {
  const morceaux = /** @type {string[]} */ ([]);
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    const enfants = enfant?.props?.children !== undefined
      ? enfant.props.children
      : enfant?.children;
    if (Array.isArray(enfants)) enfants.forEach(parcourir);
    else parcourir(enfants);
  };
  parcourir(node);
  return morceaux.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Aplatit un tableau de styles React Native en un seul objet.
 * @param {any} style - Le style, tableau ou objet.
 * @returns {any} Le style aplati.
 */
const styleAplati = (style) => {
  if (Array.isArray(style)) {
    return style.reduce(
      (/** @type {any} */ acc, /** @type {any} */ part) => ({ ...acc, ...styleAplati(part) }),
      {},
    );
  }
  return style && typeof style === 'object' ? style : {};
};

/**
 * Rend le premier noeud Text dont le texte contient `extrait`.
 * @param {any} racine - La racine de test.
 * @param {string} extrait - Le morceau de texte cherche.
 * @returns {any} Le noeud trouve, ou undefined.
 */
const texteQuiContient = (racine, extrait) => racine.root
  .findAllByType(Text)
  .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(extrait))
  .pop();

describe('N1 · (a) caracterisation — ce que le composant fait AUJOURD HUI', () => {
  test('sans poste et sans `isDetection`, il ne monte RIEN (garde d origine)', () => {
    // 🔒 CE TEMOIN NE DOIT JAMAIS BOUGER. C'est lui qui garantit que l'etat vide
    // est une OPTION explicite, et que les autres appelants du composant gardent
    // exactement le comportement d'avant N1 : rien a l'ecran.
    const racine = monter({ slots: [] });

    expect(racine.toJSON()).toBeNull();
  });

  test('avec des postes, les pastilles de resume portent leurs comptes', () => {
    const racine = monter({
      slots: [
        poste({ documentId: 'slot-1', quantity: 2, remaining: 2 }),
        poste({
          documentId: 'slot-2', isComplete: true, position: 'Ailier', quantity: 3, remaining: 0,
        }),
      ],
    });
    const contenu = texteDe(racine.toJSON());

    expect(contenu).toContain('2 poste(s)');
    expect(contenu).toContain('5 place(s)');
    expect(contenu).toContain('1 ouvert(s)');
  });

  test('avec des postes, chaque poste porte son nom et son reste', () => {
    const racine = monter({ slots: [poste({ position: 'Gardien', remaining: 2 })] });
    const contenu = texteDe(racine.toJSON());

    expect(contenu).toContain('Gardien');
    expect(contenu).toContain('2 restante(s)');
  });
});

describe('N1 · (a) cible — la detection sans poste dit pourquoi', () => {
  test('`isDetection` + zero poste montre la phrase du pack, en toutes lettres', () => {
    // 🎯 LE COEUR DU LOT. Texte impose par le README du pack (l. 99), repris mot
    // pour mot : « Aucun poste recherché — la séance est ouverte à tous les
    // profils ». Le tiret du pack devient le passage a la ligne du motif AD06.
    const racine = monter({ isDetection: true, slots: [] });
    const contenu = texteDe(racine.toJSON());

    expect(contenu).toContain('Aucun poste recherché');
    expect(contenu).toContain('La séance est ouverte à tous les profils');
  });

  test('l etat vide demande SES clefs a fr.js, pas des chaines en dur', () => {
    monter({ isDetection: true, slots: [] });

    expect(askedKeys).toContain('eventDetails.detection.noSlots');
    expect(askedKeys).toContain('eventDetails.detection.noSlotsHint');
  });

  test('l etat vide suit le motif AD06 : titre h4Bold primary500, ligne p3 neutral300', () => {
    // ⛔ Pas `EmptyState` : le pack impose ce motif-la pour un etat vide de bloc.
    // Le mock de theme rend `{ fontToken }` pour les jetons de police, donc un
    // titre en `p3` ferait tomber ce temoin — c'est le but.
    const racine = monter({ isDetection: true, slots: [] });
    const titre = styleAplati(texteQuiContient(racine, 'Aucun poste recherché')?.props?.style);
    const ligne = styleAplati(
      texteQuiContient(racine, 'La séance est ouverte à tous les profils')?.props?.style,
    );

    expect(titre).toMatchObject({ color: 'couleur-primary500', fontToken: 'h4Bold' });
    expect(ligne).toMatchObject({ color: 'couleur-neutral300', fontToken: 'p3' });
  });

  test('avec des postes, `isDetection` ne fait PAS apparaitre l etat vide', () => {
    // 🪤 Le garde-fou du garde-fou : l'etat vide ne doit jamais doubler la liste.
    const racine = monter({ isDetection: true, slots: [poste()] });
    const contenu = texteDe(racine.toJSON());

    expect(contenu).not.toContain('Aucun poste recherché');
    expect(contenu).toContain('Avant-centre');
  });

  test('le titre de la liste est ACCENTUE et passe par fr.js', () => {
    // 🔤 « Postes recherches » etait ecrit en dur, sans accent (l. 106).
    const racine = monter({ isDetection: true, slots: [poste()] });

    expect(texteDe(racine.toJSON())).toContain('Postes recherchés');
    expect(askedKeys).toContain('eventDetails.detection.slotsTitle');
  });
});
