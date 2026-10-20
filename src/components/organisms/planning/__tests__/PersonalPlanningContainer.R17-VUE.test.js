import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { getMyPlanning } from '@/services/event/eventService';

// 🗓️ R17-VUE (19/10/2026, REC17-010) — L ONGLET « MON PLANNING » S OUVRE LA OU IL Y A QUELQUE
// CHOSE. Sa vue de base, « 3 jours », compte comme « jour » (reglage du chef) : vide ⇒ la
// semaine s il y a quelque chose dedans, sinon le mois du prochain evenement ; rien ⇒ 3 jours.
// Le « prochain evenement » est lu dans la liste du dessous, DEJA demandee par l ecran
// (`ParticipantEventList`, `useGetEvents` trie par date) : aucune lecture de plus.

// Mercredi 21 octobre 2026, midi.
jest.mock('@/utils/planning/planningSlots', () => ({
  ...jest.requireActual('@/utils/planning/planningSlots'),
  getPlanningDefaultDate: () => new Date(2026, 9, 21, 12, 0, 0),
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
jest.mock('@/services/event/eventService', () => ({ getMyPlanning: jest.fn() }));

/** @type {any[]} */
const mockSelecteurs = [];
/** @type {any[]} */
const mockGrilles = [];
/** @type {any[]} */
const mockCalendriers = [];
/** @type {number} */
let mockChargements = 0;
jest.mock('@/components/atoms/loader/Loader', () => function LoaderDouble() {
  mockChargements += 1;
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

/**
 * Un creneau du planning perso, a midi heure de Paris.
 * @param {string} jour - AAAA-MM-JJ.
 * @returns {any} Le creneau.
 */
const creneau = (/** @type {string} */ jour) => ({
  documentId: `evt-${jour}`, kind: 'event', startAt: `${jour}T10:00:00.000Z`, title: 'Entrainement',
});

/** @type {Array<{ arbre: any, client: QueryClient }>} */
const montes = [];
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 10); }); });
};
/**
 * Monte l onglet avec ce que lit le calendrier (les 3 jours) et la liste du dessous.
 * @param {any[]} troisJours - La reponse de `GET /users/me/planning` pour les 3 jours.
 * @param {Array<Date | null> | null} datesAVenir - Les dates de la liste ; null : pas encore lue.
 * @returns {Promise<(dates: Array<Date | null> | null) => Promise<void>>} Pour livrer la liste.
 */
const monter = async (troisJours, datesAVenir) => {
  /** @type {any} */ (getMyPlanning).mockImplementation(async (/** @type {any} */ plage) => (
    plage.from === '2026-10-21' && plage.to === '2026-10-23' ? { data: troisJours } : { data: [] }
  ));
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <PersonalPlanningContainer datesAVenir={datesAVenir} />
      </QueryClientProvider>,
    );
  });
  await attendre();
  montes.push({ arbre, client });
  return async (dates) => {
    await act(async () => {
      arbre.update(
        <QueryClientProvider client={client}>
          <PersonalPlanningContainer datesAVenir={dates} />
        </QueryClientProvider>,
      );
    });
    await attendre();
  };
};
const selecteur = () => mockSelecteurs[mockSelecteurs.length - 1];
const calendrier = () => mockCalendriers[mockCalendriers.length - 1];

beforeEach(() => {
  mockSelecteurs.length = 0;
  mockGrilles.length = 0;
  mockCalendriers.length = 0;
  mockChargements = 0;
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

describe('R17-VUE — « Mon planning » a l arrivee', () => {
  test('1 CARACTERISATION — 3 jours pleins : la vue « 3 jours » reste', async () => {
    await monter([creneau('2026-10-22')], [new Date(2026, 9, 22, 12)]);
    expect(selecteur().value).toBe('3days');
    expect(mockGrilles[mockGrilles.length - 1].mode).toBe('3days');
  });

  test('2 ROUGE-AVANT — 3 jours vides, un evenement samedi : la SEMAINE', async () => {
    await monter([], [new Date(2026, 9, 24, 12)]);
    expect(selecteur().value).toBe('week');
    expect(mockGrilles[mockGrilles.length - 1].mode).toBe('week');
  });

  test('3 ROUGE-AVANT — semaine vide, prochain le 12 novembre : le MOIS de novembre', async () => {
    await monter([], [new Date(2026, 10, 12, 18), new Date(2026, 11, 2, 18)]);
    expect(selecteur().value).toBe('month');
    expect(calendrier().currentDate.getMonth()).toBe(10);
    expect(calendrier().currentDate.getDate()).toBe(12);
  });

  test('4 CARACTERISATION — rien a venir : « 3 jours », et son etat vide', async () => {
    await monter([], []);
    expect(selecteur().value).toBe('3days');
  });

  test('5 ROUGE-AVANT — la liste pas encore lue : il attend (roue), puis decide', async () => {
    const livrer = await monter([], null);
    expect(mockSelecteurs).toHaveLength(0);
    expect(mockChargements).toBeGreaterThan(0);
    await livrer([new Date(2026, 9, 25, 12)]);
    expect(selecteur().value).toBe('week');
  });

  test('6 — un choix fait a la main ensuite est GARDE', async () => {
    const livrer = await monter([], [new Date(2026, 10, 12, 18)]);
    expect(selecteur().value).toBe('month');
    act(() => selecteur().onChange('3days'));
    await livrer([new Date(2026, 9, 24, 12)]);
    expect(selecteur().value).toBe('3days');
  });
});
