import { getItem, removeItem, setItem } from '@/platform/storage';

/**
 * T-PARCOURS-2 (17/11/2026, point 2, R12) — LE TOURNOI OÙ REVENIR APRÈS LA CONNEXION, au téléphone.
 * Le visiteur appuie sur « Se connecter pour s'inscrire » (barre du bas de la fiche du tournoi) :
 * la connexion remonte toute la navigation et il arrivait sur l'Accueil, sans retour (capture
 * app-P1-10). La fiche pose ce repère juste avant ; le crochet des liens en attente
 * (navigation/useLiensEnAttente.js) rouvre la fiche une fois le compte prêt, accueil d'un compte
 * neuf compris. Même modèle que le retour au lien de la Ville
 * (domains/collectivite/lienDeLaVille.js).
 * Seul l'identifiant du tournoi est rangé — jamais une personne.
 * ponytail: retenu par APPAREIL et borné à 1 h — une connexion abandonnée puis reprise plus tard ne
 * ramène plus au tournoi ; voie de sortie : allonger la durée si la recette le demande.
 * Témoin : src/navigation/__tests__/TPARCOURS2.retourAuTournoi.test.js.
 */

const CLE = 'retour-au-tournoi';

export const DUREE_DU_RETOUR_AU_TOURNOI_MS = 60 * 60 * 1000;

/**
 * Pose le repère (la fiche du tournoi, sans compte, avant la connexion).
 * @param {unknown} eventId - L'identifiant du tournoi (celui de la route EventDetails).
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {void}
 */
export const retenirLeRetourAuTournoi = (eventId, maintenant = Date.now()) => {
  const id = String(eventId || '').trim();
  if (!id) return;
  try {
    setItem(CLE, JSON.stringify({ at: maintenant, eventId: id }));
  } catch {
    // Sans rangement, le joueur rouvre le lien du tournoi, comme avant.
  }
};

/**
 * Prend le repère : il est rendu s'il a moins d'1 h, et effacé dans tous les cas (il ne sert
 * qu'une fois).
 * @param {number} [maintenant] - L'instant, en millisecondes.
 * @returns {string | null} L'identifiant du tournoi, ou null.
 */
export const prendreLeRetourAuTournoi = (maintenant = Date.now()) => {
  try {
    const retenu = JSON.parse(getItem(CLE) || 'null');
    if (!retenu) return null;
    removeItem(CLE);
    const id = typeof retenu?.eventId === 'string' ? retenu.eventId.trim() : '';
    const age = maintenant - Number(retenu?.at);
    const frais = Number.isFinite(age) && age >= 0 && age < DUREE_DU_RETOUR_AU_TOURNOI_MS;
    return id && frais ? id : null;
  } catch {
    return null;
  }
};
