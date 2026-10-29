import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TourResumePill from '../TourResumePill';

// GUIDE-FINITIONS-2 n° 24 (rejeu du 28/10, captures 00 et 55) : la pastille « Reprendre
// le tour » ne disait ni la mission ni la jauge, et sa croix effaçait le guide d'un
// toucher, sans confirmation.

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

let tree;
const mount = () => act(() => { tree = renderer.create(<TourResumePill />); });
const texts = () => tree.root.findAll((node) => typeof node.type === 'string'
  && typeof node.props.children === 'string').map((node) => node.props.children).join(' | ');
const quitButton = () => tree.root.findAll((node) => (
  node.props.accessibilityLabel === 'Arrêter le guide'
  && typeof node.props.onPress === 'function'))[0];
const styleOf = (node) => Object.assign({}, ...[node.props.style].flat(5).filter(Boolean));

let alertSpy;
beforeEach(() => { alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => {
  alertSpy.mockRestore();
  act(() => tree?.unmount());
});

describe('n° 24 — la pastille dit où en est le guide', () => {
  it('témoin : « Reprendre le tour » reprend', () => {
    mockTour = pausedTour();
    mount();
    expect(texts()).toContain('Reprendre le tour');
  });

  it('la mission et la jauge', () => {
    mockTour = pausedTour();
    mount();
    expect(texts()).toContain('Mission 2/4');
    expect(texts()).toContain('Inviter tes joueur·se·s');
    expect(texts()).toContain('25 %');
  });

  it('en pause sur l’ouverture (pas encore de mission) : la jauge seule', () => {
    mockTour = pausedTour({ currentMission: null, gauge: 0, missionPosition: null });
    mount();
    expect(texts()).toContain('0 %');
    expect(texts()).not.toContain('Mission');
  });
});

describe('n° 24 — la croix demande confirmation', () => {
  it('un toucher n’efface rien : une question d’abord', () => {
    mockTour = pausedTour();
    mount();
    act(() => { quitButton().props.onPress(); });
    expect(mockTour.exitTour).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2];
    expect(buttons).toHaveLength(2);
    // « Annuler » ne fait rien, « Arrêter » efface.
    buttons.find((button) => button.style === 'cancel').onPress?.();
    expect(mockTour.exitTour).not.toHaveBeenCalled();
    buttons.find((button) => button.style === 'destructive').onPress();
    expect(mockTour.exitTour).toHaveBeenCalledTimes(1);
  });

  it('une cible de 44 pt (elle faisait environ 12 pt)', () => {
    mockTour = pausedTour();
    mount();
    const style = styleOf(quitButton());
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});
