import renderer, { act } from 'react-test-renderer';

import VideoCvPlayer from '../VideoCvPlayer.web';

// VIDEOCV (28/10) — le lecteur du site. Décision 1- A : la miniature d'abord ; l'iframe
// youtube-nocookie ne naît qu'à l'appui.

jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/components/atoms/glyphIcon/GlyphIcon', () => () => null);
jest.mock('@/theme/themeContext', () => {
  const leaf = {};
  const ramp = () => new Proxy({}, { get: () => leaf });
  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: ramp(),
      Colors: new Proxy({}, { get: () => 'black' }),
      Fonts: ramp(),
      Spaces: new Proxy({}, { get: () => ramp() }),
    }),
  };
});

const iframes = (arbre) => arbre.root.findAll((n) => n.type === 'iframe');

test('avant l appui : la miniature, AUCUNE iframe ; après : youtube-nocookie', () => {
  let arbre;
  act(() => {
    arbre = renderer.create(<VideoCvPlayer url="https://www.youtube.com/watch?v=k3Lm9QpX2aE" />);
  });
  expect(iframes(arbre)).toHaveLength(0);
  const bouton = arbre.root.findAll(
    (n) => n.props.testID === 'video-cv-player-play' && n.props.onPress,
  )[0];
  act(() => bouton.props.onPress());
  const [cadre] = iframes(arbre);
  expect(cadre.props.src).toBe('https://www.youtube-nocookie.com/embed/k3Lm9QpX2aE?autoplay=1&playsinline=1&rel=0');
  expect(cadre.props.referrerPolicy).toBe('strict-origin-when-cross-origin');
});
