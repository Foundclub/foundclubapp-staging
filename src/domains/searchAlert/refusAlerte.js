import { isAccessRefusalError } from '@/utils/errors/accessRefusal';
import { isRequestTimeoutAbandon } from '@/utils/errors/apiError';

/**
 * PAR-L10 (12/10, recette parent PAR-013) — POURQUOI une alerte n'a pas été créée.
 *
 * Le client HTTP rejette la charge Strapi DÉBALLÉE — `{ status, name, message,
 * details }` — ou une chaîne nue quand il n'y a pas de réponse
 * (`client.native.js:91-97`, `client.web.js:89-95`). La création lisait
 * `erreur.response.data.error.message`, qui n'existe jamais dans cette forme :
 * chaque refus devenait « Erreur lors de la sauvegarde », y compris le 403 du
 * rôle Parent qui n'avait pas les droits d'alerte.
 *
 * Module SANS dépendance d'écran : les deux chemins de création (la recherche,
 * `useAlerteRecherche`, et l'écran plein `EventFilters`) le lisent, et les bancs
 * qui doublent `@/utils/errors/displayError` ne le touchent pas.
 * ⚠️ `getErrorMessage` ne convient pas ici : hors développement, il remplace le
 * texte du serveur par le message générique (`displayError.js:178-182`).
 */

export const RaisonDuRefus = Object.freeze({
  connexion: 'connexion',
  delai: 'delai',
  droit: 'droit',
  inconnue: 'inconnue',
  limite: 'limite',
  serveur: 'serveur',
});

// « Limite de 10 alertes atteinte. Supprimez une alerte existante. »
// (admin/src/api/search-alert/controllers/search-alert.ts:91).
const LIMITE = /limite de (\d+) alertes/i;
// Ce que rejette axios sans réponse : 'Network Error' (XHR), les deux autres
// selon l'adaptateur.
const SANS_CONNEXION = /^(network error|network request failed|failed to fetch)$/i;

/**
 * @typedef {{ maximum?: number, message: string, raison: string }} Refus
 */

/**
 * Lit la raison d'un refus, quelle que soit la forme de l'erreur.
 * @param {unknown} erreur Ce que la création a rejeté.
 * @returns {Refus} La raison, et le texte du serveur quand il y en a un.
 */
export const lireLeRefus = (erreur) => {
  const brute = /** @type {any} */ (erreur);
  const message = typeof brute === 'string'
    ? brute
    // La forme axios brute reste lue : un service qui contournerait le client
    // la rendrait encore (`response.data.error`).
    : String(brute?.response?.data?.error?.message || brute?.message || '');
  const status = Number(brute?.status ?? brute?.response?.status) || 0;

  if (isAccessRefusalError(brute)) return { message, raison: RaisonDuRefus.droit };
  const limite = status === 400 ? LIMITE.exec(message) : null;
  if (limite) return { maximum: Number(limite[1]), message, raison: RaisonDuRefus.limite };
  if (!status && isRequestTimeoutAbandon(brute)) return { message, raison: RaisonDuRefus.delai };
  if (!status && SANS_CONNEXION.test(message.trim())) {
    return { message, raison: RaisonDuRefus.connexion };
  }
  // Un 400 de ce contrôleur est rédigé en français pour l'utilisateur
  // (« La ville est obligatoire pour une alerte. ») : on le répète tel quel.
  if (status === 400 && message.trim()) return { message, raison: RaisonDuRefus.serveur };
  return { message, raison: RaisonDuRefus.inconnue };
};

/**
 * La phrase lue par l'utilisateur, sous « L'alerte n'a pas été créée. ».
 * @param {Refus} refus La raison (`lireLeRefus`).
 * @param {(...args: any[]) => any} t La traduction (`t` d'i18next, `(cle, repli, options)`).
 * @returns {string} La phrase.
 */
export const phraseDuRefus = (refus, t) => {
  switch (refus.raison) {
    case RaisonDuRefus.connexion:
      return t('searchAlerts.refus.connexion', 'Pas de connexion.');
    case RaisonDuRefus.delai:
      return t(
        'searchAlerts.refus.delai',
        'Le serveur met du temps à répondre : regarde dans Mes alertes avant de réessayer.',
      );
    case RaisonDuRefus.droit:
      return t('searchAlerts.refus.droit', 'Ton compte ne peut pas encore créer d\'alerte.');
    case RaisonDuRefus.limite:
      return t(
        'searchAlerts.refus.limite',
        'Tu as déjà {{maximum}} alertes : supprimes-en une dans Mes alertes.',
        { maximum: refus.maximum },
      );
    case RaisonDuRefus.serveur:
      return refus.message.trim();
    default:
      return t('searchAlerts.refus.inconnue', 'Réessaie dans un instant.');
  }
};
