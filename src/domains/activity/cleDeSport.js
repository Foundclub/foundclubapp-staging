// SPORTS-DOUBLONS (01/10/2026) — UN SPORT = UNE CLÉ, ET UN NOM.
//
// La base garde 4 sports en double (« Volley » / « Volleyball », « Echecs » / « Échecs »,
// « Equitation » / « Équitation », « Canoë-Kayak » / « Canoë-kayak ») : le choix du sport de la
// recherche les montrait deux fois. La règle qui dit « ces deux noms sont le même sport » est celle
// du serveur (`admin/src/api/search/services/sport-key.ts`), recopiée ici À L'IDENTIQUE : le témoin
// admin `tests/authz/SPORTS-DOUBLONS-2-parite-app.test.js` lit CE fichier et compare les deux, nom
// par nom. Changer l'une sans l'autre le fait rougir.
//
// ⛔ Aucun import et rien que du JavaScript : ce témoin l'évalue tel quel, hors de React Native.

/** Un nom court (déjà réduit en clé) → la clé du sport qu'il désigne. */
export const ALIAS_DE_CLE = Object.freeze({
  volley: 'volleyball',
});

/** Le nom à afficher et à envoyer pour une clé qui a plusieurs écritures dans la base. */
export const NOMS_OFFICIELS = Object.freeze({
  canoekayak: 'Canoë-kayak',
  echecs: 'Échecs',
  equitation: 'Équitation',
  volleyball: 'Volleyball',
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
 * @param {unknown} nom Un nom de sport.
 * @returns {string} Le nom officiel de sa clé, sinon le nom tel quel.
 */
export const nomOfficielDeSport = (nom) => (
  NOMS_OFFICIELS[/** @type {keyof typeof NOMS_OFFICIELS} */ (cleDeSport(nom))] || String(nom ?? '').trim()
);

/**
 * Les sports regroupés par clé, un groupe par sport, dans l'ordre de la liste reçue. Le nom du
 * groupe est le nom officiel (sinon celui de sa première ligne) ; son représentant, la ligne qui
 * porte ce nom (sinon la première).
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
    const nom = NOMS_OFFICIELS[/** @type {keyof typeof NOMS_OFFICIELS} */ (cle)]
      || String(membres[0]?.name ?? '').trim();
    return {
      cle,
      membres,
      nom,
      representant: membres.find((sport) => sport?.name === nom) || membres[0],
    };
  });
};
