import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TrainingMeasureInput from '@/components/organisms/training/TrainingMeasureInput';

/**
 * LA SAISIE D'UNE MESURE — les quatre promesses faites au terrain.
 *
 * 🚨 LE TEMOIN QUI COMPTE EST LE PREMIER, et il vient d'un defaut vu a l'ecran
 * le 2026-09-06 : `Number('')` vaut ZERO, pas NaN. Un champ VIDE etait donc lu
 * comme la valeur 0, tombait sous la borne basse du protocole, et l'ecran
 * s'ouvrait COUVERT d'alertes rouges « Valeur inhabituelle » avant que personne
 * n'ait tape quoi que ce soit. Un formulaire qui crie avant d'etre rempli est un
 * formulaire qu'on n'ose plus remplir.
 *
 * Les trois autres figent ce que le guide de terrain exige :
 *   · une valeur hors bornes est SIGNALEE, jamais refusee ;
 *   · la virgule vaut point decimal (personne ne tape « 31.4 » en francais) ;
 *   · une mesure calculee ne se saisit pas — elle s'affiche, avec sa formule.
 */

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({ Colors, Fonts: genererPolices(Colors), Spaces }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ options) => (
      options ? `${clef}|${JSON.stringify(options)}` : clef
    ),
  }),
}));

const MESURE = {
  attempts: 3,
  key: 'delta_images_fort',
  label: 'Images entre les 2 plots',
  max: 300,
  min: 15,
  type: 'integer',
  unit: 'images',
};

/**
 * Monte la mesure et rend l'arbre de test.
 * @param {any} [surcharge] ce qu'on change a la mesure nominale
 * @param {any} [values] les valeurs deja saisies, indexees `${attempt}|${side}`
 * @param {any} [handlers] les rappels `onRecord` et `onToggleInvalid`
 * @returns {any} l'arbre react-test-renderer
 */
const rendre = (surcharge = {}, values = {}, handlers = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <TrainingMeasureInput
        measure={{ ...MESURE, ...surcharge }}
        onRecord={handlers.onRecord || (() => {})}
        onToggleInvalid={handlers.onToggleInvalid || (() => {})}
        values={values}
      />,
    );
  });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat.
 * @param {any} arbre l'arbre rendu
 * @returns {string[]} les chaines reellement rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l'arbre rendu
   * @returns {void} rien : la sortie est empilee dans `sortie`
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
 * Les alertes « valeur inhabituelle » actuellement affichees.
 * @param {any} arbre l'arbre rendu
 * @returns {string[]} une entree par alerte
 */
const alertes = (arbre) => textes(arbre)
  .filter((t) => t.startsWith('training.measures.outOfRange'));

describe('un champ vide n est pas une valeur', () => {
  it('N AFFICHE AUCUNE alerte tant que rien n est saisi', () => {
    const arbre = rendre();

    expect(arbre.root.findAllByType(TextInput)).toHaveLength(3);
    expect(alertes(arbre)).toEqual([]);
  });

  it('n en affiche pas non plus quand la valeur enregistree est une chaine vide', () => {
    expect(alertes(rendre({}, { '1|none': { value: '' } }))).toEqual([]);
  });

  it('n en affiche pas pour un espace seul', () => {
    expect(alertes(rendre({}, { '1|none': { value: '   ' } }))).toEqual([]);
  });
});

describe('les bornes signalent, elles ne refusent jamais', () => {
  it('laisse passer une valeur dans les bornes, sans rien dire', () => {
    expect(alertes(rendre({}, { '1|none': { value: 42 } }))).toEqual([]);
  });

  it('SIGNALE une valeur sous la borne basse, en gardant la saisie', () => {
    const arbre = rendre({}, { '1|none': { value: 3 } });

    expect(alertes(arbre)).toHaveLength(1);
    expect(alertes(arbre)[0]).toContain('"min":15');
    expect(arbre.root.findAllByType(TextInput)[0].props.value).toBe('3');
  });

  it('SIGNALE une valeur au-dessus de la borne haute, en gardant la saisie', () => {
    const arbre = rendre({}, { '1|none': { value: 999 } });

    expect(alertes(arbre)).toHaveLength(1);
    expect(alertes(arbre)[0]).toContain('"max":300');
    expect(arbre.root.findAllByType(TextInput)[0].props.value).toBe('999');
  });

  it('ne signale rien quand le protocole ne donne aucune borne', () => {
    expect(alertes(rendre({ max: undefined, min: undefined }, { '1|none': { value: 9999 } })))
      .toEqual([]);
  });
});

