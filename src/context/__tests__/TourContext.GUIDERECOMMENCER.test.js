import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceInteraction,
  emitGuidanceRefusal,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';
// GUIDE-FINITIONS-2 (rejeu du guide Entraîneur, 28/10 au soir, sur 6397828a) :
// - n° 2 : la demande d'adhésion devient « en attente » pendant que le guide est
//   déjà sur m1-new (pause dans la même séance, demande faite hors du guide) :
// GUIDE-RECOMMENCER (décision d'Adel 29/10 « 5- B », règle du chef) : « Recommencer à
// zéro » remet la PROGRESSION du guide à zéro (progression, bonus gardés, marque « déjà
// lancé ») et repart de l'ouverture ; il n'efface RIEN de réel. Une équipe qui existe
// valide M1 (« Ton équipe est déjà là »), jamais un tunnel qui buterait sur le quota.
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

let tree;
const renderProvider = () => {
  act(() => {
    tree = renderer.create(<TourProvider><Probe /></TourProvider>);
  });
};
const route = (name) => act(() => { emitGuidanceRouteVisit(name); });
const pressNext = () => act(() => { tour.completeCurrentStep(); });
const stepId = () => tour.currentStep?.id;


beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  tour = undefined;
  // Coach sans club ni équipe.
  mockUserData = {
    documentId: USER_ID,
    firstname: 'Sam',
    myTeams: [],
    trainedTeams: [],
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  act(() => tree?.unmount());
  jest.useRealTimers();
});

const BONUS_KEY = `tourBonusLater_${USER_ID}`;
const DONE_KEY = `tourGuideDone_${USER_ID}`;
const PROGRESS_KEY = `tourProgress_${USER_ID}`;

/**
 * Guide fini avec des bonus « pour plus tard », comme Julien Marchal.
 * @returns {void}
 */
const finishedGuide = () => {
  mockStore.set(DONE_KEY, '1');
  mockStore.set(BONUS_KEY, JSON.stringify(['coach_b2']));
};

describe('GUIDE-RECOMMENCER — remise à zéro de la progression', () => {
  it('guide fini : repart de l’ouverture, jauge 0, bonus gardés effacés', () => {
    finishedGuide();
    renderProvider();
    expect(tour.isTourActive).toBe(false);
    let started;
    act(() => { started = tour.restartTour('coach'); });
    expect(started).toBe(true);
    expect(tour.tourStatus).toBe('active');
    expect(stepId()).toBe('open');
    expect(tour.gauge).toBe(0);
    expect(tour.missionStatus).toEqual({});
    expect(mockStore.has(BONUS_KEY)).toBe(false);
    // Le guide relancé est « déjà lancé » : le menu reste dans Mon compte.
    expect(mockStore.get(DONE_KEY)).toBe('1');
    expect(JSON.parse(mockStore.get(PROGRESS_KEY)).gauge).toBe(0);
  });

  it('guide en pause à 50 % : ce qui a été fait est oublié par le guide', () => {
    mockStore.set(DONE_KEY, '1');
    mockStore.set(PROGRESS_KEY, JSON.stringify({
      created: { 'team.created': { teamName: 'U13' } },
      flags: { hadClub: true, hadTeam: false },
      gauge: 50,
      missionStatus: { coach_m1: 'done', coach_m2: 'done' },
      profileKey: 'coach',
      stepIndex: COACH_GUIDE.steps.findIndex((step) => step.id === 'm3-dock'),
      version: 3,
    }));
    renderProvider();
    expect(tour.tourStatus).toBe('paused');
    act(() => { tour.restartTour('coach'); });
    expect(stepId()).toBe('open');
    expect(tour.gauge).toBe(0);
    expect(tour.created).toEqual({});
    expect(tour.missionStatus).toEqual({});
  });

  it('ne touche que les clés du guide, et n’appelle que la navigation', () => {
    finishedGuide();
    mockStore.set('autreCle', 'garde');
    mockStore.set('tourProgress_autre-compte', 'garde');
    renderProvider();
    act(() => { tour.restartTour('coach'); });
    expect(mockStore.get('autreCle')).toBe('garde');
    expect(mockStore.get('tourProgress_autre-compte')).toBe('garde');
    // Retour au début : l'accueil, en dépilant Mon compte.
    expect(mockNavigate).toHaveBeenLastCalledWith(
      RouteNames.HomeTab,
      { params: { pop: true, screen: RouteNames.SearchHome }, screen: RouteNames.Search },
      { pop: true },
    );
  });

  it('équipe existante : M1 est reconnue (« Ton équipe est déjà là »), pas de tunnel', () => {
    finishedGuide();
    mockUserData = {
      ...mockUserData,
      club: { documentId: 'club-1' },
      trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'U13' }],
    };
    renderProvider();
    act(() => { tour.restartTour('coach'); });
    expect(tour.flags.hadTeam).toBe(true);
    pressNext();
    expect(stepId()).toBe('m1-find');
    expect(COACH_GUIDE.steps.find((step) => step.id === 'm1-find').completesMission).toBe(true);
  });

  it('quota d’événements après la remise à zéro : le refus s’affiche, M4 reste ouverte', () => {
    finishedGuide();
    mockUserData = {
      ...mockUserData,
      club: { documentId: 'club-1' },
      trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'U13' }],
    };
    renderProvider();
    act(() => { tour.restartTour('coach'); });
    pressNext();
    route(RouteNames.TeamDetails);
    act(() => jest.advanceTimersByTime(2000));
    act(() => { emitGuidanceInteraction('team.actions.open'); });
    act(() => { emitGuidanceInteraction('teamActions.shareLink'); });
    act(() => { emitGuidanceAction('team.invite.shared'); });
    act(() => jest.advanceTimersByTime(2000));
    route(RouteNames.SearchHome);
    expect(stepId()).toBe('m3-card');
    act(() => { emitGuidanceRefusal('paywall.event-limit'); });
    expect(tour.blocked?.reason).toMatch(/Rien n’a été créé/);
    act(() => { tour.skipBlockedMission(); });
    expect(tour.missionStatus.coach_m3).toBe('blocked');
    expect(tour.missionStatus.coach_m4).toBeUndefined();
    expect(tour.currentStep.missionId).toBe('coach_m4');
  });
});
