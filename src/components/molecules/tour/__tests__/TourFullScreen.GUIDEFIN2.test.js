import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { COACH_GUIDE } from '@/domains/tour/coachGuide';

import TourFullScreen from '../TourFullScreen';

// GUIDE-FINITIONS-2 (rejeu du guide Entraîneur, 28/10 au soir). TourFullScreen
// n'avait aucun test : les témoins d'abord (ce qui ne doit pas bouger), puis
// - n° 20 : l'ouverture d'un coach sans club ne disait pas « trouve ton club » (75) ;
// - n° 29 : le palier ne disait pas où retrouver les bonus ; la clôture disait
//   « 1 séance(s) », « Retrouve ce guide dans Mon compte » sans dire où, rien sur
//   l'équipe d'un coach qui l'avait déjà, rien sur le match d'exemple (36, 49).

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

describe('témoins (inchangés)', () => {
  it('ouverture : C’est parti, Plus tard, les 4 missions', () => {
    mockTour = baseTour({ gauge: 0 });
    const texts = textsOf('opening');
    expect(texts).toContain('C\'est parti');
    expect(texts).toContain('Plus tard');
    expect(texts).toContain('Créer ton équipe');
    expect(texts).toContain('Inviter tes joueur·se·s');
  });

  it('clôture : ce qui a été créé est marqué RÉEL, Aller à l’accueil', () => {
    mockTour = baseTour({
      created: { 'friendlyMatch.ad.published': {}, 'team.created': { teamName: 'U13' } },
    });
    const texts = textsOf('closing');
    expect(texts).toContain('U13 créée');
    expect(texts).toContain('Annonce de match amical publiée');
    expect(texts).toContain('RÉEL');
    expect(texts).toContain('Aller à l\'accueil');
  });
});

describe('n° 20 — ouverture d’un coach sans club', () => {
  it('sous « Créer ton équipe » : trouve d’abord ton club', () => {
    mockTour = baseTour({ flags: { hadClub: false, hadTeam: false }, gauge: 0 });
    expect(textsOf('opening')).toContain('D’abord, trouve ton club (ou crée-le)');
  });

  it('témoin : un coach qui a son club ne le lit pas', () => {
    mockTour = baseTour({ gauge: 0 });
    expect(textsOf('opening')).not.toContain('trouve ton club');
  });
});

describe('n° 29 — palier et clôture', () => {
  it('palier : « Plus tard » dit où retrouver les bonus', () => {
    mockTour = baseTour();
    expect(textsOf('milestone')).toContain('Mon compte › Guide entraîneur·e');
  });

  it('clôture : « 1 séance programmée », sans « (s) »', () => {
    mockTour = baseTour({ created: { 'event.created': { occurrences: 1 } } });
    const texts = textsOf('closing');
    expect(texts).toContain('1 séance programmée');
    expect(texts).not.toContain('(s)');
  });

  it('clôture : plusieurs séances au pluriel', () => {
    mockTour = baseTour({ created: { 'event.created': { occurrences: 9 } } });
    expect(textsOf('closing')).toContain('9 séances programmées');
  });

  it('clôture : le chemin du guide dans Mon compte', () => {
    mockTour = baseTour();
    expect(textsOf('closing')).toContain('Mon compte › Guide entraîneur·e');
  });

  it('clôture : l’équipe d’un coach qui l’avait déjà a sa ligne', () => {
    mockTour = baseTour({ flags: { hadClub: true, hadTeam: true } });
    expect(textsOf('closing')).toContain('Ton équipe, déjà prête');
  });

  it('clôture : le match d’exemple de B2 est dit effacé', () => {
    mockTour = baseTour({ missionStatus: { coach_b2: 'done' } });
    expect(textsOf('closing')).toMatch(/match d’exemple/i);
  });

  it('témoin : B2 passé, rien sur le match d’exemple', () => {
    mockTour = baseTour({ missionStatus: { coach_b2: 'skipped' } });
    expect(textsOf('closing')).not.toMatch(/match d’exemple/i);
  });
});
