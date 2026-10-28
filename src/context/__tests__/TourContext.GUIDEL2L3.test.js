import renderer, { act } from 'react-test-renderer';

import { resetGuidanceRuntimeForTests } from '@/domains/guidance/guidanceRuntime';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// GUIDE-ENTETE (28/10, décision d'Adel 3- A, partie navigation) — audit du
// guide Entraîneur, captures 76-77 : relancé depuis Mon compte, le guide
// restait sur Mon compte, sans barre d'onglets, et sa bulle couvrait la flèche.
// La relance revient à l'accueil EN DÉPILANT (react-navigation 7 : `navigate`
// sans `pop` empile un doublon au lieu de revenir).

const mockNavigate = jest.fn(() => true);
jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
}));

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

const USER_ID = 'coach-1';

let tour;
/**
 * Sonde : capture la valeur du contexte du tour.
 * @returns {null} Rien à rendre.
 */
function Probe() {
  tour = useTour();
  return null;
}

const renderProvider = () => {
  act(() => {
    renderer.create(<TourProvider><Probe /></TourProvider>);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  tour = undefined;
  // Coach avec club, sans équipe : M1 passe par le tunnel équipe.
  mockUserData = {
    club: { documentId: 'club-1' },
    documentId: USER_ID,
    firstname: 'Sam',
    myTeams: [],
    trainedTeams: [],
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe('Relance du guide depuis Mon compte', () => {
  it('repart de l’accueil en dépilant Mon compte (pop)', () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.HomeTab,
      { screen: 'SearchHome' },
      { pop: true },
    );
  });
});
