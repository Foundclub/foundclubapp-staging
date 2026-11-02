import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceInteraction,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// FIN-GUIDE (recette d'Adel sur iPhone, 02/11, compte 0644444444) : un entraîneur déjà coach de
// « Seniors A » se voyait imposer « Crée ton équipe » à 0 %. Attendu : déjà coach ⇒ mission 1
// validée ; le club a des équipes ⇒ la question ; une demande envoyée ⇒ le guide attend sans
// bloquer ; au retour du partage ⇒ jamais d'étape sans issue.

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
const CLUB = { documentId: 'club-7', name: 'AS Atlas Paillade' };
const SENIORS = { club: { documentId: CLUB.documentId }, documentId: 'team-1', name: 'Seniors A' };
const PENDING_TEAM = {
  direction: 'request', documentId: 'req-1', state: 'pending', team: SENIORS,
};

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
const rerender = () => act(() => { tree.update(<TourProvider><Probe /></TourProvider>); });
const route = (name) => act(() => { emitGuidanceRouteVisit(name); });
const action = (key, meta) => act(() => { emitGuidanceAction(key, meta); });
const interaction = (key) => act(() => { emitGuidanceInteraction(key); });
const flush = () => act(() => { jest.runOnlyPendingTimers(); });
const stepId = () => tour.currentStep?.id;
const pressNext = () => act(() => { tour.completeCurrentStep(); });
const start = () => {
  renderProvider();
  act(() => { tour.startTour('coach'); });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  tour = undefined;
  mockUserData = {
    club: CLUB, documentId: USER_ID, firstname: 'Sam', myTeams: [], trainedTeams: [],
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  act(() => tree?.unmount());
  jest.useRealTimers();
});

describe('point 1 — déjà coach d’une équipe : mission 1 validée', () => {
  it('au départ : M1 faite, 25 %, et « C’est parti » mène à M2', () => {
    mockUserData = { ...mockUserData, trainedTeams: [SENIORS] };
    start();
    expect(tour.missionStatus.coach_m1).toBe('done');
    expect(tour.gauge).toBe(25);
    pressNext();
    expect(stepId()).toBe('m2-card');
  });

  it('équipe acceptée pendant « Nouvelle équipe » : récompense, puis M2', () => {
    start();
    pressNext();
    expect(stepId()).toBe('m1-choice');
    pressNext();
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-new');
    mockUserData = { ...mockUserData, trainedTeams: [SENIORS] };
    rerender();
    expect(tour.reward).toMatchObject({ from: 0, to: 25 });
    flush();
    expect(stepId()).toBe('m2-card');
  });

  it('le compte d’Adel : guide gardé à 0 % sur « Crée ton équipe », coach depuis ⇒ M2', () => {
    mockUserData = { ...mockUserData, trainedTeams: [SENIORS] };
    mockStore.set(`tourProgress_${USER_ID}`, JSON.stringify({
      created: {},
      flags: { hadClub: true, hadTeam: false },
      gauge: 0,
      missionStatus: {},
      profileKey: 'coach',
      stepId: 'm1-new',
      stepIndex: 3,
      version: 3,
    }));
    renderProvider();
    expect(tour.tourStatus).toBe('paused');
    expect(tour.missionStatus.coach_m1).toBe('done');
    expect(tour.gauge).toBe(25);
    expect(stepId()).toBe('m2-card');
  });

  it('témoin : une équipe où il est seulement joueur ne valide rien', () => {
    mockUserData = { ...mockUserData, myTeams: [SENIORS], trainedTeams: [] };
    start();
    expect(tour.missionStatus.coach_m1).toBeUndefined();
    pressNext();
    expect(stepId()).toBe('m1-choice');
  });

  it('témoin : le tunnel en cours n’est pas interrompu par le profil relu', () => {
    start();
    pressNext();
    pressNext();
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('tw1');
    mockUserData = { ...mockUserData, trainedTeams: [SENIORS] };
    rerender();
    expect(stepId()).toBe('tw1');
    expect(tour.reward).toBeNull();
  });
});

