import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';
// GUIDE-FINITIONS-2 (rejeu du guide Entraîneur, 28/10 au soir, sur 6397828a) :
// - n° 2 : la demande d'adhésion devient « en attente » pendant que le guide est
//   déjà sur m1-new (pause dans la même séance, demande faite hors du guide) :
//   « Nouvelle équipe » ouvrait l'écran « Ton adhésion est en attente » avec la
//   bulle tw1, et « J'ai compris » ramenait à m1-new : la boucle revenait ;
// - N10 : la visite « sans rien créer » finissait sans bulle de fin.
// sur le tunnel équipe après une reprise ; N4 aucune bulle au retour d'une fiche club.

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
// Le profil relu (refetch) : le contexte du guide le lit au rendu suivant.
const rerender = () => act(() => { tree.update(<TourProvider><Probe /></TourProvider>); });
const route = (name) => act(() => { emitGuidanceRouteVisit(name); });
const pressNext = () => act(() => { tour.completeCurrentStep(); });
const stepId = () => tour.currentStep?.id;

const PENDING_REQUEST = { club: { documentId: 'club-9', name: 'AS Montrivage' }, state: 'pending' };

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

const coachWithTeamClub = () => {
  mockUserData = { ...mockUserData, club: { documentId: 'club-1' } };
};

describe('n° 2 — demande en attente découverte avec le guide déjà sur m1-new', () => {
  const reachM1New = () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    pressNext();
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-new');
  };

  it('« Nouvelle équipe » mène à l’écran d’attente : bulle d’attente, pas tw1', () => {
    reachM1New();
    mockUserData = { ...mockUserData, clubMembershipRequests: [PENDING_REQUEST] };
    rerender();
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('m1-wait');
    // « J'ai compris » de l'écran d'attente ramène sur Équipes : pas de retour à m1-new.
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-wait');
    pressNext();
    expect(tour.tourStatus).toBe('paused');
  });

  it('pause sur m1-new, demande faite entre-temps : la reprise saute « Nouvelle équipe »', () => {
    reachM1New();
    act(() => { tour.pauseTour(); });
    mockUserData = { ...mockUserData, clubMembershipRequests: [PENDING_REQUEST] };
    rerender();
    act(() => { tour.resumeTour(); });
    expect(stepId()).toBe('m1-dock');
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-wait');
  });

  it('témoin : sans demande, « Nouvelle équipe » mène au tunnel (tw1, avec un club)', () => {
    coachWithTeamClub();
    reachM1New();
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('tw1');
  });
});

describe('N10 — la visite « sans rien créer » finit sur une bulle, à l’accueil', () => {
  it('après rv-m4 : une bulle de fin, puis l’accueil en dépilant', () => {
    renderProvider();
    act(() => { tour.startTour('coach', { review: true }); });
    ['rv-m1', 'rv-m2', 'rv-m3', 'rv-m4'].forEach((id) => {
      expect(stepId()).toBe(id);
      pressNext();
    });
    expect(stepId()).toBe('rv-end');
    expect(tour.isReview).toBe(true);
    expect(String(tour.currentStep.text)).toMatch(/rien n.a été créé/);
    mockNavigate.mockClear();
    pressNext();
    expect(tour.isTourActive).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.HomeTab,
      { params: { pop: true, screen: RouteNames.SearchHome }, screen: RouteNames.Search },
      { pop: true },
    );
  });
});
