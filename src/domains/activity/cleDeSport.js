// SPORTS-DOUBLONS (01/10/2026) — UN SPORT = UNE CLÉ.
//
// La base garde 4 sports en double (« Volley » / « Volleyball », « Echecs » / « Échecs »,
// « Equitation » / « Équitation », « Canoë-Kayak » / « Canoë-kayak ») : le choix du sport de la
// recherche les montrait deux fois. La règle qui dit « ces deux noms sont le même sport » est celle
// du serveur (`admin/src/api/search/services/sport-key.ts`), recopiée ici À L'IDENTIQUE : le témoin
// admin `tests/authz/SPORTS-DOUBLONS-2-parite-app.test.js` lit CE fichier et compare les deux, nom
// par nom, et vérifie que la ligne montrée est celle que le serveur déclare officielle.
//
// ⛔ Aucun import et rien que du JavaScript : ce témoin l'évalue tel quel, hors de React Native.

/** Un nom court (déjà réduit en clé) → la clé du sport qu'il désigne. */
export const ALIAS_DE_CLE = Object.freeze({
  volley: 'volleyball',
});

/**
 * Un nom de sport réduit à ses lettres et chiffres, sans accent ni casse : « Volley-ball »,
 * « volleyball » et « VOLLEYBALL » se valent, « équit » trouve « Équitation ».
 * @param {unknown} nom Le nom.
 * @returns {string} Le nom réduit.
 */
export const compacterNomDeSport = (nom) => String(nom ?? '')
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

/**
 * La clé d'un sport : le nom réduit, puis ses alias. « Volley » et « Volleyball » ont la même.
 * @param {unknown} nom Le nom.
 * @returns {string} La clé.
 */
export const cleDeSport = (nom) => {
  const compacte = compacterNomDeSport(nom);
  return ALIAS_DE_CLE[/** @type {keyof typeof ALIAS_DE_CLE} */ (compacte)] || compacte;
};

/**
 * Le rang d'une écriture dans son groupe, la mieux écrite d'abord : la forme complète (pas un
 * alias : « Volleyball » avant « Volley »), puis la plus accentuée (« Échecs » avant « Echecs »),
 * puis celle qui a le moins de majuscules (« Canoë-kayak » avant « Canoë-Kayak »). C'est ainsi que
 * le serveur a choisi ses noms officiels ; le témoin de parité le vérifie sur les doublons réels.
 * @param {unknown} nom L'écriture.
 * @param {string} cle La clé de son groupe.
 * @returns {number[]} Le rang, à comparer terme à terme.
 */
const rangDEcriture = (nom, cle) => [
  compacterNomDeSport(nom) === cle ? 0 : 1,
  -(String(nom ?? '').normalize('NFD').match(/\p{Diacritic}/gu) || []).length,
  (String(nom ?? '').match(/\p{Lu}/gu) || []).length,
];

/**
 * Compare deux rangs terme à terme.
 * @param {number[]} a Un rang.
 * @param {number[]} b Un autre.
 * @returns {number} Négatif si `a` passe avant `b`.
 */
const comparerLesRangs = (a, b) => a.reduce((ecart, valeur, i) => ecart || valeur - b[i], 0);

/**
 * Les sports regroupés par clé, un groupe par sport, dans l'ordre de la liste reçue. Le
 * représentant est l'écriture la mieux écrite (à rang égal, la première de la liste) : c'est son
 * nom qu'on affiche et qu'on envoie.
 * @param {any[] | undefined} sports Les lignes du référentiel (`documentId`, `name`).
 * @returns {{ cle: string, membres: any[], nom: string, representant: any }[]} Les groupes.
 */
export const regrouperLesSports = (sports) => {
  /** @type {Map<string, any[]>} */
  const groupes = new Map();
  (Array.isArray(sports) ? sports : []).forEach((sport) => {
    const cle = cleDeSport(sport?.name);
    if (!cle) return;
    groupes.set(cle, [...(groupes.get(cle) || []), sport]);
  });
  return [...groupes.entries()].map(([cle, membres]) => {
    const representant = membres.reduce((meilleur, sport) => (
      comparerLesRangs(rangDEcriture(sport?.name, cle), rangDEcriture(meilleur?.name, cle)) < 0
        ? sport
        : meilleur
    ));
    return {
      cle, membres, nom: String(representant?.name ?? '').trim(), representant,
    };
  });
};