describe('point 1 — la question « Es-tu entraîneur d’une de ces équipes ? »', () => {
  it('coach d’un club, sans équipe : la question vient avant « Crée ton équipe »', () => {
    start();
    pressNext();
    expect(stepId()).toBe('m1-choice');
    expect(tour.currentStep.kind).toBe('teamChoice');
  });

  it('non (ou club sans équipe) : on continue vers la création', () => {
    start();
    pressNext();
    pressNext();
    expect(stepId()).toBe('m1-dock');
  });

  it('équipe reprise ou reconnue : M1 validée, puis M2', () => {
    start();
    pressNext();
    action('team.trained', { teamName: 'Seniors A' });
    expect(tour.missionStatus.coach_m1).toBe('done');
    flush();
    expect(stepId()).toBe('m2-card');
  });

  it('demande envoyée : le guide le dit et se met en attente, sans bloquer', () => {
    start();
    pressNext();
    action('team.requested', { teamName: 'Seniors A' });
    expect(stepId()).toBe('m1-wait-team');
    expect(tour.currentStep.pausedLabel).toMatch(/équipe/);
    pressNext();
    expect(tour.tourStatus).toBe('paused');
  });

  it('demande déjà en attente au départ : l’attente, pas la création', () => {
    mockUserData = { ...mockUserData, teamMembershipRequests: [PENDING_TEAM] };
    start();
    pressNext();
    expect(stepId()).toBe('m1-wait-team');
  });

  it('une invitation reçue n’est pas une demande : la question reste', () => {
    mockUserData = {
      ...mockUserData,
      teamMembershipRequests: [{ ...PENDING_TEAM, direction: 'invite' }],
    };
    start();
    pressNext();
    expect(stepId()).toBe('m1-choice');
  });

  it('acceptée pendant la pause : la pastille annonce M2', () => {
    mockUserData = { ...mockUserData, teamMembershipRequests: [PENDING_TEAM] };
    start();
    pressNext();
    pressNext();
    expect(tour.tourStatus).toBe('paused');
    mockUserData = { ...mockUserData, teamMembershipRequests: [], trainedTeams: [SENIORS] };
    rerender();
    expect(tour.tourStatus).toBe('paused');
    expect(tour.missionStatus.coach_m1).toBe('done');
    expect(stepId()).toBe('m2-card');
  });

  it('réponse arrivée pendant la pause : la pastille ne dit plus « En attente »', () => {
    mockUserData = { ...mockUserData, teamMembershipRequests: [PENDING_TEAM] };
    start();
    pressNext();
    pressNext();
    expect(tour.isWaitOver).toBe(false);
    mockUserData = {
      ...mockUserData,
      teamMembershipRequests: [{ ...PENDING_TEAM, state: 'refused' }],
    };
    rerender();
    expect(tour.isWaitOver).toBe(true);
  });

  it('refusée pendant la pause : la question revient à la reprise', () => {
    mockUserData = { ...mockUserData, teamMembershipRequests: [PENDING_TEAM] };
    start();
    pressNext();
    pressNext();
    mockUserData = {
      ...mockUserData,
      teamMembershipRequests: [{ ...PENDING_TEAM, state: 'refused' }],
    };
    rerender();
    act(() => { tour.resumeTour(); });
    expect(stepId()).toBe('m1-choice');
  });

  it('club rejoint pendant le guide : la question aussi, puis le tunnel', () => {
    mockUserData = { ...mockUserData, club: null };
    start();
    pressNext();
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('m1-gate');
    interaction('clubGate.search');
    route(RouteNames.Club);
    mockUserData = { ...mockUserData, club: CLUB };
    action('club.joined', { clubName: CLUB.name });
    interaction('club.joined.ack');
    expect(stepId()).toBe('m1-back');
    route(RouteNames.SearchHome);
    expect(stepId()).toBe('m1-choice');
    pressNext();
    route(RouteNames.MyTeamList);
    expect(stepId()).toBe('m1-new');
    route(RouteNames.TeamWizardName);
    expect(stepId()).toBe('tw1');
  });
});

