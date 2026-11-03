import renderer, { act } from 'react-test-renderer';

import VideoPreparationBand from '../VideoPreparationBand';

jest.mock('@/theme/strings', () => ({
  __esModule: true,
  default: jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next,
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors, Fonts: generateFonts(Colors) }) };
});
jest.mock('@/components/atoms/button/Button', () => (/** @type {any} */ props) => {
  // eslint-disable-next-line global-require
  const { Text } = require('react-native');
  return <Text {...props}>{props.title}</Text>;
});

/**
 * Monte le bandeau.
 * @param {number | null} pourcent
 * @param {() => void} onCancel
 * @returns {any} L'arbre rendu.
 */
const monter = (pourcent, onCancel) => {
  /** @type {any} */
  let ecran = null;
  act(() => {
    ecran = renderer.create(<VideoPreparationBand onCancel={onCancel} pourcent={pourcent} />);
  });
  return ecran;
};

/**
 * Le texte affiché.
 * @param {any} ecran
 * @returns {string} Tous les textes, à la suite.
 */
const texteDe = (ecran) => JSON.stringify(ecran.toJSON());

describe('VIDEO-RAME — le bandeau de préparation', () => {
  test('avec un pourcentage : « Préparation de la vidéo… 40 % », et Annuler répond', () => {
    const onCancel = jest.fn();
    const ecran = monter(40, onCancel);
    expect(texteDe(ecran)).toContain('Préparation de la vidéo… 40 %');

    act(() => { ecran.root.findAll((n) => n.props.title === 'Annuler')[0].props.onPress(); });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('sans pourcentage : le fichier arrive encore de la galerie', () => {
    const texte = texteDe(monter(null, jest.fn()));
    expect(texte).toContain('Préparation du fichier…');
    expect(texte).not.toContain('%');
  });
});
