import { getCategorySortKey } from '@/services/category/categoryService';

// CORR-INSCRIPTION (recette du site, 30/10) — l'âge face aux catégories : la catégorie de la
// saison (présélection à l'inscription, p17) et l'équipe de son âge (rangement des équipes, p19).

/**
 * CORR-INSCRIPTION p17 (recette du site, décision A) — la catégorie d'âge de la saison en cours, pour
 * la présélectionner à l'inscription : « U11 » si l'on a moins de 11 ans au 31 décembre de l'année où
 * la saison finit (une saison va de juillet à juin), « Senior » à partir de 20.
 * @param {string | null | undefined} dateDeNaissance - « AAAA-MM-JJ » ou « JJ/MM/AAAA ».
 * @param {Date} [maintenant]
 * @returns {string | null} « U11 », « Senior », ou `null` sans date lisible.
 */
export const categorieDeLaSaison = (dateDeNaissance, maintenant = new Date()) => {
  const texte = String(dateDeNaissance || '');
  const annee = Number((/^(\d{4})-/.exec(texte) || /\/(\d{4})$/.exec(texte) || [])[1]);
  if (!annee) return null;
  const finDeSaison = maintenant.getFullYear() + (maintenant.getMonth() >= 6 ? 1 : 0);
  const ecart = finDeSaison - annee;
  if (ecart < 1) return null;
  return ecart >= 20 ? 'Senior' : `U${ecart}`;
};

/**
 * CORR-INSCRIPTION p19 (recette du site, décision A) — l'équipe est-elle de l'âge de ce joueur ?
 * Rien n'est interdit (un club qui surclasse doit recevoir la demande) : la réponse sert à ranger
 * les équipes de son âge d'abord et à griser les autres sous « Autres équipes ». Une U11 accueille les
 * 9-10 ans de la saison, une Sénior les 18 ans et plus. Âge ou catégorie inconnus : de son âge.
 * @param {string | null | undefined} nomDeCategorie - « U11 (11 ans) », « Sénior (+18 ans) »…
 * @param {number | null | undefined} age - L'âge du joueur, en années.
 * @returns {boolean}
 */
export const equipeDeSonAge = (nomDeCategorie, age) => {
  if (!Number.isFinite(age) || !nomDeCategorie) return true;
  const cle = getCategorySortKey(nomDeCategorie);
  const ans = /** @type {number} */ (age);
  if (cle.group === 0) return ans >= cle.rank - 2 && ans <= cle.rank - 1;
  if (cle.group === 1) return ans >= 18;
  if (cle.group === 2) return ans >= 35;
  return true;
};
