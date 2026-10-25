import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { getCMPlanning } from '@/services/multisportClub/multisportClubService';

// 🗓️ R17-VUE (19/10/2026, REC17-010) — LE PLANNING OMNISPORT S OUVRE LA OU IL Y A QUELQUE CHOSE.
// Vue de base : la semaine. Vide, mais un evenement plus tard ⇒ le MOIS de ce prochain
// evenement, trouve par UNE lecture bornee (31 jours apres la semaine) ; rien ⇒ la semaine.
// Premier temoin de ce conteneur (E6) : les tests 1 et 2 caracterisent ce qui existait.

// Mercredi 21 octobre 2026, midi (semaine du 19 au 25).
jest.mock('@/utils/planning/planningSlots', () => ({
  ...jest.requireActual('@/utils/planning/planningSlots'),
  getPlanningDefaultDate: () => new Date(2026, 9, 21, 12, 0, 0),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: espaces,
    }),
  };
});
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ sceneBottomInset: 0 }),
}));
jest.mock('@/services/facility/facilityService', () => ({
  getCMFacilities: jest.fn(async () => ({ data: [] })),
}));
jest.mock('@/services/multisportClub/multisportClubService', () => ({
  getCMClubs: jest.fn(async () => ({ data: [] })),
  getCMPlanning: jest.fn(),
}));

/** @type {any[]} */
const mockSelecteurs = [];
/** @type {any[]} */
const mockGrilles = [];
/** @type {any[]} */
const mockCalendriers = [];
/* eslint-disable global-require */
jest.mock(
  '@/components/molecules/dateSlider/DateSlider',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_DateSlider'),
);
jest.mock(
  '@/components/molecules/eventCard/EventCardNew',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventCardNew'),
);
jest.mock(
  '@/components/molecules/header/LeagueHeaderSwitch',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_LeagueHeaderSwitch'),
);
jest.mock(
  '@/components/molecules/notificationBadge/NotificationBadge',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_NotificationBadge'),
);
jest.mock(
  '@/components/molecules/profileButton/ProfileButton',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_ProfileButton'),
);
jest.mock(
  '@/components/organisms/planning/PlanningFullscreenButton',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_PlanningFullscreenButton'),
);
/* eslint-enable global-require */
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function EnveloppeDouble(/** @type {any} */ props) {
    return props.isLoading || props.error ? null : props.children;
  },
);
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SelecteurDouble(/** @type {any} */ props) {
    mockSelecteurs.push(props);
    return null;
  },
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
import CMPlanningContent from '../CMPlanningContent';

/**
 * Un evenement d une section, a midi heure de Paris.
 * @param {string} jour - AAAA-MM-JJ.
 * @returns {any} Le bloc.
 */
const evenement = (jour) => ({
  documentId: `evt-${jour}`, kind: 'event', startAt: `${jour}T10:00:00.000Z`, title: 'Judo',
});

/** @type {Array<{ arbre: any, client: QueryClient }>} */
const montes = [];
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 10); }); });
};
/**
 * Monte le planning omnisport ; le serveur rend `parPlage[from]` (sinon rien).
 * @param {Record<string, any[]>} parPlage - Les reponses, par jour de debut.
 * @returns {Promise<void>}
 */
const monter = async (parPlage) => {
  /** @type {any} */ (getCMPlanning).mockImplementation(async (
    /** @type {string} */ _cm,
    /** @type {any} */ filtres,
  ) => ({ data: parPlage[filtres.from] || [] }));
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <CMPlanningContent cmId="cm-1" navigation={{ navigate: jest.fn() }} />
      </QueryClientProvider>,
    );
  });
  // Arrivee, lecture de la suite, puis lecture du mois choisi (sans donnees provisoires ici).
  await attendre();
  await attendre();
  await attendre();
  montes.push({ arbre, client });
};
const selecteur = () => mockSelecteurs[mockSelecteurs.length - 1];
const plagesLues = () => /** @type {any} */ (getCMPlanning).mock.calls
  .map((/** @type {any[]} */ appel) => `${appel[1].from}>${appel[1].to}`);

beforeEach(() => {
  mockSelecteurs.length = 0;
  mockGrilles.length = 0;
  mockCalendriers.length = 0;
  /** @type {any} */ (getCMPlanning).mockReset();
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('R17-VUE — le planning omnisport a l arrivee', () => {
  test('1 CARACTERISATION — la semaine par defaut, lue du lundi au dimanche', async () => {
    await monter({ '2026-10-19': [evenement('2026-10-22')] });
    expect(selecteur().value).toBe('week');
    expect(selecteur().options.map((/** @type {any} */ o) => o.value))
      .toEqual(['week', '3days', 'month']);
    expect(mockGrilles[mockGrilles.length - 1].mode).toBe('week');
  });

  test('2 CARACTERISATION — semaine pleine : AUCUNE lecture de plus', async () => {
    await monter({ '2026-10-19': [evenement('2026-10-22')] });
    expect(plagesLues()).toEqual(['2026-10-19>2026-10-25']);
  });

  test('3 ROUGE-AVANT — semaine vide, un tournoi le 3 novembre : le MOIS de novembre', async () => {
    await monter({ '2026-10-26': [evenement('2026-11-03')] });
    expect(plagesLues()).toContain('2026-10-26>2026-11-25');
    expect(selecteur().value).toBe('month');
    const calendrier = mockCalendriers[mockCalendriers.length - 1];
    expect([calendrier.currentDate.getMonth(), calendrier.currentDate.getDate()]).toEqual([10, 3]);
  });

  test('4 — semaine vide, rien plus tard : la semaine reste (une lecture de plus)', async () => {
    await monter({});
    expect(selecteur().value).toBe('week');
    expect(plagesLues()).toEqual(['2026-10-19>2026-10-25', '2026-10-26>2026-11-25']);
  });

  test('5 — un choix fait a la main ensuite est GARDE', async () => {
    await monter({ '2026-10-26': [evenement('2026-11-03')] });
    expect(selecteur().value).toBe('month');
    await act(async () => { selecteur().onChange('3days'); });
    await attendre();
    expect(selecteur().value).toBe('3days');
  });
});

describe('C05 (Q2-15) — « Événements à partir du » hors de la plage du planning', () => {
  const cartes = () => montes[montes.length - 1].arbre.root
    .findAll((/** @type {any} */ n) => n.props?.item?.documentId && typeof n.type === 'function')
    .map((/** @type {any} */ n) => n.props.item.documentId);

  test('le 27/10 choisi, la semaine du 19 affichee : la liste lit sa propre semaine', async () => {
    await monter({
      '2026-10-19': [evenement('2026-10-22')],
      '2026-10-26': [evenement('2026-10-27')],
    });
    expect(cartes()).toEqual(['evt-2026-10-22']);
    const curseur = montes[montes.length - 1].arbre.root
      .find((/** @type {any} */ n) => typeof n.props?.onDateSelected === 'function');
    await act(async () => { curseur.props.onDateSelected(new Date(2026, 9, 27)); });
    await attendre();
    expect(cartes()).toEqual(['evt-2026-10-27']);
    expect(selecteur().value).toBe('week');
  });
});
