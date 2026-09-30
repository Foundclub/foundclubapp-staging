import i18next from 'i18next';

/**
 * LE TITRE D'UNE ANNONCE JOUEUR — une seule regle, lue par la carte
 * (`RecruitmentAdCard`), Mes activites (`myActivitiesFeed`) et la fiche
 * (`RecruitmentAdDetails`).
 *
 * FINITIONS-AUDIT (audit V1, H2, 2026-09-30) : un sport sans postes (arts martiaux…)
 * publie des annonces SANS poste, que le serveur accepte depuis RECRUTER-TUNNEL. Les
 * trois ecrans les intitulaient « Poste non spécifié ». Elles s'intitulent
 * « <Sport> — <Catégorie> », et « <Sport> » seul sans categorie.
 */

/**
 * Nom lisible d'une valeur qui arrive en texte ou en objet (`{ name }`, `{ label }`).
 * @param {unknown} value
 * @returns {string}
 */
const nameOf = (value) => {
  const objet = /** @type {any} */ (value);
  return String((typeof value === 'string' ? value : objet?.name || objet?.label) || '').trim();
};

/**
 * Le sport d'une annonce, lu comme la carte le lit depuis ANNONCES-SPORT : le sien,
 * sinon l'activite de son equipe quand la reponse la porte — jamais un sport invente.
 * @param {any} ad L'annonce de recrutement.
 * @returns {string} Le sport, ou '' s'il est inconnu.
 */
export const getRecruitmentAdSportName = (ad) => nameOf(ad?.sport)
  || nameOf(ad?.team?.activities?.[0])
  || nameOf(ad?.team?.sport);

/**
 * Le titre d'une annonce joueur : son poste ; sans poste, « <Sport> — <Catégorie> ».
 * @param {any} ad L'annonce de recrutement.
 * @returns {string} Le titre affiche, jamais vide.
 */
export const getRecruitmentAdPlayerTitle = (ad) => {
  const position = String(ad?.position || '').trim();
  if (position) return position;

  const sport = getRecruitmentAdSportName(ad);
  if (!sport) return i18next.t('recruitmentAdCard.positionUnspecified', 'Poste non spécifié');

  const category = nameOf(ad?.category);
  return category ? `${sport} — ${category}` : sport;
};
