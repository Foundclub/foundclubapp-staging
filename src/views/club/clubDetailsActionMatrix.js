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
