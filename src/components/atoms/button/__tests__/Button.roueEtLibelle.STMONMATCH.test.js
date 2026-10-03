/* eslint-disable max-len -- les libellés du design se lisent en entier. */
import { createElement } from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '../Button';

// ST-MONMATCH (écran 9, design des statistiques validé le 02/10, feuille du score, état 4) —
// « Le bouton TOURNE et ne se touche plus : pas de double envoi. » La planche dessine la roue
// À CÔTÉ de « Enregistrement… ».
//
// 🧱 L'atome n'affichait que la roue OU le texte (`isLoading` remplaçait le libellé) : la fiche
// écrivait « Enregistrement… » sans roue (ponytail noté dans EventDetails, voie de sortie :
// « une roue à côté du libellé dans l'atome »). Le voici, SUR DEMANDE seulement
// (`keepTitleWhileLoading`) : les autres boutons de l'app gardent la roue seule.

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
    Colors: couleurs,
    Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
    Images: { check: 1 },
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

/** @type {any[]} */
const montes = [];
afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

const monter = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(Button, { onPress: jest.fn(), variant: 'Primary', ...props }));
  });
  montes.push(arbre);
  return arbre.root;
};

test('ST-MONMATCH roue/1 — 🔴 sur demande : la roue ET « Enregistrement… », et le bouton ne se touche plus', () => {
  const racine = monter({ isLoading: true, keepTitleWhileLoading: true, title: 'Enregistrement…' });

  expect(racine.findAllByType(ActivityIndicator)).toHaveLength(1);
  expect(racine.findAllByType(Text).map((noeud) => noeud.props.children)).toContain('Enregistrement…');
  expect(racine.findByType(TouchableOpacity).props.disabled).toBe(true);
});

test('ST-MONMATCH roue/2 — 🔒 PROTÉGÉ : sans la demande, la roue SEULE, comme partout ailleurs', () => {
  const racine = monter({ isLoading: true, title: 'Envoyer' });

  expect(racine.findAllByType(ActivityIndicator)).toHaveLength(1);
  expect(racine.findAllByType(Text)).toHaveLength(0);
});

test('ST-MONMATCH roue/3 — 🔒 au repos, la demande ne change rien : le libellé seul', () => {
  const racine = monter({ keepTitleWhileLoading: true, title: 'Enregistrer 2 - 1' });

  expect(racine.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(racine.findAllByType(Text).map((noeud) => noeud.props.children)).toEqual(['Enregistrer 2 - 1']);
});
