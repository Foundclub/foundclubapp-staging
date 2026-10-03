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

const CLE = 'coll-invitation-ville';

/** Au-delà, un lien retenu ne vaut plus : un club créé bien plus tard n'a peut-être rien à voir. */
export const DUREE_DU_LIEN_RETENU_MS = 48 * 60 * 60 * 1000;

/**
 * Retient le lien de la Ville.
 * @param {unknown} token - Le jeton du lien (`/invitation-ville/:token`).
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {void}
 */
export const retenirLienDeLaVille = (token, maintenant = Date.now()) => {
  const jeton = String(token || '').trim();
  if (!jeton) return;
  try {
    setItem(CLE, JSON.stringify({ at: maintenant, token: jeton }));
  } catch {
    // Sans rangement, le club demandera son rattachement depuis le lien, comme avant.
  }
};

/**
 * Le lien retenu, s'il a moins de 48 h.
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {string | null} Le jeton, ou null.
 */
export const lienDeLaVilleRetenu = (maintenant = Date.now()) => {
  try {
    const retenu = JSON.parse(getItem(CLE) || 'null');
    const jeton = typeof retenu?.token === 'string' ? retenu.token.trim() : '';
    const age = maintenant - Number(retenu?.at);
    const frais = Number.isFinite(age) && age >= 0 && age < DUREE_DU_LIEN_RETENU_MS;
    return jeton && frais ? jeton : null;
  } catch {
    return null;
  }
};

/**
 * Oublie le lien retenu (après la création du club).
 * @returns {void}
 */
export const oublierLienDeLaVille = () => {
  try {
    removeItem(CLE);
  } catch {
    // Rien à oublier.
  }
};
