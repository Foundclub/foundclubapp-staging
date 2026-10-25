import { createElement } from 'react';
import { Platform, ScrollView, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import DateTimeSelector, { WheelPicker } from '../DateTimeSelector';

// C04 (BUGHUNT phase 2, 25/10) — la roue de date : témoin caractérisant (le fichier n'en avait
// aucun), puis Q1-02 (fin de mois qui déborde), Q1-10 (année passée absente de la roue) et Q1-06
// (sur le site, la molette ne déclenche jamais `onMomentumScrollEnd`).

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ _cle, /** @type {string} */ repli) => repli }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs), Spaces: espaces }),
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  const { createElement: ce } = jest.requireActual('react');
  return function BottomModalMock(/** @type {any} */ props) {
    return props.isVisible ? ce(View, { testID: 'feuille' }, props.children) : null;
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const { TouchableOpacity: Bouton } = jest.requireActual('react-native');
  const { createElement: ce } = jest.requireActual('react');
  return function ButtonMock(/** @type {any} */ props) {
    return ce(Bouton, { accessibilityLabel: props.title, onPress: props.onPress });
  };
});

/** @type {any[]} */
const arbres = [];
afterEach(() => {
  act(() => { arbres.splice(0).forEach((arbre) => arbre.unmount()); });
});

const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(createElement(DateTimeSelector, props)); });
  arbres.push(arbre);
  return arbre;
};
const roues = (/** @type {any} */ arbre) => arbre.root.findAllByType(WheelPicker);
const ouvrir = (/** @type {any} */ arbre) => {
  act(() => { arbre.root.findAllByType(TouchableOpacity)[0].props.onPress(); });
};
const tourner = (/** @type {any} */ arbre, /** @type {number} */ rang, /** @type {number} */ v) => {
  act(() => { roues(arbre)[rang].props.onValueChange(v); });
};
const confirmer = (/** @type {any} */ arbre) => {
  act(() => {
    arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Confirmer'
      && typeof n.props.onPress === 'function')[0].props.onPress();
  });
};
const jma = (/** @type {Date} */ d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

describe('DateTimeSelector — comportement actuel (caractérisation)', () => {
  test('feuille : jour, mois, année puis « Confirmer » renvoie la date choisie', () => {
    const onChange = jest.fn();
    const annee = new Date().getFullYear() + 1;
    const arbre = monter({ onChange, value: new Date(annee, 4, 10) });
    ouvrir(arbre);

    tourner(arbre, 0, 12);
    tourner(arbre, 1, 5);
    tourner(arbre, 2, annee + 1);
    expect(onChange).not.toHaveBeenCalled();
    confirmer(arbre);

    expect(jma(onChange.mock.calls[0][0])).toBe(`12/6/${annee + 1}`);
  });

  test('affichage intégré : chaque roue écrit tout de suite', () => {
    const onChange = jest.fn();
    const annee = new Date().getFullYear() + 1;
    const arbre = monter({ display: 'inline', onChange, value: new Date(annee, 4, 10) });
    ouvrir(arbre);

    tourner(arbre, 1, 7);

    expect(jma(onChange.mock.calls[0][0])).toBe(`10/8/${annee}`);
  });
});

describe('🔴 C04 Q1-02 — changer de mois ou d année ne déborde pas sur le mois suivant', () => {
  test('31 janvier puis février donne le 28 février (feuille)', () => {
    const onChange = jest.fn();
    const annee = new Date().getFullYear() + 1;
    const nonBissextile = [annee, annee + 1, annee + 2, annee + 3]
      .find((a) => new Date(a, 1, 29).getMonth() !== 1);
    const arbre = monter({ onChange, value: new Date(nonBissextile, 0, 31) });
    ouvrir(arbre);

    tourner(arbre, 1, 1);
    confirmer(arbre);

    expect(jma(onChange.mock.calls[0][0])).toBe(`28/2/${nonBissextile}`);
  });

  test('29 février d une année bissextile, puis l année suivante : 28 février (intégré)', () => {
    const onChange = jest.fn();
    const courante = new Date().getFullYear();
    const bissextile = [0, 1, 2, 3].map((d) => courante + d)
      .find((a) => new Date(a, 1, 29).getMonth() === 1);
    const arbre = monter({ display: 'inline', onChange, value: new Date(bissextile, 1, 29) });
    ouvrir(arbre);

    tourner(arbre, 2, bissextile + 1);

    expect(jma(onChange.mock.calls[0][0])).toBe(`28/2/${bissextile + 1}`);
  });
});

describe('🔴 C04 Q1-10 — une date d une année passée reste visible et choisissable', () => {
  test('la roue des années commence à l année de la date ouverte', () => {
    const courante = new Date().getFullYear();
    const arbre = monter({ onChange: jest.fn(), value: new Date(courante - 1, 8, 1) });
    ouvrir(arbre);

    const annees = roues(arbre)[2].props.data;
    expect(annees[0]).toBe(courante - 1);
    expect(annees).toContain(courante + 4);
  });
});

describe('🔴 C04 Q1-06 — sur le site, la molette enregistre la valeur au centre', () => {
  const osDOrigine = Platform.OS;
  beforeEach(() => {
    jest.useFakeTimers();
    Platform.OS = 'web';
  });
  afterEach(() => {
    jest.useRealTimers();
    Platform.OS = osDOrigine;
  });

  test('un défilement sans élan (molette) choisit la valeur où la roue s arrête', () => {
    const onValueChange = jest.fn();
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(WheelPicker, {
        data: [0, 1, 2, 3, 4, 5], isOpen: true, onValueChange, selectedValue: 0,
      }));
    });
    arbres.push(arbre);
    const roue = arbre.root.findByType(ScrollView);

    act(() => {
      roue.props.onScroll?.({ nativeEvent: { contentOffset: { y: 100 } } });
      roue.props.onScroll?.({ nativeEvent: { contentOffset: { y: 150 } } });
      jest.advanceTimersByTime(400);
    });

    expect(onValueChange.mock.calls).toEqual([[3]]);
  });
});
