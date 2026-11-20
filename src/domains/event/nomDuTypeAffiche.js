import { familleAuxMotsPropres } from '@/domains/activity/familleDuSport';

/**
 * INSCRIPTION-CODE-5 (20/11, décision du chef, point a) — LE NOM AFFICHÉ D'UN TYPE D'ÉVÉNEMENT.
 *
 * Hors sports collectifs et raquette, un type du serveur se DIT avec les mots de la famille
 * (planche V2 4.2, tableau de DECISIONS-E4-LOT4 §5) : un spéléologue qui choisit « Sortie »
 * lit « Sortie » partout, jamais « Match ». Le type reste l'objet du serveur : seuls les mots
 * affichés changent (dispatch, `includes`, grisage, images et couleurs lisent toujours `name`).
 *
 * Une seule règle pour l'étape « Type », le récapitulatif, le détail et les cartes.
 */

/** Les motifs du serveur qui ont un mot par famille (clés `familles.<f>.evenements.<motif>`). */
export const MOTIFS_PAR_FAMILLE = Object.freeze(['detection', 'entrainement', 'match', 'stage', 'tournoi']);

/**
 * Gardent le nom du serveur : « Match amical » (la porte League, sport collectif), et, faute de
 * motif, « Autre » et « Réservation ».
 */
const TYPES_SANS_MOT_DE_FAMILLE = Object.freeze(['match amical']);

const comparable = (/** @type {unknown} */ value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim();

/**
 * Le motif d'un type du serveur, s'il en a un mot par famille.
 * @param {unknown} nomDuType Le nom du type (« Match », « Détection / Séance d'essai »…).
 * @returns {string | null} Le motif (« match »…), ou null.
 */
export const motifDuType = (nomDuType) => {
  const normalise = comparable(nomDuType);
  if (!normalise || TYPES_SANS_MOT_DE_FAMILLE.includes(normalise)) return null;
  return MOTIFS_PAR_FAMILLE.find((motif) => normalise.includes(motif)) || null;
};

/**
 * La famille dont un ÉVÉNEMENT prend les mots : son activité d'abord (équipe, puis tournoi),
 * celle du lecteur en repli seulement. Un spéléologue ne lit pas « Sortie » sur un match de foot.
 * @param {any} evenement L'événement, tel que l'API le sert.
 * @param {unknown} [activiteDuLecteur] `userData.preferredSport` du lecteur.
 * @returns {string | null} La famille aux mots propres, ou null : les mots du serveur.
 */
export const familleDeLEvenement = (evenement, activiteDuLecteur) => {
  const activiteDeLEvenement = (Array.isArray(evenement?.team?.activities)
    && evenement.team.activities.map((/** @type {any} */ a) => a?.name).find(Boolean))
    || evenement?.tournamentActivity?.name
    || '';
  return familleAuxMotsPropres(activiteDeLEvenement || activiteDuLecteur);
};

/**
 * Le titre affiché d'un type d'événement.
 * @param {unknown} nomDuType Le nom du type, tel que le serveur le sert.
 * @param {string | null | undefined} famille Une famille aux mots propres (`familleAuxMotsPropres`).
 * @param {(cle: string) => string} t La traduction.
 * @returns {string} Le mot de la famille, sinon le nom du serveur tel quel (chaîne vide si absent).
 */
export const nomAfficheDuType = (nomDuType, famille, t) => {
  const motif = famille ? motifDuType(nomDuType) : null;
  return motif ? t(`familles.${famille}.evenements.${motif}.titre`) : String(nomDuType || '');
};
