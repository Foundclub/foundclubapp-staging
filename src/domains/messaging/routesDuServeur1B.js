/**
 * MSG1BA — RETROCOMPATIBILITE : UNE ROUTE DU LOT SERVEUR MESSAGERIE-1B QUI N'EXISTE PAS ENCORE.
 *
 * L'app 2.6.71 peut parler a un serveur d'avant 1B (la prod du 07/10). Ses routes neuves
 * (`POST /chats/:id/unread`, `POST|DELETE /chats/:id/group-photo`) y repondent 404 : le geste
 * est alors CACHE, jamais affiche en erreur rouge (regle du lot).
 * Meme lecture du statut que `licenseService.getUserCurrentLicense`.
 * @param {any} erreur - L'erreur d'un appel HTTP.
 * @returns {boolean} Vrai si la route n'existe pas sur ce serveur.
 */
export const estUneRouteAbsente = (erreur) => {
  const statut = Number(
    erreur?.status ?? erreur?.response?.status ?? erreur?.response?.data?.error?.status,
  );
  return statut === 404 || statut === 405;
};

/** Le serveur a deja dit 404 a « marquer non lu » : on ne le reproposera pas de la session. */
let nonLuAbsent = false;

/**
 * « Marquer comme non lu » a-t-il deja rencontre un serveur d'avant 1B ?
 * @returns {boolean} Vrai si la route a repondu 404 pendant cette session.
 */
export const routeNonLuAbsente = () => nonLuAbsent;

/**
 * Retient que « marquer non lu » n'existe pas sur ce serveur (jusqu'au prochain lancement).
 * @returns {void}
 */
export const noterRouteNonLuAbsente = () => {
  nonLuAbsent = true;
};
