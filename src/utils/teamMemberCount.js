// Nombre de membres d'une équipe, tel qu'affiché sur les cartes d'équipe.
//
// Extrait de `TeamListContent` pour être testable : la carte affichait « 0 membre »
// sur des équipes pleines, parce qu'elle comptait UNIQUEMENT les listes `players`
// et `trainers`. Or le serveur ne les renvoie pas toujours :
//
//  - le contrôleur `api::team.team` les retire et n'expose plus que
//    `playersCount` / `trainersCount` quand le club masque ses membres
//    (`membersAreHidden`) ;
//  - Strapi les retire aussi de lui-même lorsque le rôle appelant n'a pas le droit
//    de lire `plugin::users-permissions.user` (sanitizer `removeRestrictedRelations`).
//
// L'écran de détail (`TeamDetails`) lisait déjà ces compteurs ; la carte, non.
// On ne se fie donc aux compteurs QUE si les listes sont absentes ou vides : quand
// elles sont là, elles restent la source la plus juste (elles dédoublonnent une
// personne à la fois joueuse et entraîneuse, ce que deux compteurs séparés ne
// peuvent pas faire).

/**
 * Renvoie la valeur sous forme de liste exploitable.
 * @param {unknown} list - Valeur potentiellement absente ou malformée.
 * @returns {any[]} La liste, ou une liste vide.
 */
const toList = (list) => (Array.isArray(list) ? list : []);

/**
 * Lit un compteur de membres renvoyé par le serveur.
 * @param {unknown} value - Compteur brut.
 * @returns {number | null} Le compteur, ou null s'il est absent ou illisible.
 */
const toCount = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/**
 * Calcule le nombre de membres à afficher pour une équipe.
 * @param {any} team - Équipe telle que renvoyée par l'API.
 * @returns {number} Nombre de membres à afficher.
 */
export const getTeamMemberCount = (team) => {
  const ids = new Set();
  const collect = (list) => {
    toList(list).forEach((member) => {
      if (!member) return;
      const memberId = member.documentId || member.id || member.phoneNumber;
      if (memberId) ids.add(String(memberId));
    });
  };

  collect(team?.players);
  collect(team?.trainers);
  collect(team?.members);

  if (ids.size > 0) return ids.size;

  const listTotal = toList(team?.players).length + toList(team?.trainers).length;
  if (listTotal > 0) return listTotal;

  const playersCount = toCount(team?.playersCount);
  const trainersCount = toCount(team?.trainersCount);
  if (playersCount === null && trainersCount === null) return 0;

  return (playersCount || 0) + (trainersCount || 0);
};

export default getTeamMemberCount;
