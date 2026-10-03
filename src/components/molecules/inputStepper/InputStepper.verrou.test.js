/* eslint-disable max-len -- les intitulés des témoins se lisent en entier. */
import { createElement } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import InputStepper from './InputStepper';

// FINITIONS11-STATS · point 5 (écran 9, état 3, planche « La feuille du score — score officiel,
// verrouillé ») — LES COMPTEURS VERROUILLÉS ONT UNE BORDURE POINTILLÉE ORANGE.
// La planche : `.cpt.verrou { border-style: dashed; border-color: warning500 à 55 % ;
// background: warning500 à 6 % }`. C'est une option À ACTIVER (`locked`), comme
// `keepTitleWhileLoading` sur Button : les 4 autres écrans qui partagent ce compteur (la fiche
// Tâche, les licences, deux écrans de recrutement) ne changent pas.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: espaces,
    }),
  };
});

const Colors = jest.requireActual('@/theme/colors').default();
const { withAlpha } = jest.requireActual('@/theme/colors');

/**
 * Le bloc compteur (le premier élément qui porte un fond) et ses deux boutons.
 * @param {any} props Les propriétés ajoutées.
 * @returns {{ bloc: any, boutons: any[] }} Le style du bloc et les deux boutons.
 */
const rendre = (props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(InputStepper, {
      max: 99,
      min: 0,
      onDecrement: () => {},
      onIncrement: () => {},
      tone: 'tunnel',
      value: 2,
      ...props,
    }));
  });
  const [premier] = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.type === 'string'
      && Boolean(StyleSheet.flatten(noeud.props?.style)?.backgroundColor),
  );
  const bloc = StyleSheet.flatten(premier.props.style);
  // Lus AVANT le démontage : un nœud démonté ne rend plus ses propriétés.
  const boutons = arbre.root.findAllByType(TouchableOpacity)
    .map((/** @type {any} */ bouton) => ({ props: { ...bouton.props } }));
  act(() => arbre.unmount());
  return { bloc, boutons };
};

describe('FINITIONS11 · point 5 — le compteur verrouillé', () => {
  test('1 · 🔴 `locked` : bordure POINTILLÉE orange, fond orange léger (la planche)', () => {
    const { bloc } = rendre({ locked: true });

    expect(bloc.borderStyle).toBe('dashed');
    expect(bloc.borderWidth).toBe(1);
    expect(bloc.borderColor).toBe(withAlpha(Colors.warning500, 0.55));
    expect(bloc.backgroundColor).toBe(withAlpha(Colors.warning500, 0.06));
  });

  test('2 · 🔴 `locked` : les deux boutons sont éteints, même loin des bornes', () => {
    const { boutons } = rendre({
      locked: true, max: 99, min: 0, value: 2,
    });

    expect(boutons).toHaveLength(2);
    boutons.forEach((bouton) => {
      expect(bouton.props.disabled).toBe(true);
      expect(bouton.props.accessibilityState).toEqual({ disabled: true });
    });
  });

  test('3 · 🔒 sans l option : le compteur du tunnel d avant (bord plein, fond sombre, boutons vivants)', () => {
    const { bloc, boutons } = rendre({});

    expect(bloc.borderStyle).toBeUndefined();
    expect(bloc.backgroundColor).toBe('rgba(4, 31, 44, 0.82)');
    expect(bloc.borderColor).toBe('rgba(1, 179, 244, 0.24)');
    boutons.forEach((bouton) => expect(bouton.props.disabled).toBe(false));
  });

  test('4 · 🔒 sans l option, registre `surface` : l apparence historique des 4 autres écrans', () => {
    const { bloc } = rendre({ tone: undefined });

    expect(bloc.borderStyle).toBeUndefined();
    expect(bloc.backgroundColor).toBe(Colors.neutral100);
  });
});
