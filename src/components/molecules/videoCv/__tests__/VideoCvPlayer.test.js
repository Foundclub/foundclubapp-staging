import renderer, { act } from 'react-test-renderer';

import VideoCvPlayer from '../VideoCvPlayer';

// VIDEOCV (28/10, planche validée par Adel) — le lecteur du téléphone.
// Décision 1- A : la miniature s'affiche, le lecteur youtube-nocookie ne naît qu'à l'appui.

jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  /**
   * Doublure : une vue qui garde la source et les rappels de la vraie WebView.
   * @param {any} props
   * @returns {any}
   */
  function WebView({
    onError, onMessage, source, testID,
  }) {
    return <View onError={onError} onMessage={onMessage} source={source} testID={testID} />;
  }
  return { WebView };
});

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

const { openUrl } = jest.requireMock('@/platform/links').default;

const URL = 'https://www.youtube.com/watch?v=k3Lm9QpX2aE';

const monter = (props = {}) => {
  let arbre;
  act(() => {
    arbre = renderer.create(<VideoCvPlayer isOwner={props.isOwner} url={props.url || URL} />);
  });
  return arbre;
};

const parId = (arbre, id) => arbre.root.findAll(
  (n) => n.props.testID === id && typeof n.type !== 'string',
);

const webViews = (arbre) => arbre.root.findAll((n) => n.props.testID === 'video-cv-player-webview'
  && n.props.source !== undefined);

describe('VIDEOCV — VideoCvPlayer', () => {
  test('avant l appui : la miniature i.ytimg.com, AUCUNE WebView dans l arbre', () => {
    const arbre = monter();
    expect(webViews(arbre)).toHaveLength(0);
    const miniature = parId(arbre, 'video-cv-player-thumbnail')[0];
    expect(miniature.props.source).toEqual({ uri: 'https://i.ytimg.com/vi/k3Lm9QpX2aE/hqdefault.jpg' });
  });

  test('après l appui : une WebView youtube-nocookie, origine https://foundclub.app', () => {
    const arbre = monter();
    act(() => parId(arbre, 'video-cv-player-play')[0].props.onPress());
    const [vue] = webViews(arbre);
    expect(vue.props.source.baseUrl).toBe('https://foundclub.app');
    expect(vue.props.source.html).toContain("host: 'https://www.youtube-nocookie.com'");
    expect(parId(arbre, 'video-cv-player-thumbnail')).toHaveLength(0);
  });

  test('message 150 : « Cette vidéo se regarde sur YouTube » + le lien', () => {
    const arbre = monter();
    act(() => parId(arbre, 'video-cv-player-play')[0].props.onPress());
    const message = JSON.stringify({ code: 150, type: 'error' });
    act(() => webViews(arbre)[0].props.onMessage({ nativeEvent: { data: message } }));
    expect(parId(arbre, 'video-cv-player-error-embed')).not.toHaveLength(0);
    expect(JSON.stringify(arbre.toJSON())).toContain('Cette vidéo se regarde sur YouTube');
    act(() => parId(arbre, 'video-cv-player-open-youtube')[0].props.onPress());
    expect(openUrl).toHaveBeenCalledWith(URL);
  });

  test('message 100 : « plus disponible », et la phrase de l auteur pour lui seul', () => {
    const arbre = monter({ isOwner: true });
    act(() => parId(arbre, 'video-cv-player-play')[0].props.onPress());
    const message = '{"type":"error","code":100}';
    act(() => webViews(arbre)[0].props.onMessage({ nativeEvent: { data: message } }));
    const texte = JSON.stringify(arbre.toJSON());
    expect(texte).toContain("Cette vidéo n'est plus disponible");
    expect(texte).toContain("C'est ta vidéo ?");
  });

  test('erreur de chargement : « Pas de connexion » + « Réessayer » relance le lecteur', () => {
    const arbre = monter();
    act(() => parId(arbre, 'video-cv-player-play')[0].props.onPress());
    act(() => webViews(arbre)[0].props.onError());
    expect(JSON.stringify(arbre.toJSON())).toContain('Pas de connexion');
    expect(webViews(arbre)).toHaveLength(0);
    act(() => parId(arbre, 'video-cv-player-retry')[0].props.onPress());
    expect(webViews(arbre)).not.toHaveLength(0);
  });

  test('lien hors YouTube : rien n est rendu', () => {
    const arbre = monter({ url: 'https://vimeo.com/812345678' });
    expect(arbre.toJSON()).toBeNull();
  });
});
