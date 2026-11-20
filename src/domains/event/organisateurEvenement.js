/**
 * ORGANISATEUR-VISIBLE (19/11, D258 « 2- A ») — qui propose l'événement, en « Prénom N. ».
 *
 * Besoin d'un club d'activité (spéléo) où chaque encadrant propose ses sorties : la fiche et la
 * carte ne disaient pas qui l'organise, alors que le serveur garde `event.organizer` (rempli à la
 * création).
 *
 * Règles :
 * - prénom + initiale du nom, jamais le nom complet, jamais l'e-mail ni l'identifiant ;
 * - sans prénom (identité masquée par le serveur, mineur compris), rien ne s'affiche ;
 * - pas pour un tournoi : il a déjà « Organisé par » son complexe (IMPL-1).
 * @param {any} event - l'événement tel que rendu par l'API (fiche ou carte).
 * @returns {string} « Camille D. », ou '' quand il ne faut rien afficher.
 */
export const libelleOrganisateur = (event) => {
  if (!event) return '';
  const typeName = String(event?.type?.name || '').toLowerCase();
  // `tournamentScopeMode` vaut « team » par défaut sur TOUT événement :
  // seul « autonomous » dit tournoi.
  if (typeName.includes('tournoi') || event?.tournamentScopeMode === 'autonomous') return '';
  const prenom = String(event?.organizer?.firstname || '').trim();
  if (!prenom) return '';
  const initiale = String(event?.organizer?.lastname || '').trim().charAt(0).toUpperCase();
  return initiale ? `${prenom} ${initiale}.` : prenom;
};

export default libelleOrganisateur;
