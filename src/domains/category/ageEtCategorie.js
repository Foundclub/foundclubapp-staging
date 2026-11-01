import { getCategorySortKey } from '@/services/category/categoryService';

// CORR-INSCRIPTION (recette du site, 30/10) — l'âge face aux catégories : la catégorie de la
// saison (présélection à l'inscription, p17) et l'équipe de son âge (rangement des équipes, p19).

/**
 * CORR-INSCRIPTION p17 (recette du site, décision A) — la catégorie d'âge de la saison en cours,
 * pour
 * la présélectionner à l'inscription : « U11 » si l'on a moins de 11 ans au 31 décembre de l'année
 * où
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
 * les équipes de son âge d'abord et à griser les autres sous « Autres équipes ». Une U11 accueille
 * les
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

/**
 * REPRISE-INSCRIPTION p17 (01/11) — les catégories qu'un joueur peut jouer cette saison : la sienne
 * et celles au-dessus (surclassement) ; Sénior dès U17 ; un adulte : Sénior et Vétéran, plus U6 à
 * U21. Une catégorie déjà choisie reste toujours proposée, une catégorie inconnue aussi. Sans date
 * de naissance lisible : toutes.
 * @param {{ name?: string }[] | undefined} categories - La liste du serveur.
 * @param {string | null | undefined} dateDeNaissance - « AAAA-MM-JJ » ou « JJ/MM/AAAA ».
 * @param {string} [dejaChoisies] - Les catégories enregistrées, séparées par des virgules.
 * @param {Date} [maintenant]
 * @returns {{ name?: string }[] | undefined} Les catégories à proposer.
 */
export const categoriesDeSonAge = (
  categories,
  dateDeNaissance,
  dejaChoisies = '',
  maintenant = new Date(),
) => {
  const saison = categorieDeLaSaison(dateDeNaissance, maintenant);
  if (!Array.isArray(categories) || !saison) return categories;
  const cible = getCategorySortKey(saison);
  const cle = (/** @type {string} */ nom) => {
    const { group, rank } = getCategorySortKey(nom);
    return `${group}:${rank}`;
  };
  const choisies = new Set(String(dejaChoisies || '').split(',').map((v) => cle(v.trim())));
  return categories.filter((categorie) => {
    const { group, rank } = getCategorySortKey(categorie?.name || '');
    if (group === 3 || choisies.has(cle(categorie?.name || ''))) return true;
    if (cible.group >= 1) return group >= 1;
    if (group === 0) return rank >= cible.rank;
    return group === 1 && cible.rank >= 17;
  });
};

/**
 * REPRISE-INSCRIPTION p17 — les catégories enregistrées, écrites avec les noms du serveur :
 * « Senior » (ancienne liste de l'inscription) devient « Sénior (+18 ans) », sans doublon.
 * @param {string | null | undefined} valeurs - Les catégories, séparées par des virgules.
 * @param {{ name?: string }[] | undefined} categories - La liste du serveur.
 * @returns {string} Les mêmes, séparées par « , ».
 */
export const versLesNomsDuServeur = (valeurs, categories) => {
  const liste = Array.isArray(categories) ? categories : [];
  const noms = String(valeurs || '').split(',').map((v) => v.trim()).filter(Boolean)
    .map((valeur) => {
      const { group, rank } = getCategorySortKey(valeur);
      if (group === 3) return valeur;
      const meme = liste.find((categorie) => {
        const autre = getCategorySortKey(categorie?.name || '');
        return autre.group === group && autre.rank === rank;
      });
      return meme?.name || valeur;
    });
  return [...new Set(noms)].join(', ');
};
