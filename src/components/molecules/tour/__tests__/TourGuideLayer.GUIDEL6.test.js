import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TourFullScreen from '../TourFullScreen';
import TourGuideLayer from '../TourGuideLayer';

// GUIDE-RELANCE (L6, 28/10) — audit du guide Entraîneur.
// « 5- A » : l'ouverture n'avait que « C'est parti » (capture 75) ; un coach
// pressé doit pouvoir dire « Plus tard » et découvrir l'app seul.
// Bloquant n° 6 : quand l'écran refuse le geste d'une mission essentielle
// (quota, droit, club partenaire), la couche dit pourquoi et offre une sortie.

let mockTour;
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton' }, isAddingAccount: false }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 24, left: 0, right: 0, top: 54,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  /**
   * Doublure SVG : une simple vue.
   * @param {{ children?: any }} props - Enfants.
   * @returns {any} Vue.
   */
  function Box({ children }) { return <View>{children}</View>; }
  return {
    __esModule: true,
    Circle: Box,
    default: Box,
    Defs: Box,
    LinearGradient: Box,
    Mask: Box,
    Rect: Box,
    Stop: Box,
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: T, TouchableOpacity: P } = jest.requireActual('react-native');
  return function ButtonMock({ onPress, title }) {
    return <P onPress={onPress}><T>{title}</T></P>;
  };
});
jest.mock('@/theme/colors', () => ({ withAlpha: (color) => color }));
jest.mock('@/hooks/useReduceMotion', () => ({ __esModule: true, default: () => true }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 16, lineHeight: 20 }) }),
  }),
}));

const flat = (c) => {
  if (Array.isArray(c)) return c.map(flat).join('');
  if (c === null || c === undefined || typeof c === 'boolean') return '';
  if (typeof c === 'object') return flat(c?.props?.children);
  return String(c);
};
const textsOf = (tree) => tree.root.findAllByType(Text).map((n) => flat(n.props.children));
const press = (tree, label) => {
  const node = tree.root.findAllByType(TouchableOpacity)
    .find((n) => n.findAllByType(Text).some((x) => flat(x.props.children) === label));
  if (!node) throw new Error(`Bouton introuvable : ${label}`);
  act(() => { node.props.onPress(); });
};

const baseTour = (extra) => ({
  blocked: null,
  completeCurrentStep: jest.fn(),
  created: {},
  currentMission: { id: 'coach_m1', locked: true, title: 'Créer ton équipe' },
  currentStep: { id: 'm1-dock', targets: ['dock.teams'], text: 'Ouvre l’onglet Équipes.' },
  finishGuide: jest.fn(),
  flags: {},
  gauge: 0,
  isGuide: true,
  isLockedStep: true,
  isTourActive: true,
  missionPosition: { index: 1, isBonus: false, total: 4 },
  missions: [],
  missionStatus: {},
  pauseTour: jest.fn(),
  reward: null,
  skipBlockedMission: jest.fn(),
  skipMission: jest.fn(),
  tourStatus: 'active',
  ...extra,
});

describe('Ouverture : « Plus tard » (décision 5- A)', () => {
  it('met le guide en pause au lieu de l’imposer', () => {
    mockTour = baseTour({ currentStep: { id: 'open', kind: 'opening' } });
    let tree;
    act(() => { tree = renderer.create(<TourFullScreen kind="opening" />); });
    expect(textsOf(tree)).toContain('Plus tard');
    press(tree, 'Plus tard');
    expect(mockTour.pauseTour).toHaveBeenCalled();
    expect(mockTour.completeCurrentStep).not.toHaveBeenCalled();
  });
});

describe('Mission refusée par l’écran (bloquant n° 6)', () => {
  it('dit « tu ne peux pas le faire maintenant », la raison, et propose de passer', () => {
    mockTour = baseTour({
      blocked: { key: 'paywall.team-limit', reason: 'Ton club a atteint 3 équipes.' },
    });
    let tree;
    act(() => { tree = renderer.create(<TourGuideLayer />); });
    const texts = textsOf(tree);
    expect(texts).toContain('Tu ne peux pas le faire maintenant');
    expect(texts).toContain('Ton club a atteint 3 équipes.');
    press(tree, 'Passer cette mission');
    expect(mockTour.skipBlockedMission).toHaveBeenCalled();
  });

  it('sans refus, aucune carte', () => {
    mockTour = baseTour({});
    let tree;
    act(() => { tree = renderer.create(<TourGuideLayer />); });
    expect(textsOf(tree)).not.toContain('Tu ne peux pas le faire maintenant');
  });
});
