/**
 * BUGHUNT C03 / P3-08 — UNE PROMESSE GARDEE EN CACHE, SAUF SI ELLE A ECHOUE.
 *
 * Les notifications du site gardaient en cache le premier essai, echec compris :
 * un service worker refuse une fois (reseau, onglet en arriere-plan) ou un
 * module qui ne se charge pas desactivaient les notifications jusqu'au
 * rechargement de la page. Un echec vide le cache : l'appel suivant reessaie.
 * @template T
 * @param {() => Promise<T>} factory - Le travail a ne faire qu'une fois.
 * @param {(value: T) => boolean} [isTemporaryFailure] - Un resultat a ne pas garder.
 * @returns {() => Promise<T>} Le meme travail, partage tant qu'il n'a pas echoue.
 */
export const memoizeUntilFailure = (factory, isTemporaryFailure = () => false) => {
  /** @type {Promise<T> | null} */
  let pending = null;
  return () => {
    if (!pending) {
      pending = (async () => factory())().then((value) => {
        if (isTemporaryFailure(value)) pending = null;
        return value;
      }, (error) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
};

export default memoizeUntilFailure;
