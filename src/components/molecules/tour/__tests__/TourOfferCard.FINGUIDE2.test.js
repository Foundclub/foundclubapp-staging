import renderer, { act } from 'react-test-renderer';

import TourOfferCard from '../TourOfferCard';

// FIN-GUIDE2 : la proposition du guide à l'accueil, dans le flux, avec un refus définitif.

let mockTour;
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));
jest.mock('@/components/atoms/button/Button', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress, title }) => <Pressable onPress={onPress}><Text>{title}</Text></Pressable>,
  };
});
jest.mock('@/theme/colors', () => ({ withAlpha: (color) => color }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 14 }) }),
  }),
}));

const offre = (overrides = {}) => ({
  declineGuideOffer: jest.fn(),
  isGuideOfferable: true,
  startTour: jest.fn(() => true),
  ...overrides,
});

let tree;
const mount = () => { act(() => { tree = renderer.create(<TourOfferCard />); }); };
const pressable = (titre) => tree.root.findAll((node) => typeof node.props.onPress === 'function'
  && node.findAll((enfant) => enfant.props.children === titre).length > 0)[0];

afterEach(() => { act(() => { tree?.unmount(); }); });

describe('TourOfferCard', () => {
  it('ne rend rien quand le guide n est pas à proposer', () => {
    mockTour = offre({ isGuideOfferable: false });
    mount();
    expect(tree.toJSON()).toBeNull();
  });

  it('« Lancer le guide » démarre le guide entraîneur', () => {
    mockTour = offre();
    mount();
    act(() => { pressable('Lancer le guide').props.onPress(); });
    expect(mockTour.startTour).toHaveBeenCalledWith('coach');
    expect(mockTour.declineGuideOffer).not.toHaveBeenCalled();
  });

  it('« Ne plus me le proposer » refuse sans démarrer', () => {
    mockTour = offre();
    mount();
    act(() => { pressable('Ne plus me le proposer').props.onPress(); });
    expect(mockTour.declineGuideOffer).toHaveBeenCalledTimes(1);
    expect(mockTour.startTour).not.toHaveBeenCalled();
  });

  it('dit où retrouver le guide après un refus', () => {
    mockTour = offre();
    mount();
    const textes = tree.root.findAll((node) => typeof node.type === 'string'
      && typeof node.props.children === 'string').map((node) => node.props.children).join(' | ');
    expect(textes).toMatch(/Mon compte › Guide entraîneur·e/);
  });
});
