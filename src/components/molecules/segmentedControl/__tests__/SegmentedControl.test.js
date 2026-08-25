import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SegmentedControl from '../SegmentedControl';

// D63 (E6) : ce composant est partage par 15 ecrans et n'avait AUCUN test,
// alors qu'il porte la regle la plus visible du pack « Gerer mon club » :
// « Libelles complets, jamais tronques — ellipsis seulement sur des donnees
// longues, jamais sur des libelles systeme. »
//
// Le defaut mesure le 2026-08-10 sur l'ecran « Nouvelle installation » :
// « Demande a valider » s'affichait « Demande a valid... ». La cause n'est PAS
// dans l'ecran, elle est ici — `numberOfLines={1}` sur le libelle du segment,
// combine a `flex: 1` quand les segments partagent la largeur.
//
// ATTENTION AU PIEGE DE MESURE : en React Native, le texte reste TOUJOURS
// complet dans l'arbre rendu ; c'est la couche native qui coupe, d'apres
// `numberOfLines`. Un test qui lit le texte affiche ne peut donc PAS voir une
// troncature. Le seul temoin fiable est la prop elle-meme.

jest.mock('react-native-reanimated', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  const Anime = {
    View: function AnimatedViewMock(/** @type {any} */ props) {
      return reactActuel.createElement(VueRN, props);
    },
  };

  return {
    __esModule: true,
    default: Anime,
    useAnimatedStyle: (/** @type {any} */ fabrique) => fabrique(),
    useSharedValue: (/** @type {any} */ valeur) => ({ value: valeur }),
  };
});

jest.mock('react-native-gesture-handler', () => {
  const reactActuel = jest.requireActual('react');
  const { ScrollView: DefilementRN, View: VueRN } = jest.requireActual('react-native');

  const enchainable = () => {
    /** @type {any} */
    const geste = {};
    ['activeOffsetX', 'failOffsetY', 'onStart', 'onUpdate', 'onEnd'].forEach((nom) => {
      geste[nom] = () => geste;
    });
    return geste;
  };

  return {
    Gesture: { Pan: enchainable },
    GestureDetector: function GestureDetectorMock(/** @type {any} */ { children }) {
      return reactActuel.createElement(VueRN, null, children);
    },
    ScrollView: DefilementRN,
  };
});

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
    }),
  };
});

// Les deux libelles du pack, ceux-la memes qui etaient coupes a l'ecran.
const MODES_DE_CONFLIT = [
  { label: 'Demande à valider', value: 'pending_validation' },
  { label: 'Autoriser et notifier', value: 'allow_and_notify' },
];

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Monte le controle segmente.
 * @param {any} [props]
 * @returns {any}
 */
const monter = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <SegmentedControl
        centerContent={Boolean(props.centerContent)}
        fitLabels={Boolean(props.fitLabels)}
        fullLabels={Boolean(props.fullLabels)}
        onChange={props.onChange || jest.fn()}
        options={props.options || MODES_DE_CONFLIT}
        value={props.value || MODES_DE_CONFLIT[0].value}
      />,
    );
  });
  return arbre;
};

/**
 * Les noeuds Text qui portent un libelle de segment.
 * @param {any} arbre
 * @returns {any[]}
 */
const libellesRendus = (arbre) => arbre.root
  .findAllByType(Text)
  .filter((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children).trim() !== '');

