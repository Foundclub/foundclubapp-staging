import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceInteraction,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// GUIDE-REPRISE (rejeu du guide Entraîneur, 28/10 au soir, app a33bf921) :
// N1 un guide d'avant la 2.6.84 repartait à 0 % ; L1 GUIDE-ATTENTE une demande
// d'adhésion en attente faisait tourner M1 en boucle ; N3 la bulle « Pas de club ? »
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
const renderProvider = () => {
  act(() => {
    tree = renderer.create(<TourProvider><Probe /></TourProvider>);
  });
};
// Le profil relu (refetch) : le contexte du guide le lit au rendu suivant.
const rerender = () => act(() => { tree.update(<TourProvider><Probe /></TourProvider>); });
const remount = () => {
  act(() => tree.unmount());
  renderProvider();
};
const route = (name) => act(() => { emitGuidanceRouteVisit(name); });
const action = (key, meta) => act(() => { emitGuidanceAction(key, meta); });
const interaction = (key) => act(() => { emitGuidanceInteraction(key); });
const pressNext = () => act(() => { tour.completeCurrentStep(); });
const stepId = () => tour.currentStep?.id;

/**
 * Progression gardée telle qu'une 2.6.83 ou 2.6.84 l'écrivait (sans la marque
 * « guide déjà lancé »).
 * @param {string} id - Étape gardée.
 * @param {Record<string, any>} [extra] - Champs en plus.
 * @returns {void}
 */
const saveProgress = (id, extra = {}) => {
  mockStore.set(PROGRESS_KEY, JSON.stringify({
    created: {},
    flags: { firstName: 'Sam', hadClub: false, hadTeam: false },
    gauge: 0,
    missionStatus: {},
    profileKey: 'coach',
    stepIndex: indexOf(id),
    version: 3,
    ...extra,
  }));
};

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

describe('N1 — un guide lancé avant la 2.6.84 ouvre le menu de relance', () => {
  it('guide en pause sans la marque : le menu, pas un départ à 0 %', () => {
    saveProgress('m2-card', { gauge: 25, missionStatus: { coach_m1: 'done' } });
    renderProvider();
    expect(tour.tourStatus).toBe('paused');
    expect(tour.hasGuideHistory).toBe(true);
  });

  it('guide repris puis fini (Julien Marchal) : le menu reste au relancement', () => {
    saveProgress('m4-am6', {
      flags: { firstName: 'Julien', hadClub: true, hadTeam: true },
      gauge: 75,
      missionStatus: { coach_m1: 'done', coach_m2: 'done', coach_m3: 'done' },
    });
    renderProvider();
    act(() => { tour.resumeTour(); });
    act(() => { tour.finishGuide(); });
    expect(tour.isTourActive).toBe(false);

    remount();
    expect(tour.hasGuideHistory).toBe(true);
  });

  it('seulement des bonus laissés « pour plus tard » : le menu aussi', () => {
    mockStore.set(`tourBonusLater_${USER_ID}`, JSON.stringify(['coach_b2']));
    renderProvider();
    expect(tour.hasGuideHistory).toBe(true);
  });

  it('témoin : jamais lancé, pas de menu', () => {
    renderProvider();
    expect(tour.hasGuideHistory).toBe(false);
  });
});

describe('L1 GUIDE-ATTENTE — demande d’adhésion en attente : le guide attend et le dit', () => {
  it('Équipes : bulle d’attente au lieu de « Nouvelle équipe », « Compris » met en pause', () => {
    mockUserData.clubMembershipRequests = [PENDING_REQUEST];
    renderProvider();
    act(() => { tour.startTour('coach'); });
    pressNext();
    expect(stepId()).toBe('m1-dock');

    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-wait');
    expect(tour.currentStep.nextLabel).toBeTruthy();

    pressNext();
    expect(tour.tourStatus).toBe('paused');
    expect(stepId()).toBe('m1-wait');
  });

  it('reprise toujours en attente : la même bulle, jamais la boucle m1-new ↔ m1-gate', () => {
    mockUserData.clubMembershipRequests = [PENDING_REQUEST];
    saveProgress('m1-wait');
    renderProvider();
    // App relancée : la reprise repart de l'accueil, comme toute reprise de M1.
    act(() => { tour.resumeTour(); });
    expect(stepId()).toBe('m1-dock');
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-wait');
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('m1-wait');
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-wait');
  });

  it('demande acceptée : la reprise repart sur Équipes puis le tunnel équipe', () => {
    mockUserData.clubMembershipRequests = [PENDING_REQUEST];
    saveProgress('m1-wait');
    renderProvider();
    mockUserData = {
      ...mockUserData,
      club: { documentId: 'club-9' },
      clubMembershipRequests: [{ ...PENDING_REQUEST, state: 'processed' }],
    };
    rerender();
    act(() => { tour.resumeTour(); });
    expect(stepId()).toBe('m1-dock');
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-new');
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('tw1');
  });

  it('demande envoyée pendant le guide (club avec dirigeant) : bulle d’attente', () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    pressNext();
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('m1-gate');
    interaction('clubGate.search');
    route(RouteNames.SearchHub);
    route(RouteNames.Club);
    expect(stepId()).toBe('m1-mine');

    action('club.requested', { clubName: 'AS Montrivage' });
    expect(stepId()).toBe('m1-wait');
  });

  it('club rejoint pour de vrai (club sans dirigeant) : « Touche OK », comme avant', () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    pressNext();
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamWizardName);
    interaction('clubGate.search');
    route(RouteNames.SearchHub);
    route(RouteNames.Club);
    action('club.joined', { clubName: 'BASKET CLUB MILLOIS' });
    expect(stepId()).toBe('m1-ok');
  });
});

describe('N3 — tunnel équipe après une reprise, club déjà rejoint', () => {
  it('rejoint pendant le guide, relancée à m1-new2 : Équipes puis tw1, sans m1-gate', () => {
    saveProgress('m1-new2', { created: { 'club.joined': { clubName: 'BASKET CLUB MILLOIS' } } });
    mockUserData.club = { documentId: 'club-7' };
    renderProvider();
    act(() => { tour.resumeTour(); });
    expect(stepId()).toBe('m1-dock2');
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-new2');
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('tw1');
  });

  it('club rejoint hors du guide : « Nouvelle équipe » mène au tunnel, pas à m1-gate', () => {
    saveProgress('m1-new');
    mockUserData.club = { documentId: 'club-7' };
    renderProvider();
    act(() => { tour.resumeTour(); });
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-new');
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('tw1');
  });
});

describe('N4 — retour d’une fiche club pendant m1-mine', () => {
  it('flèche depuis la fiche : la recherche retrouve sa bulle (m1-csearch)', () => {
    renderProvider();
    act(() => { tour.startTour('coach'); });
    pressNext();
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamWizardName);
    interaction('clubGate.search');
    route(RouteNames.SearchHub);
    route(RouteNames.Club);
    expect(stepId()).toBe('m1-mine');

    route(RouteNames.SearchHub);
    expect(stepId()).toBe('m1-csearch');
  });
});
