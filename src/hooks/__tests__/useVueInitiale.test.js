import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import useVueInitiale from '../useVueInitiale';

// 🗓️ R17-VUE (19/10/2026, REC17-010) — le crochet commun aux 5 plannings : il decide UNE fois a
// l arrivee, ne lit la suite (bornee) que si la vue de base ET la semaine sont vides, attend la
// liste deja demandee (onglet perso), et se retire devant un choix fait a la main.

// Mercredi 21 octobre 2026, midi (semaine du lundi 19 au dimanche 25).
jest.mock('@/utils/planning/planningSlots', () => ({
  ...jest.requireActual('@/utils/planning/planningSlots'),
  getPlanningDefaultDate: () => new Date(2026, 9, 21, 12, 0, 0),
}));

/**
 * Un bloc de planning, a l heure de Paris (midi : le meme jour partout).
 * @param {string} jour - AAAA-MM-JJ.
 * @returns {any} Le bloc.
 */
const bloc = (/** @type {string} */ jour) => ({ startAt: `${jour}T10:00:00.000Z`, title: 'x' });

/** @type {any} */
let crochet;

/**
 * Le planning qui porte le crochet.
 * @param {{ options: any }} props - Les options du crochet.
 * @returns {null} Rien a dessiner.
 */
function Planning({ options }) {
  crochet = useVueInitiale(options);
  return null;
}

/** @type {Array<{ arbre: any, client: QueryClient }>} */
const montes = [];
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 10); }); });
};
const monter = async (/** @type {any} */ props) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}><Planning options={props} /></QueryClientProvider>,
    );
  });
  await attendre();
  montes.push({ arbre, client });
  return {
    changer: async (/** @type {any} */ nouvelles) => {
      await act(async () => {
        arbre.update(
          <QueryClientProvider client={client}>
            <Planning options={{ ...props, ...nouvelles }} />
          </QueryClientProvider>,
        );
      });
      await attendre();
    },
  };
};

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

const jourDe = (/** @type {Date} */ date) => (
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
);

describe('R17-VUE — useVueInitiale', () => {
  test('1 — jour plein : la vue de base, decidee tout de suite, sans lecture de plus', async () => {
    const appliquer = jest.fn();
    const queryFn = jest.fn();
    await monter({
      appliquer,
      evenements: [bloc('2026-10-21')],
      lectureDeLaSuite: { queryFn, queryKey: ['t1'] },
      vueDeBase: 'day',
    });
    expect(appliquer).toHaveBeenCalledTimes(1);
    expect(appliquer.mock.calls[0][0].vue).toBe('day');
    expect(queryFn).not.toHaveBeenCalled();
    expect(crochet.enDecision).toBe(false);
  });

  test('2 — jour vide, semaine pleine (deja lue) : la semaine, sans lecture de plus', async () => {
    const appliquer = jest.fn();
    const queryFn = jest.fn();
    await monter({
      appliquer,
      evenements: [bloc('2026-10-24')],
      lectureDeLaSuite: { queryFn, queryKey: ['t2'] },
      vueDeBase: 'day',
    });
    expect(appliquer.mock.calls.map(([decision]) => decision.vue)).toEqual(['week']);
    expect(queryFn).not.toHaveBeenCalled();
  });

  test('3 — semaine vide : UNE lecture bornee, puis le mois du prochain evenement', async () => {
    const appliquer = jest.fn();
    const queryFn = jest.fn(async () => ({ data: [bloc('2026-11-12'), bloc('2026-11-03')] }));
    await monter({
      appliquer, evenements: [], lectureDeLaSuite: { queryFn, queryKey: ['t3'] }, vueDeBase: 'week',
    });
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryFn).toHaveBeenCalledWith({ from: '2026-10-26', to: '2026-11-25' });
    expect(appliquer).toHaveBeenCalledTimes(1);
    expect(appliquer.mock.calls[0][0].vue).toBe('month');
    expect(jourDe(appliquer.mock.calls[0][0].date)).toEqual([2026, 11, 3]);
  });

  test('4 — rien plus tard (ou suite illisible) : la vue de base', async () => {
    const appliquer = jest.fn();
    await monter({
      appliquer,
      evenements: [],
      lectureDeLaSuite: { queryFn: async () => ({ data: [] }), queryKey: ['t4'] },
      vueDeBase: 'day',
    });
    expect(appliquer.mock.calls.map(([decision]) => decision.vue)).toEqual(['day']);

    const appliquerEchec = jest.fn();
    await monter({
      appliquer: appliquerEchec,
      evenements: [],
      lectureDeLaSuite: { queryFn: async () => { throw new Error('500'); }, queryKey: ['t4b'] },
      vueDeBase: 'day',
    });
    expect(appliquerEchec.mock.calls.map(([decision]) => decision.vue)).toEqual(['day']);
  });

  test('5 — onglet perso : base vide, il ATTEND la liste deja demandee, puis decide', async () => {
    const appliquer = jest.fn();
    const planning = await monter({
      appliquer, evenements: [], listeConnue: false, vueDeBase: '3days',
    });
    expect(appliquer).not.toHaveBeenCalled();
    expect(crochet.enDecision).toBe(true);
    await planning.changer({
      datesDeLaListe: [new Date(2026, 11, 5, 18, 0, 0)], listeConnue: true,
    });
    expect(appliquer.mock.calls.map(([decision]) => decision.vue)).toEqual(['month']);
    expect(jourDe(appliquer.mock.calls[0][0].date)).toEqual([2026, 12, 5]);
    expect(crochet.enDecision).toBe(false);
  });

  test('6 — choix manuel GARDE : fait avant la decision, la regle se retire', async () => {
    const appliquer = jest.fn();
    const planning = await monter({
      appliquer, evenements: undefined, vueDeBase: 'week',
    });
    expect(crochet.enDecision).toBe(true);
    act(() => crochet.garderLeChoix());
    await planning.changer({ evenements: [] });
    expect(appliquer).not.toHaveBeenCalled();
    expect(crochet.enDecision).toBe(false);
  });

  test('7 — decidee UNE fois : de nouvelles donnees ensuite ne la rejouent pas', async () => {
    const appliquer = jest.fn();
    const planning = await monter({
      appliquer, evenements: [bloc('2026-10-22')], vueDeBase: 'week',
    });
    await planning.changer({ evenements: [] });
    await planning.changer({ evenements: [bloc('2026-10-30')] });
    expect(appliquer).toHaveBeenCalledTimes(1);
  });

  test('8 — regle coupee (plein ecran ouvert sur un autre jour) : rien n est decide', async () => {
    const appliquer = jest.fn();
    await monter({
      actif: false, appliquer, evenements: [], vueDeBase: 'day',
    });
    expect(appliquer).not.toHaveBeenCalled();
    expect(crochet.enDecision).toBe(false);
  });
});
