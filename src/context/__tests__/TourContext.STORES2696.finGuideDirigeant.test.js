import renderer, { act } from 'react-test-renderer';

import { resetGuidanceRuntimeForTests } from '@/domains/guidance/guidanceRuntime';
import { TOUR_HOME_TARGET } from '@/domains/tour/tourCatalog';
import { resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import { TourProvider, useTour } from '../TourContext';

// Décision du chef du 08/11 (STORES-2696) : guide Dirigeant allumé, la fin du guide raccompagne à
// l'accueil, comme l'ancien tour (TourContext.test.js, D23 ⑥). Le guide avance par missions et les
// essentielles ne se passent pas : on part du 1er bonus et on passe chaque bonus. Toute boucle a
// sa borne (une boucle sans limite a bloqué la série complète le 08/11).
const mockNavigate = jest.fn(() => true);
jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
}));
jest.mock('@/domains/tour/presidentGuideSettings', () => {
  const actual = jest.requireActual('@/domains/tour/presidentGuideSettings');
  const settings = { ...actual.PRESIDENT_GUIDE_SETTINGS, enabled: true };
  return { __esModule: true, default: settings, PRESIDENT_GUIDE_SETTINGS: settings };
});

const mockStore = new Map();
let mockAuth;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));
jest.mock('@/store/appContext', () => ({
  storage: {
    delete: (key) => mockStore.delete(key),
    getString: (key) => (mockStore.has(key) ? mockStore.get(key) : undefined),
    set: (key, value) => mockStore.set(key, value),
  },
}));

let tour;
/**
 * Sonde : capture la valeur du contexte du tour.
 * @returns {null} Rien à rendre.
 */
function Probe() {
  tour = useTour();
  return null;
}

let tree;

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  resetTourTargetsForTests();
  tour = undefined;
  mockAuth = {
    subscriptionAccessLevel: 'CLUB',
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'user-1',
      firstname: 'Sam',
      role: { name: 'President', type: 'president' },
      trainedTeams: [],
    },
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  act(() => tree?.unmount());
  jest.useRealTimers();
});

describe('TourContext — guide Dirigeant allumé : la fin raccompagne à l’accueil', () => {
  it('guide à missions allumé : le retour à l’accueil depuis la dernière étape', () => {
    act(() => { tree = renderer.create(<TourProvider><Probe /></TourProvider>); });
    act(() => { tour.startTour('president', { fromMission: 'president_b1' }); });
    expect(tour.isGuide).toBe(true);

    const vues = [];
    const passerLeBonus = () => act(() => { tour.skipMission(); });
    for (let garde = 0; tour.currentStep?.id !== 'close' && garde < 20; garde += 1) {
      vues.push(tour.currentStep?.id);
      passerLeBonus();
    }
    expect({ derniere: tour.currentStep?.id, vues }).toMatchObject({ derniere: 'close' });

    mockNavigate.mockClear();
    act(() => { tour.finishGuide(); });

    expect(tour.isTourActive).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith(
      TOUR_HOME_TARGET.routeName,
      TOUR_HOME_TARGET.params,
      { pop: true },
    );
  });
});
