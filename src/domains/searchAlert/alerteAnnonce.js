import { enTableau, libelleUnique } from '@/domains/searchAlert/alerteEvenement';

/**
 * ALERTES-ANNONCES (30/09) — ce qu'une alerte « annonces » garde des filtres de
 * Rechercher › Recrutement, et comment on la nomme. Fonctions PURES : aucune ne
 * parle au serveur. Jumelle de `alerteEvenement.js`, dont elle reprend les règles
 * communes (tableaux, nom unique, signature).
 *
 * Décision d'Adel (30/09) : « je veux que les joueurs soient prévenus [des
 * annonces], même les entraîneurs ». Le public de l'alerte est celui du filtre
 * « Profil » de la recherche : joueurs, coachs, ou les deux.
 *
 * Le serveur lit d'une alerte d'annonces la ville, le public, le sport, la
 * catégorie et le niveau (`admin/.../filter-normalizer.ts`,
 * `sanitizeRecruitmentFilters`) et REFUSE une alerte sans ville. La ville est un
 * TEXTE, comme dans la recherche d'annonces (`recruitmentAdFilters.city`) : il n'y
 * a donc pas de rayon. Le texte tapé, la section et le poste restent sur la
 * recherche : ils ne la filtrent pas côté serveur, une alerte « comme celles-ci »
 * ne doit pas être plus stricte que les résultats affichés.
 */

/**
 * Les filtres qu'une alerte d'annonces peut garder.
 * @param {Record<string, any> | null | undefined} filtres Les filtres du recrutement.
 * @param {string} publicChoisi Le filtre « Profil » : `all`, `player` ou `coach`.
 * @returns {null | {
 *   audienceType?: 'player' | 'coach'; category: string[];
 *   city: { label: string, value: string }; level: string[]; sport: string;
 * }} Les filtres de l'alerte, ou `null` quand il manque la ville.
 */
export const filtresDeLAlerteAnnonce = (filtres, publicChoisi) => {
  const ville = String(filtres?.city || '').trim();
  if (!ville) return null;

  /** @type {any} */
  const alerte = {
    category: enTableau(filtres?.category),
    city: { label: ville, value: ville },
    level: enTableau(filtres?.level),
    sport: String(filtres?.sport || ''),
  };
  if (publicChoisi === 'player' || publicChoisi === 'coach') {
    alerte.audienceType = publicChoisi;
  }
  return alerte;
};

/**
 * La ligne lue sous « Me prévenir » : « Football · Joueur·se·s · Lyon ».
 * @param {ReturnType<typeof filtresDeLAlerteAnnonce>} alerte Les filtres de l'alerte.
 * @param {string} tousLesSports Le mot dit quand aucun sport n'est retenu.
 * @param {string} libellePublic Le public, déjà traduit (vide pour « les deux »).
 * @returns {string} Le résumé, vide sans alerte possible.
 */
export const resumeDeLAlerteAnnonce = (alerte, tousLesSports, libellePublic) => {
  if (!alerte) return '';
  return [alerte.sport || tousLesSports, libellePublic, alerte.city.label]
    .filter(Boolean)
    .join(' · ');
};

/**
 * Le nom rangé dans « Mes alertes » : « Annonces · Football · Lyon », numéroté
 * s'il est déjà pris (même règle que les alertes d'événements).
 * @param {NonNullable<ReturnType<typeof filtresDeLAlerteAnnonce>>} alerte Les filtres de l'alerte.
 * @param {{ label?: string }[] | undefined} alertesExistantes Les alertes du compte.
 * @param {string} motAnnonces Le mot « Annonces », déjà traduit.
 * @returns {string} Le nom.
 */
export const libelleDeLAlerteAnnonce = (alerte, alertesExistantes, motAnnonces) => libelleUnique(
  [motAnnonces, alerte.sport, alerte.city.label].filter(Boolean).join(' · '),
  alertesExistantes,
);
