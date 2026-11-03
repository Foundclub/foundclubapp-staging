import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { TourProvider, useTour } from '../TourContext';

// T3-GUIDE-SITE (Adel « 3- A », 03/11) : le guide de l'entraîneur sur le site, derrière
// `GUIDE_SUR_LE_SITE`. Éteint, le site ne change pas ; allumé, il démarre comme sur le téléphone.

let mockFlag = false;
jest.mock('@/config/fonctionsMasquees', () => Object.defineProperty(
  { ...jest.requireActual('@/config/fonctionsMasquees') },
  'GUIDE_SUR_LE_SITE',
  { get: () => mockFlag },
));
jest.mock('@/navigation/navigationService', () => ({ navigate: jest.fn(() => true) }));

let mockUserData;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

const mockStore = new Map();
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
let plateforme;
const mount = () => {
  mockUserData = {
    club: { documentId: 'club-1' },
    documentId: 'coach-1',
    onboardingCompletedAt: '2026-11-03T08:00:00.000Z',
    role: { name: 'Entraîneur' },
    trainedTeams: [],
  };
  act(() => { tree = renderer.create(<TourProvider><Probe /></TourProvider>); });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockStore.clear();
  plateforme = jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(() => {
  act(() => { tree?.unmount(); });
  plateforme.restore();
  jest.useRealTimers();
});

describe('Interrupteur éteint : le site ne change pas', () => {
  beforeEach(() => { mockFlag = false; });

  it('ni départ ni proposition', () => {
    mount();
    expect(tour.isGuideOfferable).toBe(false);
    let parti;
    act(() => { parti = tour.startTour('coach'); });
    expect(parti).toBe(false);
    expect(tour.isTourActive).toBe(false);
  });

  it('ni « Recommencer »', () => {
    mount();
    let parti;
    act(() => { parti = tour.restartTour('coach'); });
    expect(parti).toBe(false);
  });
});

describe('Interrupteur allumé : le guide part sur le site', () => {
  beforeEach(() => { mockFlag = true; });

  it('la proposition de l accueil apparaît', () => {
    mount();
    expect(tour.isGuideOfferable).toBe(true);
  });

  it('le guide à missions démarre et garde sa progression', () => {
    mount();
    let parti;
    act(() => { parti = tour.startTour('coach'); });
    expect(parti).toBe(true);
    expect(tour.isGuide).toBe(true);
    expect(tour.isTourActive).toBe(true);
    expect(mockStore.get('tourGuideDone_coach-1')).toBe('1');
  });

  it('un ancien tour v2 (dirigeant) reste refusé : sa bannière n est pas sur le site', () => {
    mount();
    let parti;
    act(() => { parti = tour.startTour('president'); });
    expect(parti).toBe(false);
    expect(tour.isTourActive).toBe(false);
  });
});
