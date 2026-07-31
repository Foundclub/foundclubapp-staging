import renderer, { act } from 'react-test-renderer';

import { TourProvider, useTour } from '../TourContext';

// Audit 2026-07-31 §4.5 : sur le site, le moteur du tour est monté mais PAS
// TourBanner — le tour navigait de page en page sans instruction ni sortie.
// Décision : startTour refuse de démarrer sur le web tant que le bandeau n'y
// est pas monté (Welcome navigue alors vers l'accueil, son chemin `!started`).

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'web',
  select: (spec) => ('web' in spec ? spec.web : spec.default),
}));

const mockNavigate = jest.fn(() => true);
jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'user-web-1',
      myTeams: [],
      trainedTeams: [],
    },
  }),
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
 * Sonde : capture la valeur du contexte du tour pour les assertions.
 * @returns {null} Rien à rendre.
 */
function Probe() {
  tour = useTour();
  return null;
}

it('sur le web, startTour refuse de démarrer : ni navigation, ni progression persistée', () => {
  act(() => {
    renderer.create(
      <TourProvider>
        <Probe />
      </TourProvider>,
    );
  });

  let started;
  act(() => { started = tour.startTour('coach'); });

  expect(started).toBe(false);
  expect(tour.isTourActive).toBe(false);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockStore.size).toBe(0);
});
