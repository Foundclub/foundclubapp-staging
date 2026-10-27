import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceInteraction,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// TUTOE (27/10) — guide Entraîneur à missions (pack design_handoff_tutoriels,
// critères d'acceptation du README) : missions verrouillées, jauge 25/50/75/100,
// reprise au début du tunnel, « Quitter » = pause, état v2 purgé.

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
const STORAGE_KEY = `tourProgress_${USER_ID}`;

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

const route = (name) => act(() => { emitGuidanceRouteVisit(name); });
const action = (key, meta) => act(() => { emitGuidanceAction(key, meta); });
const interaction = (key) => act(() => { emitGuidanceInteraction(key); });
const reward = () => act(() => { jest.advanceTimersByTime(1700); });

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

const startAndOpen = () => {
  renderProvider();
  act(() => { tour.startTour('coach'); });
  expect(tour.currentStep.id).toBe('open');
  act(() => { tour.completeCurrentStep(); });
};

const doMission1 = () => {
  route(RouteNames.MyTeamList);
  route(RouteNames.TeamWizardName);
  [
    RouteNames.TeamWizardDescription,
    RouteNames.TeamWizardSection,
    RouteNames.TeamWizardActivity,
    RouteNames.TeamWizardCategory,
    RouteNames.TeamWizardLevel,
    RouteNames.TeamWizardTrainers,
    RouteNames.TeamWizardRecap,
  ].forEach(route);
  expect(tour.currentStep.id).toBe('tw8');
  action('team.created', { teamName: 'U13 A' });
};

describe('guide Entraîneur — démarrage', () => {
  it('ouvre sur l’accueil avec l’écran d’ouverture et une jauge à 0', () => {
    renderProvider();
    let started;
    act(() => { started = tour.startTour('coach'); });
    expect(started).toBe(true);
    expect(tour.isGuide).toBe(true);
    expect(tour.currentStep.kind).toBe('opening');
    expect(tour.gauge).toBe(0);
    expect(mockNavigate)
      .toHaveBeenCalledWith(RouteNames.HomeTab, { screen: RouteNames.SearchHome });
    expect(tour.missions.map((mission) => mission.id))
      .toEqual(['coach_m1', 'coach_m2', 'coach_m3', 'coach_m4']);
  });

  it('« C’est parti » mène à la 1re étape, sans naviguer à la place de la personne', () => {
    startAndOpen();
    expect(tour.currentStep.id).toBe('m1-dock');
    expect(tour.missionPosition).toEqual({ index: 1, isBonus: false, total: 4 });
  });

  it('un coach qui a déjà une équipe commence par « Retrouve ton équipe »', () => {
    mockUserData = { ...mockUserData, trainedTeams: [{ documentId: 't-1' }] };
    startAndOpen();
    expect(tour.currentStep.id).toBe('m1-find');
  });

  it('un coach sans club passe par l’écran « Il te faut d’abord un club »', () => {
    mockUserData = { ...mockUserData, club: null };
    startAndOpen();
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamWizardName);
    expect(tour.currentStep.id).toBe('m1-gate');
    interaction('clubGate.notFound');
    expect(tour.currentStep.id).toBe('m1-cw');
  });
});

