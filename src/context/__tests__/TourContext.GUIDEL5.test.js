import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// GUIDE-BONUS (L5, 28/10) — audit du guide Entraîneur, captures 45, 47-49, 64-67.
// · Clôture : l'accueil était EMPILÉ par-dessus la compo d'exemple (react-navigation 7 :
//   `navigate` sans `pop` empile un doublon) ; la feuille « Publier la compo ? » restait
//   ouverte et l'écran d'exemple dans la pile. Le guide revient à l'accueil en DÉPILANT.
// · B2 enchaîne sur le planning sans repasser par l'accueil.
// · B1, équipe vide (décision d'Adel « 2- A », 28/10) : l'écran signale qu'il n'y a
//   personne, le guide montre la zone et « Compris » valide le bonus.

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

/** Démarre le guide sur le bonus B1 et ouvre la séance (étape b1-relance). */
const allerABRelance = () => {
  renderProvider();
  act(() => { tour.startTour('coach', { fromMission: 'coach_b1' }); });
  act(() => { emitGuidanceRouteVisit(RouteNames.MyEventList); });
  act(() => { emitGuidanceRouteVisit(RouteNames.EventDetails); });
  expect(tour.currentStep?.id).toBe('b1-relance');
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  tour = undefined;
  mockUserData = {
    club: { documentId: 'club-1' },
    documentId: 'coach-1',
    firstname: 'Sam',
    myTeams: [],
    trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'U13' }],
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

describe('Clôture du guide', () => {
  it('revient à l’accueil en DÉPILANT : compo d’exemple et feuille sortent de la pile', () => {
    renderProvider();
    act(() => { tour.startTour('coach', { fromMission: 'coach_b2' }); });
    mockNavigate.mockClear();

    act(() => { tour.finishGuide(); });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.HomeTab,
      { params: { pop: true, screen: 'SearchHome' }, screen: RouteNames.Search },
      { pop: true },
    );
  });
});

describe('Bonus 2 : pas d’aller-retour accueil-planning', () => {
  it('« Passer ce bonus » sur B1 emmène directement au planning, en dépilant la séance', () => {
    allerABRelance();
    mockNavigate.mockClear();

    act(() => { tour.skipMission(); });

    expect(tour.currentStep?.id).toBe('b2-dock');
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.HomeTab,
      { screen: RouteNames.MyEventList },
      { pop: true },
    );
    act(() => { emitGuidanceRouteVisit(RouteNames.MyEventList); });
    expect(tour.currentStep?.id).toBe('b2-where');
  });

  it('b1-dock revient lui aussi à l’accueil en dépilant (sinon l’onglet Planning visé est '
    + 'celui de l’accueil resté dessous : ni cadre ni voile, captures 39-41)', () => {
    const dock = COACH_GUIDE.steps.find((step) => step.id === 'b1-dock');
    expect(dock.navigateOnEnter).toBe(true);
    expect(dock.navTarget.pop).toBe(true);
  });
});

describe('Bonus 1 avec une équipe vide (décision « 2- A »)', () => {
  it('l’écran signale « personne » : bulle « Ici, tu verras qui vient », Compris valide', () => {
    allerABRelance();

    act(() => { emitGuidanceAction('event.participants.empty'); });

    expect(tour.currentStep?.id).toBe('b1-vide');
    expect(tour.currentStep.text).toContain('Ici, tu verras qui vient');
    expect(tour.currentStep.nextLabel).toBe('Compris');

    act(() => { tour.completeCurrentStep(); });
    expect(tour.missionStatus.coach_b1).toBe('done');
    act(() => { jest.advanceTimersByTime(2000); });
    expect(tour.currentStep?.id).toBe('b2-dock');
  });

  it('équipe avec joueurs : la relance valide le bonus, sans passer par b1-vide', () => {
    allerABRelance();

    act(() => { emitGuidanceAction('event.relance.sent'); });

    expect(tour.missionStatus.coach_b1).toBe('done');
    act(() => { jest.advanceTimersByTime(2000); });
    expect(tour.currentStep?.id).toBe('b2-dock');
  });

  it('la bulle de relance ne parle plus de l’équipe vide', () => {
    const relance = COACH_GUIDE.steps.find((step) => step.id === 'b1-relance');
    expect(relance.text).not.toContain('Pas encore de joueur');
  });
});

describe('Bonus 2 : combien convoquer', () => {
  it('b2-list dit combien cocher (une formation demande la moitié des titulaires)', () => {
    const liste = COACH_GUIDE.steps.find((step) => step.id === 'b2-list');
    expect(liste.text).toContain('au moins la moitié');
  });
});