describe('point 2 — équipe créée dans l’inscription, profil pas encore relu', () => {
  it('le guide démarré ensuite la reconnaît : M1 validée, M2 en suite', () => {
    renderProvider();
    action('team.created', { teamName: 'Seniors B' });
    act(() => { tour.startTour('coach'); });
    expect(tour.missionStatus.coach_m1).toBe('done');
    expect(tour.gauge).toBe(25);
    expect(tour.created['team.created']).toMatchObject({ teamName: 'Seniors B' });
    pressNext();
    expect(stepId()).toBe('m2-card');
  });
});

describe('point 4 — le retour du partage', () => {
  const toPick = () => {
    mockUserData = { ...mockUserData, trainedTeams: [SENIORS] };
    start();
    pressNext();
    route(RouteNames.TeamDetails);
    interaction('team.actions.open');
    interaction('teamActions.shareLink');
    expect(stepId()).toBe('m2-pick');
  };

  it('partage confirmé : mission réussie, puis M3', () => {
    toPick();
    action('team.invite.shared', { teamId: 'team-1' });
    expect(tour.missionStatus.coach_m2).toBe('done');
    flush();
    expect(stepId()).toBe('m3-dock');
  });

  it('partage annulé ou sans résultat : le guide demande, il ne recule pas', () => {
    toPick();
    interaction('team.invite.dismissed');
    expect(stepId()).toBe('m2-sent');
    expect(tour.currentStep.nextLabel).toBeTruthy();
    pressNext();
    expect(tour.missionStatus.coach_m2).toBe('done');
  });

  it('feuille qui ne répond jamais : la bulle garde un bouton, jamais d’étape sans issue', () => {
    toPick();
    expect(tour.currentStep.nextLabel).toBeTruthy();
    pressNext();
    expect(tour.missionStatus.coach_m2).toBe('done');
    flush();
    expect(stepId()).toBe('m3-dock');
  });

  it.each(['m2-more', 'm2-share'])('une vraie invitation envoyée depuis %s valide M2', (step) => {
    mockUserData = { ...mockUserData, trainedTeams: [SENIORS] };
    start();
    pressNext();
    route(RouteNames.TeamDetails);
    if (step === 'm2-share') interaction('team.actions.open');
    expect(stepId()).toBe(step);
    action('team.invite.sent', { teamId: 'team-1' });
    expect(tour.missionStatus.coach_m2).toBe('done');
    flush();
    expect(stepId()).toBe('m3-dock');
  });

  it('le lien existant repartagé depuis la feuille : le guide demande aussi', () => {
    mockUserData = { ...mockUserData, trainedTeams: [SENIORS] };
    start();
    pressNext();
    route(RouteNames.TeamDetails);
    interaction('team.invite.returned');
    expect(stepId()).toBe('m2-sent');
  });

  it('la bulle se pose sous les onglets de la fiche', () => {
    toPick();
    expect(tour.currentStep.belowTargets).toEqual(['team.tabs']);
  });
});

describe('reprise — la progression se retrouve par l’id de l’étape', () => {
  it('garde l’id, et le relit même si les étapes ont bougé', () => {
    start();
    pressNext();
    pressNext();
    const saved = JSON.parse(mockStore.get(`tourProgress_${USER_ID}`));
    expect(saved.stepId).toBe('m1-dock');
    act(() => tree.unmount());
    mockStore.set(`tourProgress_${USER_ID}`, JSON.stringify({ ...saved, stepIndex: 0 }));
    renderProvider();
    expect(stepId()).toBe('m1-dock');
  });
});
