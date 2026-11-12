import renderer, { act } from 'react-test-renderer';

import { resetGuidanceRuntimeForTests } from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { PRESIDENT_GUIDE_SETTINGS } from '@/domains/tour/presidentGuideSettings';

import { TourProvider, useTour } from '../TourContext';

// GUIDE-PROGRESSIONS (demande d'Adel D45, décision « 222 B » du 10/11) : chaque guide garde sa
// progression. Avant : lancer le guide Dirigeant remettait à zéro le guide Entraîneur en pause
// (une seule progression par personne sur le téléphone), et l'inverse.
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

const USER_ID = 'dirigeant-1';
// La clé d'avant ce lot, telle qu'elle est déjà écrite sur les téléphones (2.6.99).
const PROGRESS_KEY = `tourProgress_${USER_ID}`;
const DONE_KEY = `tourGuideDone_${USER_ID}`;
// Étape 3 du guide Entraîneur (rang 3 : « open » est le rang 0).
const COACH_STEP_3 = 'm1-dock';

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
const relaunchApp = () => {
  act(() => tree.unmount());
  tour = undefined;
  renderProvider();
};
const stepId = () => tour.currentStep?.id;

/**
 * Guide Entraîneur gardé sur le téléphone, à l'étape 3, sous la forme d'avant ce lot.
 * @param {Record<string, any>} [extra] - Champs en plus ou à retirer (valeur `undefined`).
 * @returns {void}
 */
const coachSavedAtStep3 = (extra = {}) => {
  mockStore.set(DONE_KEY, '1');
  mockStore.set(PROGRESS_KEY, JSON.stringify({
    created: {},
    flags: {},
    gauge: 0,
    missionStatus: {},
    profileKey: 'coach',
    skippedSubMissions: [],
    stepId: COACH_STEP_3,
    stepIndex: COACH_GUIDE.steps.findIndex((step) => step.id === COACH_STEP_3),
    version: 3,
    ...extra,
  }));
};

/**
 * L'Entraîneur est mis en pause à l'étape 3 (reprise puis « Quitter »).
 * @returns {void}
 */
const coachPausedAtStep3 = () => {
  coachSavedAtStep3();
  renderProvider();
  act(() => { tour.resumeTour(); });
  expect(tour.profileKey).toBe('coach');
  expect(stepId()).toBe(COACH_STEP_3);
  act(() => { tour.pauseTour(); });
  expect(tour.tourStatus).toBe('paused');
};

/**
 * Le Dirigeant est lancé, et on y avance d'une étape.
 * @returns {void}
 */
const presidentStartedAndAdvanced = () => {
  let started;
  act(() => { started = tour.startTour('president'); });
  expect(started).toBe(true);
  expect(tour.profileKey).toBe('president');
  const first = stepId();
  act(() => { tour.completeCurrentStep(); });
  act(() => jest.runOnlyPendingTimers());
  expect(stepId()).not.toBe(first);
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  tour = undefined;
  // Dirigeant·e avec un club rattaché (le guide Dirigeant peut partir), sans équipe.
  mockUserData = {
    club: { documentId: 'club-1', name: 'AS Test' },
    documentId: USER_ID,
    firstname: 'Dina',
    myTeams: [],
    role: { name: 'President', type: 'president' },
    trainedTeams: [],
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  act(() => tree?.unmount());
  jest.useRealTimers();
});

