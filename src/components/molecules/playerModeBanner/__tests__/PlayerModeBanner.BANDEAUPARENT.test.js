import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerModeBanner from '../PlayerModeBanner';

// BANDEAU-PARENT (10/11/2026, D20, maquette validée par Adel, piste A) — le bandeau du parent
// devient UNE LIGNE : « Ton mode » à gauche, « Parent | Joueur » à droite (le contrôle de
// « Ton mode »,
// positions de 44 px). Un seul toucher, au même endroit dans les deux sens ; en mode joueur la
// carte se colore. Le compte Parent qui ne joue pas lit « Tu pratiques aussi un sport ? » et
// « Je pratique » sur la même ligne. Hauteur visée à 390 px : 68 px (108 et 146 avant).
// Ce qui ne change pas : le compte né Joueur n'a pas de bandeau (ACCUEIL-JOUEUR) ; pendant le
// guide, l'offre est cachée et le retour reste ; le dirigeant et l'entraîneur gardent le leur.
// ROUGE sur la base 45330da8b : le bandeau était une carte à bouton large.

let mockGuideActif = false;
jest.mock('@/context/useTour', () => ({
  useTour: () => ({
    isGuide: mockGuideActif,
    isTourActive: mockGuideActif,
    tourStatus: mockGuideActif ? 'active' : null,
  }),
}));

// BANDEAU-PARENT (10/11) : le bandeau du parent monte le contrôle de « Ton mode »
// (SegmentedControl) ; ses doublures, comme dans SegmentedControl.RESABASCULE.test.js.
jest.mock('react-native-reanimated', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {
      View: function AnimatedViewMock(/** @type {any} */ props) {
        return reactActuel.createElement(VueRN, props);
      },
    },
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

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: {},
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

/** @type {any[]} */
const montes = [];

/**
 * Monte le bandeau.
 * @param {any} props - Ce que l'accueil lui passe.
 * @returns {any} - L'arbre rendu.
 */
const monter = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <PlayerModeBanner
        accountRoleKey={props.accountRoleKey}
        canUseParentMode={props.canUseParentMode === true}
        canUsePlayerMode={props.canUsePlayerMode === true}
        displayMode={props.displayMode ?? null}
        onChange={props.onChange || jest.fn()}
        onPratiqueAussi={props.onPratiqueAussi || jest.fn()}
        prenoms={props.prenoms || []}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};

afterEach(() => {
  mockGuideActif = false;
  while (montes.length) {
    const arbre = montes.pop();
    act(() => arbre.unmount());
  }
});

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));

/**
 * Les positions touchables, une par libellé, dans l'ordre de l'écran.
 * @param {any} arbre - L'arbre rendu.
 * @returns {any[]} - Les positions.
 */
const positions = (arbre) => {
  /** @type {Map<string, any>} */
  const parLibelle = new Map();
  arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.accessibilityRole === 'radio' && typeof n.props?.onPress === 'function'
  )).forEach((/** @type {any} */ n) => {
    if (!parLibelle.has(n.props.accessibilityLabel)) parLibelle.set(n.props.accessibilityLabel, n);
  });
  return [...parLibelle.values()];
};

const position = (/** @type {any} */ arbre, /** @type {string} */ debut) => positions(arbre)
  .find((n) => String(n.props.accessibilityLabel).startsWith(debut));

const cochee = (/** @type {any} */ noeud) => noeud.props.accessibilityState?.checked === true;

const carte = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === testID && typeof n.type === 'string')[0];

const NE_PARENT_QUI_JOUE = { accountRoleKey: 'player', canUseParentMode: true, prenoms: ['Léa'] };

