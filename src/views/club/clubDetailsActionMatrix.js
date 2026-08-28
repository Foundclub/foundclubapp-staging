/**
 * AA04 ③ — LA PORTE VERS LA PREMIERE EQUIPE, sur SON club.
 *
 * La section « Equipes » de la fiche, et sa carte « + Creer une equipe »,
 * n'existaient que pour `canEdit` — c'est-a-dire pour le seul role `president`
 * (`canUserEditClub`). Or un ENTRAINEUR qui vient de creer son club reste
 * `Entraineur` tant qu'il n'a pas coche « je suis aussi dirigeant »
 * (`admin`, `club-self-onboard.ts`, `resolveCreatorRoleTarget`) : il arrivait
 * sur la fiche de SON club sans aucune porte vers une equipe, alors que l'app
 * le laisse deja en creer une depuis l'onglet Equipes (`canManageTeam` =
 * entraineur OU dirigeant).
 *
 * 🔒 `hasAdministrativeClubAccess` et non « est membre » : c'est le
 * rattachement ADMINISTRATIF (`hasClubAccess`, donc `user.club` / `clubs` /
 * `clubAffiliations`), jamais l'appartenance deduite d'une equipe. Un
 * entraineur qui joue dans l'equipe d'un AUTRE club n'ouvre donc rien chez ce
 * club-la. Et la creation reste de toute facon arbitree par le serveur : cette
 * fonction decide d'une PORTE, pas d'un droit.
 * @param {object} params - Ce que la fiche sait de la personne et du club.
 * @param {boolean} [params.canEdit] - Elle dirige ce club (role `president`).
 * @param {boolean} [params.hasAdministrativeClubAccess] - Ce club est SON club.
 * @param {boolean} [params.isClubStaffRole] - Elle encadre : entraineur ou dirigeant.
 * @returns {boolean} La fiche propose-t-elle de creer une equipe ?
 */
export const canCreateTeamInClub = ({
  canEdit = false,
  hasAdministrativeClubAccess = false,
  isClubStaffRole = false,
}) => Boolean(canEdit || (isClubStaffRole && hasAdministrativeClubAccess));

/**
 * AFFIL A1 — « JE DIRIGE CE CLUB » : ADHESION OU REVENDICATION ?
 *
 * Regle d Adel, redite le 2026-08-28 : « quand un club n a pas de dirigeant, il
 * doit etre directement affilie comme dirigeant de celui-ci. Nous, ca nous
 * envoie une demande de verification. »
 *
 * 🎯 Cette regle EXISTE DEJA cote serveur, et elle reconnait le dirigeant depuis
 * U03/D4 (`canClaimClubWithoutManager`). Elle etait inatteignable pour une
 * raison mesurable : `canJoinClub` (useAuth.js:626) ne vaut vrai que pour un
 * ENTRAINEUR, donc la matrice n allume pour un dirigeant que
 * `showEmptyClubClaimAction` — le bouton qui envoie une REVENDICATION. Or
 * l affiliation d office exige `type: 'join'`
 * (`club-membership-request.ts:665`) : le seul bouton qu il voyait etait le seul
 * qui ne pouvait pas l affilier.
 *
 * ⛔ CE QUE CETTE FONCTION N ELARGIT PAS, ET C EST VOULU :
 *  · un club QUI A un dirigeant garde sa demande a valider — `ownerCount === 0`
 *    est la condition exacte enoncee par Adel (« aucun dirigeant affilie ») ;
 *  · un club dont les membres sont MASQUES n est pas un club sans dirigeant :
 *    on ne sait pas, donc on ne presume pas ;
 *  · un compte SANS ROLE (40 sur 118 en production au 2026-08-13) garde sa
 *    revendication. Le serveur refuserait son adhesion
 *    (`resolveOrphanClubJoinRefusal`) : lui retirer le claim lui retirerait son
 *    seul chemin.
 *
 * 🔒 Le serveur reste l arbitre : il recompte les dirigeants VIVANTS lui-meme
 * (`clubHasLivingManager`) et refuse en nommant le motif. Cette fonction choisit
 * un GESTE, jamais un droit.
 * @param {object} params - Ce que la fiche sait du club et de la personne.
 * @param {boolean} [params.areClubMembersHidden] - Le club masque-t-il ses membres.
 * @param {boolean} [params.isClubStaffRole] - Elle encadre : entraineur ou dirigeant.
 * @param {number} [params.ownerCount] - Le nombre de dirigeants visibles du club.
 * @returns {'join' | 'claim'} Le geste a envoyer.
 */