describe('GUIDE-PROGRESSIONS — chaque guide garde sa progression', () => {
  it('précondition : le guide Dirigeant est allumé', () => {
    expect(PRESIDENT_GUIDE_SETTINGS.enabled).toBe(true);
  });

  it('Entraîneur en pause à l’étape 3, puis Dirigeant : l’Entraîneur reprend à l’étape 3', () => {
    coachPausedAtStep3();
    presidentStartedAndAdvanced();
    act(() => { tour.resumeTour({ profileKey: 'coach' }); });
    expect(tour.profileKey).toBe('coach');
    expect(tour.tourStatus).toBe('active');
    expect(stepId()).toBe(COACH_STEP_3);
  });

  it('… et le Dirigeant, quitté pour l’Entraîneur, reprend lui aussi où il en était', () => {
    coachPausedAtStep3();
    presidentStartedAndAdvanced();
    const presidentStep = stepId();
    act(() => { tour.resumeTour({ profileKey: 'coach' }); });
    act(() => { tour.resumeTour({ profileKey: 'president' }); });
    expect(tour.profileKey).toBe('president');
    expect(stepId()).toBe(presidentStep);
  });

  it('… même après un relancement de l’app', () => {
    coachPausedAtStep3();
    presidentStartedAndAdvanced();
    relaunchApp();
    // Le dernier guide touché revient en pause, comme avant ce lot.
    expect(tour.profileKey).toBe('president');
    expect(tour.tourStatus).toBe('paused');
    expect(tour.parkedGuideKeys).toEqual(['coach']);
    act(() => { tour.resumeTour({ profileKey: 'coach' }); });
    expect(tour.profileKey).toBe('coach');
    expect(stepId()).toBe(COACH_STEP_3);
  });

  it('Mon compte sait quels guides attendent : l’Entraîneur rangé, pas celui à l’écran', () => {
    coachPausedAtStep3();
    expect(tour.parkedGuideKeys).toEqual([]);
    presidentStartedAndAdvanced();
    expect(tour.parkedGuideKeys).toEqual(['coach']);
    act(() => { tour.resumeTour({ profileKey: 'coach' }); });
    expect(tour.parkedGuideKeys).toEqual(['president']);
  });

  it('finir le Dirigeant ne touche pas à l’Entraîneur rangé', () => {
    coachPausedAtStep3();
    presidentStartedAndAdvanced();
    act(() => { tour.exitTour(); });
    expect(tour.isTourActive).toBe(false);
    expect(tour.parkedGuideKeys).toEqual(['coach']);
    act(() => { tour.resumeTour({ profileKey: 'coach' }); });
    expect(stepId()).toBe(COACH_STEP_3);
  });

  it('« Recommencer à zéro » le Dirigeant ne remet pas l’Entraîneur à zéro', () => {
    coachPausedAtStep3();
    presidentStartedAndAdvanced();
    act(() => { tour.restartTour('president'); });
    expect(tour.profileKey).toBe('president');
    expect(stepId()).toBe('open');
    act(() => { tour.resumeTour({ profileKey: 'coach' }); });
    expect(stepId()).toBe(COACH_STEP_3);
  });

  it('« Recommencer à zéro » l’Entraîneur rangé repart de zéro, lui seul', () => {
    coachPausedAtStep3();
    presidentStartedAndAdvanced();
    act(() => { tour.restartTour('coach'); });
    expect(tour.profileKey).toBe('coach');
    expect(stepId()).toBe('open');
    expect(tour.parkedGuideKeys).toEqual(['president']);
  });

  it('reprendre un guide sans progression rangée ne change rien', () => {
    coachPausedAtStep3();
    act(() => { tour.resumeTour({ profileKey: 'president' }); });
    expect(tour.profileKey).toBe('coach');
    expect(tour.tourStatus).toBe('paused');
  });

  it('la visite « sans rien créer » ne range rien', () => {
    coachPausedAtStep3();
    act(() => { tour.startTour('coach', { review: true }); });
    expect(tour.isReview).toBe(true);
    expect(tour.parkedGuideKeys).toEqual([]);
  });
});

describe('GUIDE-PROGRESSIONS — migration douce', () => {
  it('une progression d’avant ce lot (clé unique) est relue : personne ne perd sa place', () => {
    coachSavedAtStep3();
    renderProvider();
    expect(tour.profileKey).toBe('coach');
    expect(tour.tourStatus).toBe('paused');
    act(() => { tour.resumeTour(); });
    expect(stepId()).toBe(COACH_STEP_3);
  });

  it('… y compris sans `stepId` (forme plus ancienne), puis rangée au départ du Dirigeant', () => {
    coachSavedAtStep3({ stepId: undefined });
    expect(JSON.parse(mockStore.get(PROGRESS_KEY)).stepId).toBeUndefined();
    renderProvider();
    expect(tour.profileKey).toBe('coach');
    presidentStartedAndAdvanced();
    act(() => { tour.resumeTour({ profileKey: 'coach' }); });
    expect(stepId()).toBe(COACH_STEP_3);
  });

  it('la clé d’avant reste celle du guide à l’écran (l’app d’avant la relit telle quelle)', () => {
    coachPausedAtStep3();
    presidentStartedAndAdvanced();
    expect(JSON.parse(mockStore.get(PROGRESS_KEY)).profileKey).toBe('president');
  });
});
