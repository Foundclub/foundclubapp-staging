/**
 * Le nom d'un role, sans accent ni casse (« Entraîneur » -> « entraineur »).
 * @param {unknown} nom
 * @returns {string}
 */
const normaliser = (nom) => String(nom || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

/** Les noms de role du serveur, ramenes a une clef (memes familles que `NewConversation`). */
const CLEF_PAR_ROLE = /** @type {Record<string, string>} */ ({
  clubadmin: 'dirigeant',
  coach: 'entraineur',
  dirigeant: 'dirigeant',
  entraineur: 'entraineur',
  joueur: 'joueur',
  parent: 'parent',
  player: 'joueur',
  president: 'dirigeant',
});

/**
 * MSG1BA (§3.1) — LA CLEF DU ROLE D'UN MEMBRE (« dirigeant », « entraineur », « joueur »,
 * « parent »), ou '' quand le role ne dit rien d'un club (SuperAdmin, compte sans role...).
 * @param {unknown} nomDuRole - `role.name` tel que le serveur le rend.
 * @returns {string}
 */
export const clefDuRole = (nomDuRole) => CLEF_PAR_ROLE[normaliser(nomDuRole)] || '';

/**
 * MSG1BA (§3.1, decision d'Adel `genre A`) — LE LIBELLE SOUS LE NOM D'UN MEMBRE dans « Infos
 * du groupe » : « Dirigeant », « Entraîneur », « Joueur », « Parent », sinon « Membre ».
 * Un seul libelle pour tout le monde : on ne connait pas le genre.
 * @param {unknown} nomDuRole - `role.name`.
 * @param {(cle: string, repli: string) => string} t
 * @returns {string}
 */
export const libelleDuRole = (nomDuRole, t) => {
  const libelles = /** @type {Record<string, string>} */ ({
    dirigeant: t('conversation.staffRole.dirigeant', 'Dirigeant'),
    entraineur: t('conversation.staffRole.entraineur', 'Entraîneur'),
    joueur: t('conversation.staffRole.joueur', 'Joueur'),
    parent: t('conversation.staffRole.parent', 'Parent'),
  });
  return libelles[clefDuRole(nomDuRole)] || t('conversation.group.member', 'Membre');
};
