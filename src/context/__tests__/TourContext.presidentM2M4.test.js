import { AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceInteraction,
  emitGuidanceRefusal,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { reportTourField, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// Guide Dirigeant·e : M2, M3 et M4 joués de bout en bout par le vrai moteur et les vraies étapes,
// signal après signal, sans écran. L'écran viendra par la recette.

const mockNavigate = jest.fn(() => true);
jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
}));
jest.mock('@/domains/tour/guideSupport', () => ({ __esModule: true, default: () => true }));
jest.mock('@/domains/tour/presidentGuideSettings', () => {
  const actual = jest.requireActual('@/domains/tour/presidentGuideSettings');
  const settings = { ...actual.PRESIDENT_GUIDE_SETTINGS, enabled: true };
  return { __esModule: true, default: settings, PRESIDENT_GUIDE_SETTINGS: settings };
});

const mockStore = new Map();
let mockAuth;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));
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

let tree;
let onAppState;
const mount = () => {
  act(() => { tree = renderer.create(<TourProvider><Probe /></TourProvider>); });
};
const flush = () => act(() => { jest.runOnlyPendingTimers(); });
const stepId = () => tour.currentStep?.id;
const next = () => act(() => { tour.completeCurrentStep(); });
const route = (name) => act(() => { emitGuidanceRouteVisit(name); });
const action = (key, meta) => act(() => { emitGuidanceAction(key, meta); });
const touch = (key, meta) => act(() => { emitGuidanceInteraction(key, meta); });
const start = (fromMission = 'president_m2') => {
  mount();
  act(() => { tour.startTour('president', { fromMission }); });
};
const toInvite = () => {
  start();
  touch('club.section.staff');
  route(RouteNames.AddCoach);
  next();
  act(() => { reportTourField('cf.phone', true); });
  next();
  action('staff.invited', { firstName: 'Julie' });
};
const leaveAndComeBack = () => act(() => {
  onAppState('background');
  onAppState('active');
});

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  resetTourTargetsForTests();
  tour = undefined;
  mockAuth = {
    subscriptionAccessLevel: 'CLUB',
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'user-1',
      firstname: 'Sam',
      role: { name: 'President', type: 'president' },
    },
  };
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, handler) => {
    onAppState = handler;
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  act(() => tree?.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('M2 de bout en bout', () => {
  it('le départ ramène sur la fiche du club, avec son id', () => {
    start();
    expect(stepId()).toBe('m2-staff');
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.ClubStack,
      { params: { clubId: 'club-1' }, screen: RouteNames.Club },
      { pop: true },
    );
  });

  it('une autre sous-page de la fiche ne fait pas avancer', () => {
    start();
    touch('club.section.teams');
    expect(stepId()).toBe('m2-staff');
  });

  it('sans numéro, « Suivant » reste et la bulle dit pourquoi ; avec, il passe', () => {
    start();
    touch('club.section.staff');
    route(RouteNames.AddCoach);
    next();
    expect(stepId()).toBe('m2-fields');
    next();
    expect(stepId()).toBe('m2-fields');
    expect(tour.guardMessage).toMatch(/numéro/);
    act(() => { reportTourField('cf.phone', true); });
    next();
    expect(stepId()).toBe('m2-send');
    expect(tour.guardMessage).toBeNull();
  });

  it('« Inviter », la messagerie, le retour : M2 validée, jauge à 25, puis la fiche', () => {
    toInvite();
    expect(stepId()).toBe('m2-invite');
    touch('staff.sms.opened');
    expect(stepId()).toBe('m2-sms');
    route(RouteNames.Club);
    expect(stepId()).toBe('m2-sms');
    leaveAndComeBack();
    expect(tour.reward).toMatchObject({ missionId: 'president_m2', to: 25 });
    flush();
    expect(stepId()).toBe('m2-back');
    touch('club.section.closed', { section: 'staff' });
    expect(stepId()).toBe('m3-teams');
  });

  it('une feuille système passe l app en « inactive » seulement : ce n est pas un retour', () => {
    toInvite();
    touch('staff.sms.opened');
    act(() => {
      onAppState('inactive');
      onAppState('active');
    });
    expect(stepId()).toBe('m2-sms');
    next();
    expect(tour.reward).toMatchObject({ missionId: 'president_m2' });
  });

  it('« Plus tard » sur la feuille : M2 validée, sans retour d app', () => {
    toInvite();
    touch('staff.invite.later');
    expect(tour.reward).toMatchObject({ missionId: 'president_m2', to: 25 });
    // La feuille se ferme et l'écran revient sur Staff, avant la fin du bandeau.
    route(RouteNames.Club);
    flush();
    expect(stepId()).toBe('m2-back');
  });

  it('passer M2 avant de créer : rien de créé, M3 suit, sans étape de retour', () => {
    start();
    touch('club.section.staff');
    act(() => { tour.skipSubMission(); });
    expect(tour.reward).toMatchObject({ missionId: 'president_m2' });
    flush();
    expect(stepId()).toBe('m3-teams');
    expect(tour.created['staff.invited']).toBeUndefined();
  });

  it('relancement de l app sur la feuille : la question, pas un second compte', () => {
    toInvite();
    expect(stepId()).toBe('m2-invite');
    act(() => tree.unmount());
    tree = undefined;
    mount();
    expect(tour.tourStatus).toBe('paused');
    act(() => { tour.resumeTour(); });
    expect(stepId()).toBe('m2-sms');
    expect(tour.created['staff.invited']).toBeTruthy();
    expect(tour.currentStep.nextLabel).toBeTruthy();
  });

  it('sans droit ouvert : la visite, qui valide sans rien créer', () => {
    mockAuth = { ...mockAuth, subscriptionAccessLevel: 'FREE' };
    start();
    expect(tour.flags.hasClubPlan).toBe(false);
    expect(stepId()).toBe('m2-visit');
    touch('club.section.staff');
    expect(stepId()).toBe('m2-visit-add');
    next();
    flush();
    expect(stepId()).toBe('m3-teams');
    expect(tour.created['staff.invited']).toBeUndefined();
  });

  it('l offre refuse en route : la raison et une sortie, mission passée, M3 suit', () => {
    start();
    touch('club.section.staff');
    route(RouteNames.AddCoach);
    next();
    act(() => { reportTourField('cf.phone', true); });
    next();
    act(() => {
      emitGuidanceRefusal('paywall.club-roles-manage-required');
    });
    expect(tour.blocked?.reason).toMatch(/offre Club/);
    act(() => { tour.skipBlockedMission(); });
    expect(stepId()).toBe('m3-teams');
  });
});

describe('les bonus de bout en bout', () => {
  it('B2 sans canal : la bulle dit pourquoi, le bonus finit au bouton, B3 suit', () => {
    start('president_b2');
    route(RouteNames.Chat);
    expect(stepId()).toBe('b2-canal');
    touch('messaging.canal.absent');
    expect(stepId()).toBe('b2-none');
    next();
    expect(tour.reward).toMatchObject({ isBonus: true, missionId: 'president_b2' });
    flush();
    // Déjà sur les messages : l'étape du retour passe toute seule.
    expect(stepId()).toBe('b3-new');
  });

  it('B3 sans assez de membres : une visite, puis la suite, sans rien créer', () => {
    start('president_b3');
    route(RouteNames.NewConversation);
    expect(stepId()).toBe('b3-sel');
    touch('conversation.members.few');
    expect(stepId()).toBe('b3-few');
    next();
    flush();
    expect(stepId()).toBe('b4-dock');
    expect(tour.created['conversation.group.created']).toBeUndefined();
  });

  it('B3 réel : le groupe créé valide le bonus et compte au bilan', () => {
    start('president_b3');
    route(RouteNames.NewConversation);
    touch('conversation.step.name');
    expect(stepId()).toBe('b3-name');
    next();
    action('conversation.group.created');
    expect(tour.reward).toMatchObject({ missionId: 'president_b3' });
    expect(tour.created['conversation.group.created']).toBeTruthy();
  });

  it('B4 et B1 : du récap à la bulle, le bonus se valide au bouton', () => {
    start('president_b4');
    route(RouteNames.SearchHome);
    route(RouteNames.AdWizardAudienceType);
    [
      RouteNames.AdWizardTeam,
      RouteNames.AdWizardPositions,
      RouteNames.AdWizardInfo,
      RouteNames.AdWizardLocation,
      RouteNames.AdWizardDescription,
      RouteNames.AdWizardRecap,
    ].forEach(route);
    expect(stepId()).toBe('a7');
    touch('ad.publish.example');
    expect(stepId()).toBe('a-stop');
    next();
    expect(tour.missionStatus.president_b4).toBe('done');
  });
});

describe('M3 et M4 de bout en bout', () => {
  const toTeam = () => {
    start('president_m3');
    expect(stepId()).toBe('m3-teams');
    touch('club.section.teams');
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
    expect(stepId()).toBe('tw8');
    action('team.created', { teamName: 'Seniors' });
  };

  it('le tunnel valide M3 au succès serveur, puis la bulle qu une alerte a précédée', () => {
    toTeam();
    expect(tour.reward).toMatchObject({ missionId: 'president_m3', to: 25 });
    flush();
    expect(stepId()).toBe('m3-ok');
    expect(tour.currentStep.targets).toBeUndefined();
    next();
    expect(stepId()).toBe('m4-back1');
  });

  it('M4 : de Mes équipes à l accueil, puis les demandes, et la mission au geste', () => {
    toTeam();
    flush();
    next();
    route(RouteNames.SearchHome);
    expect(stepId()).toBe('m4-card');
    route(RouteNames.RequestsHub);
    expect(stepId()).toBe('m4-filter');
    expect(tour.currentStep.tourExample).toBe('membershipRequest');
    touch('requests.filter.club');
    expect(stepId()).toBe('m4-card2');
    next();
    expect(stepId()).toBe('m4-accept');
    touch('membershipRequest.accepted.example');
    expect(tour.reward).toMatchObject({ missionId: 'president_m4', to: 50 });
    flush();
    expect(stepId()).toBe('palier');
    expect(tour.currentStep.tourExample).toBeUndefined();
    next();
    expect(stepId()).toBe('b1-card');
    // « Passer ce bonus », partout : on arrive à la clôture sans rien avoir créé.
    ['b2-dock', 'b3-new', 'b4-dock', 'b5-back', 'close'].forEach((id) => {
      act(() => { tour.skipMission(); });
      expect(stepId()).toBe(id);
    });
    expect(tour.missionStatus.president_b1).toBe('skipped');
    mockNavigate.mockClear();
    act(() => { tour.finishGuide(); });
    expect(tour.isTourActive).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { pop: true },
    );
  });

  it('M4 reprise après fermeture : on repart de la carte, l exemple n est plus là', () => {
    toTeam();
    flush();
    next();
    route(RouteNames.SearchHome);
    route(RouteNames.RequestsHub);
    expect(tour.currentStep.tourExample).toBe('membershipRequest');
    act(() => tree.unmount());
    tree = undefined;
    mount();
    act(() => { tour.resumeTour(); });
    expect(stepId()).toBe('m4-card');
    expect(tour.currentStep.tourExample).toBeUndefined();
  });

  it('M3 passée sans équipe : le guide ramène à l accueil, sans parler d une équipe', () => {
    start('president_m4');
    expect(stepId()).toBe('m4-home');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
