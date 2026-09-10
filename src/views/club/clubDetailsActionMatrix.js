import { parentalPowerForAge } from '@/constants/parentalDeclaration';

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
 * raison mesurable : `canJoinClub` ne valait vrai que pour un ENTRAINEUR, donc
 * la matrice n allumait pour un dirigeant que `showEmptyClubClaimAction` — le
 * bouton qui envoie une REVENDICATION. Or l affiliation d office exige
 * `type: 'join'` (`club-membership-request.ts`) : le seul bouton qu il voyait
 * etait le seul qui ne pouvait pas l affilier.
 *
 * ⚠️ ETAT DEPUIS LE LOT TRIO (2026-09-01) : `canJoinClub` reconnait desormais
 * le dirigeant (`useAuth.js`), donc `showEmptyClubClaimAction` — qui exige
 * `!canJoinClub` — ne s allume plus que pour un compte SANS ROLE, dont
 * `isClubStaffRole` vaut faux. Depuis `ClubDetails`, cette fonction rend donc
 * TOUJOURS `'claim'` : sa branche `'join'` est devenue inatteignable, et le
 * geste d affiliation d office passe maintenant par `showJoinClubAction` ->
 * `handleAskToJoinClub`, qui appelle exactement le meme endpoint. ⛔ Elle est
 * CONSERVEE telle quelle (ses temoins la couvrent, et la retirer serait une
 * suppression de comportement sans rapport avec le defaut corrige) : c est un
 * nettoyage a faire, pas une correction.
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

/**
 * LA PLACE A RESERVER SOUS LE DEFILEMENT POUR LES BOUTONS FLOTTANTS.
 *
 * 🖥️ MESURE PRISE SUR L EMULATEUR le 2026-09-10, fiche de « TEST FC » : deux
 * boutons voisins occupaient [63,1710][1017,1833] et [63,1865][1017,1988] —
 * 123 px de haut, et un PAS de 155 px de l un a l autre.
 * La formule d avant reservait 72 px par bouton supplementaire, MOINS DE LA
 * MOITIE du pas reel. Sur une fiche club courte, les boutons flottants
 * recouvraient donc « Installations », « Stade marseillais », « Sports »,
 * « Football » : le contenu passait derriere, illisible.
 *
 * ⚠️ Aucune porte ne mesure ca : `react-test-renderer` ne calcule aucune mise
 * en page. Il a fallu regarder l ecran. D ou cette fonction PURE, pour qu au
 * moins l arithmetique soit tenue par un temoin.
 * @param {number} count - Le nombre de boutons flottants affiches.
 * @param {number} bottomInset - Le retrait bas de l appareil, deja plancher.
 * @returns {number} La place a reserver au bas du defilement.
 */
export const floatingActionsScrollPadding = (count, bottomInset) => {
  const nombre = Number.isFinite(count) ? count : 0;
  if (nombre <= 0) return 40;
  // 128 = le socle d un bouton seul (sa hauteur plus sa marge) ; 155 = le pas
  // reel d un bouton au suivant, mesure a l ecran.
  return bottomInset + 128 + ((nombre - 1) * 155);
};

/**
 * PARENT P2 — COMBIEN D ENFANTS, ET DANS QUELLE TRANCHE D AGE.
 *
 * Le comptage vit ICI, a cote de la matrice qui le consomme, et pas dans
 * `ClubDetails` : c est ce qui evite d ajouter la-bas un import de
 * `@/constants/*` que `perfectionist/sort-imports` et `import/order` classent a
 * deux endroits CONTRAIRES (mesure le 2026-09-10 : les deux regles se renvoient
 * la ligne l une a l autre, aucune position ne les satisfait toutes les deux).
 *
 * ⛔ Il rend DEUX NOMBRES, jamais des fiches : ni la matrice ni la fiche club
 * n ont de raison de manipuler le prenom ou la date de naissance d un mineur.
 * @param {any[]} enfants - Les fiches enfants du compte, telles que le serveur les rend.
 * @returns {{ childrenUnder13Count: number, minorChildrenCount: number }} Les deux compteurs.
 */
