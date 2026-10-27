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

import { canUserEditClub } from '@/domains/auth/authUseCases';

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

/**
 * Est-ce que ce compte ENTRAINE cette equipe ? Le profil (`trainedTeams`) ou
 * l'equipe elle-meme (`team.trainers`, source fraiche) — un joueur, non.
 * @param {any} team L'equipe.
 * @param {any} user Le compte connecte (`userData`).
 * @returns {boolean} true s'il l'entraine.
 */
export const isTeamTrainer = (team, user) => {
  const teamDocumentId = toDocumentId(team);
  if (!teamDocumentId || !user) return false;
  if (toDocumentIds(user?.trainedTeams).includes(teamDocumentId)) return true;
  const userDocumentId = toDocumentId(user);
  return Boolean(userDocumentId) && toDocumentIds(team?.trainers).includes(userDocumentId);
};

/**
 * La premiere equipe de la liste que ce compte entraine (guide TUTOE :
 * « Ton equipe est deja la » ne vise jamais une equipe ou il ne fait que jouer).
 * @param {any[]} teams Les equipes affichees, dans l'ordre.
 * @param {any} user Le compte connecte.
 * @returns {string | null} Son documentId, ou null.
 */
export const firstTrainedTeamId = (teams, user) => toDocumentId(
  (Array.isArray(teams) ? teams : []).find((team) => isTeamTrainer(team, user)),
) || null;

/**
 * « Est-ce que je GERE cette equipe ? » — la question de DROIT, a ne pas
 * confondre avec `isMyTeam` juste au-dessus, qui est celle d'APPARTENANCE.
 *
 * GERER-ANNONCE (audit V1, A15/A16, 2026-09-30) : quatre ecrans d'annonces
 * repondaient « oui » des que l'equipe etait dans `myTeams`. Or `myTeams` est
 * la liste des equipes ou l'on JOUE (schema utilisateur, `mappedBy: players`,
 * rendue telle quelle par `/me`) : un joueur recevait les outils du club
 * (« Modifier », « Avis de recherche », « Supprimer »), que le serveur lui
 * refusait ensuite. Et un dirigeant qui n'entraine pas l'equipe ne les recevait
 * pas, alors que le serveur les lui accorde.
 *
 * ⚖️ Meme reponse que le serveur, `api::team.auth.canManageTeam`
 * (admin/src/api/team/services/auth.ts:92-113) :
 *   · entraineur de l'equipe — le profil (`trainedTeams`, source lente) ou
 *     l'equipe elle-meme (`team.trainers`, source fraiche, cf. `isMyTeam`) ;
 *   · OU dirigeant/president du club de l'equipe — `canUserEditClub`, la porte
 *     qui dit deja « dirigeant de ce club » partout dans l'app.
 * Ce juge n'ouvre rien : le serveur revalide chaque ecriture.
 * @param {any} team L'equipe (avec son `club` pour le versant dirigeant).
 * @param {any} user Le compte connecte (`userData`).
 * @returns {boolean} true si ce compte gere cette equipe.
 */
export const isTeamManager = (team, user) => {
  if (!toDocumentId(team) || !user) return false;
  if (isTeamTrainer(team, user)) return true;

  return canUserEditClub(user, toDocumentId(team?.club));
};

/**
 * Les equipes du profil que ce compte GERE, sans doublon — la liste a donner aux
 * choix d'equipe et aux filtres « mes annonces ».
 *
 * Meme ordre que la paire `myTeams` + `trainedTeams` que lisaient ces ecrans,
 * mais une equipe ou l'on ne fait que jouer en sort. Elle y reste si l'on
 * dirige son club : c'est alors `canManageTeam` qui dit oui au serveur.
 * @param {any} user Le compte connecte (`userData`).
 * @returns {any[]} Les equipes gerees, telles que le profil les porte.
 */
export const getManagedTeams = (user) => {
  const seen = new Set();
  return [
    ...(Array.isArray(user?.myTeams) ? user.myTeams : []),
    ...(Array.isArray(user?.trainedTeams) ? user.trainedTeams : []),
  ].filter((team) => {
    const teamDocumentId = toDocumentId(team);
    if (!teamDocumentId || seen.has(teamDocumentId) || !isTeamManager(team, user)) return false;
    seen.add(teamDocumentId);
    return true;
  });
};

/**
 * Meme entite, par documentId ou par id — la regle `isSameUserEntity` des deux
 * polices serveur ci-dessous, deux valeurs VIDES ne se ressemblent jamais.
 * @param {any} left Une entite.
 * @param {any} right Une autre.
 * @returns {boolean} true si c'est la meme.
 */
const isSameEntity = (left, right) => {
  const leftDocumentId = toDocumentId(left);
  if (leftDocumentId && leftDocumentId === toDocumentId(right)) return true;

  const leftId = String(left?.id ?? '').trim();
  return Boolean(leftId && leftId === String(right?.id ?? '').trim());
};

/**
 * « Est-ce MOI qui ai publie cette annonce ? » — plus etroit que `canManageTeamAd`.
 * ANNONCE-RENOUVELER (05/10) : le serveur ne laisse RENOUVELER que l'auteur, meme a un
 * co-entraineur que sa police laisse passer
 * (admin : recruitment-ad/controllers/recruitment-ad-custom.ts, `renew`).
 * Test : __tests__/teamMembership.auteurAnnonce.test.js.
 * @param {any} ad L'annonce (avec `author`).
 * @param {any} user Le compte connecte (`userData`).
 * @returns {boolean} true si ce compte en est l'auteur.
 */
export const isAdAuthor = (ad, user) => Boolean(
  ad?.author && user && isSameEntity(ad.author, user),
);

/**
 * « Est-ce que je gere cette ANNONCE ? » — annonce de recrutement comme annonce
 * de match amical : le serveur tient la meme regle pour les deux,
 * `canManageTeam(equipe de l'annonce)` OU auteur de l'annonce
 * (admin : recruitment-ad/policies/can-manage-recruitment-ad.ts:50-59,
 * friendly-match-ad/services/friendly-match-workflow.ts:143-151).
 * @param {any} ad L'annonce (avec `team`, `team.club` et `author`).
 * @param {any} user Le compte connecte (`userData`).
 * @returns {boolean} true si ce compte en a les outils.
 */
export const canManageTeamAd = (ad, user) => {
  if (!ad || !user) return false;
  if (isAdAuthor(ad, user)) return true;
  return isTeamManager(ad?.team, user);
};
