import { AppState } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceAction,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { resetTourTargetsForTests, reportTourField } from '@/domains/tour/tourTargetRegistry';

import { TourProvider, useTour } from '../TourContext';

// Socle du guide Dirigeant (lot L1, 05/11) : le moteur ne connaît plus l'entraîneur en dur. Un faux
// guide de dirigeant suffit à l'éprouver ; aucun écran dirigeant n'existe encore.

const mockNavigate = jest.fn(() => true);
jest.mock('@/navigation/navigationService', () => ({
  navigate: (...args) => mockNavigate(...args),
}));
jest.mock('@/domains/tour/guideSupport', () => ({ __esModule: true, default: () => true }));

const USER_ID = 'user-1';
const mockStore = new Map();
let mockUserData;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));
jest.mock('@/store/appContext', () => ({
  storage: {
    delete: (key) => mockStore.delete(key),
    getString: (key) => (mockStore.has(key) ? mockStore.get(key) : undefined),
    set: (key, value) => mockStore.set(key, value),
  },
}));
jest.mock('@/domains/tour/tourCatalog', () => {
  const actual = jest.requireActual('@/domains/tour/tourCatalog');
  const step = (id, missionId, extras = {}) => ({
    id, missionId, targets: [], text: id, ...extras,
  });
  const guide = {
    buildFlags: ({ created }) => ({ hadClubAtStart: Boolean(created?.['club.created']) }),
    isOfferDate: (date) => date === 'apres-le-depart',
    missions: [{
      gaugeStep: 50, id: 'd_m1', locked: true, title: 'M1',
    }, {
      gaugeStep: 50, id: 'd_m2', locked: true, title: 'M2',
    }],
    preStartSignals: ['club.created'],
    steps: [
      step('a', 'd_m1', { nextLabel: 'Suivant' }),
      step('champ', 'd_m1', {
        nextLabel: 'Suivant',
        nextRequires: { field: 'club.name', message: () => 'Donne un nom d’abord.' },
      }),
      step('p1', 'd_m1', { nextLabel: 'Suivant', passable: true, subMission: 'partenaires' }),
      step('p2', 'd_m1', { nextLabel: 'Suivant', passable: true, subMission: 'partenaires' }),
      step('b', 'd_m1', { nextLabel: 'Suivant' }),
      step('fin', 'd_m1', {
        completesMission: true, nextLabel: 'Suivant', passable: true, subMission: 'derniere',
      }),
      step('sms', 'd_m2', {
        advanceOn: { key: 'app.returned', type: 'interaction' }, completesMission: true,
      }),
    ],
    version: 3,
  };
  return {
    ...actual,
    GUIDE_PRE_START_SIGNALS: [...actual.GUIDE_PRE_START_SIGNALS, 'club.created'],
    getGuideKeyForRole: (role) => (
      role === 'president' ? 'president' : actual.getGuideKeyForRole(role)
    ),
    getTourProfile: (key) => (key === 'president' ? guide : actual.getTourProfile(key)),
  };
});

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
const mount = () => {
  act(() => { tree = renderer.create(<TourProvider><Probe /></TourProvider>); });
};
const flush = () => act(() => { jest.runOnlyPendingTimers(); });
const stepId = () => tour.currentStep?.id;
const pressNext = () => act(() => { tour.completeCurrentStep(); });
const start = () => {
  mount();
  act(() => { tour.startTour('president'); });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockClear();
  mockStore.clear();
  resetGuidanceRuntimeForTests();
  resetTourTargetsForTests();
  tour = undefined;
  mockUserData = {
    documentId: USER_ID,
    firstname: 'Sam',
    onboardingCompletedAt: 'apres-le-depart',
    role: { name: 'President', type: 'president' },
  };
});

afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  act(() => tree?.unmount());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('la proposition du guide suit le rôle', () => {
  it('un dirigeant avec un guide : proposé, et c’est le sien', () => {
    mount();
    expect(tour.isGuideOfferable).toBe(true);
    expect(tour.offerGuideKey).toBe('president');
  });

  it('la date vient du profil : avant son départ, rien', () => {
    mockUserData.onboardingCompletedAt = 'avant';
    mount();
    expect(tour.isGuideOfferable).toBe(false);
  });

  it('un rôle sans guide : rien', () => {
    mockUserData.role = { name: 'Player', type: 'player' };
    mount();
    expect(tour.isGuideOfferable).toBe(false);
    expect(tour.offerGuideKey).toBeNull();
  });
});

describe('ce qui s’est passé avant le départ', () => {
  it('le signal déclaré par le profil est retenu, sans nommer l’équipe', () => {
    mount();
    act(() => { emitGuidanceAction('club.created', { clubName: 'AS Test' }); });
    act(() => { tour.startTour('president'); });
    expect(tour.flags.hadClubAtStart).toBe(true);
  });
});

describe('le retour d’une autre app', () => {
  let onChange;
  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, handler) => {
      onChange = handler;
      return { remove: jest.fn() };
    });
  });
  const toSms = () => {
    start();
    reportTourField('club.name', true);
    pressNext();
    pressNext();
    pressNext();
    pressNext();
    pressNext();
    pressNext();
    flush();
    expect(stepId()).toBe('sms');
  };

  it('arrière-plan puis retour : le signal part, l’étape avance', () => {
    toSms();
    act(() => { onChange('background'); });
    act(() => { onChange('active'); });
    expect(tour.missionStatus.d_m2).toBe('done');
  });

  it('témoin : « inactive » (feuille système) n’est pas un départ', () => {
    toSms();
    act(() => { onChange('inactive'); });
    act(() => { onChange('active'); });
    expect(stepId()).toBe('sms');
    expect(tour.missionStatus.d_m2).toBeUndefined();
  });
});

describe('une partie de mission qu’on peut passer', () => {
  const toPartners = () => {
    start();
    reportTourField('club.name', true);
    pressNext();
    pressNext();
    expect(stepId()).toBe('p1');
  };

  it('passe toute la partie, la mission continue', () => {
    toPartners();
    act(() => { tour.skipSubMission(); });
    expect(stepId()).toBe('b');
    expect(tour.missionStatus.d_m1).toBeUndefined();
  });

  it('dernière partie passée : la mission se valide quand même', () => {
    toPartners();
    act(() => { tour.skipSubMission(); });
    pressNext();
    expect(stepId()).toBe('fin');
    act(() => { tour.skipSubMission(); });
    expect(tour.missionStatus.d_m1).toBe('done');
    flush();
    expect(stepId()).toBe('sms');
  });

  it('témoin : une étape sans partie ne se passe pas', () => {
    start();
    act(() => { tour.skipSubMission(); });
    expect(stepId()).toBe('a');
  });
});

describe('la garde du bouton de la bulle', () => {
  it('champ non rempli : on reste, et la bulle dit pourquoi', () => {
    start();
    pressNext();
    expect(stepId()).toBe('champ');
    pressNext();
    expect(stepId()).toBe('champ');
    expect(tour.guardMessage).toBe('Donne un nom d’abord.');
  });

  it('champ rempli : on avance, et le message part', () => {
    start();
    pressNext();
    pressNext();
    act(() => { reportTourField('club.name', true); });
    pressNext();
    expect(stepId()).toBe('p1');
    expect(tour.guardMessage).toBeNull();
  });
});
