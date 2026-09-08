import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import TrainingEnrolled from '../TrainingEnrolled';

/**
 * « C EST DANS TON ENTRAINEMENT » — la confirmation d inscription.
 *
 * 🔎 POURQUOI CET ECRAN EXISTE. Le bouton de la fiche inscrivait DIRECTEMENT et
 * filait au planning : la personne se retrouvait devant une liste de huit
 * journees sans jamais avoir lu a quoi elle venait de s engager, ni ce qu elle
 * doit preparer avant la premiere.
 *
 * 🔎 CE QUE CE FILET PROTEGE :
 *   1. le recapitulatif dit le programme, le nombre de seances, le debut et la fin ;
 *   2. les trois choses a preparer sont la — sans partenaire ni trepied, le Jour T
 *      ne se mesure pas ;
 *   3. les DEUX boutons REMPLACENT la fleche de retour : l inscription est faite,
 *      il n y a rien a annuler ici ;
 *   4. l ecran tient debout meme sans parametres.
 */

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyle(Colors),
      Colors,
      Fonts: genererPolices(Colors),
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

jest.mock('react-native-linear-gradient', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(VueRN, props),
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

const PARAMS = {
  endDate: '2026-09-19',
  firstSession: 'Jour T — Technique et calibrations',
  programTitle: 'Football haut niveau',
  sessionsCount: 8,
  startDate: '2026-09-07',
};

/**
 * Monte l ecran et rend l arbre de test.
 * @param {any} [params] les parametres de la route
 * @param {any} [navigation] la navigation moquee
 * @returns {any} l arbre react-test-renderer
 */
const rendre = (params = PARAMS, navigation = { navigate: () => {} }) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TrainingEnrolled navigation={navigation} route={{ params }} />);
  });
  return arbre;
};

/**
 * Tout le texte affiche par un arbre, mis a plat.
 * @param {any} arbre l arbre rendu
 * @returns {string[]} les chaines reellement rendues
 */
const textes = (arbre) => {
  /** @type {string[]} */
  const sortie = [];
  /**
   * Descend dans un noeud rendu et empile chaque chaine rencontree.
   * @param {any} noeud un noeud de l arbre rendu
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

describe('l ecran dit CE QU ON VIENT DE S ENGAGER A FAIRE', () => {
  it('annonce le programme, le nombre de seances, le debut et la fin', () => {
    const recap = textes(rendre()).find((v) => String(v).startsWith('training.enrolled.recap'));

    expect(recap).toContain('"program":"Football haut niveau"');
    expect(recap).toContain('"count":8');
    expect(recap).toContain('"start":"lun. 7 sept."');
    expect(recap).toContain('"end":"sam. 19 sept."');
  });

  it('nomme la premiere seance : on sait par quoi ca commence', () => {
    expect(textes(rendre()).some((v) => String(v).includes('Jour T — Technique et calibrations')))
      .toBe(true);
  });

  it('se tait sur la premiere seance quand elle n est pas connue', () => {
    const vus = textes(rendre({ ...PARAMS, firstSession: null }));

    expect(vus.some((v) => String(v).startsWith('training.enrolled.firstSession'))).toBe(false);
  });
});

describe('ce qu il faut trouver AVANT la premiere seance', () => {
  it('donne les TROIS choses, jamais une de moins', () => {
    const vus = textes(rendre());

    expect(vus).toContain('training.enrolled.before.title');
    expect(vus).toContain('training.enrolled.before.partner');
    expect(vus).toContain('training.enrolled.before.phone');
    expect(vus).toContain('training.enrolled.before.tripod');
  });
});

describe('les deux boutons REMPLACENT la fleche de retour', () => {
  it('il y en a exactement deux, et pas un de plus', () => {
    expect(rendre().root.findAllByType(Button)).toHaveLength(2);
  });

  it('le principal mene a la liste des seances, pas a la premiere journee', () => {
    // ⚠️ Correction du premier jugement : le dessin ramene a la LISTE, pas a la
    // journee elle-meme. On vient de planifier huit rendez-vous, on veut les voir.
    const navigate = jest.fn();
    const arbre = rendre(PARAMS, { navigate });

    act(() => {
      arbre.root.findAllByProps({ title: 'training.enrolled.seeSessions' })
        .find((n) => typeof n.props.onPress === 'function').props.onPress();
    });

    expect(navigate).toHaveBeenCalledWith('TrainingSessions');
  });

  it('le discret ramene a l accueil', () => {
    const navigate = jest.fn();
    const arbre = rendre(PARAMS, { navigate });

    act(() => {
      arbre.root.findAllByProps({ title: 'training.enrolled.later' })
        .find((n) => typeof n.props.onPress === 'function').props.onPress();
    });

    expect(navigate).toHaveBeenCalledWith('SearchHome');
  });
});

describe('ce qui ne doit jamais faire tomber l ecran', () => {
  it('tient debout sans aucun parametre de route', () => {
    expect(() => rendre(undefined)).not.toThrow();
  });

  it('n affiche jamais « undefined » quand une donnee manque', () => {
    expect(textes(rendre({}))).not.toContain('undefined');
  });
});
