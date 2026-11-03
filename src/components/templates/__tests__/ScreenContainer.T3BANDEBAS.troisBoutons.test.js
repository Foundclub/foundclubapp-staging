import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ScreenContainer from '../ScreenContainer';

// T3-BANDE-BAS, décision d'Adel « 7- B » (03/11) : le contenu passe sous la barre du téléphone.
// Un fond derrière la barre à 3 boutons (48 dp) la garde lisible ; à gestes (24 dp), aucun.

const mockBas = { valeur: 48 };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: mockBas.valeur, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Alignments: { fill: { flex: 1 }, grow1: { flexGrow: 1 } },
    Colors: { neutral900: '#0c0c0d' },
    Images: { bg1: 1, bg2: 2, bg3: 3 },
  }),
}));

jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(0),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingTabBarScenePaddingBottom: () => 134,
}));

const FOND = 'fond-barre-trois-boutons';

/**
 * Monte le cadre et dit si le fond y est.
 * @param {string} mode Le mode de marge basse.
 * @param {string} [gradient] Une couleur de dégradé, pour l'autre forme du cadre.
 * @returns {any} Le fond trouvé, ou undefined.
 */
function fondDuCadre(mode, gradient) {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ScreenContainer
        bottomInsetMode={/** @type {any} */ (mode)}
        gradient={gradient ? [gradient, gradient] : null}
      >
        <Text>contenu</Text>
      </ScreenContainer>,
    );
  });
  return arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === FOND
    && typeof n.type === 'string')[0];
}

describe('fond derrière la barre à 3 boutons', () => {
  const osInitial = Platform.OS;
  beforeEach(() => {
    Platform.OS = 'android';
    mockBas.valeur = 48;
  });
  afterEach(() => { Platform.OS = osInitial; });

  test('Android, 3 boutons : un fond de la hauteur de la barre, qui ne prend aucun appui', () => {
    const fond = fondDuCadre('scroll-edge');
    expect(fond).toBeDefined();
    const style = Object.assign({}, ...[fond.props.style].flat());
    expect(style).toMatchObject({
      bottom: 0, height: 48, left: 0, position: 'absolute', right: 0,
    });
    expect(fond.props.pointerEvents).toBe('none');
  });

  test('il y est aussi avec un dégradé', () => {
    expect(fondDuCadre('scroll-edge', '#000000')).toBeDefined();
  });

  test('Android, gestes : rien', () => {
    mockBas.valeur = 24;
    expect(fondDuCadre('scroll-edge')).toBeUndefined();
  });

  test('iPhone : rien', () => {
    Platform.OS = 'ios';
    mockBas.valeur = 48;
    expect(fondDuCadre('scroll-edge')).toBeUndefined();
  });

  test.each(['none', 'screen', 'tab-scene', 'edge-to-edge'])('les autres écrans (%s) : rien', (
    /** @type {string} */ mode,
  ) => {
    expect(fondDuCadre(mode)).toBeUndefined();
  });
});
