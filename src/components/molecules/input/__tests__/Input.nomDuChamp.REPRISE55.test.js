import fs from 'fs';
import path from 'path';

import { createElement } from 'react';
import { TextInput, TouchableWithoutFeedback } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Checkable from '@/components/atoms/checkable/Checkable';

import Input from '../Input';

// REPRISE-ROBUSTESSE 55 (01/11, contre-recettes Dirigeant et Ville) — ce que le lecteur d'écran
// ne pouvait pas nommer : les champs à étiquette visible (« Titre », « Texte » de l'actualité de
// la Ville), les adresses proposées (une case sans nom), « Supprimer mon compte » (pas un bouton),
// « Nouvelle conversation » (pas un bouton), les corbeilles de la fiche d'équipe (sans nom), les
// deux champs de « Nouvelle discussion » (sans nom). 57 : la carte d'une offre était un <button>
// qui contenait les boutons du palier.

jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: jest.requireActual('@/theme/fonts').default(Colors),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

// La coche dessinée vient de `react-native-bouncy-checkbox` (ESM pur, hors Babel) : une doublure
// qui garde ses props, pour vérifier qu'elle n'est plus un élément focalisable sans nom.
jest.mock('react-native-bouncy-checkbox', () => {
  const react = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return react.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => (
    react.createElement(View, { ...props, ref, testID: 'coche' })
  ));
});

/**
 * Rend un élément et lit les props du premier nœud du type voulu.
 * @param {any} element - L'élément.
 * @param {any} type - Le type cherché.
 * @returns {any} Ses props.
 */
const lire = (element, type) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(element); });
  const props = { ...arbre.root.findAllByType(type)[0].props };
  act(() => arbre.unmount());
  return props;
};

const source = (/** @type {string} */ relatif) => fs.readFileSync(
  path.join(__dirname, '../../../../..', relatif),
  'utf8',
);

describe('REPRISE-ROBUSTESSE 55 — un nom pour chaque champ et chaque case', () => {
  test('un champ à étiquette visible porte ce nom (« Titre » de l actualité)', () => {
    const champ = lire(createElement(Input, { label: 'Titre', value: '' }), TextInput);
    expect(champ.accessibilityLabel).toBe('Titre');
  });

  test('un nom donné exprès reste celui-là', () => {
    expect(lire(
      createElement(Input, {
        accessibilityLabel: 'Titre de l actualité', label: 'Titre', value: '',
      }),
      TextInput,
    ).accessibilityLabel).toBe('Titre de l actualité');
  });

  test('une adresse proposée : la case dit son texte', () => {
    const props = lire(
      createElement(Checkable, {
        isChecked: false, setIsChecked: () => {}, text: '12 rue des Lilas',
      }),
      TouchableWithoutFeedback,
    );
    expect([props.accessibilityRole, props.accessibilityLabel])
      .toEqual(['radio', '12 rue des Lilas']);
  });

  test('la coche dessinée n est plus un 2e élément focalisable sans nom', () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(Checkable, {
        isChecked: false, setIsChecked: () => {}, text: '12 rue des Lilas',
      }));
    });
    const coche = arbre.root.findAllByProps({ testID: 'coche' })[0].props;
    act(() => arbre.unmount());
    expect([coche.focusable, coche['aria-hidden']]).toEqual([false, true]);
  });
});

describe('REPRISE-ROBUSTESSE 55 et 57 — rôles et noms relevés par les contre-recettes', () => {
  test('« Supprimer mon compte » est un bouton', () => {
    expect(source('src/views/profile/Profile.js'))
      .toMatch(/<TouchableOpacity accessibilityRole="button" onPress=\{handleDeleteAccount\}>/);
  });

  test('« Nouvelle conversation » de la messagerie est un bouton', () => {
    expect(source('src/views/Messaging.js')).toMatch(
      /accessibilityLabel=\{t\('messaging\.newConversation', 'Nouvelle conversation'\)\}\s+accessibilityRole="button"/,
    );
  });

  test('les deux corbeilles de la fiche d équipe ont un nom', () => {
    const fiche = source('src/views/team/TeamDetails.js');
    expect(fiche).toContain("t('teamDetails.a11y.removeTrainer'");
    expect(fiche).toContain("t('teamDetails.a11y.removePlayer'");
  });

  test('Nouvelle discussion : pastilles « Retirer » en boutons, deux champs nommés', () => {
    const ecran = source('src/views/NewConversation.js');
    expect(ecran.match(/name: nomComplet\(personne\),\s+\}\)\}\s+accessibilityRole="button"/g))
      .toHaveLength(2);
    expect(ecran).toMatch(/<TextInput\s+accessibilityLabel=\{t\(\s+'newConversation\.groupNamePlaceholder'/);
    expect(ecran).toMatch(/<TextInput\s+accessibilityLabel=\{modeVille/);
  });

  test('57 — la carte d une offre n est plus un bouton qui contient des boutons', () => {
    const page = source('src/views/guidance/GuideOffersRecap.js');
    expect(page).toMatch(/accessibilityRole="radio"\s+accessibilityState=\{\{ checked: isSelected \}\}/);
    expect(page)
      .not.toMatch(/accessibilityRole="button"\s+accessibilityState=\{\{ selected: isSelected \}\}/);
  });
});
