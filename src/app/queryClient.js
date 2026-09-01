import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';

import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';

import {
  BOOT_REQUEST_BLOCKED_CODE,
  BOOT_REQUEST_NO_SESSION_CODE,
} from '@/services/bootRequestGuard';
import { REQUEST_TIMEOUT_ABANDON_CODE } from '@/utils/errors/apiError';

// Les intercepteurs de réponse (client.native.js / client.web.js) rejettent la
// charge DÉBALLÉE `error.response.data.error`, jamais l'erreur axios : une
// erreur applicative Strapi arrive donc ici sans `isAxiosError` et sans
// `response`, avec son code dans `error.status`. Lire les deux formes est
// indispensable, sinon tout 4xx retombe dans « inconnu => on retente ».
// Mesuré sur staging le 2026-07-29 : chaque 403 partait 3 fois (1 + 2 reprises
// à 1,13 s et 2,07 s d'écart) pour cette seule raison.
const getErrorStatus = (/** @type {any} */ error) => {
  const rawStatus = error?.status
    ?? error?.response?.status
    ?? error?.error?.status;
  const parsed = Number(rawStatus);
  return Number.isFinite(parsed) ? parsed : null;
};

const getErrorMethod = (/** @type {any} */ error) => String(
  error?.config?.method || error?.response?.config?.method || 'get',
).trim().toUpperCase();

const isLocallyBlocked = (/** @type {any} */ error) => (
  error?.code === BOOT_REQUEST_BLOCKED_CODE
  || error?.code === BOOT_REQUEST_NO_SESSION_CODE
);

// PERF3 — l'abandon posé par l'intercepteur (objet à code dédié), et sa forme
// historique en chaîne nue au cas où un chemin la produirait encore. Le test du
// message ne tourne que sur les erreurs SANS status : un 5xx dont le message
// contient « timeout » n'arrive jamais ici.
const isTimeoutAbandon = (/** @type {any} */ error) => (
  error?.code === REQUEST_TIMEOUT_ABANDON_CODE
  || String(error?.message || error || '').toLowerCase().includes('timeout')
);

/**
 * @param {number} failureCount
 * @param {unknown} error
 * @returns {boolean}
 */
export const shouldRetryQuery = (failureCount, error) => {
  // PERF3 — UNE reprise au lieu de deux (GO Adel 01/09) : la 2e reprise triplait
  // la demande précisément quand le serveur ralentit. Ce qu'on perd : une
  // micro-coupure réseau passagère se rattrape moins souvent toute seule.
  if (failureCount >= 1) {
    return false;
  }

  const typedError = /** @type {any} */ (error);

  // Refus posé par le client lui-même (circuit anti-rafale, absence de session) :
  // retenter ne fait que rejouer le même refus, sans jamais toucher le réseau.
  if (isLocallyBlocked(typedError)) {
    return false;
  }

  if (getErrorMethod(typedError) !== 'GET') {
    return false;
  }

  const status = getErrorStatus(typedError);
  if (status === null || status === 0) {
    // PERF3 — un ABANDON (timeout client de 15 s) ne se retente JAMAIS : le
    // serveur n'a aucun timeout de requête (ni Caddyfile ni config/server.ts),
    // il continue de fabriquer la réponse que plus personne n'attend. Chaque
    // reprise ajoutait 15 s d'attente et 1 requête (48 s / 3 appels mesurés).
    if (isTimeoutAbandon(typedError)) {
      return false;
    }
    // Panne réseau franche (échec immédiat, sans réponse) : ça vaut le coup.
    return true;
  }

  // 429 exclu : le retryDelay (1 s au premier essai) retombe dans la fenêtre de
  // blocage du rate-limiter (60 s) et ne fait qu'amplifier la charge.
  if (status === 408 || status === 425) {
    return true;
  }

  // Tout autre 4xx est un refus définitif (permission, jeton, validation) :
  // le retenter triple le trafic sans jamais changer la réponse.
  return status >= 500;
};

/**
 * Un seul message par geste.
 *
 * Un refus payant produisait DEUX interruptions : la feuille de vente ouverte par l'écran, et
 * l'alerte générique de ce filet global. Mesuré le 2026-08-01 : 14 écrans / 22 mutations sont
 * concernés — poser `meta.preventToastError` 22 fois serait 22 occasions de l'oublier.
 * Le filet se tait donc dès que l'erreur porte une décision d'abonnement exploitable :
 * dans ce cas c'est l'écran qui parle, et il parle mieux (il peut vendre).
 *
 * ponytail: le plafond assumé — un écran qui recevrait un refus payant SANS héberger la feuille
 * n'afficherait plus rien. Voie de sortie : brancher la feuille sur cet écran (c'est ce qui a été
 * fait pour AddCoach.js), ou poser `meta.errorMessageFallback` pour forcer un message.
 * @param {unknown} error
 * @param {any} mutation
 * @returns {boolean}
 */
export const shouldSkipMutationErrorAlert = (error, mutation) => {
  if (mutation?.options?.meta?.preventToastError) return true;
  return Boolean(extractSubscriptionDecisionFromError(error));
};

/**
 * @param {{
 *   captureQueryError?: (error: unknown) => void,
 *   onMutationError?: (error: unknown, fallbackMessage?: string) => void
 * }} [options]
 * @returns {import('@tanstack/react-query').QueryClient}
 */
export const createFoundClubQueryClient = (options = {}) => {
  const {
    captureQueryError,
    onMutationError,
  } = options;

  return new QueryClient({
    defaultOptions: {
      queries: {
        // Y05 — CES DEUX DEFAUTS RESTENT FERMES, ET C'EST VOLONTAIRE.
        //
        // La detection « l'app est revenue » et « le reseau est revenu » est
        // desormais branchee (`app/queryRefreshOnReturn.js`, `focusManager` et
        // `onlineManager`). Les ouvrir ici ferait repartir, a chaque retour,
        // TOUTES les requetes montees d'un coup : mesure du 2026-08-20, l'app
        // declare 169 requetes sur 67 fichiers, et le serveur de recette a deja
        // ete tue par un plafond memoire trop bas (D16).
        //
        // Ce qui se relit vraiment passe donc par une LISTE BLANCHE de familles
        // (`getReturnRefreshQueryKeys`), heritee du registre du lot U05.
        // ⚠️ `refetchOnReconnect` etait sans effet jusqu'ici — le `onlineManager`
        // par defaut de la v5 ne s'abonne a rien en React Native et restait
        // eternellement « en ligne ». Maintenant qu'il bascule pour de vrai, le
        // laisser a `true` (son defaut) rouvrirait exactement la rafale que ce
        // lot doit eviter.
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
      },
    },
    mutationCache: new MutationCache({
      onError: (error, variables, context, mutation) => {
        if (shouldSkipMutationErrorAlert(error, mutation)) return;
        if (typeof onMutationError === 'function') {
          onMutationError(
            error,
            mutation?.options?.meta?.errorMessageFallback?.toString(),
          );
        }
      },
    }),
    queryCache: new QueryCache({
      onError: (error) => {
        if (typeof captureQueryError === 'function') {
          captureQueryError(error);
        }
      },
    }),
  });
};

export default createFoundClubQueryClient;
