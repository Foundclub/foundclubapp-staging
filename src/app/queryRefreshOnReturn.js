import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { AFTER_ACTION_CACHES } from '@/domains/refresh/afterAction';

import { createLogger } from '@/utils/logger/logger';

/**
 * Y05 — « JE DOIS FERMER ET ROUVRIR L'APP POUR VOIR LES DEMANDES ».
 *
 * CE QUI MANQUAIT, MESURE LE 2026-08-20 sur `staging` (6651603) :
 *  · `queryClient.js` pose `refetchOnWindowFocus: false` pour TOUTES les requetes ;
 *  · `grep -rn "focusManager" src` => 0 resultat, `onlineManager` => 0 resultat.
 *
 * react-query detecte « l'ecran est revenu au premier plan » avec un evenement de
 * NAVIGATEUR (`window.addEventListener('focus')`). Dans une app de telephone cet
 * evenement n'existe pas : il faut brancher `AppState` a la main. Personne ne
 * l'avait fait, donc revenir dans FoundClub apres l'avoir quitte ne relisait
 * RIEN. Seul un redemarrage complet vidait le cache — exactement le geste
 * qu'Adel a du faire. Meme chose pour le reseau : le `onlineManager` par defaut
 * de la v5 ne s'abonne a rien en React Native (`query-core/src/onlineManager.ts`,
 * « addEventListener does not exist in React Native »), il reste donc
 * eternellement « en ligne » et aucun retour de connexion ne relit quoi que ce
 * soit.
 *
 * ⛔ CE MODULE NE RALLUME PAS TOUT. Rebrancher `refetchOnWindowFocus: true` en
 * defaut global ferait repartir, a chaque retour, TOUTES les requetes montees —
 * et le serveur de recette a deja ete tue par un plafond memoire trop bas (D16).
 * Le defaut reste ferme ; seules les familles nommees ci-dessous se relisent.
 *
 * ⛔ ET IL N'INVENTE AUCUN REGISTRE. Les racines viennent de
 * `AFTER_ACTION_CACHES` (lots T08 / U05) : deux listes de racines finissent
 * toujours par diverger, et une racine perimee n'echoue jamais, elle ne fait
 * simplement RIEN.
 */

const refreshLogger = createLogger('query-refresh-on-return');

/**
 * LES ACTIONS DONT ON HERITE LES RACINES — et pourquoi CELLES-LA.
 *
 * Revenir au premier plan, ce n'est pas « j'ai agi », c'est « quelqu'un
 * d'autre a peut-etre agi pendant mon absence ». Les trois seules choses qui
 * bougent sans moi sont exactement ces trois entrees du registre :
 *  · `membershipChanged`  — on m'a accepte (mes equipes, mon profil changent) ;
 *  · `acceptRequest`      — une demande est arrivee ou a ete traitee ;
 *  · `answerEvent`        — quelqu'un a repondu present a un evenement.
 *
 * ⛔ `createClub`, `createEvent`, `joinClub`, `joinTeam`, `leaveTeam`,
 * `publishComposition`, `subscribe` n'y sont PAS : ce sont MES gestes, et ils
 * sont deja rafraichis a la seconde ou je les fais (lot T08). Les rejouer au
 * retour serait payer deux fois.
 * @type {string[]}
 */
export const RETURN_REFRESH_ACTIONS = ['acceptRequest', 'answerEvent', 'membershipChanged'];

/**
 * Les racines a relire au retour : l'union, sans doublon, des actions ci-dessus.
 *
 * ⚠️ Une racine ne cite jamais d'identifiant : la correspondance de react-query
 * est prefixee, `['team']` couvre `['team', 'abc']` sans avoir a le nommer.
 * @returns {string[][]} Les racines, chacune une seule fois.
 */
export const getReturnRefreshQueryKeys = () => {
  /** @type {Map<string, string[]>} */
  const uniqueRoots = new Map();

  RETURN_REFRESH_ACTIONS.forEach((action) => {
    const queryKeys = AFTER_ACTION_CACHES[action];
    if (!Array.isArray(queryKeys)) {
      // Une action renommee dans le registre doit se voir, pas se taire.
      refreshLogger.warn(`[RETURN] action absente du registre, ignoree : ${action}`);
      return;
    }
    queryKeys.forEach((queryKey) => uniqueRoots.set(queryKey.join('|'), queryKey));
  });

  return [...uniqueRoots.values()];
};

