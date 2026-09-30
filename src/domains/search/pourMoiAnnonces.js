// LISTE-ANNONCES (audit V1, A08) — « POUR MOI » : ce que le profil demande au serveur.
//
// Avant, « Compatibles avec mon profil » comparait DANS LE TÉLÉPHONE les 10 annonces
// chargées au profil (sport, section, catégorie tous identiques), et concluait souvent
// « aucune » alors que le serveur en connaissait d'autres. Désormais la recherche du
// serveur fait le tri : elle sait déjà filtrer par sport, catégorie et section
// (`admin/src/api/search/services/search.ts`, `searchRecruitment`).
//
// Les critères sont ceux que l'ancien tri tenait pour DURS : sport, catégorie, section.
// Le niveau et la ville n'y étaient qu'un bonus de classement — et la ville ne marchait
// jamais : le profil ne garde qu'une adresse en texte libre, jamais comparable à la
// ville d'une annonce.

/**
 * @typedef {{ documentId: string, name: string }} Categorie
 * @typedef {{ categories: Categorie[], section: string, sport: string }} CriteresPourMoi
 */

const normaliser = (/** @type {unknown} */ valeur) => String(valeur ?? '').trim().toLowerCase();

/**
 * Les critères « Pour moi » d'un compte. Sans sport au profil, il n'y en a pas :
 * « Pour moi » ne peut rien trier, et l'écran le dit au lieu de vider la liste.
 * @param {any} userData Le compte (`preferredSport` et `category` sont des TEXTES ;
 *   `category` peut en porter plusieurs, séparées par des virgules — `UserCategory.js`).
 * @param {any[] | undefined} categories Les catégories connues, pour passer des noms
 *   aux identifiants que la recherche attend.
 * @returns {CriteresPourMoi | null} Les critères, ou `null` sans sport.
 */
export const criteresPourMoi = (userData, categories) => {
  const sport = String(userData?.preferredSport ?? '').trim();
  if (!sport) return null;

  const nomsDuProfil = String(userData?.category ?? '')
    .split(',')
    .map(normaliser)
    .filter(Boolean);
  const connues = (Array.isArray(categories) ? categories : [])
    .filter((categorie) => (
      categorie?.documentId && nomsDuProfil.includes(normaliser(categorie?.name))
    ))
    .map((categorie) => ({
      documentId: String(categorie.documentId),
      name: String(categorie.name),
    }));

  return {
    categories: connues,
    section: String(userData?.section?.name ?? '').trim(),
    sport,
  };
};

/**
 * La requête « Pour moi » : les filtres DÉJÀ posés par l'utilisateur, complétés par son
 * profil là où il n'a rien choisi. Un filtre explicite gagne toujours sur le profil.
 * Cette requête est donc toujours PLUS étroite que celle des filtres seuls : ses
 * annonces sont un sous-ensemble de la liste complète, et « Autres annonces » en est
 * exactement le reste.
 * @param {Record<string, any> | undefined} filtres Les filtres appliqués.
 * @param {CriteresPourMoi} criteres Les critères du profil.
 * @returns {{ libelles: string[], params: Record<string, any> }} Les paramètres de la
 *   recherche, et les critères du PROFIL qui y sont réellement entrés (ce qu'on écrit).
 */
export const requetePourMoi = (filtres, criteres) => {
  const params = { ...(filtres || {}) };
  /** @type {string[]} */
  const libelles = [];

  if (!params.sport) {
    params.sport = criteres.sport;
    libelles.push(criteres.sport);
  }
  const categorieChoisie = Array.isArray(params.category)
    ? params.category.length > 0
    : Boolean(params.category);
  if (!categorieChoisie && criteres.categories.length > 0) {
    params.category = criteres.categories.map((categorie) => categorie.documentId);
    libelles.push(...criteres.categories.map((categorie) => categorie.name));
  }
  if (!params.section && criteres.section) {
    params.section = criteres.section;
    libelles.push(criteres.section);
  }

  return { libelles, params };
};

/**
 * Le total annoncé par le serveur (`meta.pagination.total`), ou le repli quand la
 * réponse n'en porte pas.
 * @param {any} meta Le `meta` de la réponse.
 * @param {number} repli Ce qu'on garde sans total du serveur.
 * @returns {number} Le total.
 */
export const totalDuServeur = (meta, repli) => {
  const total = Number(meta?.pagination?.total);
  return Number.isFinite(total) && total >= 0 ? total : repli;
};
