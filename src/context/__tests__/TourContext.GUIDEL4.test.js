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

// GUIDE-RECUL (28/10, lot L4 de l'audit du guide Entraîneur, manque « tunnels »,
// capture 25) : un retour arrière dans un tunnel affichait l'écran précédent
// avec la bulle de l'étape SUIVANTE ; le guide ne savait qu'avancer. Le retour
// ramène l'étape ouverte sur l'écran affiché.

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
const indexOf = (id) => COACH_GUIDE.steps.findIndex((step) => step.id === id);

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  tour = undefined;
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

/**
 * Guide lancé, M1 et M2 faites : on est à « ouvre l'accueil » (m3-dock).
 * @returns {void}
 */
const reachMission3 = () => {
  renderProvider();
  act(() => { tour.startTour('coach'); });
  act(() => { tour.completeCurrentStep(); });
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
  action('team.created', { teamName: 'U13 A' });
  reward();
  route(RouteNames.MyTeamList);
  route(RouteNames.TeamDetails);
  interaction('team.actions.open');
  interaction('teamActions.shareLink');
  action('team.invite.shared');
  reward();
  expect(tour.currentStep.id).toBe('m3-dock');
};

describe('L4 — retour arrière dans un tunnel', () => {
  it('le retour ramène l’étape de l’écran affiché, écran après écran', () => {
    reachMission3();
    route(RouteNames.SearchHome);
    route(RouteNames.EventWizardType);
    route(RouteNames.EventWizardTeam);
    route(RouteNames.EventWizardLocation);
    expect(tour.currentStep.id).toBe('m3-place');

    // Retour Android : écran « Équipe » ⇒ bulle de l'équipe, pas celle du lieu.
    route(RouteNames.EventWizardTeam);
    expect(tour.currentStep.id).toBe('m3-team');
    route(RouteNames.EventWizardType);
    expect(tour.currentStep.id).toBe('m3-type');
    // Sorti du tunnel, sur l'accueil : « Ajouter un événement ».
    route(RouteNames.SearchHome);
    expect(tour.currentStep.id).toBe('m3-card');
    // L'étape rendue est enregistrée (reprise après fermeture de l'app).
    expect(JSON.parse(mockStore.get(STORAGE_KEY)).stepIndex).toBe(indexOf('m3-card'));
    expect(tour.tourStatus).toBe('active');
  });

  it('on repart en avant après un retour', () => {
    reachMission3();
    route(RouteNames.SearchHome);
    route(RouteNames.EventWizardType);
    route(RouteNames.EventWizardTeam);
    route(RouteNames.EventWizardType);
    expect(tour.currentStep.id).toBe('m3-type');
    route(RouteNames.EventWizardTeam);
    expect(tour.currentStep.id).toBe('m3-team');
    route(RouteNames.EventWizardLocation);
    expect(tour.currentStep.id).toBe('m3-place');
  });

  it('un écran que le guide n’a pas traversé ne fait pas reculer', () => {
    reachMission3();
    route(RouteNames.SearchHome);
    route(RouteNames.EventWizardType);
    route(RouteNames.EventWizardTeam);
    route(RouteNames.MyEventList);
    expect(tour.currentStep.id).toBe('m3-team');
  });

  it('jamais en arrière dans une mission déjà réussie', () => {
    reachMission3();
    // Le récap du tunnel équipe a ouvert « ouvre ton équipe » (M2, réussie) :
    // y repasser ne rouvre pas M2.
    route(RouteNames.SearchHome);
    expect(tour.currentStep.id).toBe('m3-card');
    route(RouteNames.TeamWizardRecap);
    expect(tour.currentStep.id).toBe('m3-card');
  });
});
