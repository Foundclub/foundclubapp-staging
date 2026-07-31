import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// Filet L01-B (audit docs/AUDIT_TOUR_GUIDE_ET_MISSIONS_2026_07_31.md §7) :
// le moteur du tour n'avait AUCUN test (E6). Ces tests caractérisent :
// démarrage, étape suivante, validation par signal, reprise « paused », sortie.

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

const USER_ID = 'user-test-1';
const STORAGE_KEY = `tourProgress_${USER_ID}`;

let tour;
/**
 * Sonde : capture la valeur du contexte du tour pour les assertions.
 * @returns {null} Rien à rendre.
 */
function Probe() {
  tour = useTour();
  return null;
}

const renderProvider = () => {
  let tree;
  act(() => {
    tree = renderer.create(
      <TourProvider>
        <Probe />
      </TourProvider>,
    );
  });
  return tree;
};

const readPersisted = () => {
  const raw = mockStore.get(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  tour = undefined;
  mockUserData = {
    club: { documentId: 'club-1' },
    documentId: USER_ID,
    myTeams: [],
    trainedTeams: [],
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe('TourContext — démarrage', () => {
  it("startTour('coach') démarre à l'étape 1 et navigue vers le tunnel équipe", () => {
    renderProvider();
    let started;
    act(() => { started = tour.startTour('coach'); });

    expect(started).toBe(true);
    expect(tour.isTourActive).toBe(true);
    expect(tour.tourStatus).toBe('active');
    expect(tour.stepIndex).toBe(0);
    expect(tour.currentStep.id).toBe('coach_create_team');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.TeamStack, {
      params: { clubId: 'club-1' },
      screen: RouteNames.TeamWizardName,
    });
    expect(readPersisted()).toEqual({
      profileKey: 'coach', skippedStepIds: [], stepIndex: 0,
    });
  });

  it('les étapes déjà accomplies sont sautées au démarrage (isAlreadyDone)', () => {
    mockUserData.trainedTeams = [{ documentId: 'team-1' }];
    renderProvider();
    act(() => { tour.startTour('coach'); });

    expect(tour.stepIndex).toBe(1);
    expect(tour.currentStep.id).toBe('coach_find_event_card');
  });

  it('un profil inconnu ne démarre rien', () => {
    renderProvider();
    let started;
    act(() => { started = tour.startTour('inconnu'); });

    expect(started).toBe(false);
    expect(tour.isTourActive).toBe(false);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('TourContext — étape suivante (validation manuelle)', () => {
  it("completeCurrentStep : succès affiché, puis navigation vers l'étape suivante", () => {
    renderProvider();
    act(() => { tour.startTour('player'); });
    expect(tour.currentStep.id).toBe('player_planning');
    mockNavigate.mockClear();

    act(() => { tour.completeCurrentStep(); });
    expect(tour.tourStatus).toBe('success');

    act(() => jest.advanceTimersByTime(1800));
    expect(tour.tourStatus).toBe('active');
    expect(tour.stepIndex).toBe(1);
    expect(tour.currentStep.id).toBe('player_participation');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.SearchHub, { activeType: 'events' });
  });

  it('la dernière étape validée termine le tour et efface la progression', () => {
    renderProvider();
    act(() => { tour.startTour('player'); });
    // Avance jusqu'à la dernière étape (4 étapes, toutes manuelles sauf la 2ᵉ).
    const skipCurrentStep = () => {
      act(() => { tour.completeCurrentStep({ skipped: true }); });
      act(() => jest.advanceTimersByTime(150));
    };
    skipCurrentStep();
    skipCurrentStep();
    skipCurrentStep();
    expect(tour.stepIndex).toBe(3);

    act(() => { tour.completeCurrentStep(); });
    act(() => jest.advanceTimersByTime(1800));

    expect(tour.isTourActive).toBe(false);
    expect(readPersisted()).toBeNull();
  });
});

describe('TourContext — validation par signal (bus guidance)', () => {
  it("le signal attendu valide l'étape ; un autre signal ne fait rien", () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    expect(tour.currentStep.success).toEqual({ key: 'team.created', type: 'action' });

    act(() => { emitGuidanceAction('event.created'); });
    expect(tour.tourStatus).toBe('active');

    act(() => { emitGuidanceAction('team.created'); });
    expect(tour.tourStatus).toBe('success');

    act(() => jest.advanceTimersByTime(1800));
    expect(tour.stepIndex).toBe(1);
  });
});

describe('TourContext — étape passée (skipped)', () => {
  it("« Passer » consigne l'étape sautée et enchaîne sur la cible de repli", () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    mockNavigate.mockClear();

    act(() => { tour.completeCurrentStep({ skipped: true }); });
    act(() => jest.advanceTimersByTime(150));

    expect(tour.stepIndex).toBe(1);
    expect(readPersisted().skippedStepIds).toEqual(['coach_create_team']);
    // Étape précédente sautée ⇒ fallbackTarget (l'accueil), pas la cible nominale.
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.HomeTab, { screen: 'SearchHome' });
  });
});

describe('TourContext — reprise « paused » (audit §2.2 D-D)', () => {
  it('un tour inachevé revient en « paused » au montage, sans naviguer tout seul', () => {
    mockStore.set(STORAGE_KEY, JSON.stringify({
      profileKey: 'coach', skippedStepIds: [], stepIndex: 2,
    }));
    renderProvider();

    // « paused » compte comme actif : c'est ce qui maintenait le bandeau (et sa
    // marge) indéfiniment pour les tours abandonnés.
    expect(tour.isTourActive).toBe(true);
    expect(tour.tourStatus).toBe('paused');
    expect(tour.stepIndex).toBe(2);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("resumeTour repart de l'étape sauvegardée et renavigue vers sa cible", () => {
    mockStore.set(STORAGE_KEY, JSON.stringify({
      profileKey: 'coach', skippedStepIds: [], stepIndex: 2,
    }));
    renderProvider();

    act(() => { tour.resumeTour(); });
    expect(tour.tourStatus).toBe('active');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EventStack, {
      screen: RouteNames.EventWizardType,
    });
  });
});

describe('TourContext — porte de sortie (exitTour)', () => {
  it('exitTour éteint le tour et efface la progression persistée', () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    expect(readPersisted()).not.toBeNull();

    act(() => { tour.exitTour(); });

    expect(tour.isTourActive).toBe(false);
    expect(tour.tourStatus).toBeNull();
    expect(readPersisted()).toBeNull();
  });
});
