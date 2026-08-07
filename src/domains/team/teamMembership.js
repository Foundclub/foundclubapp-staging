/**
 * « Est-ce MON equipe ? » — le juge partage.
 *
 * POURQUOI CE MODULE EXISTE — defaut ① de la recette du 2026-08-07 : « j'ai cree
 * une equipe et je me suis affilie en tant qu'entraineur. Une fois creee, je la
 * vois comme etant une AUTRE equipe du club ; je me voyais entraineur dans les
 * membres mais je ne pouvais pas agir sur l'equipe. Ce n'est qu'apres quelques
 * minutes que c'est devenu normal. »
 *
 * La question a DEUX sources, et l'app n'en ecoutait qu'une :
 *
 *  1. **Le profil du compte** (`userData.myTeams` / `userData.trainedTeams`).
 *     Il arrive par `GET /app/bootstrap`, que le serveur sert depuis un cache
 *     memoire : la charge entiere est fraiche 30 s puis servie PERIMEE jusqu'a
 *     4 min de plus, et le profil qu'elle contient est fraiche 60 s puis perime
 *     4 min de plus (admin/src/api/firebase-auth/services/
 *     firebase-auth-runtime-cache.js). Aucune ecriture sur une equipe ne purge
 *     ce cache : creer une equipe ne fait donc PAS apparaitre l'equipe dans le
 *     profil avant plusieurs minutes. Cote app, invalider `['app-bootstrap']`
 *     ne sert a rien : la reponse revient identique.
 *
 *  2. **L'equipe elle-meme** (`team.trainers` / `team.players`), telle que
 *     `GET /teams` et `GET /teams/:id` viennent de la rendre. Celle-la est
 *     FRAICHE, et elle est deja a l'ecran : c'est la liste d'encadrants que
 *     l'utilisateur regarde pendant que l'app lui refuse d'agir.
 *
 * C'est exactement l'incoherence decrite : la moitie « je me vois entraineur »
 * lisait la source 2, la moitie « je peux agir » lisait la source 1.
 *
 * ⚠️ Ce juge ne fait qu'AJOUTER de la verite : il ne rend jamais `false` la ou
 * l'ancienne regle rendait `true`. Et il n'ouvre aucun droit que le serveur
 * n'ait deja accorde — il ne dit « oui » que quand le serveur a lui-meme
 * renvoye ce compte parmi les encadrants ou les joueurs de cette equipe.
 */

/**
 * L'identifiant d'un objet relation, qu'il arrive entier ou deja reduit a son id.
 * @param {any} value Une entite, ou directement son documentId.
 * @returns {string} Le documentId, ou '' si rien d'exploitable.
 */
const toDocumentId = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return String(value?.documentId || '').trim();
};

/**
 * Les documentId d'une collection de relations.
 * @param {any} collection Tableau d'entites (ou d'identifiants).
 * @returns {string[]} Les identifiants non vides.
 */
const toDocumentIds = (collection) => (Array.isArray(collection) ? collection : [])
  .map(toDocumentId)
  .filter(Boolean);

/**
 * Les equipes que le PROFIL du compte declare — source lente (cache serveur).
 * @param {any} user Le compte connecte (`userData`).
 * @returns {string[]} Les documentId de ses equipes, joueur et entraineur confondus.
 */
export const getProfileTeamIds = (user) => [
  ...toDocumentIds(user?.myTeams),
  ...toDocumentIds(user?.trainedTeams),
];

/**
 * Est-ce que ce compte fait partie de cette equipe ?
 * @param {any} team L'equipe, telle que le serveur vient de la rendre.
 * @param {any} user Le compte connecte (`userData`).
 * @returns {boolean} true des que l'UNE des deux sources le dit.
 */
export const isMyTeam = (team, user) => {
  const teamDocumentId = toDocumentId(team);
  if (!teamDocumentId) return false;

  // Source lente : le profil. C'est elle, et elle seule, que l'app lisait.
  if (getProfileTeamIds(user).includes(teamDocumentId)) return true;

  // Source fraiche : l'equipe. Elle tranche des la premiere reponse du serveur.
  const userDocumentId = toDocumentId(user);
  if (!userDocumentId) return false;

  return toDocumentIds(team?.trainers).includes(userDocumentId)
    || toDocumentIds(team?.players).includes(userDocumentId);
};
