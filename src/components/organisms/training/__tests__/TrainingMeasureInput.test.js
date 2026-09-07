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

/**
 * 🚨 LE DEFAUT LE PLUS CHER DE LA SECTION, MESURE LE 2026-09-07.
 *
 * Les branches `boolean` et `choice` ecrivaient `attempt: 1` EN DUR et relisaient
 * `saved['1|none']`. Sur la frappe de puissance, le joueur tire 12 fois, appuie
 * 12 fois sur « quel coin as-tu touche ? », et le carnet ne gardait QUE la
 * douziemme — ecrasee sur la ligne de la premiere. Aucun message, rien a l'ecran.
 *
 * Mesure sur le programme reel : 230 cases a pastilles ou Oui/Non, dont 110
 * PERDUES, reparties sur 22 mesures — presque toutes sur le Jour T, la journee
 * qui ouvre le programme.
 *
 * La branche des champs a taper, elle, depliait deja correctement `rows`
 * (essais x cotes). Ces temoins figent le fait que les TROIS branches se
 * comportent pareil.
 */
describe('une mesure a pastilles garde CHAQUE essai', () => {
  const CHOIX = {
    attempts: 3,
    choices: ['gauche', 'droite'],
    key: 'coin_touche_fort',
    label: 'Coin touche',
    type: 'choice',
  };

  it('rend UN groupe de pastilles PAR ESSAI, pas un seul pour tous', () => {
    const arbre = rendre(CHOIX);

    // 3 essais x 2 choix = 6 pastilles, et non 2.
    expect(arbre.root.findAllByType(TouchableOpacity)).toHaveLength(6);
  });

  it('numerote les essais a l ecran, comme le font les champs a taper', () => {
    expect(textes(rendre(CHOIX)).filter((t) => t.startsWith('training.measures.attempt')))
      .toHaveLength(3);
  });

  it('ENREGISTRE L ESSAI SUR LEQUEL ON APPUIE, et non toujours le premier', () => {
    const onRecord = jest.fn();
    const arbre = rendre(CHOIX, {}, { onRecord });

    // La 3e pastille est le premier choix du 2e essai (2 choix par essai).
    act(() => { arbre.root.findAllByType(TouchableOpacity)[2].props.onPress(); });

    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 2, measureKey: 'coin_touche_fort', side: 'none', textValue: 'gauche',
    }));
  });

  it('deplie les deux cotes quand la mesure en a, comme les champs a taper', () => {
    const arbre = rendre({ ...CHOIX, attempts: 2, sides: true });

    // 2 essais x 2 cotes x 2 choix = 8 pastilles.
    expect(arbre.root.findAllByType(TouchableOpacity)).toHaveLength(8);
  });

  it('n allume que la pastille de SON essai, jamais celle du premier', () => {
    const arbre = rendre(CHOIX, { '2|none': { textValue: 'droite' } });
    const allumees = arbre.root.findAllByType(TouchableOpacity)
      .map((n, i) => [i, n.props.style.borderWidth === 1 && n.props.style.backgroundColor !== 'transparent'])
      .filter(([, active]) => active)
      .map(([i]) => i);

    // Seule la 4e pastille (2e essai, 2e choix) doit etre allumee.
    expect(allumees).toEqual([3]);
  });
});

describe('une mesure Oui/Non garde CHAQUE essai', () => {
  const BOOLEEN = {
    attempts: 4,
    key: 'dans_le_cadre',
    label: 'Dans le cadre',
    type: 'boolean',
  };

  it('rend une paire Oui/Non PAR ESSAI', () => {
    expect(rendre(BOOLEEN).root.findAllByType(TouchableOpacity)).toHaveLength(8);
  });

  it('ENREGISTRE L ESSAI SUR LEQUEL ON APPUIE', () => {
    const onRecord = jest.fn();
    const arbre = rendre(BOOLEEN, {}, { onRecord });

    // La 8e pastille est le « Non » du 4e essai.
    act(() => { arbre.root.findAllByType(TouchableOpacity)[7].props.onPress(); });

    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({
      attempt: 4, side: 'none', textValue: 'non',
    }));
  });
});
