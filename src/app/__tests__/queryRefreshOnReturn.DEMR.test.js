import { onlineManager } from '@tanstack/react-query';

import { buildPreservedApiError, buildRequestTimeoutAbandon } from '@/utils/errors/apiError';

import { createFoundClubQueryClient } from '@/app/queryClient';
import { startQueryRefreshBridge } from '@/app/queryRefreshOnReturn';

/**
 * DEMR / T2 — UN DELAI DEPASSE N'EST PAS UNE COUPURE RESEAU.
 *
 * 🔎 LE MECANISME (lu dans le code le 16/09, et c'est ce que ce fichier prouve) :
 * l'intercepteur HTTP rejette un abandon a 15 s avec `status: 0`
 * (`buildRequestTimeoutAbandon`). Le filet de `queryRefreshOnReturn` ne voit
 * aucun code HTTP > 0 et conclut « coupure » : `onlineManager.setOnline(false)`,
 * et TOUTES les requetes de l'app passent en pause. Une requete en pause rend
 * `data: undefined`, `isLoading: false` — l'ecran « Demandes » affiche
 * « Aucune demande en attente » et le tirer-pour-rafraichir ne fait plus rien.
 * C'est le « il faut recharger » d'Adel.
 *
 * En production le 16/09, les lectures d'activites du hub duraient 13 a 37 s :
 * toutes au-dela des 15 s de l'app.
 *
 * Ce fichier monte le VRAI client de l'app (sa vraie politique de reprise) et le
 * VRAI `onlineManager` de react-query — rien n'est simule entre l'erreur et la
 * bascule.
 */

const createFakeAppState = () => ({
  addEventListener: () => ({ remove: () => {} }),
  currentState: 'active',
});

const createFakeFocus = () => ({ setFocused: () => {} });

let client = /** @type {import('@tanstack/react-query').QueryClient} */ (/** @type {any} */ (null));
let stopBridge = () => {};

/**
 * Fait echouer UNE requete avec `error`, a travers le vrai cache.
 * @param {string} name Le nom de la requete.
 * @param {unknown} error L'erreur rejetee par la fonction de lecture.
 * @returns {Promise<void>}
 */
const failOnce = async (name, error) => {
  await client.fetchQuery({
    queryFn: () => Promise.reject(error),
    queryKey: ['demr-t2', name],
    // La politique de reprise reste celle de l'app ; seul le delai entre deux
    // essais est raccourci pour ne pas attendre une seconde reelle.
    retryDelay: 1,
  }).catch(() => {});
};

describe('DEMR / T2 — delai depasse ou coupure reseau', () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    client = createFoundClubQueryClient();
    stopBridge = startQueryRefreshBridge(client, {
      appState: createFakeAppState(),
      focus: createFakeFocus(),
      online: onlineManager,
    });
  });

  afterEach(() => {
    stopBridge();
    onlineManager.setOnline(true);
    client.clear();
  });

  it('T2.1 — un abandon a 15 s (XHR, ECONNABORTED) ne met PAS l app hors ligne', async () => {
    await failOnce('xhr', buildRequestTimeoutAbandon({ code: 'ECONNABORTED' }));

    expect({ enLigne: onlineManager.isOnline() }).toEqual({ enLigne: true });
  });

  it('T2.2 — un abandon a 15 s (fetch, ETIMEDOUT) ne met PAS l app hors ligne', async () => {
    await failOnce('fetch', buildRequestTimeoutAbandon({ code: 'ETIMEDOUT' }));

    expect({ enLigne: onlineManager.isOnline() }).toEqual({ enLigne: true });
  });

  it('T2.3 — le meme abandon re-emballe par un service (status perdu), non plus', async () => {
    const wrapped = buildPreservedApiError(
      buildRequestTimeoutAbandon({ code: 'ECONNABORTED' }),
      'Failed to fetch events',
    );
    expect(wrapped.status).toBeNull();

    await failOnce('emballe', wrapped);

    expect({ enLigne: onlineManager.isOnline() }).toEqual({ enLigne: true });
  });

  it('T2.4 — une VRAIE coupure (aucune reponse) met toujours l app hors ligne', async () => {
    await failOnce('coupure', { message: 'Network Error', name: 'AxiosError' });

    expect({ enLigne: onlineManager.isOnline() }).toEqual({ enLigne: false });
  });

  it('T2.5 — une reponse du serveur (503) ne met pas l app hors ligne (inchange)', async () => {
    await failOnce('503', { message: 'Service Unavailable', status: 503 });

    expect({ enLigne: onlineManager.isOnline() }).toEqual({ enLigne: true });
  });
});
