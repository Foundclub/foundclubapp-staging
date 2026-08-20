/**
 * AA02 — « cette ligne a-t-elle encore une personne ? »
 *
 * UNE seule fonction repond a la question, pour toute l'application. Elle
 * existait deja recopiee a la main (`TeamWizardName.js`) et cinq fois cote
 * serveur (`club.ts`, `team.ts` x2, `firebase-auth.ts`, `superadmin-console.ts`) :
 * ce module est la copie de reference cote app, et les lecteurs l'appellent
 * au lieu de la reecrire.
 *
 * ⚠️ LE MARQUEUR N'EST PAS LE NOM AFFICHE. Supprimer son compte ne supprime pas
 * la ligne : le serveur RENOMME l'utilisateur en « Utilisateur Supprimé », le
 * bloque, et lui donne un identifiant tombstone
 * (`deleted_user_<id>_<horodatage>` / `...@deleted.com`). Le compte reste donc
 * relie a ses evenements passes, a ses conversations, a ses cotisations.
 *
 * 🔒 LA GARDE QUI COMPTE : `blocked` est exige EN PLUS du tombstone. Un vrai
 * membre n'est jamais bloque avec un identifiant `deleted_user_`, donc il ne
 * peut pas etre masque par erreur — masquer un joueur vivant serait pire que
 * le defaut de depart.
 */

const readText = (value) => String(value == null ? '' : value).trim();

/**
 * Un compte supprime (RGPD), anonymise et bloque par le serveur.
 * @param {any} user - L'utilisateur tel que le serveur le renvoie.
 * @returns {boolean} `true` si plus personne ne se cache derriere cette ligne.
 */
export const isDeletedAccount = (user) => {
  if (!user || typeof user !== 'object') return false;
  if (!user.blocked) return false;

  const username = readText(user.username);
  const email = readText(user.email).toLowerCase();
  return username.startsWith('deleted_user_') || email.endsWith('@deleted.com');
};

/**
 * Une ligne de liste porte-t-elle encore une personne ?
 *
 * Deux trous possibles, et ils n'ont pas la meme cause :
 *  - la relation est VIDE (`null`) — la ligne a survecu a son utilisateur ;
 *  - la relation pointe vers un compte supprime — la ligne montre un fantome.
 * @param {any} user - L'utilisateur porte par la ligne.
 * @returns {boolean} `true` si la ligne peut etre affichee.
 */
export const hasLivingUser = (user) => Boolean(user) && !isDeletedAccount(user);

/**
 * Retire d'une liste de personnes celles qui n'existent plus.
 * @template T
 * @param {T[]} [users] - La liste brute renvoyee par le serveur.
 * @returns {T[]} La meme liste, sans les trous ni les comptes supprimes.
 */
export const withoutDeletedAccounts = (users = []) => (
  Array.isArray(users) ? users.filter((user) => hasLivingUser(user)) : []
);

/**
 * Meme chose pour une liste d'ENVELOPPES (`{ user }`) : demandes de
 * participation, convocations, cotisations, inscriptions.
 * @template T
 * @param {T[]} [entries] - Les enveloppes renvoyees par le serveur.
 * @param {(entry: T) => any} [pickUser] - Ou lire la personne dans l'enveloppe.
 * @returns {T[]} Les enveloppes qui portent encore une personne.
 */
export const withoutDeletedAccountEntries = (entries = [], pickUser = (entry) => entry?.user) => (
  Array.isArray(entries) ? entries.filter((entry) => hasLivingUser(pickUser(entry))) : []
);
