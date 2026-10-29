import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceInteraction,
  emitGuidanceRefusal,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// GUIDE-FINITIONS-3 (rejeu 2 du guide Entraîneur, 29/10, captures A03-A15) :
// R2-1 un coach qui rejoint son club en route garde la bulle « Pas de club ? »
// pendant tout le tunnel, et l'équipe créée ne valide pas M1 ; réserve du n° 6
// « Passer cette mission » bloquait M2-M4 alors qu'une équipe existe.

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
const CLUB = { documentId: 'club-7', name: 'BASKET CLUB MILLOIS' };

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
// Le profil relu (refetch) : le contexte du guide le lit au rendu suivant.
const rerender = () => act(() => { tree.update(<TourProvider><Probe /></TourProvider>); });
const route = (name) => act(() => { emitGuidanceRouteVisit(name); });
const action = (key, meta) => act(() => { emitGuidanceAction(key, meta); });
const interaction = (key) => act(() => { emitGuidanceInteraction(key); });
const flush = () => act(() => { jest.runOnlyPendingTimers(); });
const stepId = () => tour.currentStep?.id;

const TUNNEL = [
  [RouteNames.TeamWizardDescription, 'tw2'],
  [RouteNames.TeamWizardSection, 'tw3'],
  [RouteNames.TeamWizardActivity, 'tw4'],
  [RouteNames.TeamWizardCategory, 'tw5'],
  [RouteNames.TeamWizardLevel, 'tw6'],
  [RouteNames.TeamWizardTrainers, 'tw7'],
  [RouteNames.TeamWizardRecap, 'tw8'],
];

/**
 * Coach sans club : départ du guide, jusqu'à l'écran « Il te faut d'abord un club ».
 * @returns {void}
 */
const startToGate = () => {
  renderProvider();
  act(() => { tour.startTour('coach'); });
  act(() => { tour.completeCurrentStep(); });
  expect(stepId()).toBe('m1-dock');
  route(RouteNames.MyTeamList);
  expect(stepId()).toBe('m1-new');
  route(RouteNames.TeamWizardName);
  expect(stepId()).toBe('m1-gate');
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  tour = undefined;
  mockUserData = {
    documentId: USER_ID,
    firstname: 'Audit',
    myTeams: [],
    trainedTeams: [],
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  act(() => tree?.unmount());
  jest.useRealTimers();
});

describe('R2-1 — club rejoint en route, puis le tunnel équipe', () => {
  it('club rejoint hors du guide puis reprise (rejeu A03) : tw1, pas « Pas de club ? »', () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    act(() => { tour.completeCurrentStep(); });
    act(() => { tour.pauseTour(); });
    // « C'est mon club ! » touché pendant la pause : le profil relu porte le club.
    mockUserData = { ...mockUserData, club: CLUB };
    rerender();
    act(() => { tour.resumeTour(); });
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('tw1');
  });

  it('club arrivé pendant « Pas de club ? » : la bulle passe au tunnel', () => {
    startToGate();
    mockUserData = { ...mockUserData, club: CLUB };
    rerender();
    expect(stepId()).toBe('tw1');
  });

  it('chaque écran du tunnel a SA bulle, même si le guide est resté sur la porte', () => {
    startToGate();
    // Le profil n'est pas encore relu : le guide ne sait rien du club.
    TUNNEL.forEach(([name, expected]) => {
      route(name);
      expect(stepId()).toBe(expected);
    });
  });

  it('l’équipe réellement créée valide M1, quelle que soit l’étape (A11)', () => {
    startToGate();
    action('team.created', { documentId: 'team-1' });
    expect(tour.missionStatus.coach_m1).toBe('done');
    expect(tour.gauge).toBe(25);
    flush();
    expect(stepId()).toBe('m2-card');
  });

  it('équipe créée depuis « Crée ton équipe avec ce bouton » : M1 validée aussi', () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    act(() => { tour.completeCurrentStep(); });
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-new');
    action('team.created', { documentId: 'team-1' });
    expect(tour.missionStatus.coach_m1).toBe('done');
  });
});

describe('Réserve du n° 6 — « Passer cette mission » quand une équipe existe', () => {
  it('quota d’équipes avec une équipe à soi dans le club : M2-M4 restent ouvertes', () => {
    mockUserData = { ...mockUserData, club: CLUB };
    renderProvider();
    act(() => { tour.startTour('coach'); });
    act(() => { tour.completeCurrentStep(); });
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('tw1');
    // L'équipe AuditR2 existe (créée hors du guide, profil relu).
    mockUserData = {
      ...mockUserData,
      trainedTeams: [{ club: { documentId: CLUB.documentId }, documentId: 'team-1' }],
    };
    rerender();
    act(() => { emitGuidanceRefusal('paywall.team-limit'); });
    act(() => { tour.skipBlockedMission(); });
    expect(tour.missionStatus.coach_m1).toBe('blocked');
    expect(tour.missionStatus.coach_m2).toBeUndefined();
    expect(stepId()).toBe('m2-card');
  });

  it('sans équipe, passer bloque toujours M2-M4 (rien à inviter)', () => {
    startToGate();
    act(() => { emitGuidanceRefusal('paywall.team-limit'); });
    act(() => { tour.skipBlockedMission(); });
    expect(tour.missionStatus).toEqual({
      coach_m1: 'blocked', coach_m2: 'blocked', coach_m3: 'blocked', coach_m4: 'blocked',
    });
  });
});

describe('n° 22 — partage du lien sur Android', () => {
  it('retour de la feuille sans savoir : le guide demande, il ne valide pas', () => {
    mockUserData = {
      ...mockUserData,
      club: CLUB,
      trainedTeams: [{ club: { documentId: CLUB.documentId }, documentId: 'team-1' }],
    };
    renderProvider();
    act(() => { tour.startTour('coach', { fromMission: 'coach_m2' }); });
    route(RouteNames.TeamDetails);
    interaction('team.actions.open');
    interaction('teamActions.shareLink');
    expect(stepId()).toBe('m2-pick');
    interaction('team.invite.returned');
    expect(tour.missionStatus.coach_m2).toBeUndefined();
    expect(stepId()).toBe('m2-sent');
    // « C'est envoyé » : la mission est faite.
    act(() => { tour.completeCurrentStep(); });
    expect(tour.missionStatus.coach_m2).toBe('done');
  });

  it('pas envoyé : rouvrir le menu repart sur « Partager le lien »', () => {
    mockUserData = {
      ...mockUserData,
      club: CLUB,
      trainedTeams: [{ club: { documentId: CLUB.documentId }, documentId: 'team-1' }],
    };
    renderProvider();
    act(() => { tour.startTour('coach', { fromMission: 'coach_m2' }); });
    route(RouteNames.TeamDetails);
    interaction('team.actions.open');
    interaction('teamActions.shareLink');
    interaction('team.invite.returned');
    interaction('team.actions.open');
    expect(stepId()).toBe('m2-share');
  });
});
