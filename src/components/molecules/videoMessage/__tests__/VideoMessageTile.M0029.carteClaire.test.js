import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// RETOURS-TESTEUR-2 (06/11/2026, M0029, décision du chef « C ») — « On ne voit pas l'image de la
// vidéo, il y a un écran noir » : la tuile était un rectangle sombre de 230 × 150 sans image. Elle
// devient une carte claire, comme la bulle d'un document : le bouton lecture, « Vidéo · 0:42 » et
// « Lire la vidéo ». Toujours sans vignette (il faudrait une bibliothèque, geste R4).

/** @type {any[]} */
const mockIcones = [];
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
jest.mock('@/components/atoms/glyphIcon/GlyphIcon', () => (/** @type {any} */ props) => {
  mockIcones.push(props);
  return null;
});

const VideoMessageTile = require('../VideoMessageTile').default;

const NOIR = jest.requireActual('@/theme/colors').default().neutral900;

const monter = (/** @type {any} */ duree) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<VideoMessageTile durationSeconds={duree} onPress={() => {}} />);
  });
  return arbre;
};

describe('M0029 — la carte d une vidéo se lit d un coup d œil', () => {
  beforeEach(() => { mockIcones.length = 0; });

  it('plus de rectangle noir de 150 : une carte basse, au fond de la bulle d un document', () => {
    const arbre = monter(42);
    const tuile = arbre.root.findByProps({ testID: 'video-message-tile' });
    const style = StyleSheet.flatten(tuile.props.style);
    expect(style.height).toBeUndefined();
    expect(style.backgroundColor).not.toBe(NOIR);
    expect(style.borderWidth).toBe(1);
  });

  it('le bouton lecture, la durée, et ce que fait l appui', () => {
    const arbre = monter(42);
    const textes = arbre.root.findAllByType(Text).map((/** @type {any} */ n) => n.props.children);
    expect(textes).toEqual(expect.arrayContaining(['Vidéo · 0:42', 'Lire la vidéo']));
    expect(mockIcones.map((icone) => icone.name)).toContain('play');
  });
});
