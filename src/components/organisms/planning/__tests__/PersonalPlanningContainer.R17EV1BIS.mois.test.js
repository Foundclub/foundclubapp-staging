import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { getMyPlanning } from '@/services/event/eventService';

// 🏛️ R17-EVT-1-BIS (b) (20/10/2026, tri du chef) — « MON PLANNING », VUE MOIS : l'événement de la
// Ville que le serveur y verse (niveau 3, un créneau par jour, sans documentId) s'ouvre sur SA
// fiche, comme dans la grille. Avant : le geste ne faisait rien (pas de documentId).
// Doublures reprises de PersonalPlanningContainer.R17-VUE.test.js. ROUGE avant.

jest.setTimeout(30000);

jest.mock('@/utils/planning/planningSlots', () => ({
  ...jest.requireActual('@/utils/planning/planningSlots'),
  getPlanningDefaultDate: () => new Date(2026, 9, 21, 12, 0, 0),
}));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
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
      Alignments: makeRamp(),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});
jest.mock('@/services/event/eventService', () => ({ getMyPlanning: jest.fn() }));

/** @type {any[]} */
const mockSelecteurs = [];
/** @type {any[]} */
const mockGrilles = [];
/** @type {any[]} */
const mockCalendriers = [];
jest.mock('@/components/atoms/loader/Loader', () => function LoaderDouble() {
  return null;
});
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SelecteurDouble(/** @type {any} */ props) {
    mockSelecteurs.push(props);
    return null;
  },
);
jest.mock(
  '@/components/organisms/planning/PlanningFullscreenButton',
  () => function PleinEcranDouble() { return null; },
);
jest.mock(
  '@/components/organisms/planningCalendarView',
  () => function CalendrierDouble(/** @type {any} */ props) {
    mockCalendriers.push(props);
    return null;
  },
);
jest.mock(
  '@/components/organisms/planningWeekTimelineView',
  () => function GrilleDouble(/** @type {any} */ props) {
    mockGrilles.push(props);
    return null;
  },
);

// eslint-disable-next-line import/first
import PersonalPlanningContainer from '../PersonalPlanningContainer';

/** @type {Array<{ arbre: any, client: QueryClient }>} */
const montes = [];
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 10); }); });
};

const FETE = {
  documentId: 'evt-ville-1',
  endTime: '15:30',
  name: 'Fête du sport',
  startTime: '14:00',
  takesPlace: true,
};
const CRENEAU_DE_LA_VILLE = {
  endAt: '2026-11-12T13:30:00.000Z',
  evenementDeLaVille: FETE,
  kind: 'villeEvent',
  startAt: '2026-11-12T12:00:00.000Z',
  title: 'Fête du sport',
};

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});
describe('R17-EVT-1-BIS — « Mon planning », vue Mois', () => {
  test('🔴 toucher l’événement de la Ville ouvre SA fiche', async () => {
    /** @type {any} */ (getMyPlanning)
      .mockImplementation(async () => ({ data: [CRENEAU_DE_LA_VILLE] }));
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <PersonalPlanningContainer datesAVenir={[new Date(2026, 10, 12, 13)]} />
        </QueryClientProvider>,
      );
    });
    await attendre();
    montes.push({ arbre, client });
    const calendrier = mockCalendriers[mockCalendriers.length - 1];
    expect(calendrier).toBeDefined();
    const item = calendrier.events.find((/** @type {any} */ e) => e?.raw?.evenementDeLaVille);
    expect(item).toBeDefined();
    mockNavigate.mockClear();
    await act(async () => {
      calendrier.onEventPress(item);
    });
    expect(mockNavigate).toHaveBeenCalledWith('EvenementDeLaVille', { evenementId: 'evt-ville-1' });
  });
});
