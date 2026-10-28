import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceRefusal,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// GUIDE-RELANCE (L6, 28/10) — audit du guide Entraîneur. Décisions d'Adel :
// « 3- A » (relancer depuis Mon compte ouvre un menu : reprendre, revoir sans
// rien créer, faire un bonus) et bloquant n° 6 (une mission essentielle que
// l'écran refuse — quota, droit, club partenaire — n'avait aucune sortie).

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
const PROGRESS_KEY = `tourProgress_${USER_ID}`;
const indexOf = (id) => COACH_GUIDE.steps.findIndex((step) => step.id === id);

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
// Gestes hors des boucles (no-loop-func) : bouton de la bulle, minuteries.
const pressNext = () => act(() => { tour.completeCurrentStep(); });
const pressNextOrSkip = () => act(() => {
  tour.completeCurrentStep({ skipped: !tour.isLockedStep });
});
const flushTimers = () => act(() => jest.runOnlyPendingTimers());
const renderProvider = () => {
  act(() => {
    tree = renderer.create(<TourProvider><Probe /></TourProvider>);
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
  act(() => tree?.unmount());
  jest.useRealTimers();
});

describe('« Revoir le guide sans rien créer » (décision 3- A)', () => {
  const saved = JSON.stringify({
    created: {},
    flags: { firstName: 'Sam', hadClub: true, hadTeam: false },
    gauge: 25,
    missionStatus: { coach_m1: 'done' },
    profileKey: 'coach',
    stepIndex: indexOf('m2-card'),
    version: 3,
  });

  it('visite une étape par mission, avance au bouton, jamais sur une vraie création', () => {
    renderProvider();
    act(() => { tour.startTour('coach', { review: true }); });
    expect(tour.currentStep?.id).toBe('rv-m1');
    expect(tour.currentStep?.nextLabel).toBeTruthy();
    // La visite emmène elle-même sur l'écran de la mission.
    expect(mockNavigate).toHaveBeenLastCalledWith(
      RouteNames.HomeTab,
      { screen: RouteNames.MyTeamList },
      { pop: true },
    );

    // Une vraie création pendant la visite ne fait rien avancer.
    act(() => { emitGuidanceAction('team.created', { teamName: 'U13' }); });
    expect(tour.currentStep?.id).toBe('rv-m1');
    expect(tour.created).toEqual({});

    const visited = [tour.currentStep.id];
    for (let guard = 0; guard < 10 && tour.isTourActive; guard += 1) {
      pressNext();
      flushTimers();
      if (tour.currentStep) visited.push(tour.currentStep.id);
    }
    expect(visited).toEqual(['rv-m1', 'rv-m2', 'rv-m3', 'rv-m4']);
    expect(tour.isTourActive).toBe(false);
    expect(tour.gauge).toBe(0);
  });

  it('rend la progression gardée telle quelle, en pause, à la fin de la visite', () => {
    mockStore.set(PROGRESS_KEY, saved);
    renderProvider();
    expect(tour.tourStatus).toBe('paused');
    act(() => { tour.startTour('coach', { review: true }); });
    expect(tour.currentStep?.id).toBe('rv-m1');
    // La visite n'écrit jamais dans la progression gardée.
    expect(mockStore.get(PROGRESS_KEY)).toBe(saved);
    for (let guard = 0; guard < 4; guard += 1) pressNext();
    expect(mockStore.get(PROGRESS_KEY)).toBe(saved);
    expect(tour.tourStatus).toBe('paused');
    expect(tour.currentStep?.id).toBe('m2-card');
    expect(tour.gauge).toBe(25);
  });

  it('les étapes de visite n’apparaissent jamais dans le vrai guide', () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    const seen = [];
    for (let guard = 0; guard < 80 && tour.isTourActive; guard += 1) {
      if (tour.currentStep) seen.push(tour.currentStep.id);
      pressNextOrSkip();
      flushTimers();
    }
    expect(seen.filter((id) => id.startsWith('rv-'))).toEqual([]);
  });
});

describe('Guide déjà fait : Mon compte le sait', () => {
  it('« hasGuideHistory » est faux au départ, vrai en cours et après la fin', () => {
    renderProvider();
    expect(tour.hasGuideHistory).toBe(false);
    act(() => { tour.startTour('coach'); });
    expect(tour.hasGuideHistory).toBe(true);
    act(() => { tour.finishGuide(); });
    expect(tour.isTourActive).toBe(false);
    expect(tour.hasGuideHistory).toBe(true);
    // Gardé d'une ouverture de l'app à l'autre.
    act(() => tree.unmount());
    tree = null;
    renderProvider();
    expect(tour.hasGuideHistory).toBe(true);
  });
});

describe('Mission essentielle que l’écran refuse (bloquant n° 6)', () => {
  const startAtM1 = () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    expect(tour.currentStep?.kind).toBe('opening');
    act(() => { tour.completeCurrentStep(); });
    expect(tour.currentStep?.id).toBe('m1-dock');
  };

  it('le refus de l’écran donne la raison et une sortie', () => {
    startAtM1();
    act(() => {
      emitGuidanceRefusal('paywall.team-limit', { reason: 'Ton club a atteint 3 équipes.' });
    });
    expect(tour.blocked).toEqual({
      key: 'paywall.team-limit', reason: 'Ton club a atteint 3 équipes.',
    });
    expect(typeof tour.skipBlockedMission).toBe('function');
  });

  it('sans raison donnée par l’écran, le guide dit la sienne', () => {
    startAtM1();
    act(() => { emitGuidanceRefusal('paywall.team-limit'); });
    expect(tour.blocked?.reason).toEqual(expect.any(String));
    expect(tour.blocked.reason.length).toBeGreaterThan(10);
  });

  it('« Rester » referme la carte sans rien passer', () => {
    startAtM1();
    act(() => { emitGuidanceRefusal('paywall.team-limit'); });
    act(() => { tour.dismissBlocked(); });
    expect(tour.blocked).toBeNull();
    expect(tour.currentStep?.id).toBe('m1-dock');
    expect(tour.missionStatus).toEqual({});
  });

  it('un refus d’une autre mission ne bloque rien', () => {
    startAtM1();
    act(() => { emitGuidanceRefusal('paywall.event-limit', { reason: 'Quota d’événements.' }); });
    expect(tour.blocked).toBeNull();
  });

  it('passer saute aussi les missions qui en dépendent, sans jauge ni création', () => {
    startAtM1();
    act(() => { emitGuidanceRefusal('paywall.team-limit', { reason: 'Quota.' }); });
    act(() => { tour.skipBlockedMission(); });
    expect(tour.blocked).toBeNull();
    // Sans équipe, inviter (M2), programmer (M3) et publier un amical (M4,
    // « Tu n'encadres encore aucune équipe ») sont impossibles aussi : palier.
    expect(tour.missionStatus).toEqual({
      coach_m1: 'blocked', coach_m2: 'blocked', coach_m3: 'blocked', coach_m4: 'blocked',
    });
    expect(tour.currentStep?.kind).toBe('milestone');
    expect(tour.gauge).toBe(0);
    expect(tour.created).toEqual({});
  });

  it('un bonus n’a pas besoin de cette sortie (il a déjà « Passer ce bonus »)', () => {
    renderProvider();
    act(() => { tour.startTour('coach', { fromMission: 'coach_b1' }); });
    act(() => { emitGuidanceRefusal('paywall.team-limit', { reason: 'Quota.' }); });
    expect(tour.blocked).toBeNull();
  });
});