export const resolveEmptyClubClaimGesture = ({
  areClubMembersHidden = false,
  isClubStaffRole = false,
  ownerCount = 0,
}) => (
  (isClubStaffRole && ownerCount === 0 && !areClubMembersHidden) ? 'join' : 'claim'
);

export const resolveClubDetailsActionMatrix = ({
  areClubMembersHidden = false,
  canContactAdmin = false,
  canEdit = false,
  canJoinClub = false,
  canLeaveClub = false,
  canPlayerSignalClubTeam = false,
  canPlayerSignalMissingTeam = false,
  canUseClubPartneringFlow = false,
  clubHasTeams = false,
  hasParentMultisportClub = false,
  isAuthenticated = false,
  isClubStaffRole = false,
  isMultisportAdmin = false,
  isParentClubAdmin = false,
  isPlayerRole = false,
  isUserAlreadyAttachedToViewedClub = false,
  ownerCount = 0,
}) => {
  const showLeaveClubAction = Boolean(isAuthenticated && canLeaveClub);
  const canShowAffiliationAction = isAuthenticated && !showLeaveClubAction;

  const showPublicClaimLogin = !isAuthenticated;
  // D98 — la fiche club est la principale porte d'entree du produit (~28 500 pages
  // indexables), et elle n'offrait au visiteur anonyme que « Je dirige ce club ».
  // Un joueur, ou le parent d'un joueur, ne peut pas signer cette phrase : il
  // repartait. Les deux portes menent a la meme connexion, aucune n'envoie quoi
  // que ce soit sans compte (temoin « never exposes a sending action »).
  const showPublicPlayerLogin = !isAuthenticated;
  const showPlayerClubAction = Boolean(
    canShowAffiliationAction && canPlayerSignalClubTeam,
  );
  // D95 — le club existe mais personne n'y a cree d'equipe. C'est le cas NORMAL
  // (222 287 clubs sur 222 294 au 2026-08-13), pas un cas limite : le joueur doit
  // pouvoir faire venir son club au lieu de tomber sur « Je dirige ce club ».
  const showPlayerNoTeamAction = Boolean(
    canShowAffiliationAction && canPlayerSignalMissingTeam,
  );
  const showJoinClubAction = Boolean(
    canShowAffiliationAction
    && canJoinClub
    && !isUserAlreadyAttachedToViewedClub
    && !isParentClubAdmin
    && !canUseClubPartneringFlow,
  );
  const showContactAdminClaimAction = Boolean(
    canShowAffiliationAction
    && canContactAdmin
    && !hasParentMultisportClub
    && (ownerCount > 0 || areClubMembersHidden)
    && !canUseClubPartneringFlow
    && !isUserAlreadyAttachedToViewedClub,
  );
  const showClubPartneringAction = Boolean(
    canShowAffiliationAction && canUseClubPartneringFlow,
  );
  const showEmptyClubClaimAction = Boolean(
    canShowAffiliationAction
    && !isUserAlreadyAttachedToViewedClub
    && !canEdit
    && !canJoinClub
    && !canUseClubPartneringFlow
    && !areClubMembersHidden
    && ownerCount === 0
    && !isPlayerRole,
  );

  // V01 — LA SECONDE PORTE d'un club QUI A des equipes (Adel, 2026-08-18).
  //
  // Ce qui a change ici tient en une ligne supprimee. Un drapeau
  // `hasPrimaryAffiliationAction` regroupait les 6 actions d'affiliation, et
  // l'interet ne s'allumait QUE si aucune d'elles ne s'allumait : c'etait un
  // repli, pas une porte. Le joueur de passage n'avait donc qu'un seul geste
  // possible, « Je fais partie de ce club » — une appartenance qu'il n'a pas.
  //
  // Les deux boutons ne disent pas la meme chose, et c'est tout l'enjeu :
  //   · la porte primaire = « j'y suis deja, faites-moi entrer » ;
  //   · celle-ci          = « je n'y suis pas, je me signale ».
  // S02 avait deja fait cohabiter ces deux intentions sur un club SANS equipe ;
  // V01 pose la meme regle sur un club qui EN A. C'est la moitie qui manquait.
  //
  // 🔒 `clubHasTeams` reste, et c'est ce qui garantit que les deux portes
  // d'interet ne s'allument JAMAIS ensemble : celle-ci exige des equipes,
  // `showClubArrivalInterestAction` exige qu'il n'y en ait aucune.
  const showClubInterestAction = Boolean(
    canShowAffiliationAction
    && !isUserAlreadyAttachedToViewedClub
    && clubHasTeams
    && !(hasParentMultisportClub && isMultisportAdmin),
  );

  // S02 — LA SECONDE PORTE d'un club sans equipe.
  //
  // Les deux boutons ne disent pas la meme chose, et c'est tout l'enjeu :
  //   · la porte primaire ci-dessus = « j'y suis deja, faites-moi entrer » ;
  //   · celle-ci                    = « je n'y suis pas encore, prevenez-moi ».
  // Un seul bouton forçait tout le monde dans la premiere case, alors que
  // 222 287 clubs sur 222 294 n'ont AUCUNE equipe (mesure prod du 2026-08-13) :
  // tomber sur un club absent de l'app est le cas NORMAL, pas le cas limite.
  //
  // 🔒 `!clubHasTeams` est la garantie structurelle de la non-regression : sur un
  // club QUI A une equipe, ce drapeau vaut faux quoi qu'il arrive, donc aucun de
  // ces ecrans ne bouge. `showClubInterestAction` (l'interet POUR UNE EQUIPE)
  // reste, lui, reserve aux clubs qui en ont une — les deux ne se croisent
  // jamais.
  //
  // 🔒 Z01 (Adel, 2026-08-20) — `!isClubStaffRole` : cette porte est celle de
  // quelqu'un qui ATTEND le club. Un dirigeant ou un entraineur ne l'attend pas,
  // il peut le faire venir lui-meme — et c'est exactement ce que dit sa propre
  // porte, juste au-dessus. Les deux ensemble se contredisaient.
  // Le drapeau nomme le ROLE et non `!isPlayerRole`, parce que le compte SANS
  // ROLE (40 comptes sur 118 en production au 2026-08-13) n'est ni l'un ni
  // l'autre : lui garde ses deux portes, comme le joueur et comme le visiteur
  // anonyme — Adel a valide leur cas le 2026-08-18.
  const showClubArrivalInterestAction = Boolean(
    canShowAffiliationAction
    && !clubHasTeams
    && !canEdit
    && !isClubStaffRole
    && !isUserAlreadyAttachedToViewedClub
    && !(hasParentMultisportClub && isMultisportAdmin),
  );

  return {
    showClubArrivalInterestAction,
    showClubInterestAction,
    showClubPartneringAction,
    showContactAdminClaimAction,
    showEmptyClubClaimAction,
    showJoinClubAction,
    showLeaveClubAction,
    showPlayerClubAction,
    showPlayerNoTeamAction,
    showPublicClaimLogin,
    showPublicPlayerLogin,
  };
};
