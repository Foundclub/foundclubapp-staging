import { AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceInteraction,
  emitGuidanceRefusal,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
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
    expect(stepId()).toBe('b4-cand');
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

const driveTo = (target) => {
  for (let guard = 0; guard < 80 && stepId() !== target; guard += 1) {
    const step = tour.currentStep;
    const { steps } = PRESIDENT_GUIDE;
    const nextId = steps[steps.findIndex((one) => one.id === step.id) + 1]?.id;
    const advances = [step.advanceOn].flat().filter(Boolean);
    const signal = advances.find((one) => one.goto === nextId)
      || advances.find((one) => !one.goto) || advances[0];
    if (step.nextRequires) act(() => { reportTourField(step.nextRequires.field, true); });
    if (!signal) next();
    else if (signal.type === 'route') route(signal.key);
    else if (signal.type === 'action') action(signal.key);
    else touch(signal.key);
  }
  expect(stepId()).toBe(target);
};

describe('recette L10 — retour sur l’écran d’exemple de B4', () => {
  const toExample = () => {
    start('president_b4');
    driveTo('b4-cand');
  };

  it('« Reprendre » rouvre l’annonce d’exemple, sans refaire le tunnel', () => {
    toExample();
    route(RouteNames.AdWizardDescription);
    mockNavigate.mockClear();
    act(() => { tour.returnToGuide(); });
    expect(stepId()).toBe('b4-cand');
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.AdWizardStack,
      { screen: RouteNames.AdWizardRecap },
    );
  });
});

describe('bilan : les parties passées arrivent jusqu’à la clôture', () => {
  it('le coach passé est exposé par le contexte', () => {
    start();
    touch('club.section.staff');
    route(RouteNames.AddCoach);
    expect(tour.skippedSubMissions).toEqual([]);
    act(() => { tour.skipSubMission(); });
    expect(tour.skippedSubMissions).toEqual(['coach']);
  });
});

describe('recette L11 — reprise pile sur l’écran d’exemple', () => {
  it('B4 : après « Reprendre », l’arrivée sur le récap garde l’exemple', () => {
    start('president_b4');
    driveTo('b4-cand');
    route(RouteNames.AdWizardDescription);
    act(() => { tour.returnToGuide(); });
    route(RouteNames.AdWizardRecap);
    expect(stepId()).toBe('b4-cand');
  });

  it('B1 : retour sur l’exemple, « Reprendre » rouvre la campagne et garde l’exemple', () => {
    start('president_b1');
    driveTo('b1-camp');
    route(RouteNames.ClubLicenses);
    mockNavigate.mockClear();
    act(() => { tour.returnToGuide(); });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ClubStack, {
      params: { clubId: 'club-1' },
      screen: RouteNames.ClubLicenseCampaignSettings,
    });
    route(RouteNames.ClubLicenseCampaignSettings);
    expect(stepId()).toBe('b1-camp');
  });
});

// Recette L11 (l11-r2-clo) : « Partager » émet l'action puis, au retour, l'interaction, dans le
// même tour de boucle. La 2ᵉ relisait l'état d'avant la 1ʳᵉ et effaçait l'affiche du bilan.
describe('bilan : l’affiche partagée y reste', () => {
  it('action et retour du partage à la suite : l’affiche est comptée', () => {
    start('president_m1');
    driveTo('m1-pshare');
    act(() => {
      emitGuidanceAction('club.poster.shared');
      emitGuidanceInteraction('poster.share.returned');
    });
    expect(tour.created['club.poster.shared']).toBeTruthy();
    expect(stepId()).toBe('m1-psent');
  });
});

// Recette L11 (l11-m1g1) : une installation déjà là valide la partie, on passe à son planning.
describe('M1 : l’installation existante suffit', () => {
  it('« Tu as déjà ton terrain », puis son planning', () => {
    start('president_m1');
    driveTo('m1-facadd');
    action('facility.existing', { facilityId: 'f1' });
    expect(stepId()).toBe('m1-fac-have');
    expect(tour.currentStep.text).toMatch(/déjà ton terrain/);
    touch('facility.planning.opened');
    expect(stepId()).toBe('m1-pdemo');
  });

  it('témoin : sans installation, la création reste le chemin', () => {
    start('president_m1');
    driveTo('m1-facadd');
    route(RouteNames.FacilityForm);
    expect(stepId()).not.toBe('m1-fac-have');
  });
});

// Recette L11 (l11-m1-reprise) : app tuée en M1 ③, « Reprendre » laissait la bulle 3/5 sur
// l'Accueil. `navigate('Club')` nu, depuis la racine, n'est traité par aucun navigateur tant que
// la pile du club n'est pas montée (hotesDepuisLaRacine.js) : la fiche passe par sa pile.
describe('L11 bis — reprise après relancement en M1 ③', () => {
  it('« Reprendre » ouvre la fiche du club par sa pile', () => {
    start('president_m1');
    driveTo('m1-facadd');
    act(() => tree.unmount());
    tree = undefined;
    mount();
    mockNavigate.mockClear();
    act(() => { tour.resumeTour(); });
    expect(stepId()).toBe('m1-fac');
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.ClubStack,
      { params: { clubId: 'club-1' }, pop: true, screen: RouteNames.Club },
      { pop: true },
    );
  });
});

// Recette L11 (l11-b3a) : B2 passé depuis l'Accueil, b3-back passait toute seule (on n'est pas
// dans une conversation) avant d'avoir emmené aux Messages ; b3-new restait sur l'Accueil.
describe('L11 bis — B3 après B2 passé', () => {
  it('b3-new emmène aux Messages', () => {
    start('president_b2');
    route(RouteNames.SearchHome);
    expect(stepId()).toBe('b2-dock');
    mockNavigate.mockClear();
    act(() => { tour.skipMission(); });
    expect(stepId()).toBe('b3-new');
    expect(mockNavigate).toHaveBeenCalledWith(
      RouteNames.HomeTab,
      { screen: RouteNames.Chat },
      { pop: true },
    );
  });
});

// Recette L11 (l11-r2-m3a) : deux retours Android rapides (messagerie, puis Staff). Le 2ᵉ ferme
// Staff pendant le bandeau de M2 : son signal se perd, m2-back s'ouvre sur la fiche. « Nos
// équipes » touché ensuite laissait la bulle « sur Staff » posée sur Nos équipes.
describe('L11 bis — deux retours rapides de M2 à M3', () => {
  it('Staff fermé pendant le bandeau, puis « Nos équipes » : la bulle de M3 suit', () => {
    toInvite();
    touch('staff.sms.opened');
    route(RouteNames.Club);
    leaveAndComeBack();
    touch('club.section.closed', { section: 'staff' });
    flush();
    expect(stepId()).toBe('m2-back');
    touch('club.section.teams');
    expect(stepId()).toBe('m3-create');
  });
});
