import renderer, { act } from 'react-test-renderer';

import { getMyPlanning } from '@/services/event/eventService';

// PARENT-PLANNING (06/10/2026, « calendrier B » du chef d orchestre) — LE CALENDRIER DU HAUT D UN
// PARENT verse aussi les creneaux A VENIR de ses enfants.
//
// Le serveur ne les calcule que sur demande (`withChildren`, hors de son cache). L ecran ne la fait
// que
// pour un compte qui A des enfants : « Mon planning » le sait par sa liste (`meta.viewerChildren`)
// et le
// dit au calendrier (prop `withChildren`). Pour tous les autres comptes, la demande ne change pas —
// pas
// meme sa cle de cache.
// Ce temoin exige :
//   1. avec la prop, la demande porte le drapeau (et une cle a elle) ; sans, rien ne change ;
//   2. le creneau d un enfant porte son PRENOM (« Hugo · Entrainement U15 ») ;
//   3. le plein ecran recoit le drapeau.

const mockUseQuery = jest.fn();
const mockNavigate = jest.fn();
const mockTimelineProps = [];
const mockFullscreenProps = [];

jest.mock('@tanstack/react-query', () => ({
  useQuery: (/** @type {any} */ options) => mockUseQuery(options),
}));

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

// `.env` n existe dans aucune copie de travail : le service est double.
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
jest.mock(
  '@/components/organisms/planning/PlanningFullscreenButton',
  () => function FullscreenDouble(/** @type {any} */ props) {
    mockFullscreenProps.push(props);
    return null;
  },
);
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

const CRENEAU_DE_HUGO = {
  documentId: 'e1',
  startAt: '2026-12-05T17:00:00.000Z',
  title: 'Entrainement U15',
  viewerChildren: [{ documentId: 'hugo', firstname: 'Hugo' }],
  viewerChildrenOnly: true,
};
const MON_CRENEAU = {
  documentId: 'e6', startAt: '2026-12-06T17:00:00.000Z', title: 'Match Seniors',
};

/**
 * Monte le calendrier ; la requete rend `creneaux`.
 * @param {any} props - Les props du calendrier.
 * @param {any[]} [creneaux] - Ce que rend le serveur.
 * @returns {any} Les options passees a `useQuery`.
 */
const monter = (props, creneaux = []) => {
  mockUseQuery.mockReturnValue({ data: { data: creneaux }, isError: false, isLoading: false });
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    arbre = renderer.create(<PersonalPlanningContainer {...props} />);
  });
  return mockUseQuery.mock.calls[mockUseQuery.mock.calls.length - 1][0];
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockUseQuery.mockReset();
  mockNavigate.mockReset();
  mockTimelineProps.length = 0;
  mockFullscreenProps.length = 0;
  /** @type {any} */ (getMyPlanning).mockClear();
});

describe('PARENT-PLANNING / 4 — le calendrier d un parent', () => {
  test('4-4 ROUGE-AVANT — `withChildren` : la demande porte le drapeau (cle a elle)', async () => {
    const options = monter({ withChildren: true });
    await options.queryFn();
    expect(/** @type {any} */ (getMyPlanning).mock.calls[0][0].withChildren).toBe(true);
    expect(options.queryKey).toContain('withChildren');
  });

  test('4-5 PROTEGE — sans la prop, la demande et sa cle ne changent pas', async () => {
    const options = monter({});
    await options.queryFn();
    expect(/** @type {any} */ (getMyPlanning).mock.calls[0][0].withChildren).toBeUndefined();
    expect(options.queryKey).toHaveLength(4);
    expect(options.queryKey.slice(0, 2)).toEqual(['planning', 'personal']);
  });

  test('4-6 ROUGE-AVANT — le creneau de Hugo porte son prenom ; le mien ne change pas', () => {
    monter({ withChildren: true }, [CRENEAU_DE_HUGO, MON_CRENEAU]);
    const titres = mockTimelineProps[mockTimelineProps.length - 1].events
      .map((/** @type {any} */ c) => c.title);
    expect(titres).toEqual(['Hugo · Entrainement U15', 'Match Seniors']);
  });

  test('4-7 ROUGE-AVANT — le plein ecran recoit le drapeau', () => {
    monter({ withChildren: true });
    act(() => mockFullscreenProps[mockFullscreenProps.length - 1].onPress());
    expect(mockNavigate.mock.calls[0][1].withChildren).toBe(true);
  });
});
