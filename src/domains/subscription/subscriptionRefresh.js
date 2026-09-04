import { createLogger } from '@/utils/logger/logger';

/**
 * Rafraîchissement de l'état d'abonnement après un achat (L08).
 *
 * POURQUOI CE MODULE EXISTE — constaté sur la build 2.6.1 : après un achat
 * réussi, « Mon abonnement » affichait encore « Gratuit » jusqu'à ce qu'on
 * ferme et rouvre l'app. Trois mécanismes se cumulent :
 *  1. l'achat client réussit AVANT que le serveur n'ouvre les droits — la
 *     vérité arrive par le webhook du store, quelques secondes plus tard ;
 *  2. l'invalidation immédiate des parcours d'achat relit donc l'ANCIEN état
 *     et le remet en cache comme frais ;
 *  3. la query `['app-bootstrap']` est posée en `refetchOnMount: false` et
 *     `refetchOnWindowFocus: false` (useAuth.js) : plus rien ne la relit
 *     ensuite, d'où le redémarrage obligatoire.
 *
 * Des relances différées existaient déjà (3 s / 8 s), mais posées dans des
 * `useEffect` d'écrans : leur nettoyage de démontage les annule dès que
 * l'utilisateur quitte l'écran de succès — c'est-à-dire presque toujours.
 * Le calendrier vit donc ICI, hors de tout cycle de vie de composant, et
 * s'arrête dès que l'état a réellement bougé.
 */

const subscriptionRefreshLogger = createLogger('subscription-refresh');

/**
 * Les deux queries qui portent l'état d'abonnement lu par TOUS les écrans
 * (`subscriptionSummary` / `entitlementsSummary` via useAuth, profil via get-me).
 * @type {string[][]}
 */
export const SUBSCRIPTION_STATE_QUERY_KEYS = [['app-bootstrap'], ['get-me']];

/**
 * Première tentative immédiate (rail de test backend : la vérité est déjà
 * posée), puis la fenêtre de convergence du webhook store — mesurée à ~2-3 s
 * en recette, jusqu'à une vingtaine de secondes quand le store est lent.
 *
 * ABOFIX / A3 — POURQUOI IL Y A UN CRAN DE PLUS QUE CE QU'ON CROIT NÉCESSAIRE.
 * Ces valeurs sont des ATTENTES SUCCESSIVES, pas des instants : les relectures
 * tombent donc à 0, 2, 7, 17, 37 puis 52 secondes. Le palier de 15 s ajouté le
 * 2026-09-04 n'est pas une marge de confort, c'est une soustraction :
 *  - le serveur sert `/app/bootstrap` depuis un cache mémoire FRAIS pendant
 *    30 s + jusqu'à 20 % de gigue, soit jusqu'à 36 s (`runtime-cache.js`) ;
 *  - une fenêtre qui s'arrêtait à 37 s ne laissait donc qu'UNE SECONDE utile,
 *    et un webhook store un peu lent la manquait à tous les coups.
 * ⚠️ Ce palier ne suffit PAS à lui seul : passé les 36 s, le même cache ressert
 * la vieille valeur pendant 4 MINUTES (stale-while-revalidate). Ce qui rend
 * cette fenêtre utile, c'est la purge posée côté serveur au traitement de
 * l'achat (`subscription-billing.ts`, `invalidateMeProfileCache`).
 * @type {number[]}
 */
export const SUBSCRIPTION_REFRESH_DELAYS_MS = [0, 2000, 5000, 10000, 20000, 15000];

/**
 * Invalide les queries qui portent l'état d'abonnement, une fois.
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @returns {Promise<void>}
 */
export const invalidateSubscriptionState = async (queryClient) => {
  await Promise.all(SUBSCRIPTION_STATE_QUERY_KEYS.map(
    (queryKey) => queryClient.invalidateQueries({ queryKey }),
  ));
};

/**
 * Empreinte de l'état d'abonnement tel qu'il est en cache. Comparer deux
 * empreintes dit si le serveur a fini de converger, sans avoir à deviner ce
 * que l'achat était censé produire (achat, changement d'offre, restauration
 * et résiliation passent tous par ici).
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @returns {string}
 */
const readSubscriptionStateSignature = (queryClient) => JSON.stringify(
  queryClient
    .getQueriesData({ queryKey: ['app-bootstrap'] })
    .map(([, data]) => [
      /** @type {any} */ (data)?.subscriptionSummary ?? null,
      /** @type {any} */ (data)?.entitlementsSummary ?? null,
    ]),
);

const wait = (/** @type {number} */ delayMs) => new Promise((resolve) => {
  setTimeout(resolve, delayMs);
});

let activeRunId = 0;
let isRefreshRunning = false;

/**
 * Arrête le calendrier en cours (changement de compte, déconnexion, tests).
 * @returns {void}
 */
export const cancelScheduledSubscriptionStateRefresh = () => {
  activeRunId += 1;
  isRefreshRunning = false;
};

/**
 * Relit l'état d'abonnement jusqu'à ce qu'il bouge, sans dépendre d'un écran.
 * À appeler une fois par achat, juste après la réussite du rail.
 *
 * Un appel pendant qu'un calendrier tourne déjà (parcours d'achat -> écran de
 * succès) ne relance rien : il se contente d'une lecture immédiate. Relancer
 * prendrait pour référence l'état DÉJÀ converge et ferait tourner la fenêtre
 * entière d'invalidations pour rien.
 * @param {import('@tanstack/react-query').QueryClient} queryClient
 * @param {{ delaysMs?: number[] }} [options]
 * @returns {Promise<boolean>} true si l'état a bougé avant la fin de la fenêtre.
 */
export const scheduleSubscriptionStateRefresh = async (queryClient, options = {}) => {
  if (isRefreshRunning) {
    await invalidateSubscriptionState(queryClient);
    return false;
  }

  const delaysMs = Array.isArray(options.delaysMs) && options.delaysMs.length > 0
    ? options.delaysMs
    : SUBSCRIPTION_REFRESH_DELAYS_MS;

  activeRunId += 1;
  const runId = activeRunId;
  isRefreshRunning = true;
  const signatureAvantAchat = readSubscriptionStateSignature(queryClient);

  try {
    for (let index = 0; index < delaysMs.length; index += 1) {
      if (delaysMs[index] > 0) {
        // eslint-disable-next-line no-await-in-loop
        await wait(delaysMs[index]);
        if (runId !== activeRunId) return false;
      }

      // eslint-disable-next-line no-await-in-loop
      await invalidateSubscriptionState(queryClient);
      if (runId !== activeRunId) return false;

      if (readSubscriptionStateSignature(queryClient) !== signatureAvantAchat) {
        return true;
      }
    }
  } finally {
    if (runId === activeRunId) {
      isRefreshRunning = false;
    }
  }

  // L'achat est passé côté store mais le serveur n'a rien ouvert dans la
  // fenêtre : le cron de réconciliation prendra le relais. Trace laissée pour
  // que ce cas se voie dans le journal au lieu de se deviner.
  // ABOFIX / A3 — la fenêtre écoulée est la SOMME des attentes, pas la dernière
  // d'entre elles. Ce libellé annonçait « 20000ms » pour une fenêtre de 37 s :
  // il rendait le diagnostic faux pour qui lisait le journal.
  const fenetreEcouleeMs = delaysMs.reduce((total, delaiMs) => total + delaiMs, 0);
  subscriptionRefreshLogger.warn(
    `[SUBSCRIPTION_REFRESH] état inchangé après ${fenetreEcouleeMs}ms`,
  );
  return false;
};
