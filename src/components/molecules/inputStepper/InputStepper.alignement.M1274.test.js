import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import InputStepper from './InputStepper';

// RETOUCHES-T12A · M1274 (recette 37, 15/11/2026) — LE COMPTEUR « − 0 + » DE L'OPTION
// (« Chasubles · 4 € par réservation », récapitulatif de la réservation) ÉTAIT MAL AGENCÉ :
// le « − » plus étroit que le « + », le chiffre collé aux boutons, rien de centré dans son cadre.
// Le même code au téléphone et au site (BlocOptions → InputStepper, `tone="tunnel"`).
//
// Ce que ce témoin prouve, en registre `tunnel` :
//   1. les deux boutons font 44 × 44 et centrent leur signe ;
//   2. le chiffre a une largeur fixe et se centre ;
//   3. la rangée centre ses trois éléments verticalement ;
//   4. comportement inchangé : « − » grisé et inactif à 0, « + » actif.
// Le registre `surface` (licences, recrutement, fiche tâche) ne bouge pas : il garde son padding.
// ROUGE avant le lot sur 1 à 3.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

// Le VRAI thème, sans le contexte React qui le porte (même doublure que InputStepper.test.js).
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

/**
 * Rend le compteur et lit sa structure.
 * @param {'surface' | 'tunnel'} tone Registre.
 * @returns {{ boutons: any[], chiffre: any, rangee: any }} Les styles aplatis.
 */
const rendre = (tone) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(InputStepper, {
      decrementLabel: 'Un de moins : Chasubles',
      incrementLabel: 'Un de plus : Chasubles',
      max: 1,
      min: 0,
      onDecrement: () => {},
      onIncrement: () => {},
      tone,
      value: 0,
    }));
  });
  /**
   * Un bouton du compteur : rôle bouton, une action, un nom.
   * @type {(n: any) => boolean}
   */
  const estUnBouton = (n) => n.props.accessibilityRole === 'button'
    && typeof n.props.onPress === 'function' && Boolean(n.props.accessibilityLabel);
  // Un bouton apparaît plusieurs fois dans l'arbre : on garde le premier de chaque nom.
  const boutons = arbre.root.findAll(estUnBouton)
    .filter((/** @type {any} */ n, /** @type {number} */ i, /** @type {any[]} */ tous) => tous
      .findIndex((/** @type {any} */ m) => m.props.accessibilityLabel
        === n.props.accessibilityLabel) === i);
  const chiffre = arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text'
    && n.props.children === 0)[0];
  const rangee = chiffre.parent.type === 'View' ? chiffre.parent : chiffre.parent.parent;
  const lire = {
    boutons: boutons.map((/** @type {any} */ b) => ({
      disabled: b.props.accessibilityState?.disabled,
      nom: b.props.accessibilityLabel,
      style: StyleSheet.flatten(b.props.style) || {},
    })),
    chiffre: StyleSheet.flatten(chiffre.props.style) || {},
    rangee: StyleSheet.flatten(rangee.props.style) || {},
  };
  act(() => arbre.unmount());
  return lire;
};

describe('M1274 — le compteur « − 0 + » du tunnel est aligné', () => {
  test('les deux boutons font 44 × 44 et centrent leur signe', () => {
    const { boutons } = rendre('tunnel');
    expect(boutons.map((b) => b.nom))
      .toEqual(['Un de moins : Chasubles', 'Un de plus : Chasubles']);
    boutons.forEach(({ style }) => {
      expect(style).toMatchObject({
        alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
      });
    });
  });

  test('le chiffre a une largeur fixe et se centre', () => {
    const { chiffre } = rendre('tunnel');
    expect(chiffre.textAlign).toBe('center');
    expect(typeof chiffre.width).toBe('number');
    expect(chiffre.width).toBeGreaterThanOrEqual(24);
  });

  test('la rangée centre ses trois éléments verticalement', () => {
    const { rangee } = rendre('tunnel');
    expect(rangee.flexDirection).toBe('row');
    expect(rangee.alignItems).toBe('center');
  });

  test('comportement inchangé : « − » grisé et inactif à 0, « + » actif', () => {
    const { boutons } = rendre('tunnel');
    expect(boutons[0].disabled).toBe(true);
    expect(boutons[0].style.opacity).toBe(0.5);
    expect(boutons[1].disabled).toBe(false);
  });

  test('le registre `surface` ne bouge pas : ni 44 × 44, ni largeur fixe', () => {
    const { boutons, chiffre } = rendre('surface');
    boutons.forEach(({ style }) => {
      expect(style.width).toBeUndefined();
      expect(style.height).toBeUndefined();
      expect(style.padding).toBe(12);
    });
    expect(chiffre.width).toBeUndefined();
  });
});