describe('SegmentedControl — ce que le controle fait (fige avant D63)', () => {
  it('rend un element pressable par option, portant son libelle', () => {
    const arbre = monter();

    const pressables = arbre.root.findAllByType(TouchableOpacity);

    expect(pressables).toHaveLength(2);
    expect(aplatirTexte(pressables[0].props.children)).toContain('Demande à valider');
    expect(aplatirTexte(pressables[1].props.children)).toContain('Autoriser et notifier');
  });

  it('appuyer sur un segment remonte SA valeur, pas son libelle', () => {
    const onChange = jest.fn();
    const arbre = monter({ onChange });

    act(() => {
      arbre.root.findAllByType(TouchableOpacity)[1].props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith('allow_and_notify');
  });

  it('les libelles sont rendus en entier dans l arbre, quelle que soit la mise en page', () => {
    // Contre-epreuve du piege de mesure decrit en tete : ce test passe AUSSI
    // quand l'ecran tronque. Il est ici pour le dire, pas pour le prouver.
    const texte = libellesRendus(monter({ centerContent: true }))
      .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
      .join(' ');

    expect(texte).toContain('Demande à valider');
    expect(texte).toContain('Autoriser et notifier');
  });

  it('par defaut, un libelle trop long est coupe a une seule ligne', () => {
    // Comportement HISTORIQUE, conserve pour les 15 ecrans qui affichent des
    // onglets courts : une deuxieme ligne y changerait la hauteur du bandeau.
    const lignesParLibelle = libellesRendus(monter())
      .map((/** @type {any} */ noeud) => noeud.props.numberOfLines);

    expect(lignesParLibelle).toEqual([1, 1]);
  });
});

describe('SegmentedControl — D63 : un libelle systeme ne se tronque jamais', () => {
  it('avec fullLabels, aucun libelle n est coupe a une ligne', () => {
    const lignesParLibelle = libellesRendus(monter({ centerContent: true, fullLabels: true }))
      .map((/** @type {any} */ noeud) => noeud.props.numberOfLines);

    expect(lignesParLibelle).toEqual([2, 2]);
    expect(lignesParLibelle).not.toContain(1);
  });

  it('avec fullLabels, le libelle ne se retrecit plus pour tenir sur la ligne', () => {
    // `flexShrink: 1` laissait le texte se comprimer jusqu'a l'ellipse. Sur deux
    // lignes il doit occuper la place dont il a besoin, pas celle qui reste.
    const styles = libellesRendus(monter({ centerContent: true, fullLabels: true }))
      .map((/** @type {any} */ noeud) => noeud.props.style)
      .map((/** @type {any} */ style) => (Array.isArray(style) ? Object.assign({}, ...style
        .filter(Boolean)) : style));

    styles.forEach((/** @type {any} */ style) => {
      expect(style.flexShrink).not.toBe(1);
    });
  });

  it('fullLabels ne change rien aux valeurs remontees', () => {
    const onChange = jest.fn();
    const arbre = monter({ centerContent: true, fullLabels: true, onChange });

    act(() => {
      arbre.root.findAllByType(TouchableOpacity)[0].props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith('pending_validation');
  });
});

// 🔠 S5 (vague S) — UN TROISIEME MODE : UNE LIGNE, MAIS LE TEXTE RETRECIT.
//
// 🗣️ Recette 2.6.27 (25/08) : « les libelles d onglet doivent tenir sur UNE
// SEULE ligne ». Avec `fullLabels` (D63), « Participants » et « Convocation »
// se cassaient sur leur DERNIERE lettre — un « s » et un « n » tout seuls sous
// le mot. C est pire que la troncature : ca ressemble a un bug d affichage.
//
// ⛔ CE QUI N ETAIT PAS UNE OPTION : corriger `fullLabels` en place. Sa
// semantique (deux lignes, jamais coupe) est celle dont FacilityForm depend, et
// sa hauteur y est RESERVEE pour deux lignes. Le ramener a une ligne y
// reintroduirait la troncature que D63 avait supprimee. Les deux besoins sont
// reels et opposes ⇒ deux props. Les temoins D63 ci-dessus restent INTACTS :
// ce sont eux qui protegent FacilityForm de ce lot.
describe('SegmentedControl — S5 : le mode UNE LIGNE qui retrecit au lieu de couper', () => {
  it('avec fitLabels, chaque libelle tient sur UNE seule ligne', () => {
    const lignesParLibelle = libellesRendus(monter({ centerContent: true, fitLabels: true }))
      .map((/** @type {any} */ noeud) => noeud.props.numberOfLines);

    expect(lignesParLibelle).toEqual([1, 1]);
  });

  it('avec fitLabels, le texte RETRECIT pour tenir — il ne s ampute pas', () => {
    // 🎯 LE COEUR DU MODE. Sans `adjustsFontSizeToFit`, `numberOfLines={1}` se
    // contente de couper : on serait revenu au defaut historique, et le « s »
    // de Participants aurait disparu au lieu de passer a la ligne. Le plancher
    // dit jusqu ou on accepte de reduire.
    const noeuds = libellesRendus(monter({ centerContent: true, fitLabels: true }));

    noeuds.forEach((/** @type {any} */ noeud) => {
      expect(noeud.props.adjustsFontSizeToFit).toBe(true);
      expect(noeud.props.minimumFontScale).toBe(0.72);
    });
  });

  it('🔒 sans fitLabels, aucun libelle ne retrecit : les autres ecrans ne bougent pas', () => {
    // La contre-epreuve qui garde les 15 ecrans a onglets courts hors de ce lot.
    const noeuds = libellesRendus(monter());

    noeuds.forEach((/** @type {any} */ noeud) => {
      expect(noeud.props.adjustsFontSizeToFit).toBe(false);
      expect(noeud.props.minimumFontScale).toBeUndefined();
    });
  });

  it('🔒 fitLabels PRIME sur fullLabels quand les deux arrivent', () => {
    // Un futur appelant qui passerait les deux ne doit pas tomber sur un rendu
    // indefini — ce genre d indefini se decouvre a la recette, pas en CI.
    const noeuds = libellesRendus(monter({
      centerContent: true,
      fitLabels: true,
      fullLabels: true,
    }));

    expect(noeuds.map((/** @type {any} */ noeud) => noeud.props.numberOfLines)).toEqual([1, 1]);
    noeuds.forEach((/** @type {any} */ noeud) => {
      expect(noeud.props.adjustsFontSizeToFit).toBe(true);
    });
  });

  it('fitLabels ne change rien aux valeurs remontees', () => {
    const onChange = jest.fn();
    const arbre = monter({ centerContent: true, fitLabels: true, onChange });

    act(() => {
      arbre.root.findAllByType(TouchableOpacity)[1].props.onPress();
    });

    expect(onChange).toHaveBeenCalledWith('allow_and_notify');
  });
});