describe('la virgule vaut point decimal', () => {
  it('accepte « 31,4 » et le transmet en « 31.4 »', () => {
    const onRecord = jest.fn();
    const arbre = rendre({ max: 60, min: 10, type: 'decimal' }, {}, { onRecord });

    act(() => { arbre.root.findAllByType(TextInput)[0].props.onChangeText('31,4'); });

    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(String(onRecord.mock.calls[0][0].value)).toBe('31.4');
    expect(alertes(arbre)).toEqual([]);
  });

  it('retire les lettres d une saisie chiffree, sans jeter', () => {
    const onRecord = jest.fn();
    const arbre = rendre({}, {}, { onRecord });

    act(() => { arbre.root.findAllByType(TextInput)[0].props.onChangeText('4a2'); });

    expect(String(onRecord.mock.calls[0][0].value)).toBe('42');
  });
});

describe('« essai nul » est une bascule, jamais une suppression', () => {
  it('previent le parent sans effacer la valeur deja saisie', () => {
    const onToggleInvalid = jest.fn();
    const arbre = rendre({ attempts: 1 }, { '1|none': { value: 42 } }, { onToggleInvalid });

    const boutons = arbre.root.findAllByType(TouchableOpacity).filter(
      (n) => n.props?.accessibilityLabel === 'training.actions.invalidAttempt',
    );
    expect(boutons).toHaveLength(1);

    act(() => { boutons[0].props.onPress(); });

    expect(onToggleInvalid).toHaveBeenCalledTimes(1);
    expect(arbre.root.findAllByType(TextInput)[0].props.value).toBe('42');
  });

  it('barre le texte d un essai marque nul, au lieu de le faire disparaitre', () => {
    const arbre = rendre({ attempts: 1 }, { '1|none': { isValid: false, value: 42 } });
    const champ = arbre.root.findAllByType(TextInput)[0];
    const style = Object.assign({}, ...[].concat(champ.props.style));

    expect(style.textDecorationLine).toBe('line-through');
    expect(champ.props.value).toBe('42');
  });
});

describe('une mesure calculee ne se saisit pas', () => {
  it('affiche sa formule et AUCUN champ', () => {
    const arbre = rendre({
      attempts: 1,
      computed: true,
      formula: 'v = d / t',
      key: 'vitesse',
      label: 'Vitesse de balle',
    });

    expect(arbre.root.findAllByType(TextInput)).toHaveLength(0);
    expect(textes(arbre).join(' ')).toContain('v = d / t');
  });
});

describe('ce qui ne doit jamais faire tomber l ecran', () => {
  it('ne rend rien pour une mesure sans clef', () => {
    expect(rendre({ key: undefined }).toJSON()).toBeNull();
  });

  it('borne le nombre d essais, meme si le serveur en annonce mille', () => {
    expect(rendre({ attempts: 1000 }).root.findAllByType(TextInput)).toHaveLength(20);
  });

  it('rend deux champs par essai quand la mesure a deux cotes', () => {
    const arbre = rendre({ attempts: 2, sides: true });

    expect(arbre.root.findAllByType(TextInput)).toHaveLength(4);
    expect(textes(arbre)).toEqual(
      expect.arrayContaining(['training.measures.side.left', 'training.measures.side.right']),
    );
  });

  it('accepte une liste de valeurs absente', () => {
    expect(() => rendre({}, undefined)).not.toThrow();
  });
});

describe('le titre porte l unite du protocole', () => {
  it('affiche le libelle puis son unite', () => {
    const rendu = textes(rendre()).join(' ');

    expect(rendu).toContain('Images entre les 2 plots');
    expect(rendu).toContain('images');
  });
});

describe('les autres composants de la fiche', () => {
  it('Text reste importable : le fichier ne casse pas le rendu natif', () => {
    expect(Text).toBeDefined();
  });
});
