import { getItem, removeItem, setItem } from '@/platform/storage';

/**
 * 🏛️ COLL-ACCUEIL-BIS (03/10/2026) — PLANCHE 38, LE RETOUR AUTOMATIQUE : le lien d'invitation de
 * la Ville, RETENU sur l'appareil quand un club touche « Inscrire mon club » (page du lien, ou
 * « Rejoindre la Ville » sans club dirigé). Il survit au détour par la connexion ou l'inscription ;
 * la création du club le lit et l'envoie au serveur, qui pose la demande de rattachement et
 * prévient la Ville (club-self-onboard, `collectiviteInvitationToken`), puis l'oublie.
 * ponytail: retenu par APPAREIL, pas par compte, et borné à 48 h — un autre compte qui crée un club
 * sur ce téléphone dans les 48 h emporterait ce lien (l'équipe FoundClub vérifie avant de
 * rattacher) ; voie de sortie : une clé par compte si cela arrive.
 */

/**
 * Le chemin de la page publique du lien, sur le site (route CollectiviteJoin) — l'adresse que la
 * Ville partage (CollectiviteInviteClub). LIENS-APP (07/10) : le téléphone la confie à l'app.
 * @param {string} token - Le code du lien.
 * @returns {string} Le chemin.
 */
export const cheminDuLienDeLaVille = (token) => `/invitation-ville/${token}`;

const CLE = 'coll-invitation-ville';
const CLE_RETOUR = 'coll-invitation-ville-retour';

/**
 * Range un jeton daté sous une clé (sans rangement, rien : jamais d'exception).
 * @param {string} cle - La clé.
 * @param {unknown} token - Le jeton.
 * @param {number} maintenant - L'instant, en millisecondes.
 * @returns {void}
 */
const ranger = (cle, token, maintenant) => {
  const jeton = String(token || '').trim();
  if (!jeton) return;
  try {
    setItem(cle, JSON.stringify({ at: maintenant, token: jeton }));
  } catch {
    // Sans rangement, le club demandera son rattachement depuis le lien, comme avant.
  }
};

/**
 * Le jeton rangé sous une clé, s'il est plus jeune que la durée.
 * @param {string} cle - La clé.
 * @param {number} duree - La durée de validité, en millisecondes.
 * @param {number} maintenant - L'instant, en millisecondes.
 * @returns {string | null} Le jeton, ou null.
 */
const relire = (cle, duree, maintenant) => {
  try {
    const retenu = JSON.parse(getItem(cle) || 'null');
    const jeton = typeof retenu?.token === 'string' ? retenu.token.trim() : '';
    const age = maintenant - Number(retenu?.at);
    const frais = Number.isFinite(age) && age >= 0 && age < duree;
    return jeton && frais ? jeton : null;
  } catch {
    return null;
  }
};

/**
 * Efface une clé.
 * @param {string} cle - La clé.
 * @returns {void}
 */
const effacer = (cle) => {
  try {
    removeItem(cle);
  } catch {
    // Rien à oublier.
  }
};

/** Au-delà, un lien retenu ne vaut plus : un club créé bien plus tard n'a peut-être rien à voir. */
export const DUREE_DU_LIEN_RETENU_MS = 48 * 60 * 60 * 1000;

/**
 * Retient le lien de la Ville.
 * @param {unknown} token - Le jeton du lien (`/invitation-ville/:token`).
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {void}
 */
export const retenirLienDeLaVille = (token, maintenant = Date.now()) => {
  ranger(CLE, token, maintenant);
};

/**
 * Le lien retenu, s'il a moins de 48 h.
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {string | null} Le jeton, ou null.
 */
export const lienDeLaVilleRetenu = (maintenant = Date.now()) => (
  relire(CLE, DUREE_DU_LIEN_RETENU_MS, maintenant)
);

/**
 * Oublie le lien retenu (après la création du club).
 * @returns {void}
 */
export const oublierLienDeLaVille = () => {
  effacer(CLE);
};

/**
 * LIENS-APP (07/10/2026) — LE RETOUR AU LIEN APRÈS LA CONNEXION. Le lien de la Ville ouvert sans
 * compte mène à la connexion, qui remonte toute la navigation : la page du lien disparaît. Ce
 * repère, posé par la page juste avant, la fait rouvrir une fois connecté
 * (navigation/useRetourAuLienDeLaVille.js), puis la page l'efface. À part du lien retenu 48 h :
 * celui-là attend la création d'un club, celui-ci ne sert qu'une fois.
 * ponytail: borné à 1 h — une connexion abandonnée puis reprise le lendemain ne ramène plus au
 * lien ; voie de sortie : allonger la durée si la recette montre des inscriptions plus longues.
 */
export const DUREE_DU_RETOUR_MS = 60 * 60 * 1000;

/**
 * Pose le repère de retour (la page du lien, sans compte, avant la connexion).
 * @param {unknown} token - Le jeton du lien.
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {void}
 */
export const retenirLeRetourAuLien = (token, maintenant = Date.now()) => {
  ranger(CLE_RETOUR, token, maintenant);
};

/**
 * Le jeton du lien où revenir, si le repère a moins d'1 h.
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {string | null} Le jeton, ou null.
 */
export const retourAuLienEnAttente = (maintenant = Date.now()) => (
  relire(CLE_RETOUR, DUREE_DU_RETOUR_MS, maintenant)
);

/**
 * Efface le repère de retour (la page du lien, ouverte avec un compte).
 * @returns {void}
 */
export const oublierLeRetourAuLien = () => {
  effacer(CLE_RETOUR);
};
