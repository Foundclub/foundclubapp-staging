import { QueryClient, QueryObserver } from '@tanstack/react-query';

import {
  AFTER_ACTION_CACHES,
  invalidateAfterAction,
  MEMBERSHIP_NOTIFICATION_TYPES,
  resolveNotificationRefreshAction,
} from '../afterAction';

/**
 * DEMR / etape 7 — UNE DEMANDE QUI ARRIVE MET A JOUR UN ONGLET « DEMANDES » OUVERT.
 *
 * 🔎 Lu dans le code le 16/09 : `teamRequest` (une demande d'equipe qui ARRIVE
 * chez l'encadrant) etait volontairement exclue du rafraichissement, au motif
 * que « RequestsHub la relit deja ». C'est faux pour un onglet DEJA ouvert :
 * l'ecran ne relit qu'a la prise de focus, et un ecran deja focalise n'y
 * repasse pas. Meme chose pour `participationRequest` (une demande de
 * participation a une activite).
 *
 * 🎯 Le garde-fou d'origine reste vrai : une notification ne doit pas payer
 * dix requetes. La nouvelle action ne touche QU'UNE racine, `requestsHub`, et
 * react-query ne la relit que si l'onglet est monte.
 *
 * Temoins sur un VRAI `QueryClient` et un VRAI `QueryObserver`.
 */

const TYPES_ARRIVEE = ['featuredRequest', 'overbookingRequest', 'participationRequest', 'teamRequest'];

/**
 * Monte une query deja lue, observee comme dans l'app.
 * @param {QueryClient} client Le client de test.
 * @param {unknown[]} queryKey La cle.
 * @returns {{ lectures: () => number, arreter: () => void }} Le compteur et le demontage.
 */
const monter = (client, queryKey) => {
  let lectures = 0;
  client.setQueryData(queryKey, { lecture: 0 });
  const observer = new QueryObserver(client, {
    queryFn: async () => {
      lectures += 1;
      return { lecture: lectures };
    },
    queryKey,
    staleTime: 30_000,
  });
  const arreter = observer.subscribe(() => {});
  return { arreter, lectures: () => lectures };
};

describe('DEMR — les notifications de demande qui ARRIVE', () => {
  /** @type {QueryClient} */
  let client;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  });

  afterEach(() => {
    client.clear();
  });

  it('les quatre demandes qui arrivent relisent la boite « Demandes »', () => {
    TYPES_ARRIVEE.forEach((type) => {
      expect({ action: resolveNotificationRefreshAction(type), type })
        .toEqual({ action: 'requestArrived', type });
    });
  });

  it('l action ne touche QU UNE racine : requestsHub', () => {
    expect(AFTER_ACTION_CACHES.requestArrived).toEqual([['requestsHub']]);
  });

  it('les etiquettes d adhesion ne changent pas', () => {
    MEMBERSHIP_NOTIFICATION_TYPES.forEach((type) => {
      expect(resolveNotificationRefreshAction(type)).toBe('membershipChanged');
    });
    TYPES_ARRIVEE.forEach((type) => {
      expect(MEMBERSHIP_NOTIFICATION_TYPES).not.toContain(type);
    });
  });

  it('un onglet OUVERT se relit, et rien d autre ne devient perime', async () => {
    const hub = monter(client, ['requestsHub', 'club-1', 'no-cm', []]);
    const equipes = monter(client, ['teams']);
    const accueil = monter(client, ['home-summary']);

    await invalidateAfterAction(client, resolveNotificationRefreshAction('teamRequest'));

    expect({
      accueil: accueil.lectures(),
      equipes: equipes.lectures(),
      hub: hub.lectures(),
    }).toEqual({ accueil: 0, equipes: 0, hub: 1 });
    expect(client.getQueryState(['teams'])?.isInvalidated).toBe(false);

    hub.arreter();
    equipes.arreter();
    accueil.arreter();
  });
});
