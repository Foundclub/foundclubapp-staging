import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { COACH_GUIDE } from '@/domains/tour/coachGuide';

import TourFullScreen from '../TourFullScreen';

// GUIDE-FINITIONS-3, R2-5 du rejeu 2 (captures A15, A23) : palier « Ton équipe est prête ! »
// et clôture « Prêt·e pour la séance » affichés à 0 %, missions passées.

let mockTour;
// Les vrais textes de fr.js, interpolation et pluriel compris.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
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
    Rect: Box,
    Stop: Box,
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ title }) => <TexteRN>{title}</TexteRN> };
});
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 16 }) }),
  }),
}));

const baseTour = (extra = {}) => ({
  completeCurrentStep: jest.fn(),
  created: {},
  finishGuide: jest.fn(),
  flags: { firstName: 'Sam', hadClub: true, hadTeam: false },
  gauge: 100,
  missions: COACH_GUIDE.missions,
  missionStatus: {},
  pauseTour: jest.fn(),
  ...extra,
});

const textsOf = (kind) => {
  let tree;
  act(() => { tree = renderer.create(<TourFullScreen kind={kind} />); });
  const texts = tree.root.findAllByType(Text)
    .map((node) => [node.props.children].flat().filter((c) => typeof c === 'string').join(''))
    .filter(Boolean);
  act(() => tree.unmount());
  return texts.join(' | ');
};

const ALL_BLOCKED = {
  coach_m1: 'blocked', coach_m2: 'blocked', coach_m3: 'blocked', coach_m4: 'blocked',
};

describe('R2-5 — le palier et la clôture disent la vérité', () => {
  it('palier à 0 %, toutes les missions passées : pas « Ton équipe est prête ! »', () => {
    mockTour = baseTour({ gauge: 0, missionStatus: ALL_BLOCKED });
    const texts = textsOf('milestone');
    expect(texts).not.toContain('Ton équipe est prête !');
    expect(texts).toContain('Aucune mission faite pour l’instant');
  });

  it('palier : M1 passée mais M2 faite, pas « équipe prête »', () => {
    mockTour = baseTour({
      gauge: 25, missionStatus: { ...ALL_BLOCKED, coach_m2: 'done' },
    });
    const texts = textsOf('milestone');
    expect(texts).not.toContain('Ton équipe est prête !');
    expect(texts).toContain('Une partie est faite');
  });

  it('palier : M1 faite, le titre reste (témoin)', () => {
    mockTour = baseTour({
      gauge: 25, missionStatus: { ...ALL_BLOCKED, coach_m1: 'done' },
    });
    expect(textsOf('milestone')).toContain('Ton équipe est prête !');
  });

  it('clôture à 0 % : pas « Prêt·e pour la séance »', () => {
    mockTour = baseTour({ gauge: 0, missionStatus: ALL_BLOCKED });
    const texts = textsOf('closing');
    expect(texts).not.toContain('Prêt·e pour la séance');
    expect(texts).toContain('Le guide est fini');
  });

  it('clôture, tout fait : « Prêt·e pour la séance » (témoin)', () => {
    mockTour = baseTour({
      gauge: 100,
      missionStatus: {
        coach_m1: 'done', coach_m2: 'done', coach_m3: 'done', coach_m4: 'done',
      },
    });
    expect(textsOf('closing')).toContain('Prêt·e pour la séance');
  });
});
