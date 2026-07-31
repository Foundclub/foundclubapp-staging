import { QueryClient } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { useTour } from '../../context/TourContext';
import SharedAppProviders from '../AppProviders.shared';

// Filet L01-D (audit docs/AUDIT_TOUR_GUIDE_ET_MISSIONS_2026_07_31.md §3.7) :
// la pile de fournisseurs partagée doit continuer de rendre ses enfants et de
// fournir un tour opérationnel après la suppression du système de missions.
// Ce test ne cite volontairement aucun module « guidance » : il doit être
// vert avant ET après le retrait.

jest.mock('@/store/appContext', () => {
  const store = new Map();
  return {
    AppProvider: ({ children }) => children,
    storage: {
      delete: (key) => store.delete(key),
      getString: (key) => (store.has(key) ? store.get(key) : undefined),
      set: (key, value) => store.set(key, value),
    },
  };
});

jest.mock('@/theme/themeContext', () => ({
  ThemeProvider: ({ children }) => children,
}));

jest.mock('@/context/AppFeedbackContext', () => ({
  AppFeedbackProvider: ({ children }) => children,
}));

// Valeurs STABLES entre deux rendus : un objet neuf à chaque appel de hook
// relancerait les effets qui en dépendent, en boucle infinie.
const mockAppMode = { isGold: false };
const mockAuthValue = {
  appBootstrapData: null,
  userData: {
    club: { documentId: 'club-1' },
    documentId: 'user-app-providers-test',
    myTeams: [],
    trainedTeams: [],
  },
};

jest.mock('@/context/AppModeContext', () => ({
  AppModeProvider: ({ children }) => children,
  useAppMode: () => mockAppMode,
}));

jest.mock('@/context/BlockingOverlayContext', () => ({
  BlockingOverlayProvider: ({ children }) => children,
}));

jest.mock('@/context/ClubScopeContext', () => ({
  ClubScopeProvider: ({ children }) => children,
}));

jest.mock('@/context/PopupManagerContext', () => ({
  PopupManagerProvider: ({ children }) => children,
}));

jest.mock('@/context/SmartNotificationContext', () => ({
  SmartNotificationProvider: ({ children }) => children,
}));

jest.mock('@/context/StartupPhaseContext', () => ({
  StartupPhaseProvider: ({ children }) => children,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/navigation/navigationService', () => ({
  navigate: jest.fn(() => true),
}));

jest.mock('@/platform/storage', () => {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    removeItem: (key) => store.delete(key),
    setItem: (key, value) => store.set(key, value),
  };
});

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { patch: jest.fn(() => Promise.resolve({ data: null })) },
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

const renderStack = () => {
  const queryClient = new QueryClient();
  let tree;
  act(() => {
    tree = renderer.create(
      <SharedAppProviders queryClient={queryClient}>
        <Probe />
      </SharedAppProviders>,
    );
  });
  return tree;
};

beforeEach(() => {
  jest.useFakeTimers();
  tour = undefined;
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe('AppProviders.shared — pile partagée (filet L01-D)', () => {
  it('rend ses enfants à travers toute la pile de fournisseurs', () => {
    renderStack();
    expect(tour).not.toBeUndefined();
  });

  it("fournit un tour opérationnel : startTour('coach') démarre le tour", () => {
    renderStack();
    let started;
    act(() => { started = tour.startTour('coach'); });

    expect(started).toBe(true);
    expect(tour.isTourActive).toBe(true);
    expect(tour.tourStatus).toBe('active');
  });
});
