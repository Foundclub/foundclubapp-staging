/**
 * CE QU'ON PEUT DÉDUIRE D'UN TEST — sans rien inventer, et sans rien demander au serveur.
 *
 * 🔎 POURQUOI CES CALCULS VIVENT ICI. L'écran d'un test doit répondre à des questions
 * que le serveur ne répond pas : quelles mesures se répètent d'un essai à l'autre,
 * lesquelles ne se notent qu'une fois, lesquelles se calculent, et à quoi ce test SERT
 * — c'est-à-dire quels autres tests s'appuient dessus. Tout se déduit des données
 * existantes. Les mettre à part les rend testables sans monter un écran, et c'est là
 * qu'une erreur se paie : ranger une mesure du mauvais côté la ferait disparaître de
 * la saisie sans qu'aucune porte ne le voie.
 */

/** Le moment où une mesure se prend : sur le terrain, ou plus tard au bureau. */
export const TERRAIN = 'terrain';

/**
 * LES TROIS FAMILLES DE MESURES D'UN TEST.
 *
 * 🪤 CE N'EST PAS LE MOMENT QUI DÉCIDE DE LA FAMILLE, C'EST LA RÉPÉTITION. On a d'abord
 * séparé sur `moment`, et le test T0 s'est retrouvé avec ZÉRO carte d'essai : ses trois
 * chutes se lisent sur un logiciel, donc en différé, donc elles sortaient de la boucle
 * d'essais — alors que ce sont exactement elles qu'on répète trois fois. Une mesure qui
 * se répète appartient à la carte d'essai, qu'on la remplisse sur le terrain ou le soir.
 * Le `moment` sert alors à la MARQUER « à saisir plus tard », pas à la déplacer.
 * @param {Record<string, any>} test le test du programme
 * @returns {{calculees: Record<string, any>[], parEssai: Record<string, any>[],
 *   uneFois: Record<string, any>[]}} les trois familles, dans l'ordre de l'écran
 */
export const mesuresParFamille = (test) => {
  /** @type {Record<string, any>[]} */
  const toutes = Array.isArray(test?.measures) ? test.measures : [];
  const seRepete = (/** @type {Record<string, any>} */ m) => Number(m?.attempts) > 1;

  return {
    // Ce que l'app ne peut pas calculer : la formule est écrite en français, pas en
    // code. La valeur se lit sur un logiciel puis se recopie — d'où un champ, et
    // non un simple affichage comme avant.
    calculees: toutes.filter((m) => m?.computed),
    parEssai: toutes.filter((m) => !m?.computed && seRepete(m)),
    // « À noter une fois » : ce qui ne change pas d'un essai à l'autre — la hauteur
    // de la box, la température de la salle. Le répéter sur chaque carte d'essai
    // remplirait l'écran de cases qu'on ne touche qu'une fois.
    uneFois: toutes.filter((m) => !m?.computed && !seRepete(m)),
  };
};

/**
 * Vrai quand une mesure ne se remplit pas sur le terrain.
 * @param {Record<string, any>} measure la mesure
 * @returns {boolean} vrai si elle se saisit plus tard, au bureau
 */
export const aSaisirPlusTard = (measure) => Boolean(measure) && measure.moment !== TERRAIN;

/**
 * CE QUE CE TEST ALIMENTE — les mesures d'AUTRES tests qui s'appuient sur les siennes.
 *
 * 🔎 CE N'EST PAS UNE DONNÉE, C'EST UNE DÉDUCTION. Aucun champ du serveur ne dit
 * « T0 alimente T1 ». Mais les formules des mesures calculées citent les clefs qu'elles
 * consomment : « moyenne de temps_10m sur les 3 essais valides ». Chercher les clefs de
 * ce test dans les formules des autres donne la réponse, et elle reste juste le jour où
 * le programme change — ce qu'une liste écrite à la main ne ferait pas.
 * @param {Record<string, any>} test le test dont on cherche les usages
 * @param {Record<string, any>[]} tousLesTests tous les tests du programme
 * @returns {{measure: string, test: string}[]} les mesures alimentées, sans doublon
 */
export const ceQueCeTestAlimente = (test, tousLesTests) => {
  /** @type {string[]} */
  const clefs = (Array.isArray(test?.measures) ? test.measures : [])
    .map((m) => m?.key).filter(Boolean);
  if (!clefs.length) return [];

  /** @type {Record<string, any>[]} */
  const autres = Array.isArray(tousLesTests) ? tousLesTests : [];
  /** @type {{measure: string, test: string}[]} */
  const sortie = [];
  const vus = new Set();

  autres.forEach((autre) => {
    if (!autre || autre.code === test?.code) return;
    (Array.isArray(autre.measures) ? autre.measures : []).forEach((mesure) => {
      const formule = String(mesure?.formula || '');
      if (!formule) return;
      // Le mot ENTIER, pas la sous-chaîne : sans les bornes, la clef `temps`
      // s'attraperait dans « temps_10m », « temps_20m » et « contretemps ».
      const cite = clefs.some((clef) => new RegExp(`(^|[^A-Za-z0-9_])${clef}([^A-Za-z0-9_]|$)`)
        .test(formule));
      if (!cite) return;
      const identite = `${autre.code}|${mesure.key}`;
      if (vus.has(identite)) return;
      vus.add(identite);
      sortie.push({ measure: mesure.label || mesure.key, test: autre.code });
    });
  });
  return sortie;
};

export default mesuresParFamille;