describe('BANDEAU-PARENT — mode parent', () => {
  it('« Ton mode » et Parent | Joueur, Parent coché ; Joueur passe en mode joueur', () => {
    const onChange = jest.fn();
    const arbre = monter({ ...NE_PARENT_QUI_JOUE, displayMode: 'parent', onChange });

    expect(textes(arbre)).toContain('TON MODE');
    expect(textes(arbre)).not.toContain('Tu joues aussi dans une équipe.');
    expect(positions(arbre).map((n) => n.props.accessibilityLabel)).toEqual([
      'Parent, 1 sur 2', 'Joueur, 2 sur 2',
    ]);
    expect(cochee(position(arbre, 'Parent'))).toBe(true);
    act(() => position(arbre, 'Joueur').props.onPress());
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('toucher la position déjà cochée ne fait rien', () => {
    const onChange = jest.fn();
    const arbre = monter({ ...NE_PARENT_QUI_JOUE, displayMode: 'parent', onChange });
    act(() => position(arbre, 'Parent').props.onPress());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('BANDEAU-PARENT — mode joueur', () => {
  it('Joueur coché, la carte colorée ; Parent revient en mode parent en un toucher', () => {
    const onChange = jest.fn();
    const arbre = monter({ ...NE_PARENT_QUI_JOUE, onChange });

    expect(cochee(position(arbre, 'Joueur'))).toBe(true);
    const fond = StyleSheet.flatten(carte(arbre, 'player-mode-active').props.style);
    expect(fond.backgroundColor).not.toBe('transparent');
    expect(textes(arbre)).not.toContain('Revenir en mode parent');
    act(() => position(arbre, 'Parent').props.onPress());
    expect(onChange).toHaveBeenCalledWith('parent');
  });

  it('le prénom ne s’écrit plus, le lecteur d’écran le lit sur « Parent »', () => {
    const arbre = monter(NE_PARENT_QUI_JOUE);
    expect(textes(arbre).join(' ')).not.toContain('Léa');
    expect(position(arbre, 'Parent').props.accessibilityLabel)
      .toBe('Parent, 1 sur 2. Léa t’attend dans le mode parent.');
  });
});

describe('BANDEAU-PARENT — plusieurs enfants', () => {
  it('trois enfants : la même ligne, « Tes enfants t’attendent » lu sur « Parent »', () => {
    const arbre = monter({ ...NE_PARENT_QUI_JOUE, prenoms: ['Léa', 'Nour', 'Sami'] });
    expect(positions(arbre)).toHaveLength(2);
    expect(position(arbre, 'Parent').props.accessibilityLabel)
      .toBe('Parent, 1 sur 2. Tes enfants t’attendent dans le mode parent.');
  });
});

describe('BANDEAU-PARENT — compte Parent qui ne joue pas', () => {
  it('« Tu pratiques aussi un sport ? » et « Je pratique » sur une ligne ; la feuille', () => {
    const onChange = jest.fn();
    const onPratiqueAussi = jest.fn();
    const arbre = monter({ accountRoleKey: 'parent', onChange, onPratiqueAussi });

    expect(textes(arbre)).toEqual(['Tu pratiques aussi un sport ?', 'Je pratique']);
    const ligne = StyleSheet.flatten(carte(arbre, 'parent-mode-home').props.style);
    expect(ligne.flexDirection).toBe('row');
    const bouton = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'player-mode-enter' && typeof n.props?.onPress === 'function'
    ))[0];
    act(() => bouton.props.onPress());
    expect(onPratiqueAussi).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('BANDEAU-PARENT — ce qui ne change pas', () => {
  it('compte né Joueur (aucune bascule parent offerte) : aucun bandeau', () => {
    const arbre = monter({ accountRoleKey: 'player', canUseParentMode: false });
    expect(arbre.toJSON()).toBeNull();
  });

  it('guide : en mode parent rien n’est proposé ; en mode joueur le retour reste', () => {
    mockGuideActif = true;
    expect(monter({ ...NE_PARENT_QUI_JOUE, displayMode: 'parent' }).toJSON()).toBeNull();
    expect(monter({ accountRoleKey: 'parent' }).toJSON()).toBeNull();
    const enJoueur = monter(NE_PARENT_QUI_JOUE);
    expect(position(enJoueur, 'Parent')).toBeDefined();
  });

  it('le dirigeant garde son bandeau (« Revenir en mode dirigeant »)', () => {
    const arbre = monter({
      accountRoleKey: 'president', canUsePlayerMode: true, displayMode: 'player',
    });
    expect(textes(arbre)).toContain('Revenir en mode dirigeant');
    expect(positions(arbre)).toHaveLength(0);
  });
});

describe('BANDEAU-PARENT — 68 px à 390 px', () => {
  // Jest ne calcule aucune mise en page : ce témoin tient la RECETTE de la hauteur (marges, liseré,
  // positions de 44 px) ; la mesure à l'écran est faite par le témoin du site (resa-bascule.spec).
  it.each([
    ['mode parent', { ...NE_PARENT_QUI_JOUE, displayMode: 'parent' }, 'parent-mode-home'],
    ['mode joueur', NE_PARENT_QUI_JOUE, 'player-mode-active'],
    ['compte Parent', { accountRoleKey: 'parent' }, 'parent-mode-home'],
  ])('%s : 11 + 44 + 11 + le liseré = 68', (_, props, testID) => {
    const arbre = monter(props);
    const style = StyleSheet.flatten(carte(arbre, testID).props.style);
    expect(style.paddingVertical).toBe(11);
    expect(style.borderWidth).toBe(1);
    expect(style.minHeight).toBe(68);
  });
});
