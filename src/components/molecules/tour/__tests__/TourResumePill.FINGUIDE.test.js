import { readFileSync } from 'fs';
import { join } from 'path';

import renderer, { act } from 'react-test-renderer';

import TourResumePill from '../TourResumePill';

// FIN-GUIDE, point 5 (capture 5 d'Adel, 02/11) : « Reprendre le tour » poussait le titre ACCUEIL
// et n'était pas alignée sur les cartes de la page.

let mockTour;
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => jest.requireActual('i18next').t(...args) }),
}));
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/theme/colors', () => ({ withAlpha: (color) => color }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 14 }) }),
  }),
}));

const pausedTour = (extra = {}) => ({
  currentMission: { locked: true, title: 'Inviter tes joueur·se·s' },
  currentStep: { id: 'm2-card' },
  exitTour: jest.fn(),
  gauge: 25,
  isGuide: true,
  isTourActive: true,
  missionPosition: { index: 2, isBonus: false, total: 4 },
  resumeTour: jest.fn(),
  tourStatus: 'paused',
  ...extra,
});

const styleOf = (node) => Object.assign({}, ...[node.props.style].flat(5).filter(Boolean));

let tree;
const mount = () => act(() => { tree = renderer.create(<TourResumePill />); });
afterEach(() => act(() => tree?.unmount()));

describe('TourResumePill redessinée', () => {
  it('occupe la largeur de la page, sans retrait propre (alignée sur les cartes)', () => {
    mockTour = pausedTour();
    mount();
    const card = tree.root.findByProps({ testID: 'tour.resumePill' });
    const style = styleOf(card);
    expect(style.alignSelf).not.toBe('flex-start');
    expect(style.marginHorizontal).toBeUndefined();
    expect(style.borderRadius).toBeLessThan(999);
  });

  it('dit la mission et montre la jauge à sa valeur', () => {
    mockTour = pausedTour();
    mount();
    const gauge = tree.root.findByProps({ testID: 'tour.resumePill.gauge' });
    expect(styleOf(gauge).width).toBe('25%');
    const texts = tree.root.findAll((node) => typeof node.type === 'string'
      && typeof node.props.children === 'string').map((node) => node.props.children).join(' | ');
    expect(texts).toMatch(/Mission 2\/4/);
    expect(texts).toMatch(/Inviter tes joueur·se·s/);
    expect(texts).toMatch(/25\s%/);
  });

  it('toute la carte reprend le guide, la cible fait au moins 44 pt', () => {
    mockTour = pausedTour();
    mount();
    const button = tree.root.findAll((node) => node.props.testID === 'tour.resumePill.resume'
      && typeof node.props.onPress === 'function')[0];
    act(() => button.props.onPress());
    expect(mockTour.resumeTour).toHaveBeenCalledTimes(1);
    expect(styleOf(button).minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('Attente finie', () => {
  const title = () => tree.root.findAll((node) => typeof node.type === 'string'
    && typeof node.props.children === 'string').map((node) => node.props.children)[0];

  it('en attente : elle le dit ; réponse arrivée : « Reprendre le tour »', () => {
    mockTour = pausedTour({ currentStep: { pausedLabel: 'En attente de ton équipe · Reprendre' } });
    mount();
    expect(title()).toMatch(/En attente/);
    act(() => tree.unmount());
    mockTour = pausedTour({
      currentStep: { pausedLabel: 'En attente de ton équipe · Reprendre' },
      isWaitOver: true,
    });
    mount();
    expect(title()).toBe('Reprendre le tour');
  });
});

describe('Place dans l’accueil', () => {
  it('sous le titre ACCUEIL, plus au-dessus : elle ne le pousse plus', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/views/home/HomeHub.js'),
      'utf8',
    );
    const title = source.indexOf("t('homeHub.title', 'Accueil').toUpperCase()");
    const pill = source.indexOf('<TourResumePill />');
    expect(title).toBeGreaterThan(-1);
    expect(pill).toBeGreaterThan(title);
  });
});
