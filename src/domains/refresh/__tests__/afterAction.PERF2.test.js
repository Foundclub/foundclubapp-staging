import { QueryClient, QueryObserver } from '@tanstack/react-query';

import { invalidateAfterAction } from '../afterAction';

// PERF-2 (D70, 12/11/2026) — REPONDRE A UN EVENEMENT NE RELIT PLUS TOUTES LES FICHES D'EVENEMENT.
//
// `answerEvent` et `publishComposition` declarent la racine `['event']` : en prefixe, elle relisait
// TOUTES les fiches montees (`['event', id]`), par exemple chaque bulle d'evenement d'un fil de
// discussion, pour une reponse qui n'en touchait qu'une.
//
// Quand l'appelant nomme l'evenement, seules se relisent :
//   - sa fiche, et ses variantes (`['event', id, 'edit']`) ;
//   - toute fiche en cache qui le PORTE (un tournoi et ses etapes : `childStageEvents`,
//     `parentEvent`).
// Sans evenement nomme (notification, appel ancien), rien ne change : toute la racine.

const ACTIONS = ['answerEvent', 'publishComposition'];

/**
 * Un cache avec quatre fiches d'evenement MONTEES (un observateur chacune), et leurs lectures
 * comptees.
 * @returns {{ queryClient: QueryClient, lectures: Record<string, number>, fermer: () => void }}
 *   Le banc.
 */
const monterCache = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  const lectures = {};
  const fiches = {
    'evt-a': { documentId: 'evt-a', name: 'Match A', participations: [] },
    'evt-b': { documentId: 'evt-b', name: 'Match B', participations: [] },
    'evt-tournoi': {
      childStageEvents: [{ documentId: 'evt-a', name: 'Etape 1' }],
      documentId: 'evt-tournoi',
    },
  };
  const cles = [
    ['event', 'evt-a'], ['event', 'evt-a', 'edit'], ['event', 'evt-b'], ['event', 'evt-tournoi'],
  ];
  const desabonnements = cles.map((queryKey) => {
    const nom = queryKey.join('/');
    lectures[nom] = 0;
    queryClient.setQueryData(queryKey, fiches[queryKey[1]]);
    const observateur = new QueryObserver(queryClient, {
      queryFn: async () => {
        lectures[nom] += 1;
        return fiches[queryKey[1]];
      },
      queryKey,
      staleTime: 60_000,
    });
    return observateur.subscribe(() => {});
  });
  return { fermer: () => desabonnements.forEach((d) => d()), lectures, queryClient };
};

describe.each(ACTIONS)('PERF-2 · invalidateAfterAction(%s) — la racine event', (action) => {
  it('evenement nomme : sa fiche, sa variante, le tournoi qui le porte ; pas l autre', async () => {
    const { fermer, lectures, queryClient } = monterCache();
    await invalidateAfterAction(queryClient, action, { eventId: 'evt-a' });
    expect(lectures).toEqual({
      'event/evt-a': 1,
      'event/evt-a/edit': 1,
      'event/evt-b': 0,
      'event/evt-tournoi': 1,
    });
    expect(queryClient.getQueryState(['event', 'evt-b'])?.isInvalidated).toBe(false);
    fermer();
  });

  it('sans evenement nomme : toute la racine, comme avant', async () => {
    const { fermer, lectures, queryClient } = monterCache();
    await invalidateAfterAction(queryClient, action);
    expect(lectures).toEqual({
      'event/evt-a': 1,
      'event/evt-a/edit': 1,
      'event/evt-b': 1,
      'event/evt-tournoi': 1,
    });
    fermer();
  });

  it('les autres racines de l action ne bougent pas (meme cle, meme relecture)', async () => {
    const queryClient = new QueryClient();
    const spy = jest.spyOn(queryClient, 'invalidateQueries');
    await invalidateAfterAction(queryClient, action, { eventId: 'evt-a' });
    const nues = spy.mock.calls
      .map(([filtre]) => filtre?.queryKey)
      .filter((cle) => cle?.[0] !== 'event');
    const avecEvenementNu = spy.mock.calls.map(([filtre]) => filtre?.queryKey);
    expect(nues.length).toBe(avecEvenementNu.length - 1);
    expect(nues.every((cle) => cle.length === 1)).toBe(true);
  });
});
