/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import renderer, { act } from 'react-test-renderer';

// 🕒 MARQUE-MAIRIE (14/10/2026) — COL-003, « D3- B » puis « 3- ok go » d'Adel : dans le calendrier
// d'un PARENT, le créneau de son ENFANT qui attend la mairie porte la marque. Le serveur la pose
// désormais sur les créneaux de l'enfant (admin MARQUE-MAIRIE, `mergeViewerChildrenPlanningSlots`) ;
// la grille la dessine depuis COLL-R-A4 (`raw.pendingDecider`). Ce témoin PROTÈGE le passage entre
// les deux : le prénom de l'enfant ajouté au titre (`withViewerChildrenTitles`) ne perd pas la marque.
// (Vert avant le lot : il fige le chemin, la preuve rouge est côté serveur.)

const mockUseQuery = jest.fn();
const mockTimelineProps = [];

jest.mock('@tanstack/react-query', () => ({
  useQuery: (/** @type {any} */ options) => mockUseQuery(options),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
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
jest.mock('@/services/event/eventService', () => ({
  getMyPlanning: jest.fn(async () => ({ data: [] })),
}));
/* eslint-disable global-require */
jest.mock(
  '@/components/atoms/loader/Loader',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_Loader'),
);
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_SegmentedControl'),
);
jest.mock(
  '@/components/organisms/planningCalendarView',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_PlanningCalendarView'),
);
/* eslint-enable global-require */
jest.mock('@/components/organisms/planning/PlanningFullscreenButton', () => function FullscreenDouble() {
  return null;
});
jest.mock('@/components/organisms/planningWeekTimelineView', () => function TimelineDouble(
  /** @type {any} */ props,
) {
  mockTimelineProps.push(props);
  return null;
});

// eslint-disable-next-line import/first
import PersonalPlanningContainer from '../PersonalPlanningContainer';

/** @type {any} */
let arbre = null;
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockUseQuery.mockReset();
  mockTimelineProps.length = 0;
});

test('MARQUE-PARENT le créneau de l enfant qui attend la mairie arrive à la grille avec sa marque, sous son prénom', () => {
  mockUseQuery.mockReturnValue({
    data: {
      data: [{
        documentId: 'e1',
        pendingDecider: 'mairie',
        startAt: '2026-12-05T17:00:00.000Z',
        title: 'Entrainement U15',
        viewerChildren: [{ documentId: 'hugo', firstname: 'Hugo' }],
        viewerChildrenOnly: true,
      }],
    },
    isError: false,
    isLoading: false,
  });
  act(() => {
    arbre = renderer.create(<PersonalPlanningContainer withChildren />);
  });
  const { events } = mockTimelineProps[mockTimelineProps.length - 1];
  const creneau = events.find((/** @type {any} */ e) => e.documentId === 'e1');
  expect(creneau.title).toContain('Hugo');
  expect(creneau.raw.pendingDecider).toBe('mairie');
});

// REPRISE-PLACE (01/11, point 6, revue Parent « faire tenir Semaine en entier ») — à 390 px sur le
// site, « Semaine » sortait coupé en « Semai… » : le sélecteur de vue garde ses largeurs égales et
// prend les marges serrées (`fitLabels`, 6 px au lieu de 16).
test('REPRISE-PLACE le sélecteur de vue (Semaine / 3 jours / Mois) serre ses marges', () => {
  mockUseQuery.mockReturnValue({ data: { data: [] }, isError: false, isLoading: false });
  act(() => {
    arbre = renderer.create(<PersonalPlanningContainer />);
  });
  const [selecteur] = arbre.root.findAll((/** @type {any} */ n) => (
    Array.isArray(n.props?.options) && typeof n.props?.onChange === 'function'
  ));
  expect(selecteur.props.centerContent).toBe(true);
  expect(selecteur.props.fitLabels).toBe(true);
});
