// VOCAL — LES DOUBLURES DE REANIMATED ET DE GESTURE HANDLER, en un seul
// exemplaire.
//
// Pourquoi une doublure et pas le vrai paquet : `react-native-reanimated` est
// publié en modules ES que la configuration Jest de ce dépôt ne transforme pas
// (`transformIgnorePatterns`, jest.config.js) — l'importer tel quel meurt sur
// « Cannot use import statement outside a module ». Les témoins qui en ont
// besoin se fabriquaient chacun une doublure locale (SegmentedControl,
// EventCardNew…). Celle-ci est partagée, et elle fait une chose de plus :
// elle ENREGISTRE LES GESTES. Un témoin peut ainsi jouer « appui, glisser à
// gauche, relâcher » sur le micro, exactement dans l'ordre où Gesture Handler
// appellerait les rappels, sans téléphone.
//
// Usage, dans un fichier de témoin :
//   jest.mock('react-native-reanimated', () => require('@/testSupport/animationDouble').reanimated());
//   jest.mock('react-native-gesture-handler', () => require('@/testSupport/animationDouble').gestureHandler());
//
// ⚠️ Les animations se posent ici à leur valeur FINALE, immédiatement : un
// témoin lit la destination d'une animation, jamais son chemin. Le chemin (les
// durées, les courbes) se vérifie à l'œil, sur téléphone.

const React = require('react');
const RN = require('react-native');

/**
 * Le JOURNAL des animations demandées, dans l'ordre : un témoin y lit ce que
 * l'écran a voulu faire (« apparaître, tenir 2 s, disparaître »), puisque la
 * doublure pose chaque animation directement à sa valeur finale.
 * @type {Array<{ fn: string, args: any[] }>}
 */
const journal = [];

/**
 * Une valeur partagée de doublure.
 * @param {any} depart - La valeur de départ.
 * @returns {{ value: any, modify: (f: (v: any) => any) => void }} La valeur.
 */
const valeurPartagee = (depart) => {
  const sv = {
    modify: (/** @type {(v: any) => any} */ f) => { sv.value = f(sv.value); },
    value: depart,
  };
  return sv;
};

/**
 * Un style animé VIVANT : chaque lecture recalcule la fabrique. Un témoin qui
 * lit le style APRÈS avoir fait bouger une valeur partagée (un niveau du micro,
 * un glissement du doigt) lit donc la destination, comme le fil d'animation
 * l'aurait posée — sans que React ait eu besoin de redessiner quoi que ce soit.
 * @param {() => any} fabrique - La fabrique du style.
 * @returns {any} Le style.
 */
const styleVivant = (fabrique) => new Proxy({}, {
  get: (_cible, cle) => fabrique()[cle],
  getOwnPropertyDescriptor: (_cible, cle) => ({
    configurable: true, enumerable: true, value: fabrique()[cle], writable: false,
  }),
  has: (_cible, cle) => cle in fabrique(),
  ownKeys: () => Reflect.ownKeys(fabrique()),
});

/**
 * Un constructeur d'animation d'entrée, enchaînable (`FadeIn.duration(120)`).
 * @returns {any} Le constructeur.
 */
const entreeEnchainable = () => {
  /** @type {any} */
  const e = {};
  ['delay', 'duration', 'easing', 'springify', 'damping', 'stiffness', 'withInitialValues', 'withCallback']
    .forEach((nom) => { e[nom] = () => e; });
  return e;
};

/**
 * La doublure de `react-native-reanimated`.
 * @returns {any} Le module de doublure.
 */
