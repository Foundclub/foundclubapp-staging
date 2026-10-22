import {
  Platform, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { verticalScale } from '@/theme/scaling';

import SegmentedControl from '../SegmentedControl';

// RESA-BASCULE (20/10/2026, planche RB-3 validée par Adel) — la bascule « Ton mode » reprend CE
// contrôle (celui des plannings) avec DEUX ajouts, opt-in : `grand` (44 px de haut au lieu de 36)
// et `radio` (rôle « bouton radio » pour le lecteur d'écran, une position inerte pendant une
// bascule, Espace choisit sur le site). Sans eux, les ~30 écrans qui l'utilisent ne bougent pas :
// le premier bloc le FIGE (vert avant le lot), les deux suivants sont écrits ROUGES.

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

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs) }),
  };
});

const MODES = [
  { label: 'Complexe', value: 'complexe' },
  { label: 'Joueur', value: 'joueur' },
  { label: 'Parent', value: 'parent' },
];

const plateformeDOrigine = Platform.OS;
afterEach(() => {
  Platform.OS = plateformeDOrigine;
});

/**
 * Monte le contrôle.
 * @param {Record<string, any>} [props] - Les propriétés en plus.
 * @returns {any} L'arbre.
 */
const monter = (props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <SegmentedControl
        centerContent
        grand={props.grand}
        onChange={props.onChange || jest.fn()}
        options={props.options || MODES}
        radio={props.radio}
        value={props.value || 'parent'}
      />,
    );
  });
  return arbre;
};

const segments = (/** @type {any} */ arbre) => arbre.root.findAllByType(TouchableOpacity);
const style = (/** @type {any} */ noeud) => StyleSheet.flatten(noeud.props.style);
const enveloppe = (/** @type {any} */ arbre) => style(arbre.root.findAllByType(View)[0]);
const ecouteursDuClavier = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props.onKeyDown === 'function' && typeof n.type !== 'string',
);

describe('RESA-BASCULE — sans les ajouts, rien ne bouge (figé avant le lot)', () => {
  it('aucun rôle ni état accessible sur les segments', () => {
    segments(monter()).forEach((segment) => {
      expect(segment.props.accessibilityRole).toBeUndefined();
      expect(segment.props.accessibilityState).toBeUndefined();
      expect(segment.props.disabled).toBeUndefined();
    });
  });

  it('les hauteurs d origine : 32 (téléphone) / 36 (site), enveloppe 45 / 52', () => {
    Platform.OS = 'ios';
    const telephone = monter();
    segments(telephone).forEach((s) => expect(style(s).minHeight).toBe(verticalScale(32)));
    expect(enveloppe(telephone).minHeight).toBe(verticalScale(45));

    Platform.OS = 'web';
    const site = monter();
    segments(site).forEach((s) => expect(style(s).minHeight).toBe(36));
    expect(enveloppe(site).minHeight).toBe(52);
  });

  it('la touche Espace n est écoutée nulle part', () => {
    Platform.OS = 'web';
    expect(ecouteursDuClavier(monter())).toHaveLength(0);
  });
});

describe('RESA-BASCULE — ajout 1 : `grand`, 44 px de haut', () => {
  it('position, rangée et enveloppe font 44 px, sur téléphone comme sur le site', () => {
    ['ios', 'android', 'web'].forEach((plateforme) => {
      Platform.OS = /** @type {any} */ (plateforme);
      const arbre = monter({ grand: true });
      segments(arbre).forEach((s) => expect(style(s).minHeight).toBe(44));
      expect(enveloppe(arbre).minHeight).toBe(44);
    });
  });
});

describe('RESA-BASCULE — ajout 2 : `radio`, le rôle « bouton radio »', () => {
  it('chaque position est un bouton radio ; la choisie est cochée ET sélectionnée', () => {
    const arbre = monter({ radio: true, value: 'parent' });
    expect(segments(arbre).map((s) => s.props.accessibilityRole))
      .toEqual(['radio', 'radio', 'radio']);
    expect(segments(arbre).map((s) => s.props.accessibilityState)).toEqual([
      { checked: false, disabled: false, selected: false },
      { checked: false, disabled: false, selected: false },
      { checked: true, disabled: false, selected: true },
    ]);
  });

  it('une position inerte (pendant une bascule) : grisée à 50 %, désactivée', () => {
    const arbre = monter({
      options: MODES.map((m) => ({ ...m, disabled: m.value !== 'complexe' })),
      radio: true,
      value: 'complexe',
    });
    const [complexe, joueur] = segments(arbre);
    expect(joueur.props.disabled).toBe(true);
    expect(joueur.props.accessibilityState.disabled).toBe(true);
    expect(style(joueur).opacity).toBe(0.5);
    expect(complexe.props.disabled).toBe(false);
    expect(style(complexe).opacity).toBeUndefined();
  });

  it('site : Espace choisit la position visée (Entrée, react-native-web le fait déjà)', () => {
    Platform.OS = 'web';
    const onChange = jest.fn();
    const arbre = monter({ onChange, radio: true, value: 'complexe' });
    const [groupe] = ecouteursDuClavier(arbre);
    const joueur = segments(arbre)[1];
    const preventDefault = jest.fn();
    act(() => {
      groupe.props.onKeyDown({
        key: ' ', preventDefault, target: { id: joueur.props.nativeID },
      });
    });
    expect(onChange).toHaveBeenCalledWith('joueur');
    expect(preventDefault).toHaveBeenCalled();

    onChange.mockClear();
    act(() => {
      groupe.props.onKeyDown({
        key: 'a', preventDefault, target: { id: joueur.props.nativeID },
      });
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('site : Espace sur une position inerte ne remonte rien', () => {
    Platform.OS = 'web';
    const onChange = jest.fn();
    const arbre = monter({
      onChange,
      options: MODES.map((m) => ({ ...m, disabled: m.value === 'joueur' })),
      radio: true,
      value: 'complexe',
    });
    const [groupe] = ecouteursDuClavier(arbre);
    act(() => {
      groupe.props.onKeyDown({
        key: ' ', preventDefault: jest.fn(), target: { id: segments(arbre)[1].props.nativeID },
      });
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
