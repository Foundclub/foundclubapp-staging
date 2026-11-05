import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { subscribeToGuidanceSignals } from '@/domains/guidance/guidanceRuntime';

import ClubFacilityPlanningContainer from '../ClubFacilityPlanningContainer';

// Guide Dirigeant, M1 ④ : un club neuf a un planning vide ; le guide y pose des événements
// d'exemple, au rendu, jamais envoyés, et l'écran dit les gestes attendus par les bulles.

const mockNavigate = jest.fn();
let mockTour;
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@react-navigation/native', () => ({
  NavigationContext: jest.requireActual('react').createContext(null),
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ canManageTeam: false, USER_ROLES: { president: 'Dirigeant' }, userData: {} }),
}));
jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: () => ({
    data: {
      clubFacilities: [{ documentId: 'fac-1', maxSlots: 2, name: 'Stade' }],
      cmId: null,
      sharedFacilities: [],
    },
    isLoading: false,
  }),
}));
jest.mock('@/services/event/eventService', () => ({
  getClubPlanning: jest.fn(() => Promise.resolve({ data: [] })),
}));
jest.mock('@/services/multisportClub/multisportClubService', () => ({
  getClubSharedPlanning: jest.fn(),
}));
jest.mock('@/hooks/useVueInitiale', () => ({
  __esModule: true,
  default: () => ({ enDecision: false, garderLeChoix: jest.fn() }),
}));

/** @type {any} */
let mockGrille;
/** @type {any} */
let mockVues;
jest.mock('@/components/atoms/loader/Loader', () => function LoaderDouble() { return null; });
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SelecteurDouble(/** @type {any} */ props) {
    mockVues = props;
    return null;
  },
);
jest.mock(
  '@/components/organisms/planning/PlanningFullscreenButton',
  () => function PleinEcranDouble() { return null; },
);
jest.mock('../../planningCalendarView', () => function CalendrierDouble(/** @type {any} */ props) {
  mockGrille = props;
  return null;
});
jest.mock('../../planningWeekTimelineView', () => function GrilleDouble(/** @type {any} */ props) {
  mockGrille = props;
  return null;
});

const monter = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <ClubFacilityPlanningContainer
          clubId="club-1"
          initialFacilityId="fac-1"
          initialSelectionKey="1"
        />
      </QueryClientProvider>,
    );
  });
  await act(async () => { await new Promise((fin) => { setTimeout(fin, 0); }); });
  return arbre;
};
const enCours = (tourExample) => ({
  currentStep: { tourExample },
  tourStatus: 'active',
});

describe('les événements d’exemple', () => {
  let signaux;
  let couper;
  beforeEach(() => {
    mockNavigate.mockClear();
    signaux = [];
    couper = subscribeToGuidanceSignals((signal) => signaux.push(signal.key));
  });
  afterEach(() => couper?.());

  it('l’étape les pose : dits « Exemple », rattachés à l’installation', async () => {
    mockTour = enCours('planning');
    await monter();
    expect(mockGrille.events.length).toBeGreaterThanOrEqual(2);
    mockGrille.events.forEach((event) => {
      expect(event.title).toContain('Exemple');
      expect(event.facility.documentId).toBe('fac-1');
    });
  });

  it('témoin : hors de ces étapes, rien', async () => {
    mockTour = enCours(undefined);
    await monter();
    expect(mockGrille.events).toEqual([]);
  });

  it('guide en pause : rien', async () => {
    mockTour = { ...enCours('planning'), tourStatus: 'paused' };
    await monter();
    expect(mockGrille.events).toEqual([]);
  });

  it('toucher un exemple n’ouvre aucune fiche', async () => {
    mockTour = enCours('planning');
    await monter();
    act(() => mockGrille.onEventPress(mockGrille.events[0]));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('témoin : toucher un vrai événement ouvre sa fiche', async () => {
    mockTour = enCours(undefined);
    await monter();
    act(() => mockGrille.onEventPress({ documentId: 'ev-1' }));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('la flèche vers l’avant le dit, pas celle vers l’arrière', async () => {
    mockTour = enCours('planning');
    await monter();
    const maintenant = mockGrille.currentDate.getTime();
    act(() => mockGrille.onDateChange(new Date(maintenant - 7 * 86400000)));
    expect(signaux).not.toContain('planning.period.next');
    act(() => mockGrille.onDateChange(new Date(maintenant + 7 * 86400000)));
    expect(signaux).toContain('planning.period.next');
  });

  it('choisir « Mois » le dit ; « 3 jours » non', async () => {
    mockTour = enCours('planning');
    await monter();
    act(() => mockVues.onChange('3days'));
    expect(signaux).not.toContain('planning.view.month');
    act(() => mockVues.onChange('month'));
    expect(signaux).toContain('planning.view.month');
  });

  it('« Toutes installations » le dit', async () => {
    mockTour = enCours('planning');
    const arbre = await monter();
    const chip = arbre.root.findAll((n) => typeof n.props.onPress === 'function'
      && n.findAll((x) => x.props.children === 'Toutes installations').length > 0)[0];
    act(() => chip.props.onPress());
    expect(signaux).toContain('facility.planning.filter');
  });
});