const reanimated = () => {
  /**
   * Un composant animé : le composant d'origine, sans les props d'animation.
   * @param {any} Composant - Le composant d'origine.
   * @returns {any} Le composant de doublure.
   */
  const animer = (Composant) => React.forwardRef((/** @type {any} */ props, ref) => {
    const {
      entering, exiting, layout, ...reste
    } = props;
    return React.createElement(Composant, { ...reste, ref });
  });
  const Animated = {
    createAnimatedComponent: animer,
    Image: animer(RN.Image),
    ScrollView: animer(RN.ScrollView),
    Text: animer(RN.Text),
    View: animer(RN.View),
  };
  const identite = (/** @type {any} */ x) => x;
  const courbe = () => identite;
  return {
    __esModule: true,
    cancelAnimation: () => {},
    createAnimatedComponent: animer,
    default: Animated,
    Easing: {
      bezier: courbe,
      ease: identite,
      in: courbe,
      inOut: courbe,
      linear: identite,
      out: courbe,
      quad: identite,
    },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    FadeIn: entreeEnchainable(),
    FadeOut: entreeEnchainable(),
    interpolate: (/** @type {number} */ v, /** @type {number[]} */ entree, /** @type {number[]} */ sortie) => {
      const [a, b] = entree;
      const [c, d] = sortie;
      if (b === a) return c;
      const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
      return c + ((d - c) * t);
    },
    interpolateColor: (/** @type {number} */ v, /** @type {number[]} */ _entree, /** @type {string[]} */ sortie) => (
      v >= 0.5 ? sortie[sortie.length - 1] : sortie[0]
    ),
    LinearTransition: entreeEnchainable(),
    makeMutable: valeurPartagee,
    ReduceMotion: { Never: 'never', System: 'system' },
    runOnJS: (/** @type {Function} */ f) => f,
    runOnUI: (/** @type {Function} */ f) => f,
    useAnimatedReaction: () => {},
    useAnimatedStyle: styleVivant,
    useDerivedValue: (/** @type {() => any} */ f) => ({ value: f() }),
    useReducedMotion: () => false,
    useSharedValue: (/** @type {any} */ depart) => React.useRef(valeurPartagee(depart)).current,
    withDelay: (/** @type {number} */ d, /** @type {any} */ v) => {
      journal.push({ args: [d, v], fn: 'withDelay' });
      return v;
    },
    withRepeat: (/** @type {any} */ v, /** @type {any[]} */ ...reste) => {
      journal.push({ args: [v, ...reste], fn: 'withRepeat' });
      return v;
    },
    withSequence: (/** @type {any[]} */ ...vs) => {
      journal.push({ args: vs, fn: 'withSequence' });
      return vs[vs.length - 1];
    },
    withSpring: (/** @type {any} */ v, /** @type {any} */ config) => {
      journal.push({ args: [v, config], fn: 'withSpring' });
      return v;
    },
    withTiming: (/** @type {any} */ v, /** @type {any} */ config, /** @type {any} */ fin) => {
      journal.push({ args: [v, config], fn: 'withTiming' });
      // Le rappel de fin passe APRÈS l'affectation de la valeur, comme sur le
      // vrai fil d'animation : sinon il écraserait ce qu'il vient de poser.
      if (typeof fin === 'function') Promise.resolve().then(() => fin(true));
      return v;
    },
  };
};

/**
 * Un geste enchaînable qui RETIENT ses rappels (`onBegin`, `onUpdate`…) et
 * ses réglages (`activateAfterLongPress`, `maxDuration`…).
 * @param {string} type - Le type de geste (Pan, Tap).
 * @returns {any} Le geste.
 */
const gesteEnregistre = (type) => {
  /** @type {any} */
  const geste = { rappels: {}, reglages: {}, type };
  [
    'onBegin', 'onStart', 'onUpdate', 'onChange', 'onEnd', 'onFinalize', 'onTouchesDown', 'onTouchesUp',
  ].forEach((nom) => {
    geste[nom] = (/** @type {Function} */ f) => { geste.rappels[nom] = f; return geste; };
  });
  [
    'activateAfterLongPress', 'activeOffsetX', 'activeOffsetY', 'enabled', 'failOffsetX',
    'failOffsetY', 'hitSlop', 'maxDistance', 'maxDuration', 'minDistance', 'numberOfTaps',
    'runOnJS', 'shouldCancelWhenOutside', 'simultaneousWithExternalGesture',
  ].forEach((nom) => {
    geste[nom] = (/** @type {any} */ v) => { geste.reglages[nom] = v; return geste; };
  });
  return geste;
};

/**
 * La doublure de `react-native-gesture-handler`.
 * @returns {any} Le module de doublure.
 */
const gestureHandler = () => ({
  __esModule: true,
  Directions: {
    DOWN: 8, LEFT: 2, RIGHT: 1, UP: 4,
  },
  Gesture: {
    Exclusive: (/** @type {any[]} */ ...gestes) => ({ gestes, type: 'Exclusive' }),
    Fling: () => gesteEnregistre('Fling'),
    LongPress: () => gesteEnregistre('LongPress'),
    Pan: () => gesteEnregistre('Pan'),
    Race: (/** @type {any[]} */ ...gestes) => ({ gestes, type: 'Race' }),
    Simultaneous: (/** @type {any[]} */ ...gestes) => ({ gestes, type: 'Simultaneous' }),
    Tap: () => gesteEnregistre('Tap'),
  },
  // Le détecteur rend ses enfants dans une vue qui PORTE le geste : un témoin
  // le retrouve par `testID="gesture-detector"` et joue ses rappels.
  GestureDetector: (/** @type {any} */ { children, gesture }) => React.createElement(
    RN.View,
    /** @type {any} */ ({ gesture, testID: 'gesture-detector' }),
    children,
  ),
  GestureHandlerRootView: RN.View,
  ScrollView: RN.ScrollView,
  Swipeable: RN.View,
});

module.exports = { gestureHandler, journal, reanimated };
