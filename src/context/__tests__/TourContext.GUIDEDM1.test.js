import { readFileSync } from 'fs';
import { join } from 'path';

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

// Guide Dirigeant·e, M1 (lots L2 et L3) : le chemin d'un dirigeant, joué signal par signal, avec
// l'offre Club et sans. Le pack : `05_GUIDE_D_DIRIGEANT.md`, décisions de la consigne commune.

const mockNavigate = jest.fn(() => true);
jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
}));
jest.mock('@/domains/tour/guideSupport', () => ({ __esModule: true, default: () => true }));
jest.mock('@/domains/tour/presidentGuideSettings', () => ({
  __esModule: true,
  PRESIDENT_GUIDE_SETTINGS: {
    enabled: true,
    offerSince: null,
    partnerPassable: true,
    visitWithoutClubPlan: true,
  },
}));

const USER_ID = 'dirigeant-1';
let mockAuth;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));
const mockStore = new Map();
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
const stepId = () => tour.currentStep?.id;
const start = () => {
  act(() => { tree = renderer.create(<TourProvider><Probe /></TourProvider>); });
  act(() => { tour.startTour('president'); });
  expect(stepId()).toBe('open');
  act(() => { tour.completeCurrentStep(); });
  expect(stepId()).toBe('m1-card');
};
const route = (name) => act(() => { emitGuidanceRouteVisit(name); });
const action = (key, meta) => act(() => { emitGuidanceAction(key, meta); });
const interaction = (key) => act(() => { emitGuidanceInteraction(key); });
const next = () => act(() => { tour.completeCurrentStep(); });
const expectStep = (id) => expect(stepId()).toBe(id);

const playPartOne = () => {
  route(RouteNames.Club);
  expectStep('m1-info');
  next();
  expectStep('m1-edit');
  route(RouteNames.ClubEdit);
  ['m1-logo', 'm1-name', 'm1-email', 'm1-phone', 'm1-addr', 'm1-deleg', 'm1-create']
    .forEach((id) => {
      expectStep(id);
      next();
    });
  expectStep('m1-save');
  action('club.updated');
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  resetTourTargetsForTests();
  tour = undefined;
  mockAuth = {
    subscriptionAccessLevel: 'CLUB_UNVERIFIED',
    userData: {
      club: { documentId: 'club-7', name: 'AS Test' },
      documentId: USER_ID,
      firstname: 'Sam',
      role: { name: 'President', type: 'president' },
    },
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  act(() => tree?.unmount());
  jest.useRealTimers();
});

describe('qui peut partir', () => {
  it('dirigeant sans club : pas de guide (décision 2)', () => {
    mockAuth.userData.club = null;
    act(() => { tree = renderer.create(<TourProvider><Probe /></TourProvider>); });
    let started;
    act(() => { started = tour.startTour('president'); });
    expect(started).toBe(false);
    expect(tour.isTourActive).toBe(false);
  });
});

describe('① les infos du club', () => {
  it('une bulle par champ, puis le vrai enregistrement', () => {
    start();
    playPartOne();
    expectStep('m1-partners');
  });

  it('« Enregistrer » n’a pas de « Suivant », et Annuler ramène à « Modifier »', () => {
    start();
    route(RouteNames.Club);
    next();
    route(RouteNames.ClubEdit);
    for (let i = 0; i < 7; i += 1) next();
    expectStep('m1-save');
    expect(tour.currentStep.nextLabel).toBeUndefined();
    route(RouteNames.Club);
    expectStep('m1-edit');
  });
});

describe('② les partenaires, avec l’offre Club', () => {
  it('liste, ajout, retour sur la fiche', () => {
    start();
    playPartOne();
    interaction('club.section.partners');
    expectStep('m1-padd');
    route(RouteNames.AddSponsor);
    expectStep('m1-pform');
    action('sponsor.created');
    expectStep('m1-pback');
    interaction('club.section.closed');
    expectStep('m1-fac');
  });

  it('se passe, sans partenaire sous la main (décision 4)', () => {
    start();
    playPartOne();
    interaction('club.section.partners');
    route(RouteNames.AddSponsor);
    act(() => { tour.skipSubMission(); });
    expectStep('m1-fac');
    expect(tour.missionStatus.president_m1).toBeUndefined();
  });

  it('droit tombé en route : la bulle donne la sortie, et la partie se passe', () => {
    start();
    playPartOne();
    interaction('club.section.partners');
    route(RouteNames.AddSponsor);
    act(() => { emitGuidanceRefusal('paywall.sponsor-manage-required'); });
    expectStep('m1-pform');
    expect(tour.missionStatus.president_m1).toBeUndefined();
    act(() => { tour.skipSubMission(); });
    expectStep('m1-fac');
  });
});

