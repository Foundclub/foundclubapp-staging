import { createElement } from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '../Button';

// CORR-ROBUSTESSE point 52 (recette du site, 30/10, « A partout ») — deux appuis dans la même
// milliseconde créaient deux fiches d'enfant, deux annulations, deux contrôles. L'état
// `isPending` de react-query n'arrive qu'au rendu suivant (après un setTimeout) : l'écran ne
// peut pas éteindre le bouton à temps. Le verrou vit donc dans l'atome, une fois pour tous.

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
    Colors: couleurs,
    Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
    Images: {},
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

/** @type {any[]} */
const montes = [];
afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
  jest.useRealTimers();
});

const toucher = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(Button, { title: 'Envoyer', ...props }));
  });
  montes.push(arbre);
  return arbre.root.findByType(TouchableOpacity);
};

test('CORR52/1 — deux appuis rapides ne donnent qu un seul appel', () => {
  jest.useFakeTimers();
  const onPress = jest.fn();
  const zone = toucher({ onPress });

  act(() => {
    zone.props.onPress({});
    zone.props.onPress({});
  });

  expect(onPress).toHaveBeenCalledTimes(1);
});

test('CORR52/2 — un appui plus tard, une fois le premier passé, repart normalement', () => {
  jest.useFakeTimers();
  const onPress = jest.fn();
  const zone = toucher({ onPress });

  act(() => { zone.props.onPress({}); });
  act(() => { jest.advanceTimersByTime(1000); });
  act(() => { zone.props.onPress({}); });

  expect(onPress).toHaveBeenCalledTimes(2);
});

test('CORR52/3 — une promesse renvoyée garde le bouton fermé jusqu à la réponse', async () => {
  jest.useFakeTimers();
  let repondre = (/** @type {any} */ _v) => _v;
  const onPress = jest.fn(() => new Promise((resolve) => { repondre = resolve; }));
  const zone = toucher({ onPress });

  act(() => { zone.props.onPress({}); });
  act(() => { jest.advanceTimersByTime(5000); });
  act(() => { zone.props.onPress({}); });
  expect(onPress).toHaveBeenCalledTimes(1);

  await act(async () => { repondre(); });
  act(() => { zone.props.onPress({}); });
  expect(onPress).toHaveBeenCalledTimes(2);
});

test('CORR52/4 — au clavier du site, Entrée deux fois de suite ne donne qu un appel', () => {
  jest.useFakeTimers();
  const onPress = jest.fn();
  const zone = toucher({ onPress, submitOnEnter: true });
  const avant = Platform.OS;
  Platform.OS = 'web';
  try {
    act(() => {
      zone.props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
      zone.props.onKeyDown({ key: 'Enter', preventDefault: () => {} });
    });
  } finally {
    Platform.OS = avant;
  }

  expect(onPress).toHaveBeenCalledTimes(1);
});

// Le même bouton d'un assistant passe de « Continuer » à « Envoyer » (ou de « Suivant » à
// « Suivant » de l'étape d'après) : c'est une autre action, elle part tout de suite.
test.each([
  ['un autre libellé', { title: 'Envoyer 2 inscriptions' }],
  ['une autre action', { title: 'Envoyer' }],
])('CORR52/5 — le bouton reçoit %s : l appui suivant part sans attendre', (_nom, apres) => {
  jest.useFakeTimers();
  const premier = jest.fn();
  const second = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(Button, { onPress: premier, title: 'Envoyer' }));
  });
  montes.push(arbre);

  act(() => { arbre.root.findByType(TouchableOpacity).props.onPress({}); });
  act(() => { arbre.update(createElement(Button, { onPress: second, ...apres })); });
  act(() => { arbre.root.findByType(TouchableOpacity).props.onPress({}); });

  expect([premier.mock.calls.length, second.mock.calls.length]).toEqual([1, 1]);
});
