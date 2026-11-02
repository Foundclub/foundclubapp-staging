// FIN-CLOCHE (02/11/2026, point 64) — une seule façon d'écrire un nombre sur une pastille : la
// cloche, le panneau, les onglets, le menu du site, les lignes de la messagerie.

// AE06 — la pastille ne dira jamais plus que ca.
export const UNREAD_BADGE_CAP = 99;

/**
 * Le nombre à peindre sur une pastille.
 * @param {unknown} count - Un compte brut.
 * @returns {string} Le libellé, ou '' quand il n'y a rien à dire.
 */
export const formatUnreadBadge = (count) => {
  const parsed = Number(count);
  if (!Number.isFinite(parsed) || parsed <= 0) return '';
  return parsed > UNREAD_BADGE_CAP ? `${UNREAD_BADGE_CAP}+` : String(Math.floor(parsed));
};