describe('guide Entraîneur — missions verrouillées et jauge', () => {
  it('une mission essentielle ne se passe pas', () => {
    startAndOpen();
    act(() => { tour.completeCurrentStep({ skipped: true }); });
    act(() => { tour.skipMission(); });
    expect(tour.currentStep.id).toBe('m1-dock');
    expect(tour.isLockedStep).toBe(true);
  });

  it('un signal étranger à l’étape ne fait rien', () => {
    startAndOpen();
    action('event.created');
    route(RouteNames.Chat);
    expect(tour.currentStep.id).toBe('m1-dock');
  });

  it('la jauge passe à 25, 50, 75 puis 100 % exactement à chaque mission', () => {
    startAndOpen();
    doMission1();
    expect(tour.tourStatus).toBe('success');
    expect(tour.reward).toEqual({
      from: 0, isBonus: false, missionId: 'coach_m1', to: 25,
    });
    reward();
    expect(tour.gauge).toBe(25);
    // L'app ramène sur « Mes équipes » après la création.
    route(RouteNames.MyTeamList);
    expect(tour.currentStep.id).toBe('m2-card');

    route(RouteNames.TeamDetails);
    interaction('team.actions.open');
    interaction('teamActions.shareLink');
    // Feuille de partage fermée sans envoi : retour à l'étape « lien ».
    interaction('team.invite.dismissed');
    expect(tour.currentStep.id).toBe('m2-share');
    interaction('teamActions.shareLink');
    action('team.invite.shared');
    reward();
    expect(tour.gauge).toBe(50);

    route(RouteNames.SearchHome);
    route(RouteNames.EventWizardType);
    [
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ].forEach(route);
    action('event.created', { occurrences: 32 });
    expect(tour.currentStep.id).toBe('m3-page');
    act(() => { tour.completeCurrentStep(); });
    reward();
    expect(tour.gauge).toBe(75);

    route(RouteNames.SearchHome);
    route(RouteNames.SearchRecruitment);
    act(() => { tour.completeCurrentStep(); });
    interaction('search.tab.events');
    interaction('search.tab.clubs');
    interaction('search.tab.amicaux');
    [
      RouteNames.FriendlyMatchWizardTeam,
      RouteNames.FriendlyMatchWizardHosting,
      RouteNames.FriendlyMatchWizardDates,
      RouteNames.FriendlyMatchWizardLocation,
      RouteNames.FriendlyMatchWizardOpponent,
      RouteNames.FriendlyMatchWizardDescription,
      RouteNames.FriendlyMatchWizardRecap,
    ].forEach(route);
    action('friendlyMatch.ad.published');
    reward();
    expect(tour.gauge).toBe(100);
    expect(tour.currentStep.kind).toBe('milestone');
    expect(tour.created['team.created'].teamName).toBe('U13 A');
    expect(tour.created['event.created'].occurrences).toBe(32);
  });

  it('la clôture raccompagne à l’accueil et efface la progression', () => {
    startAndOpen();
    act(() => { tour.finishGuide(); });
    expect(tour.isTourActive).toBe(false);
    expect(mockStore.has(STORAGE_KEY)).toBe(false);
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.HomeTab, { screen: 'SearchHome' });
  });
});

describe('guide Entraîneur — reprise', () => {
  it('app tuée à « Date & horaire » : « Reprendre » ramène au début du tunnel événement', () => {
    startAndOpen();
    doMission1();
    reward();
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamDetails);
    interaction('team.actions.open');
    interaction('teamActions.shareLink');
    action('team.invite.shared');
    reward();
    route(RouteNames.SearchHome);
    route(RouteNames.EventWizardType);
    route(RouteNames.EventWizardTeam);
    route(RouteNames.EventWizardLogistics);
    expect(tour.currentStep.id).toBe('m3-when');

    // Fermeture de l'app : nouveau montage, le tour revient « en pause ».
    const saved = mockStore.get(STORAGE_KEY);
    mockStore.clear();
    mockStore.set(STORAGE_KEY, saved);
    resetGuidanceRuntimeForTests();
    renderProvider();
    expect(tour.tourStatus).toBe('paused');
    expect(tour.gauge).toBe(50);
    mockNavigate.mockClear();
    act(() => { tour.resumeTour(); });
    expect(tour.currentStep.id).toBe('m3-type');
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EventStack, {
      screen: RouteNames.EventWizardType,
    });
  });

  it('« Quitter » met en pause sans effacer la progression', () => {
    startAndOpen();
    act(() => { tour.pauseTour(); });
    expect(tour.tourStatus).toBe('paused');
    expect(JSON.parse(mockStore.get(STORAGE_KEY)).version).toBe(3);
  });

  it('un état v2 de l’ancien tour coach est purgé au lieu d’être rejoué', () => {
    mockStore.set(STORAGE_KEY, JSON.stringify({
      profileKey: 'coach', skippedStepIds: [], stepIndex: 2,
    }));
    renderProvider();
    expect(tour.isTourActive).toBe(false);
    expect(mockStore.has(STORAGE_KEY)).toBe(false);
  });
});
