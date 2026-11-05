import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TourFullScreen from '../TourFullScreen';

// Socle du guide Dirigeant (lot L1, 05/11) : l'écran plein cadre lit ses textes, sa mission clé et
// son bilan dans le profil en cours, plus dans celui de l'entraîneur.

let mockTour;
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => {
      if (key === 'tourCatalog.president.palier.title') return 'Ton club est prêt !';
      if (key === 'club.ready') return 'Club prêt';
      return typeof fallback === 'string' ? fallback : key;
    },
  }),
}));
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
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
    Rect: Box,
    Stop: Box,
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ title }) => <RNText>{title}</RNText> };
});
jest.mock('@/theme/colors', () => ({ withAlpha: (color) => color }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 16, lineHeight: 20 }) }),
  }),
}));
jest.mock('@/domains/tour/tourCatalog', () => {
  const actual = jest.requireActual('@/domains/tour/tourCatalog');
  const guide = {
    closingLines: () => ['AS Test complété'],
    exampleMissionId: 'd_b1',
    gaugeLabelKey: 'club.ready',
    keyMissionId: 'd_m1',
  };
  return {
    ...actual,
    getTourProfile: (key) => (key === 'president' ? guide : actual.getTourProfile(key)),
  };
});

const MISSIONS = [{ id: 'd_m1', locked: true, title: 'Ton club' }];
const tourDirigeant = (missionStatus) => ({
  completeCurrentStep: jest.fn(),
  created: {},
  finishGuide: jest.fn(),
  flags: {},
  gauge: 100,
  missions: MISSIONS,
  missionStatus,
  pauseTour: jest.fn(),
  profileKey: 'president',
});
const textsOf = (kind) => {
  let tree;
  act(() => { tree = renderer.create(<TourFullScreen kind={kind} />); });
  const texts = tree.root.findAllByType(Text)
    .map((node) => [node.props.children].flat(5).join(''));
  act(() => tree.unmount());
  return texts.join(' | ');
};

describe('le palier suit le profil', () => {
  it('sa mission clé faite : son titre à lui', () => {
    mockTour = tourDirigeant({ d_m1: 'done' });
    expect(textsOf('milestone')).toContain('Ton club est prêt !');
  });

  it('témoin : la mission du coach ne compte pas pour lui', () => {
    mockTour = tourDirigeant({ coach_m1: 'done' });
    expect(textsOf('milestone')).not.toContain('Ton club est prêt !');
  });

  it('la jauge dit ce que son guide prépare', () => {
    mockTour = tourDirigeant({ d_m1: 'done' });
    expect(textsOf('milestone')).toContain('Club prêt');
  });
});

describe('la clôture suit le profil', () => {
  it('son bilan, et pas les lignes de l’entraîneur', () => {
    mockTour = {
      ...tourDirigeant({ d_m1: 'done' }),
      created: { 'team.created': { teamName: 'Seniors' } },
    };
    const texts = textsOf('closing');
    expect(texts).toContain('AS Test complété');
    expect(texts).not.toContain('Seniors');
  });
});
