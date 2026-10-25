import { Animated } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AppCelebrationBanner from '../AppCelebrationBanner';

// 🐞 Q3-17 — GLISSER LA BANNIERE NE LA FERMAIT PAS.
// Seuls quatre des gestionnaires du PanResponder etaient branches : sans
// `onResponderGrant`, le geste n etait jamais initialise et `dx` restait a 0.
// Le banc rejoue le systeme de repondeur de React Native avec le VRAI PanResponder.

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  const fige = {
    Colors: couleurs,
    Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => fige };
});

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

/**
 * Glisse le doigt de 200 px vers la droite sur la vue qui porte le geste,
 * comme le fait le systeme de repondeur : il demande a chaque mouvement qui
 * veut le geste, accorde, puis transmet les mouvements et le lacher.
 * @param {any} vue les proprietes de la vue animee
 * @returns {void}
 */
const glisser = (vue) => {
  const touche = {
    currentPageX: 100,
    currentPageY: 50,
    currentTimeStamp: 0,
    previousPageX: 100,
    previousPageY: 50,
    previousTimeStamp: 0,
    startPageX: 100,
    startPageY: 50,
    startTimeStamp: 0,
    touchActive: true,
  };
  const historique = {
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: 0,
    numberActiveTouches: 1,
    touchBank: [touche],
  };
  const evenement = () => ({ nativeEvent: { touches: [{}] }, touchHistory: historique });
  vue.onStartShouldSetResponderCapture?.(evenement());
  vue.onStartShouldSetResponder?.(evenement());
  let accorde = false;
  for (let i = 1; i <= 10; i += 1) {
    touche.previousPageX = touche.currentPageX;
    touche.previousTimeStamp = touche.currentTimeStamp;
    touche.currentPageX = 100 + (20 * i);
    touche.currentTimeStamp = 16 * i;
    historique.mostRecentTimeStamp = 16 * i;
    if (!accorde) {
      vue.onMoveShouldSetResponderCapture?.(evenement());
      if (vue.onMoveShouldSetResponder?.(evenement())) {
        accorde = true;
        vue.onResponderGrant?.(evenement());
      }
    }
    if (accorde) vue.onResponderMove(evenement());
  }
  touche.touchActive = false;
  historique.numberActiveTouches = 0;
  if (accorde) vue.onResponderRelease(evenement());
};

describe('🐞 Q3-17 — la banniere se ferme quand on la fait glisser', () => {
  it('un glisser de 200 px vers la droite la ferme', () => {
    const onExited = jest.fn();
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <AppCelebrationBanner durationMs={60000} onExited={onExited} title="Bravo" />,
      );
    });
    const vue = arbre.root.findAllByType(Animated.View)
      .find((/** @type {any} */ n) => typeof n.props.onResponderMove === 'function');

    act(() => { glisser(vue.props); });
    act(() => { jest.advanceTimersByTime(1000); });

    // La fermeture vient du geste : la minuterie de 60 s est encore loin.
    expect(onExited).toHaveBeenCalled();
    act(() => { arbre.unmount(); });
  });
});