/**
 * ⏱️ LE VERROU ANTI-RAFALE. Deux retours separes de moins de ce delai ne
 * declenchent qu'une seule relecture.
 *
 * 15 s est choisi contre les caches du SERVEUR, pas au hasard : la charge
 * `/app/bootstrap` y est fraiche 30 s et les demandes 60 s
 * (`admin/src/api/firebase-auth/services/firebase-auth-runtime-cache.js`).
 * Relire plus souvent ne peut rien apprendre de neuf. Et c'est assez long pour
 * qu'un aller-retour d'une seconde (notification deroulee, appareil photo) ne
 * relance pas tout une deuxieme fois.
 */
export const RETURN_REFRESH_COOLDOWN_MS = 15 * 1000;

let lastReturnRefreshAt = 0;

/** Remet le verrou anti-rafale a zero. Reserve aux tests. */
export const resetReturnRefreshCooldown = () => {
  lastReturnRefreshAt = 0;
};

/**
 * Ce changement d'etat est-il un VRAI retour au premier plan ?
 *
 * ⚠️ LES DEUX PLATEFORMES NE PARLENT PAS LA MEME LANGUE :
 *  · Android passe par `background`, puis revient en `active` ;
 *  · iOS ajoute `inactive`, et il le rend AUSSI quand on deroule le centre de
 *    controle, quand un appel arrive, ou pendant la bascule multitache —
 *    l'app n'a alors jamais ete quittee. `inactive -> active` n'est donc PAS un
 *    retour, et le compter ferait repartir des requetes pour un doigt qui frole
 *    le haut de l'ecran ;
 *  · `unknown` et `extension` (React Native, cas rares) comptent comme
 *    `background` : on ne sait pas ce qui s'est passe, donc on relit.
 * @param {string | null | undefined} previousState L'etat precedent d'AppState.
 * @param {string | null | undefined} nextState Le nouvel etat.
 * @returns {boolean} Vrai si l'app revient d'une absence.
 */
export const isReturnToForeground = (previousState, nextState) => {
  if (String(nextState || '').trim() !== 'active') return false;
  const previous = String(previousState || '').trim();
  return previous === 'background' || previous === 'unknown' || previous === 'extension';
};

/**
 * Relit les familles nommees, et RIEN d'autre.
 *
 * ⚠️ `invalidateQueries` ne declenche un appel reseau que pour les requetes
 * ACTIVES — celles qu'un ecran monte est en train de lire. Les autres sont
 * seulement marquees perimees et se reliront quand on les affichera. Le nombre
 * d'appels au retour est donc borne par l'ecran ouvert, jamais par la taille du
 * cache.
 * @param {import('@tanstack/react-query').QueryClient} queryClient Le cache de l'app.
 * @param {string} [reason] D'ou vient le declenchement, pour le journal.
 * @param {number} [now] L'horloge, injectable pour les tests.
 * @returns {boolean} Vrai si la relecture a eu lieu, faux si le verrou l'a bloquee.
 */
export const refreshOnReturn = (queryClient, reason = 'foreground', now = Date.now()) => {
  if (!queryClient) return false;

  if (lastReturnRefreshAt && now - lastReturnRefreshAt < RETURN_REFRESH_COOLDOWN_MS) {
    refreshLogger.debug(`[RETURN] relecture ignoree (verrou anti-rafale) : ${reason}`);
    return false;
  }

  lastReturnRefreshAt = now;

  getReturnRefreshQueryKeys().forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey });
  });

  refreshLogger.debug(`[RETURN] familles relues : ${reason}`);
  return true;
};

/**
 * L'erreur ressemble-t-elle a une coupure reseau ?
 *
 * ⚠️ On ne le decide QU'ICI, apres les reprises : `shouldRetryQuery`
 * (`queryClient.js`) a deja retente deux fois une erreur sans status. Une erreur
 * qui arrive jusqu'a ce filet a donc echoue trois fois en ~3 s — c'est une
 * coupure, pas un delai isole.
 *
 * ponytail: le plafond assume — sans bibliotheque de connectivite, « hors ligne »
 * reste une DEDUCTION. Un serveur injoignable pendant que le wifi marche est
 * compte comme hors ligne. La consequence est bornee (les requetes patientent au
 * lieu d'echouer, et la sonde ci-dessous les relance toute seule). Voie de
 * sortie : installer `@react-native-community/netinfo`, geste a GO d'Adel (R4).
 * @param {any} error L'erreur remontee par le cache de requetes.
 * @returns {boolean} Vrai si aucune reponse HTTP n'a ete recue.
 */
