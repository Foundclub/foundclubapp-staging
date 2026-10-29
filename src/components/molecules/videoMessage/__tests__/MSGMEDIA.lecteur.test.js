import renderer, { act } from 'react-test-renderer';

// MSG-MEDIA (29/10) — le lecteur du téléphone : une WebView qui contient une balise <video>,
// sans bibliothèque vidéo, et un secours « Ouvrir dans le navigateur ».
const mockOpenUrl = jest.fn();
const mockWebViews = /** @type {any[]} */ ([]);

jest.mock('react-native-webview', () => ({
  WebView: (/** @type {any} */ props) => {
    mockWebViews.push(props);
    return null;
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/platform/links', () => ({
  __esModule: true,
  default: { openUrl: (/** @type {string} */ url) => mockOpenUrl(url) },
}));
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
jest.mock('@/components/atoms/glyphIcon/GlyphIcon', () => () => null);

const VideoMessagePlayer = require('../VideoMessagePlayer').default;
const { buildVideoPage } = require('../videoPage');

const ADRESSE = 'https://cdn.example.test/uploads/but.mp4';

describe('MSG-MEDIA — lecteur vidéo du téléphone', () => {
  beforeEach(() => {
    mockWebViews.length = 0;
    mockOpenUrl.mockClear();
  });

  test('la page du lecteur est une balise <video> lisible en ligne, adresse échappée', () => {
    const page = buildVideoPage('https://x.test/a.mp4?n="1"&b=<2>');
    expect(page).toContain('<video src="https://x.test/a.mp4?n=&quot;1&quot;&amp;b=&lt;2&gt;"');
    expect(page).toContain('controls autoplay playsinline');
  });

  test('ouvert : la WebView lit CETTE vidéo ; le navigateur sert de secours', () => {
    const onClose = jest.fn();
    /** @type {any} */
    let ecran;
    act(() => {
      ecran = renderer.create(<VideoMessagePlayer onClose={onClose} url={ADRESSE} />);
    });

    expect(mockWebViews).toHaveLength(1);
    expect(mockWebViews[0].source.html).toContain(`<video src="${ADRESSE}"`);

    act(() => {
      ecran.root.findByProps({ testID: 'video-message-player-browser' }).props.onPress();
    });
    expect(mockOpenUrl).toHaveBeenCalledWith(ADRESSE);

    act(() => {
      ecran.root.findByProps({ testID: 'video-message-player-close' }).props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => ecran.unmount());
  });

  test('fermé (adresse vide) : aucune WebView en mémoire', () => {
    /** @type {any} */
    let ecran;
    act(() => {
      ecran = renderer.create(<VideoMessagePlayer onClose={jest.fn()} url="" />);
    });
    expect(mockWebViews).toHaveLength(0);
    act(() => ecran.unmount());
  });
});