export const countChildrenByAgeBand = (enfants) => {
  const fiches = Array.isArray(enfants) ? enfants : [];
  return {
    childrenUnder13Count: fiches
      .filter((enfant) => parentalPowerForAge(enfant?.age) === 'full').length,
    minorChildrenCount: fiches
      .filter((enfant) => parentalPowerForAge(enfant?.age) !== 'none').length,
  };
};

export const resolveClubDetailsActionMatrix = ({
  areClubMembersHidden = false,
  canContactAdmin = false,
  canEdit = false,
  canJoinClub = false,
  canLeaveClub = false,
  canPlayerSignalClubTeam = false,
  canPlayerSignalMissingTeam = false,
  canUseClubPartneringFlow = false,
  // PARENT P2 — les deux seuls chiffres dont la matrice a besoin sur les
  // enfants : combien ont MOINS DE 13 ANS, et combien sont MINEURS. Deux
  // nombres, jamais une liste de fiches : une matrice de decision n a aucune
  // raison de voir le prenom ni la date de naissance d un mineur.
  childrenUnder13Count = 0,
  clubHasTeams = false,
  hasParentMultisportClub = false,
  // PARENT P2 — la demande d interet de CE parent pour CE club est-elle deja
  // partie ? Mon bouton envoie exactement la meme, la porte existante le dit
  // deja : quand c est vrai, la mienne s efface au lieu de faire doublon.
  hasPendingChildInterest = false,
  isAuthenticated = false,
  isClubStaffRole = false,
  isMultisportAdmin = false,
  isParentClubAdmin = false,
  isPlayerRole = false,
  isUserAlreadyAttachedToViewedClub = false,
  minorChildrenCount = 0,
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

  // ───────────────────────────────────────────────────────────────────────
  // PARENT P2 (2026-09-10) — « DEMANDER A REJOINDRE AU NOM DE MON ENFANT ».
  //
  // 🔒 LES TROIS TRANCHES D AGE (E17, tranche par Adel le 07/09) :
  //   moins de 13 ans → la porte s allume : l enfant n a pas de compte, c est
  //                     le parent qui parle pour lui ;
  //   13 a 17 ans     → PLUS de porte, mais une EXPLICATION : l ado fait sa
  //                     demande lui-meme. Un ado de 16 ans qui ne pourrait pas
  //                     dire qu il vient a l entrainement, « ca ne tient pas
  //                     debout » (plan, E17) ;
  //   18 ans et plus  → ni porte ni phrase : le lien parental est ETEINT, et
  //                     l app n a plus rien a dire sur un adulte.
  //
  // ⛔ CE N EST PAS UNE DEMANDE D ADHESION, et la difference est structurelle :
  // `club-membership-request` porte un `user` (un COMPTE) et son acceptation
  // MUTE ce compte (role, club). Un enfant de moins de 13 ans n a pas de
  // compte — le serveur le refuse — donc faire signer la demande par le parent
  // rattacherait LE PARENT au club : la mauvaise personne dans l effectif.
  // Le rail d interet, lui, ne rattache PERSONNE : il previent les dirigeants,
  // qui repondent au parent. C est le partage tranche en C9 du plan.
  //
  // 🖥️ `!hasPendingChildInterest` VIENT DE L EMULATEUR, le 2026-09-10. Une fois
  // l interet envoye, la fiche club montrait TROIS boutons au libelle identique
  // « Demande en attente » — le mien et les deux existants — et ces quatre
  // boutons flottants RECOUVRAIENT les informations du club, illisibles.
  // Mon bouton declenche la MEME demande que la porte d interet existante :
  // quand elle est deja partie, l autre l annonce, la mienne n ajoute rien.
  const showChildInterestAction = Boolean(
    canShowAffiliationAction
    && childrenUnder13Count > 0
    && !canEdit
    && !hasPendingChildInterest
    && !isUserAlreadyAttachedToViewedClub,
  );
  // On EXPLIQUE l absence de la porte au lieu de la faire disparaitre sans un
  // mot — mais seulement tant qu il reste un mineur a qui ca s applique.
  const showTeenSelfRequestHint = Boolean(
    canShowAffiliationAction
    && childrenUnder13Count === 0
    && minorChildrenCount > 0
    && !canEdit
    && !isUserAlreadyAttachedToViewedClub,
  );

  return {
    showChildInterestAction,
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
    showTeenSelfRequestHint,
  };
};
