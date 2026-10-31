/* eslint-disable max-len -- donnees de test */
// CORR-COLLECTIVITES 94 (31/10/2026, décision d'Adel A) — sur le site, « La Ville est prévenue »
// s'affichait dans une boîte grise du navigateur (window.alert, OK / Annuler). C'est désormais la
// fenêtre de l'app (BottomModal en dialogue) : un titre, la phrase, un bouton « OK » qui ferme.
import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import VillePrevenueDialog from '../VillePrevenueDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ _cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : _cle) }),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(/** @type {any} */ { children, isVisible }) {
  return isVisible ? children : null;
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(TouchableOpacity, { onPress: props.onPress, testID: props.testID }, reactActuel.createElement(TexteRN, null, props.title));
  };
});
jest.mock('@/theme/themeContext', () => () => ({
  Fonts: new Proxy({}, { get: () => ({}) }),
  Spaces: new Proxy({}, { get: () => new Proxy({}, { get: () => ({}) }) }),
}));

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map((/** @type {any} */ n) => [].concat(n.props.children).join(''));

describe('CORR-COLLECTIVITES 94 — « La Ville est prévenue » dans la fenêtre de l’app', () => {
  it('le titre, la phrase, et « OK » ferme', async () => {
    const fermer = jest.fn();
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<VillePrevenueDialog message="La Ville de Montrivage est prévenue : la place se libère." onClose={fermer} />);
    });
    expect(textes(arbre)).toEqual(expect.arrayContaining(['C’est annulé', 'La Ville de Montrivage est prévenue : la place se libère.', 'OK']));
    await act(async () => { arbre.root.findByProps({ testID: 'ville-prevenue-ok' }).props.onPress(); });
    expect(fermer).toHaveBeenCalled();
  });

  it('sans message : rien', async () => {
    /** @type {any} */
    let arbre;
    await act(async () => { arbre = renderer.create(<VillePrevenueDialog message={null} onClose={jest.fn()} />); });
    expect(textes(arbre)).toEqual([]);
  });

  it('la fiche du site n’appelle plus window.alert pour la Ville prévenue', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'EventDetails.web.js'), 'utf8');
    expect(source).toContain('<VillePrevenueDialog');
    expect(/window\.alert\([^)]*villePrevenue/s.test(source)).toBe(false);
  });
});
