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
    // GUIDE-ENTETE (3- A, 28/10) : retour à l'accueil en dépilant (relance depuis Mon compte).
    expect(mockNavigate)
      .toHaveBeenCalledWith(RouteNames.HomeTab, {
        params: { pop: true, screen: RouteNames.SearchHome }, screen: RouteNames.Search,
      }, { pop: true });
    expect(tour.missions.map((mission) => mission.id))
      .toEqual(['coach_m1', 'coach_m2', 'coach_m3', 'coach_m4', 'coach_b1', 'coach_b2']);
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

  // TUTOE-CALIBRAGE (27/10, décision du chef) : une équipe où le coach est
  // JOUEUR ne compte pas ; seules les équipes qu'il entraîne (trainedTeams).
  it('une équipe où le coach est seulement joueur ne saute pas « Créer ton équipe »', () => {
    mockUserData = { ...mockUserData, myTeams: [{ documentId: 't-joueur' }], trainedTeams: [] };
    startAndOpen();
    expect(tour.currentStep.id).toBe('m1-dock');
  });

  // Tournée : Julien entraîne U13 et Seniors d'un AUTRE club ; l'écran Équipes
  // est celui de son club courant, où il n'entraîne rien.
  it('des équipes entraînées dans un autre club ne sautent pas « Créer ton équipe »', () => {
    mockUserData = {
      ...mockUserData,
      trainedTeams: [{ club: { documentId: 'autre-club' }, documentId: 't-ailleurs' }],
    };
    startAndOpen();
    expect(tour.currentStep.id).toBe('m1-dock');
  });

  it('équipe entraînée dans son club : « Retrouve ton équipe » vise une équipe entraînée', () => {
    mockUserData = {
      ...mockUserData,
      trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 't-ici' }],
    };
    startAndOpen();
    expect(tour.currentStep.id).toBe('m1-find');
    expect(tour.currentStep.targets).toEqual(['teams.trained.0']);
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
      // DATESDABORD (staging) : le lieu AVANT « Date & horaire ».
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardLogistics,
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
    // GUIDE-BONUS (L5) : en dépilant (la compo d'exemple sort de la pile).
    expect(mockNavigate).toHaveBeenLastCalledWith(
      RouteNames.HomeTab,
      { params: { pop: true, screen: 'SearchHome' }, screen: RouteNames.Search },
      { pop: true },
    );
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
    // TUTOE-CALIBRAGE : ordre réel du tunnel (DATESDABORD), lieu puis date.
    route(RouteNames.EventWizardLocation);
    expect(tour.currentStep.id).toBe('m3-place');
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

  // TUTOE-CALIBRAGE (27/10, décision du chef) : une pause PENDANT la séance
  // reprend à l'étape en pause ; seul un relancement de l'app (brouillon
  // perdu) repart au début du tunnel (`resumeFrom`, témoin ci-dessus).
  it('pause puis « Reprendre » dans la même séance : retour à l’étape en pause', () => {
    mockUserData = { ...mockUserData, club: null };
    startAndOpen();
    route(RouteNames.MyTeamList);
    route(RouteNames.TeamWizardName);
    interaction('clubGate.search');
    expect(tour.currentStep.id).toBe('m1-csearch');
    act(() => { tour.pauseTour(); });
    act(() => { tour.resumeTour(); });
    expect(tour.tourStatus).toBe('active');
    expect(tour.currentStep.id).toBe('m1-csearch');
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

// TUTOE-CALIBRAGE (27/10) — émulateur : la carte « Rechercher » ouvre
// `SearchRecruitment`, une REDIRECTION vers le hub de recherche ; seule la route
// du hub arrive au guide, qui restait bloqué sur « m4-card ».
describe('guide Entraîneur — M4 par la redirection de recherche', () => {
  it('arriver sur le hub de recherche fait passer à la lecture des profils', () => {
    const { COACH_GUIDE } = jest.requireActual('@/domains/tour/coachGuide');
    const { matchSignal } = jest.requireActual('@/domains/tour/tourGuideEngine');
    const index = COACH_GUIDE.steps.findIndex((step) => step.id === 'm4-card');
    const match = matchSignal(COACH_GUIDE, index, { key: RouteNames.SearchHub, kind: 'route' }, {});
    expect(COACH_GUIDE.steps[match?.index]?.id).toBe('m4-read');
  });
});

describe('guide Entraîneur — bonus (TUTOE-2)', () => {
  const startBonus = (missionId) => {
    renderProvider();
    act(() => { tour.startTour('coach', { fromMission: missionId }); });
  };

  it('le palier propose 2 bonus, chacun avec sa durée', () => {
    renderProvider();
    const bonus = tour.missions || [];
    act(() => { tour.startTour('coach'); });
    expect(tour.missions.filter((mission) => !mission.locked)
      .map((mission) => [mission.id, mission.estimatedSeconds]))
      .toEqual([['coach_b1', 15], ['coach_b2', 35]]);
    expect(bonus).toEqual([]);
  });

  it('B1 : planning › séance › relance réelle ⇒ bonus réussi, jauge inchangée', () => {
    startBonus('coach_b1');
    expect(tour.currentStep.id).toBe('b1-dock');
    expect(tour.gauge).toBe(100);
    route(RouteNames.MyEventList);
    expect(tour.currentStep.id).toBe('b1-card');
    route(RouteNames.EventDetails);
    expect(tour.currentStep.id).toBe('b1-relance');
    action('event.relance.sent');
    expect(tour.reward).toEqual({
      from: 100, isBonus: true, missionId: 'coach_b1', to: 100,
    });
    reward();
    // GUIDE-BONUS (L5) : le bonus suivant emmène directement au planning, en dépilant.
    expect(tour.currentStep.id).toBe('b2-dock');
    expect(mockNavigate).toHaveBeenLastCalledWith(
      RouteNames.HomeTab,
      { screen: RouteNames.MyEventList },
      { pop: true },
    );
    expect(tour.missionStatus.coach_b1).toBe('done');
  });

  it('« Passer ce bonus » saute à B2 sans le valider', () => {
    startBonus('coach_b1');
    act(() => { tour.skipMission(); });
    expect(tour.currentStep.id).toBe('b2-dock');
    expect(tour.missionStatus.coach_b1).toBe('skipped');
  });

  it('B2 : le match d’exemple s’ouvre sans eventId ni teamId, puis la publication simulée clôt', () => {
    mockUserData.trainedTeams = [{ activities: [{ name: 'Rugby' }], name: 'U13 A' }];
    startBonus('coach_b2');
    route(RouteNames.MyEventList);
    expect(tour.currentStep.id).toBe('b2-where');
    act(() => { tour.completeCurrentStep(); });
    expect(tour.currentStep.id).toBe('b2-list');
    const [stack, { params, screen }] = mockNavigate.mock.calls.at(-1);
    expect([stack, screen]).toEqual([RouteNames.EventStack, RouteNames.MatchCallUpSelection]);
    expect(params.tourExample).toBe('match');
    expect(params.sport).toBe('Rugby');
    expect(params.teamName).toBe('U13 A');
    expect(params.players.length).toBeGreaterThan(0);
    expect(params.players.every((player) => player.isSimulation)).toBe(true);
    // Aucun identifiant réel : aucune requête ne peut partir de ces écrans.
    expect(params).not.toHaveProperty('eventId');
    expect(params).not.toHaveProperty('teamId');
    expect(params).not.toHaveProperty('clubId');

    route(RouteNames.MatchCompositionStart);
    expect(tour.currentStep.id).toBe('b2-start');
    route(RouteNames.MatchCompositionBoard);
    expect(tour.currentStep.id).toBe('b2-pub');
    action('composition.simulated.published');
    expect(tour.reward.isBonus).toBe(true);
    reward();
    expect(tour.currentStep.kind).toBe('closing');
  });

  it('M3 : la feuille « Répéter » et le formulaire de lieu ont leurs sous-bulles en M3', () => {
    const { COACH_GUIDE } = jest.requireActual('@/domains/tour/coachGuide');
    const byId = (id) => COACH_GUIDE.steps.find((step) => step.id === id);
    expect(byId('m3-when').subGuides[0].bubbles.map(([target]) => target)).toEqual([
      'repeat.frequency', 'repeat.interval', 'repeat.days', 'repeat.end', 'repeat.apply',
    ]);
    expect(byId('m3-place').subGuides[0].bubbles).toHaveLength(6);
  });
});

// TUTOE-CALIBRAGE-2 (27/10, décision du chef 3) : l'étape retient l'écran qui
// l'a ouverte ; la couche coupe le voile quand on le quitte (retour en arrière).
it('une étape de tunnel retient la route qui l’a ouverte', () => {
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
  expect(tour.currentStep.id).toBe('m3-type');
  expect(tour.stepRoute).toBe(RouteNames.EventWizardType);
  route(RouteNames.EventWizardTeam);
  expect(tour.stepRoute).toBe(RouteNames.EventWizardTeam);
  // Un signal qui n'est pas une route : l'étape suivante n'a pas d'écran à elle.
  route(RouteNames.EventWizardLocation);
  route(RouteNames.EventWizardLogistics);
  route(RouteNames.EventWizardAccess);
  route(RouteNames.EventWizardDescription);
  route(RouteNames.EventWizardRecap);
  expect(tour.currentStep.id).toBe('m3-create');
  expect(tour.stepRoute).toBe(RouteNames.EventWizardRecap);
  action('event.created', { documentId: 'ev-1' });
  expect(tour.stepRoute).toBeNull();
});
