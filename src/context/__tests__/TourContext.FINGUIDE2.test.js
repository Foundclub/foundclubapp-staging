import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { TourProvider, useTour } from '../TourContext';

// FIN-GUIDE2 (Adel « 1- A », 02/11) : un coach qui ferme l'app en pleine inscription ne passe plus
// par « Bienvenue », seul écran qui lance le guide. L'accueil le lui propose s'il ne l'a jamais
// lancé, une fois sa fin d'inscription datée après la frontière ; les anciens comptes, datés au
// plus tard par le rattrapage du 29/10, ne voient rien.

jest.mock('@/navigation/navigationService', () => ({ navigate: jest.fn(() => true) }));

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

const APRES = '2026-11-03T08:00:00.000Z';
const coach = (overrides = {}) => ({
  documentId: 'coach-1',
  onboardingCompletedAt: APRES,
  role: { name: 'Entraîneur' },
  ...overrides,
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
const mount = (userData = coach()) => {
  mockUserData = userData;
  act(() => { tree = renderer.create(<TourProvider><Probe /></TourProvider>); });
};

beforeEach(() => {
  jest.useFakeTimers();
  mockStore.clear();
});

afterEach(() => {
  act(() => { tree?.unmount(); });
  jest.useRealTimers();
});

describe('Qui se voit proposer le guide', () => {
  it('un coach inscrit après la frontière, qui ne l a jamais lancé', () => {
    mount();
    expect(tour.isGuideOfferable).toBe(true);
  });

  it('pile sur la frontière : oui ; une seconde avant : non', () => {
    mount(coach({ onboardingCompletedAt: '2026-11-02T23:00:00.000Z' }));
    expect(tour.isGuideOfferable).toBe(true);
    act(() => { tree.unmount(); });
    mount(coach({ onboardingCompletedAt: '2026-11-02T22:59:59.000Z' }));
    expect(tour.isGuideOfferable).toBe(false);
  });

  it.each([
    ['daté par le rattrapage du 29/10', '2026-10-29T12:30:00.000Z'],
    ['sans date', null],
    ['date illisible', 'pas une date'],
  ])('un ancien coach : %s', (_cas, onboardingCompletedAt) => {
    mount(coach({ onboardingCompletedAt }));
    expect(tour.isGuideOfferable).toBe(false);
  });

  it.each(['Dirigeant', 'Joueur', 'Parent'])('pas un coach : %s', (name) => {
    mount(coach({ role: { name } }));
    expect(tour.isGuideOfferable).toBe(false);
  });

  it('un guide déjà lancé sur cet appareil', () => {
    mockStore.set('tourGuideDone_coach-1', '1');
    mount();
    expect(tour.isGuideOfferable).toBe(false);
  });

  it('jamais sur le site, qui n a pas de guide', () => {
    const plateforme = jest.replaceProperty(Platform, 'OS', 'web');
    mount();
    expect(tour.isGuideOfferable).toBe(false);
    plateforme.restore();
  });
});

describe('Ce que devient la proposition', () => {
  it('le refus tient après une relance de l app', () => {
    mount();
    act(() => { tour.declineGuideOffer(); });
    expect(tour.isGuideOfferable).toBe(false);
    act(() => { tree.unmount(); });
    mount();
    expect(tour.isGuideOfferable).toBe(false);
  });

  it('le refus d un compte ne vaut pas pour un autre', () => {
    mount();
    act(() => { tour.declineGuideOffer(); });
    act(() => { tree.unmount(); });
    mount(coach({ documentId: 'coach-2' }));
    expect(tour.isGuideOfferable).toBe(true);
  });

  it('le refus laisse le guide ouvert depuis Mon compte', () => {
    mount();
    act(() => { tour.declineGuideOffer(); });
    expect(tour.hasGuideHistory).toBe(false);
    act(() => { tour.startTour('coach'); });
    expect(tour.isTourActive).toBe(true);
  });

  it('lancé puis arrêté, il n est plus proposé', () => {
    mount();
    act(() => { tour.startTour('coach'); });
    expect(tour.isGuideOfferable).toBe(false);
    act(() => { tour.exitTour(); });
    expect(tour.isTourActive).toBe(false);
    expect(tour.isGuideOfferable).toBe(false);
  });

  it('la date arrivée après coup (profil relu) fait apparaître la proposition', () => {
    mount(coach({ onboardingCompletedAt: null }));
    expect(tour.isGuideOfferable).toBe(false);
    mockUserData = coach();
    act(() => { tree.update(<TourProvider><Probe /></TourProvider>); });
    expect(tour.isGuideOfferable).toBe(true);
  });
});
