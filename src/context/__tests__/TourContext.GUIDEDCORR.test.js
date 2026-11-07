import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  emitGuidanceInteraction,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import { RouteNames } from '@/navigation/routeNames';

import { TourProvider, useTour } from '../TourContext';

// GUIDE-D-CORR (tournée du 07/11, TG-05 et TG-06) : partenaire créé, deux retours rapides ⇒ le
// guide repartait à « Tout part d'ici » puis 1/5 (captures g38-g43) ; la partie 2/5 rejouée
// demandait « ton premier partenaire » alors qu'il existait, et le bilan disait à la fois
// « Partenaire ajouté » et « À faire : ton partenaire » (r12-r14, r87).

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

const USER_ID = 'dirigeant-corr';
const STORAGE_KEY = `tourProgress_${USER_ID}`;
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
const route = (name) => act(() => { emitGuidanceRouteVisit(name); });
const action = (key, meta) => act(() => { emitGuidanceAction(key, meta); });
const interaction = (key) => act(() => { emitGuidanceInteraction(key); });
const next = () => act(() => { tour.completeCurrentStep(); });
const expectStep = (id) => expect(stepId()).toBe(id);
const mount = () => {
  act(() => { tree = renderer.create(<TourProvider><Probe /></TourProvider>); });
};
const remount = () => {
  act(() => tree.unmount());
  mount();
  expect(tour.tourStatus).toBe('paused');
  act(() => { tour.resumeTour(); });
};
const start = () => {
  mount();
  // L'accueil est à l'écran quand le guide part : la carte « Gérer mon club » y est.
  route(RouteNames.SearchHome);
  act(() => { tour.startTour('president'); });
  next();
  expectStep('m1-card');
};
const playEditFields = () => {
  route(RouteNames.ClubEdit);
  ['m1-logo', 'm1-name', 'm1-email', 'm1-phone', 'm1-addr', 'm1-deleg', 'm1-create']
    .forEach((id) => {
      expectStep(id);
      next();
    });
  expectStep('m1-save');
  action('club.updated');
  route(RouteNames.Club);
};
const playPartOne = () => {
  route(RouteNames.Club);
  expectStep('m1-info');
  next();
  playEditFields();
  expectStep('m1-partners');
};
const playPartnerCreated = () => {
  interaction('club.section.partners');
  expectStep('m1-padd');
  route(RouteNames.AddSponsor);
  expectStep('m1-pform');
  action('sponsor.created');
  route(RouteNames.Club);
  expectStep('m1-pback');
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

describe('TG-05 : ce qui est enregistré ne se refait pas', () => {
  it('partenaire créé, deux retours rapides jusqu’à l’accueil : on reste à 3/5', () => {
    start();
    playPartOne();
    playPartnerCreated();
    // 1er retour : la section se ferme, la fiche du club ; 2e : l'accueil.
    // La section démontée le dit, puis la fiche reprend le focus (sa route), puis l'accueil.
    interaction('club.section.closed');
    expectStep('m1-fac');
    route(RouteNames.Club);
    route(RouteNames.SearchHome);
    expectStep('m1-fac');
  });

  it('app tuée après ces retours : « Reprendre » ramène à 3/5, pas à 1/5', () => {
    start();
    playPartOne();
    playPartnerCreated();
    interaction('club.section.closed');
    route(RouteNames.Club);
    route(RouteNames.SearchHome);
    remount();
    expectStep('m1-fac');
  });

  it('témoin : un retour sans rien enregistrer revient toujours à l’étape d’avant', () => {
    start();
    route(RouteNames.Club);
    next();
    expectStep('m1-edit');
    route(RouteNames.ClubEdit);
    expectStep('m1-logo');
    // Annuler : la fiche revient, l'étape « Modifier » aussi (GUIDE-RECUL).
    route(RouteNames.Club);
    expectStep('m1-edit');
  });
});

describe('TG-06 : une partie déjà faite ne se rejoue pas', () => {
  it('partie 1 rejouée après la création du partenaire : la partie 2/5 est sautée', () => {
    start();
    playPartOne();
    playPartnerCreated();
    // L'état gardé de la tournée : partenaire créé, guide revenu sur « Enregistre ».
    const saved = JSON.parse(mockStore.get(STORAGE_KEY));
    mockStore.set(STORAGE_KEY, JSON.stringify({ ...saved, stepId: 'm1-save' }));
    remount();
    expectStep('m1-info');
    next();
    playEditFields();
    expectStep('m1-fac');
  });

  it('partenaire déjà là (hors guide) : « Tu as déjà ton partenaire », puis 3/5', () => {
    start();
    playPartOne();
    // L'écran : la section s'ouvre, puis il dit qu'un partenaire y est déjà (ClubDetails).
    interaction('club.section.partners');
    action('sponsor.existing');
    expectStep('m1-partners-have');
    next();
    expectStep('m1-fac');
  });

  it('bilan : partenaire créé puis partie passée ⇒ pas de « À faire : ton partenaire »', () => {
    const text = (_key, fallback) => fallback;
    const created = { 'sponsor.created': { at: null } };
    expect(PRESIDENT_GUIDE.closingTodoLines(text, ['partners'], created)).toEqual([]);
    expect(PRESIDENT_GUIDE.closingTodoLines(text, ['partners'], {}))
      .toEqual(['À faire : ton partenaire']);
  });
});