describe('③ les installations, avec l’offre Club', () => {
  const toForm = () => {
    start();
    playPartOne();
    act(() => { tour.skipSubMission(); });
    expectStep('m1-fac');
    route(RouteNames.FacilityList);
    expectStep('m1-facadd');
    route(RouteNames.FacilityForm);
    expectStep('m1-ffname');
  };

  it('nom, type et adresse obligatoires : la bulle retient, et dit pourquoi', () => {
    toForm();
    next();
    expectStep('m1-ffname');
    expect(tour.guardMessage).toMatch(/nom/);
    act(() => { reportTourField('facility.name', true); });
    next();
    expectStep('m1-fftype');
    next();
    expectStep('m1-fftype');
    expect(tour.guardMessage).toMatch(/type/);
    act(() => { reportTourField('facility.type', true); });
    next();
    expectStep('m1-ffaddr');
    next();
    expectStep('m1-ffaddr');
    expect(tour.guardMessage).toMatch(/adresse/);
    act(() => { reportTourField('facility.address', true); });
    next();
    expectStep('m1-ff2');
    next();
    expectStep('m1-ff3');
  });

  it('droit tombé à « Créer » : ni blocage de la mission, ni bulle sans issue', () => {
    toForm();
    ['facility.name', 'facility.type', 'facility.address']
      .forEach((field) => reportTourField(field, true));
    next();
    next();
    next();
    next();
    expectStep('m1-ff3');
    act(() => { emitGuidanceRefusal('paywall.facility-manage-required'); });
    expectStep('m1-ff3');
    act(() => { tour.skipSubMission(); });
    expect(tour.currentStep?.subMission).not.toBe('facilities');
    expect(tour.missionStatus.president_m1).not.toBe('blocked');
  });
});

describe('sans offre Club (décision 1, A)', () => {
  it('② et ③ sont montrés au bouton, jamais joués', () => {
    mockAuth.subscriptionAccessLevel = 'FREE';
    start();
    playPartOne();
    expectStep('m1-partners-visit');
    expect(tour.currentStep.targets).toEqual(['club.m.partners']);
    next();
    expectStep('m1-fac-visit');
    expect(tour.currentStep.targets).toEqual(['club.m.facilities']);
    next();
    const ids = PRESIDENT_GUIDE.steps.map((step) => step.id);
    expect(ids.indexOf(stepId())).toBeGreaterThan(ids.indexOf('m1-fac-visit'));
    expect(['m1-padd', 'm1-pform', 'm1-facadd', 'm1-ff3']).not.toContain(stepId());
  });
});

describe('le catalogue de M1 ne promet rien que le code n’ait', () => {
  const src = (path) => readFileSync(join(__dirname, '../..', path), 'utf8');
  const M1 = PRESIDENT_GUIDE.steps.filter((step) => step.missionId === 'president_m1');
  const SOURCES = [
    'views/club/ClubDetails.js',
    'views/club/ClubEdit.js',
    'views/club/AddSponsor.js',
    'views/facility/FacilityList.js',
    'views/facility/FacilityForm.js',
    'views/event/EventPublishedShowcase.js',
    'components/organisms/planning/ClubFacilityPlanningContainer.js',
    'components/organisms/planningWeekTimelineView/PlanningWeekTimelineViewV2.js',
    'views/home/HomeHub.js',
    'components/molecules/wizardStepLayout/WizardStepLayout.js',
    'components/atoms/headerBackButton/HeaderBackButton.js',
  ].map(src).join('\n');

  it('chaque ancre de M1 est posée dans un écran', () => {
    const anchors = M1.flatMap((step) => step.targets || [])
      .filter((id) => !id.startsWith('home.card.'));
    expect(anchors.length).toBeGreaterThan(15);
    anchors.forEach((id) => expect([id, SOURCES.includes(`"${id}"`)]).toEqual([id, true]));
  });

  it('④ puis ⑤ : le pack dans l’ordre, la mission se valide à la croix', () => {
    const ids = M1.map((step) => step.id);
    const fin = ids.slice(ids.indexOf('m1-fplan'));
    expect(fin).toEqual([
      'm1-fplan', 'm1-pdemo', 'm1-pcap', 'm1-pchips', 'm1-parrows', 'm1-pempty', 'm1-pview',
      'm1-pmonth', 'm1-pb1', 'm1-fback', 'm1-poster', 'm1-pmodel', 'm1-pposter', 'm1-ptext',
      'm1-pfields', 'm1-pshare', 'm1-psent', 'm1-pclose',
    ]);
    expect(M1.filter((step) => step.completesMission).map((step) => step.id))
      .toEqual(['m1-pclose']);
  });

  it('④ vise la carte de L’installation créée, sinon aucune', () => {
    const step = M1.find((candidate) => candidate.id === 'm1-fplan');
    expect(step.targetsFor({ created: { 'facility.created': { facilityId: 'f-9' } } }))
      .toEqual(['facility.plan.f-9']);
    expect(step.targetsFor({ created: {} })).toEqual([]);
  });

  it('les exemples s’arrêtent en quittant le planning', () => {
    const withExample = M1.filter((step) => step.tourExample === 'planning').map((s) => s.id);
    expect(withExample).toEqual([
      'm1-pdemo', 'm1-pcap', 'm1-pchips', 'm1-parrows', 'm1-pempty', 'm1-pview', 'm1-pmonth',
    ]);
  });

  it('aucun id d’étape en double (reprise par id)', () => {
    const ids = PRESIDENT_GUIDE.steps.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chaque étape dans un écran à brouillon sait où reprendre', () => {
    M1.filter((step) => step.id !== 'm1-card').forEach((step) => {
      expect([step.id, Boolean(step.resumeFrom)]).toEqual([step.id, true]);
    });
  });
});