export const isNetworkOutageError = (error) => {
  if (!error) return false;
  const rawStatus = error?.status ?? error?.response?.status ?? error?.error?.status;
  const parsedStatus = Number(rawStatus);
  return !(Number.isFinite(parsedStatus) && parsedStatus > 0);
};

/** Le premier pas de la sonde de retour reseau. */
export const NETWORK_PROBE_MIN_DELAY_MS = 5 * 1000;
/** Le pas maximum : la sonde double a chaque echec, sans depasser cette valeur. */
export const NETWORK_PROBE_MAX_DELAY_MS = 60 * 1000;

/**
 * Branche les deux detections manquantes sur le cycle de vie du telephone.
 *
 * ⚠️ Brancher `focusManager` seul n'envoie AUCUNE requete de plus : le defaut
 * `refetchOnWindowFocus` reste `false`. Il sert a dire la verite a react-query
 * (« l'app dort »), ce qui evite qu'une requete reparte pendant que l'ecran est
 * eteint. Tout ce qui se relit vraiment passe par `refreshOnReturn`, donc par la
 * liste blanche.
 *
 * 🛰️ LA SONDE DE RESEAU N'APPELLE AUCUN POINT DE SANTE : quand on se croit hors
 * ligne, on se redeclare en ligne apres un delai croissant, ce qui relance les
 * requetes que react-query avait mises en attente. Si le reseau est toujours
 * coupe, elles echouent et le delai double. Aucune dependance ajoutee.
 * @param {import('@tanstack/react-query').QueryClient} queryClient Le cache de l'app.
 * @param {{ appState?: any, focus?: any, online?: any }} [deps] Injections de test.
 * @returns {() => void} La fonction qui debranche tout.
 */
export const startQueryRefreshBridge = (queryClient, deps = {}) => {
  const appState = deps.appState || AppState;
  const focus = deps.focus || focusManager;
  const online = deps.online || onlineManager;

  let currentAppState = appState?.currentState || 'active';
  /** @type {any} */
  let probeTimer = null;
  let probeDelayMs = NETWORK_PROBE_MIN_DELAY_MS;

  focus.setFocused(currentAppState === 'active');

  const clearProbe = () => {
    if (probeTimer) {
      clearTimeout(probeTimer);
      probeTimer = null;
    }
  };

  const scheduleProbe = () => {
    clearProbe();
    probeTimer = setTimeout(() => {
      probeTimer = null;
      probeDelayMs = Math.min(probeDelayMs * 2, NETWORK_PROBE_MAX_DELAY_MS);
      online.setOnline(true);
    }, probeDelayMs);
  };

  const unsubscribeOnline = online.subscribe((/** @type {boolean} */ isOnline) => {
    if (!isOnline) {
      scheduleProbe();
      return;
    }
    clearProbe();
    // Le reseau revient : les memes familles, la meme liste blanche, le meme verrou.
    refreshOnReturn(queryClient, 'reconnect');
  });

  const appStateSubscription = appState.addEventListener(
    'change',
    (/** @type {string} */ nextState) => {
      const previousState = currentAppState;
      currentAppState = nextState;

      focus.setFocused(nextState === 'active');

      if (!isReturnToForeground(previousState, nextState)) return;

      // Revenir dans l'app est aussi la meilleure occasion de sortir d'un « hors
      // ligne » deduit a tort : on se redeclare joignable avant de relire.
      probeDelayMs = NETWORK_PROBE_MIN_DELAY_MS;
      if (!online.isOnline()) {
        online.setOnline(true);
        return;
      }

      refreshOnReturn(queryClient, 'foreground');
    },
  );

  const queryCache = queryClient.getQueryCache();
  const unsubscribeQueryErrors = queryCache.subscribe((/** @type {any} */ event) => {
    if (event?.type !== 'updated' || event?.action?.type !== 'error') return;
    if (!isNetworkOutageError(event.action.error)) return;
    if (!online.isOnline()) return;
    online.setOnline(false);
  });

  return () => {
    clearProbe();
    appStateSubscription?.remove?.();
    unsubscribeOnline?.();
    unsubscribeQueryErrors?.();
  };
};

export default startQueryRefreshBridge;
