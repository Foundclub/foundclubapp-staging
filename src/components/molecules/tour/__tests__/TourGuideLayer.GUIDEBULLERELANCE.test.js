/* eslint-disable max-len -- les libellés et les témoins se lisent en entier. */
import fs from 'fs';
import path from 'path';

import renderer, { act } from 'react-test-renderer';

import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// ==========================================================================
// GUIDE-BULLE-RELANCE (13/11, décision d'Adel « 318 B ») — bonus 1 du guide Entraîneur, étape
// « relance » (b1-relance). Sur le SITE, un entraînement n'a pas de bouton « Relancer » : la fiche
// du site pose l'ancre `event.relance.telephone` et la bulle de repli dit de relancer depuis le
// téléphone (« Passer ce bonus » est le bouton déjà présent sur toute bulle de bonus).
// ICI, LE TÉLÉPHONE : il ne pose jamais cette ancre, donc il ne voit jamais la bulle de repli,
// qu'il ait un bouton « Relancer » à l'écran ou non.
// ==========================================================================

jest.setTimeout(30000);

const SCREEN = { height: 640, width: 360 };
const CARD = {
  height: 60, width: 330, x: 15, y: 300,
};

let mockTour;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 640, scale: 3, width: 360,
  }),
}));
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton' }, isAddingAccount: false }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 24,
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
    __esModule: true, default: Box, Defs: Box, Mask: Box, Rect: Box,
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/molecules/tour/TourFullScreen', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('@/theme/colors', () => ({ withAlpha: (color) => color }));
jest.mock('@/hooks/useReduceMotion', () => ({ __esModule: true, default: () => true }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 16, lineHeight: 20 }) }),
  }),
}));

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);
const activeTour = (currentStep) => ({
  completeCurrentStep: jest.fn(),
  created: {},
  currentMission: { locked: false, title: 'Voir qui vient et relancer' },
  currentStep,
  exitTour: jest.fn(),
  gauge: 25,
  isGuide: true,
  isLockedStep: false,
  isTourActive: true,
  missionPosition: { index: 1, isBonus: true, total: 2 },
  pauseTour: jest.fn(),
  profileKey: 'coach',
  resumeTour: jest.fn(),
  returnToGuide: jest.fn(),
  reward: null,
  skipMission: jest.fn(),
  tourStatus: 'active',
});

const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};
const renderLayer = async () => {
  let tree;
  await act(async () => { tree = renderer.create(<TourGuideLayer />); });
  const root = tree.root.findAll((node) => node.props.testID === 'tour.layer'
    && typeof node.type !== 'string')[0];
  root.instance.measureInWindow = (cb) => cb(0, 0, SCREEN.width, SCREEN.height);
  await act(async () => {
    root.props.onLayout({ nativeEvent: { layout: { ...SCREEN, x: 0, y: 0 } } });
  });
  await act(async () => { jest.advanceTimersByTime(400); });
  await flush();
  return tree;
};
// Tous les textes affichés par la couche (la bulle et ses boutons).
const texteDeLaBulle = (tree) => tree.root
  .findAll((node) => typeof node.props.children === 'string')
  .map((node) => node.props.children)
  .join(' ');

beforeEach(() => {
  jest.useFakeTimers();
  resetTourTargetsForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('GUIDE-BULLE-RELANCE — le téléphone ne voit pas la bulle de repli du site', () => {
  it('téléphone, bouton « Relancer » à l’écran : la bulle dit toujours « relance-les en un clic »', async () => {
    mockTour = activeTour(step('b1-relance'));
    registerTourTarget('event.relance', (done) => done(CARD));
    const tree = await renderLayer();
    const texte = texteDeLaBulle(tree);
    expect(texte).toContain('relance-les en un clic');
    expect(texte).not.toContain('depuis ton téléphone');
  });

  it('téléphone, aucun bouton « Relancer » à l’écran : toujours pas de bulle de repli', async () => {
    mockTour = activeTour(step('b1-relance'));
    registerTourTarget('event.participants', (done) => done(CARD));
    const tree = await renderLayer();
    const texte = texteDeLaBulle(tree);
    expect(texte).toContain('relance-les en un clic');
    expect(texte).not.toContain('depuis ton téléphone');
  });

  it('la bulle de repli ne vient QUE de l’ancre du site `event.relance.telephone`', async () => {
    const repli = step('b1-relance').fallback;
    expect(repli?.targets).toEqual(['event.relance.telephone']);
    expect(repli.text).toContain('depuis ton téléphone');
    // Témoin du mécanisme : l'ancre du site posée ⇒ la bulle de repli s'affiche (ce que voit le site).
    mockTour = activeTour(step('b1-relance'));
    registerTourTarget('event.relance.telephone', (done) => done(CARD));
    const tree = await renderLayer();
    expect(texteDeLaBulle(tree)).toContain('depuis ton téléphone');
    expect(texteDeLaBulle(tree)).toContain('Passer ce bonus');
  });

  it('aucun fichier du téléphone ne pose l’ancre `event.relance.telephone` (seuls les *.web.js)', () => {
    const racine = path.resolve(__dirname, '../../../..');
    /** @type {string[]} */
    const poseurs = [];
    const parcourir = (/** @type {string} */ dossier) => {
      fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
        const chemin = path.join(dossier, entree.name);
        if (entree.isDirectory()) {
          if (entree.name !== '__tests__' && entree.name !== 'node_modules') parcourir(chemin);
          return;
        }
        if (!/\.(js|jsx|ts|tsx)$/.test(entree.name)) return;
        if (fs.readFileSync(chemin, 'utf8').includes('event.relance.telephone')) {
          poseurs.push(path.relative(racine, chemin).split(path.sep).join('/'));
        }
      });
    };
    parcourir(racine);
    const horsSite = poseurs.filter((fichier) => !/\.web\.(js|jsx|ts|tsx)$/.test(fichier)
      && fichier !== 'domains/tour/coachGuide.js');
    expect(poseurs).toContain('views/event/EventDetails.web.js');
    expect(horsSite).toEqual([]);
  });
});
