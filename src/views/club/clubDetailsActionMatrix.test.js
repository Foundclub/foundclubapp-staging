import { resolveClubDetailsActionMatrix } from './clubDetailsActionMatrix';

describe('resolveClubDetailsActionMatrix', () => {
  // V01 (2026-08-18) — REECRIT. Ce test disait « sans le repli d'interet » : il
  // verrouillait la regle d'avant, ou l'interet n'apparaissait QUE si aucune
  // action d'affiliation ne s'allumait. Adel demande l'inverse : « je dois voir
  // DEUX boutons ». Les deux intentions ne se remplacent pas, elles coexistent —
  // « je rejoins » n'est pas « je me signale ».
  it('shows join AND the interest door together for an unattached coach', () => {
    expect(resolveClubDetailsActionMatrix({
      canJoinClub: true,
      clubHasTeams: true,
      isAuthenticated: true,
    })).toMatchObject({
      showClubInterestAction: true,
      showJoinClubAction: true,
    });
  });

  it('shows leave only for an attached dirigeant', () => {
    expect(resolveClubDetailsActionMatrix({
      canContactAdmin: true,
      canLeaveClub: true,
      clubHasTeams: true,
      isAuthenticated: true,
      ownerCount: 1,
    })).toMatchObject({
      showClubInterestAction: false,
      showContactAdminClaimAction: false,
      showLeaveClubAction: true,
    });
  });

  // V01 (2026-08-18) — REECRIT. Il disait « a la place du repli d'interet ».
  // « Je fais partie de ce club » et « Interesse par le club » repondent a deux
  // situations differentes : j'y suis deja / je n'y suis pas encore. Forcer la
  // seconde a disparaitre des que la premiere s'allume oblige le joueur a
  // affirmer une appartenance qu'il n'a pas.
  it('shows player affiliation AND the interest door side by side', () => {
    expect(resolveClubDetailsActionMatrix({
      canPlayerSignalClubTeam: true,
      clubHasTeams: true,
      isAuthenticated: true,
      isPlayerRole: true,
    })).toMatchObject({
      showClubInterestAction: true,
      showPlayerClubAction: true,
    });
  });

  it('hides interest for a multisport admin on a child club', () => {
    expect(resolveClubDetailsActionMatrix({
      clubHasTeams: true,
      hasParentMultisportClub: true,
      isAuthenticated: true,
      isMultisportAdmin: true,
    })).toMatchObject({
      showClubInterestAction: false,
    });
  });

  it('uses interest as a fallback for an authenticated unattached visitor', () => {
    expect(resolveClubDetailsActionMatrix({
      clubHasTeams: true,
      isAuthenticated: true,
      ownerCount: 1,
    })).toMatchObject({
      showClubInterestAction: true,
      showJoinClubAction: false,
      showPlayerClubAction: false,
    });
  });

  // D95 — temoin principal. 222 287 clubs sur 222 294 n'ont aucune equipe : le
  // joueur qui en ouvre un doit repartir avec un geste fait, pas avec un mur.
  // Avant D95 il ne voyait que « Je dirige ce club » (showClubPartneringAction).
  it('offers to bring the club over when a player opens a club without any team', () => {
    expect(resolveClubDetailsActionMatrix({
      canPlayerSignalMissingTeam: true,
      clubHasTeams: false,
      isAuthenticated: true,
      isPlayerRole: true,
    })).toMatchObject({
      showClubInterestAction: false,
      showClubPartneringAction: false,
      showEmptyClubClaimAction: false,
      showPlayerClubAction: false,
      showPlayerNoTeamAction: true,
    });
  });

  // D95 — non-regression, REECRITE par V01 (2026-08-18).
  //
  // Ce que D95 protegeait est INTACT : sur un club qui a une equipe, le joueur
  // garde « Je fais partie de ce club » et n'attrape ni « C'est mon club » ni
  // « Je dirige ce club ». Ce qui change, et seulement cela : l'interet cesse
  // d'etre un repli et s'affiche A COTE.
  it('keeps the player affiliation on a club with teams, and adds the interest door', () => {
    expect(resolveClubDetailsActionMatrix({
      canPlayerSignalClubTeam: true,
      canPlayerSignalMissingTeam: false,
      clubHasTeams: true,
      isAuthenticated: true,
      isPlayerRole: true,
    })).toMatchObject({
      showClubInterestAction: true,
      showClubPartneringAction: false,
      showPlayerClubAction: true,
      showPlayerNoTeamAction: false,
    });
  });

  // D95 — le coach garde son parcours « club partenaire » sur un club sans equipe.
  it('keeps the partnering flow for a coach on a club without teams', () => {
    expect(resolveClubDetailsActionMatrix({
      canUseClubPartneringFlow: true,
      clubHasTeams: false,
      isAuthenticated: true,
    })).toMatchObject({
      showClubPartneringAction: true,
      showPlayerNoTeamAction: false,
    });
  });

  // D98 — temoin 1. ~28 500 pages de clubs sont indexables par Google et la fiche
  // club est donc la principale porte d'entree du produit. Le visiteur anonyme n'y
  // avait qu'UNE action, « Je dirige ce club » : une phrase qu'un joueur ou un
  // parent ne peut pas signer honnetement. Il lui faut sa propre porte.
  it('offers an anonymous visitor to play at the club, not only to run it', () => {
    expect(resolveClubDetailsActionMatrix({
      isAuthenticated: false,
    })).toMatchObject({
      showPublicClaimLogin: true,
      showPublicPlayerLogin: true,
    });
  });

  // D98 — temoin 1 bis. La porte du joueur ne depend PAS de l'etat du club :
  // 222 287 clubs sur 222 294 n'ont aucune equipe (2026-08-13), c'est le cas
  // majoritaire d'une page indexee, pas un cas limite.
  it('offers the anonymous player door on a club without any team', () => {
    expect(resolveClubDetailsActionMatrix({
      clubHasTeams: false,
      isAuthenticated: false,
    })).toMatchObject({
      showPublicClaimLogin: true,
      showPublicPlayerLogin: true,
    });
  });

  // D98 — temoin 3. Les DEUX portes de l'anonyme mènent a la connexion : aucune
  // action d'ENVOI ne doit s'allumer sans compte. `canShowAffiliationAction` exige
  // `isAuthenticated`, ce test le verrouille contre une regression future.
  it('never exposes a sending action to an anonymous visitor', () => {
    expect(resolveClubDetailsActionMatrix({
      areClubMembersHidden: true,
      canContactAdmin: true,
      canEdit: true,
      canJoinClub: true,
      canLeaveClub: true,
      canPlayerSignalClubTeam: true,
      canPlayerSignalMissingTeam: true,
      canUseClubPartneringFlow: true,
      clubHasTeams: true,
      isAuthenticated: false,
      isPlayerRole: true,
      ownerCount: 3,
    })).toEqual({
      showClubArrivalInterestAction: false,
      showClubInterestAction: false,
      showClubPartneringAction: false,
      showContactAdminClaimAction: false,
      showEmptyClubClaimAction: false,
      showJoinClubAction: false,
      showLeaveClubAction: false,
      showPlayerClubAction: false,
      showPlayerNoTeamAction: false,
      showPublicClaimLogin: true,
      showPublicPlayerLogin: true,
    });
  });

  // ---------------------------------------------------------------------------
  // S02 — « Moi je veux DEUX BOUTONS » (Adel, 2026-08-16).
  //
  // Le defaut repare ici : sur un club SANS equipe, la fiche n'offrait qu'UNE
  // porte, et elle disait la meme chose a tout le monde — « j'y suis deja ».
  // Or presque tout visiteur tombe sur un club absent de l'app (222 287 clubs
  // sur 222 294 n'ont aucune equipe, mesure prod du 2026-08-13) : celui qui n'y
  // est PAS ENCORE n'avait nulle part ou se declarer, et repartait.
  // ---------------------------------------------------------------------------
  describe('S02 · les deux portes d\'un club sans equipe', () => {
    // Temoin principal.
    it('shows BOTH doors when a player opens a club without any team', () => {
      expect(resolveClubDetailsActionMatrix({
        canPlayerSignalMissingTeam: true,
        clubHasTeams: false,
        isAuthenticated: true,
        isPlayerRole: true,
      })).toMatchObject({
        showClubArrivalInterestAction: true,
        showPlayerNoTeamAction: true,
      });
    });

    // Le compte SANS ROLE est le profil le plus courant apres le visiteur
    // anonyme (40 comptes sur 118 en prod, 2026-08-13). Il n'avait strictement
    // que « Je dirige ce club », une phrase qu'il ne peut pas signer.
    it('shows the arrival door to a signed-in account without any role', () => {
      expect(resolveClubDetailsActionMatrix({
        clubHasTeams: false,
        isAuthenticated: true,
      })).toMatchObject({
        showClubArrivalInterestAction: true,
        showEmptyClubClaimAction: true,
      });
    });

    // 🔒 LA NON-REGRESSION QUI COMPTE. Sur un club QUI A une equipe, la seconde
    // porte reste eteinte : c'est `showClubInterestAction` (l'interet pour une
    // EQUIPE precise) qui continue de jouer ce role, inchange.
    it('leaves a club WITH teams without any arrival door', () => {
      expect(resolveClubDetailsActionMatrix({
        clubHasTeams: true,
        isAuthenticated: true,
        ownerCount: 1,
      })).toMatchObject({
        showClubArrivalInterestAction: false,
        showClubInterestAction: true,
      });
    });

    // Aucune action d'ENVOI sans compte : la 2e porte enregistre un interet
    // nominatif, elle ne peut donc pas s'allumer pour un visiteur anonyme.
    it('never offers the arrival door to an anonymous visitor', () => {
      expect(resolveClubDetailsActionMatrix({
        clubHasTeams: false,
        isAuthenticated: false,
      })).toMatchObject({
        showClubArrivalInterestAction: false,
      });
    });

    // Un dirigeant de CE club n'a rien a attendre : il y est.
    it('never offers the arrival door to someone already in the club', () => {
      expect(resolveClubDetailsActionMatrix({
        canEdit: true,
        clubHasTeams: false,
        isAuthenticated: true,
        isUserAlreadyAttachedToViewedClub: true,
      })).toMatchObject({
        showClubArrivalInterestAction: false,
      });
    });
  });

  // D98 — temoin 2, LE TEMOIN QUI COMPTE. Un visiteur CONNECTE ne voit rien
  // changer. `toEqual` compare l'objet ENTIER : si D98 allumait ou eteignait quoi
  // que ce soit pour un compte connecte, ces 4 profils le diraient.
  //
  // ⚠️ S02 a AJOUTE une clef a l'objet rendu (`showClubArrivalInterestAction`) et
  // ces 4 profils la portent donc desormais. Elle vaut `false` partout ou le club
  // a une equipe — les 2 profils « sans equipe » sont les seuls a changer, et
  // c'est exactement le lot.
  describe('D98 · temoin 2 — un visiteur connecte ne voit RIEN changer', () => {
    // ⚠️ V01 — ce profil CHANGE, et c'est EXACTEMENT la demande d'Adel : le
    // joueur qui ouvre un club qui n'est pas le sien voit desormais les deux
    // boutons. Toute la reste de sa ligne est identique a D98.
    it('gives a player on a club with teams the second door, and nothing else changes', () => {
      expect(resolveClubDetailsActionMatrix({
        canPlayerSignalClubTeam: true,
        clubHasTeams: true,
        isAuthenticated: true,
        isPlayerRole: true,
      })).toEqual({
        showClubArrivalInterestAction: false,
        showClubInterestAction: true,
        showClubPartneringAction: false,
        showContactAdminClaimAction: false,
        showEmptyClubClaimAction: false,
        showJoinClubAction: false,
        showLeaveClubAction: false,
        showPlayerClubAction: true,
        showPlayerNoTeamAction: false,
        showPublicClaimLogin: false,
        showPublicPlayerLogin: false,
      });
    });

    // ⚠️ S02 — ce profil CHANGE, et c'est voulu : le joueur d'un club sans equipe
    // gagne la 2e porte. Tout le reste de sa ligne est identique a D98.
    it('leaves a player on a club without any team untouched', () => {
      expect(resolveClubDetailsActionMatrix({
        canPlayerSignalMissingTeam: true,
        clubHasTeams: false,
        isAuthenticated: true,
        isPlayerRole: true,
      })).toEqual({
        showClubArrivalInterestAction: true,
        showClubInterestAction: false,
        showClubPartneringAction: false,
        showContactAdminClaimAction: false,
        showEmptyClubClaimAction: false,
        showJoinClubAction: false,
        showLeaveClubAction: false,
        showPlayerClubAction: false,
        showPlayerNoTeamAction: true,
        showPublicClaimLogin: false,
        showPublicPlayerLogin: false,
      });
    });

    it('leaves an attached dirigeant untouched', () => {
      expect(resolveClubDetailsActionMatrix({
        canContactAdmin: true,
        canLeaveClub: true,
        clubHasTeams: true,
        isAuthenticated: true,
        ownerCount: 1,
      })).toEqual({
        showClubArrivalInterestAction: false,
        showClubInterestAction: false,
        showClubPartneringAction: false,
        showContactAdminClaimAction: false,
        showEmptyClubClaimAction: false,
        showJoinClubAction: false,
        showLeaveClubAction: true,
        showPlayerClubAction: false,
        showPlayerNoTeamAction: false,
        showPublicClaimLogin: false,
        showPublicPlayerLogin: false,
      });
    });

    // ⚠️ S02 — ce profil CHANGE lui aussi, et de la meme facon : « Je dirige ce
    // club » reste sa porte primaire, la 2e s'ajoute a cote.
    it('leaves a coach on a partner club without teams untouched', () => {
      expect(resolveClubDetailsActionMatrix({
        canUseClubPartneringFlow: true,
        clubHasTeams: false,
        isAuthenticated: true,
      })).toEqual({
        showClubArrivalInterestAction: true,
        showClubInterestAction: false,
        showClubPartneringAction: true,
        showContactAdminClaimAction: false,
        showEmptyClubClaimAction: false,
        showJoinClubAction: false,
        showLeaveClubAction: false,
        showPlayerClubAction: false,
        showPlayerNoTeamAction: false,
        showPublicClaimLogin: false,
        showPublicPlayerLogin: false,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // V01 — « je dois voir DEUX boutons » (Adel, 2026-08-18).
  //
  // Le defaut repare ici : sur un club QUI A une equipe, le drapeau
  // `hasPrimaryAffiliationAction` eteignait l'interet des qu'une action
  // d'affiliation s'allumait. Le joueur de passage n'avait donc qu'un seul
  // geste possible, et il affirmait une appartenance : « Je fais partie de ce
  // club ». Celui qui n'y est PAS ENCORE ne pouvait rien dire.
  //
  // S02 avait deja fait cohabiter les deux portes sur un club SANS equipe. V01
  // fait la meme chose sur un club qui EN A — c'est la moitie qui manquait.
  // ---------------------------------------------------------------------------
  describe("V01 · les deux portes d'un club AVEC equipes", () => {
    // LE TEMOIN PRINCIPAL.
    it('shows BOTH doors when a player opens a club with teams', () => {
      expect(resolveClubDetailsActionMatrix({
        canPlayerSignalClubTeam: true,
        clubHasTeams: true,
        isAuthenticated: true,
        isPlayerRole: true,
      })).toMatchObject({
        showClubInterestAction: true,
        showPlayerClubAction: true,
      });
    });

    // 🔒 NON-REGRESSION — un joueur DEJA dans ce club n'y a plus rien a
    // demander : ni « je fais partie de ce club », ni « interesse ». C'est
    // `canPlayerSignalClubTeam` qui s'eteint en amont, et
    // `isUserAlreadyAttachedToViewedClub` qui ferme la seconde porte ici.
    it('never shows either door to a player already in the club', () => {
      expect(resolveClubDetailsActionMatrix({
        canPlayerSignalClubTeam: false,
        clubHasTeams: true,
        isAuthenticated: true,
        isPlayerRole: true,
        isUserAlreadyAttachedToViewedClub: true,
      })).toMatchObject({
        showClubInterestAction: false,
        showPlayerClubAction: false,
      });
    });

    // 🔒 NON-REGRESSION — un dirigeant de CE club garde « Quitter le club » et
    // rien d'autre : `canShowAffiliationAction` exige `!showLeaveClubAction`.
    it('never shows the interest door to a dirigeant of the viewed club', () => {
      expect(resolveClubDetailsActionMatrix({
        canEdit: true,
        canLeaveClub: true,
        clubHasTeams: true,
        isAuthenticated: true,
        isUserAlreadyAttachedToViewedClub: true,
        ownerCount: 1,
      })).toMatchObject({
        showClubInterestAction: false,
        showLeaveClubAction: true,
      });
    });

    // 🔒 NON-REGRESSION — les deux portes ne se marchent JAMAIS dessus :
    // `showClubInterestAction` exige des equipes, `showClubArrivalInterestAction`
    // exige qu'il n'y en ait aucune. Un club ne peut pas etre dans les deux cas.
    it('never lights the two interest doors at the same time', () => {
      const avecEquipes = resolveClubDetailsActionMatrix({
        canPlayerSignalClubTeam: true,
        clubHasTeams: true,
        isAuthenticated: true,
        isPlayerRole: true,
      });
      const sansEquipe = resolveClubDetailsActionMatrix({
        canPlayerSignalMissingTeam: true,
        clubHasTeams: false,
        isAuthenticated: true,
        isPlayerRole: true,
      });

      expect(avecEquipes.showClubArrivalInterestAction).toBe(false);
      expect(sansEquipe.showClubInterestAction).toBe(false);
    });
  });
  // ---------------------------------------------------------------------------
  // Z01 — « les dirigeants et entraineurs voient les deux boutons "me prevenir
  // quand le club arrive" alors qu'eux doivent juste avoir le bouton "C'est mon
  // club" » (Adel, 2026-08-20, capture a l'appui).
  //
  // Ce que la regle dit, et rien de plus : la porte « prevenez-moi quand ce club
  // arrive » est celle de quelqu'un qui ATTEND le club. Un dirigeant ou un
  // entraineur n'attend pas : il peut le faire venir lui-meme, et c'est
  // exactement ce que dit sa propre porte. Les deux ensemble se contredisent.
  //
  // 🔒 Le joueur et le visiteur deconnecte ne bougent PAS : Adel a valide leur
  // cas au tour precedent (« sur la fiche d'un club qui n'est pas le tien : les
  // deux boutons cohabitent » → « oui », 2026-08-18). C'est pour ca que le
  // drapeau s'appelle `isClubStaffRole` et non `!isPlayerRole` : le compte SANS
  // ROLE (40 comptes sur 118 en production au 2026-08-13) garde ses deux portes.
  // ---------------------------------------------------------------------------
  describe('Z01 · un encadrant ne voit pas la porte de celui qui attend', () => {
    // 🎯 TEMOIN 1 — le cas d'Adel, cote dirigeant. `toEqual` compare l'objet
    // ENTIER : « et RIEN d'autre » est donc verifie, pas seulement suppose.
    it('gives a dirigeant on an unclaimed club his claim door and NOTHING else', () => {
      expect(resolveClubDetailsActionMatrix({
        canContactAdmin: true,
        clubHasTeams: false,
        isAuthenticated: true,
        isClubStaffRole: true,
        ownerCount: 0,
      })).toEqual({
        showClubArrivalInterestAction: false,
        showClubInterestAction: false,
        showClubPartneringAction: false,
        showContactAdminClaimAction: false,
        showEmptyClubClaimAction: true,
        showJoinClubAction: false,
        showLeaveClubAction: false,
        showPlayerClubAction: false,
        showPlayerNoTeamAction: false,
        showPublicClaimLogin: false,
        showPublicPlayerLogin: false,
      });
    });

    // 🎯 TEMOIN 2 — le meme club, cote entraineur. C'est CE profil qui est sur la
    // capture d'Adel : `canJoinClub` vaut `coach` (useAuth.js:626) et son bouton
    // s'intitule « C'est mon club ! » des que le club n'a aucun dirigeant visible.
    it('gives a coach on the same club his join door and NOTHING else', () => {
      expect(resolveClubDetailsActionMatrix({
        canJoinClub: true,
        clubHasTeams: false,
        isAuthenticated: true,
        isClubStaffRole: true,
        ownerCount: 0,
      })).toEqual({
        showClubArrivalInterestAction: false,
        showClubInterestAction: false,
        showClubPartneringAction: false,
        showContactAdminClaimAction: false,
        showEmptyClubClaimAction: false,
        showJoinClubAction: true,
        showLeaveClubAction: false,
        showPlayerClubAction: false,
        showPlayerNoTeamAction: false,
        showPublicClaimLogin: false,
        showPublicPlayerLogin: false,
      });
    });

    // 🔒 TEMOIN 3 — LA NON-REGRESSION VALIDEE PAR ADEL. Le joueur garde
    // EXACTEMENT ses deux portes sur ce meme club. `toEqual` : si Z01 en eteint
    // une seule, cette ligne le dit.
    it('keeps EXACTLY both doors for a player on the same club', () => {
      expect(resolveClubDetailsActionMatrix({
        canPlayerSignalMissingTeam: true,
        clubHasTeams: false,
        isAuthenticated: true,
        isPlayerRole: true,
        ownerCount: 0,
      })).toEqual({
        showClubArrivalInterestAction: true,
        showClubInterestAction: false,
        showClubPartneringAction: false,
        showContactAdminClaimAction: false,
        showEmptyClubClaimAction: false,
        showJoinClubAction: false,
        showLeaveClubAction: false,
        showPlayerClubAction: false,
        showPlayerNoTeamAction: true,
        showPublicClaimLogin: false,
        showPublicPlayerLogin: false,
      });
    });

    // 🔒 TEMOIN 3 bis — le compte SANS ROLE n'est ni dirigeant ni entraineur : il
    // garde lui aussi ses deux portes. C'est ce qui distingue `isClubStaffRole`
    // d'un simple `!isPlayerRole`, qui aurait emporte ce profil au passage.
    it('keeps both doors for a signed-in account without any role', () => {
      expect(resolveClubDetailsActionMatrix({
        clubHasTeams: false,
        isAuthenticated: true,
        ownerCount: 0,
      })).toMatchObject({
        showClubArrivalInterestAction: true,
        showEmptyClubClaimAction: true,
      });
    });

    // 🔒 TEMOIN 4 — le visiteur deconnecte ne change pas, et le drapeau d'Z01 ne
    // fuit pas jusqu'a lui : meme en le forçant, ses deux portes de connexion
    // restent les seules allumees.
    it('leaves an anonymous visitor untouched, even when flagged as staff', () => {
      expect(resolveClubDetailsActionMatrix({
        clubHasTeams: false,
        isAuthenticated: false,
        isClubStaffRole: true,
        ownerCount: 0,
      })).toEqual({
        showClubArrivalInterestAction: false,
        showClubInterestAction: false,
        showClubPartneringAction: false,
        showContactAdminClaimAction: false,
        showEmptyClubClaimAction: false,
        showJoinClubAction: false,
        showLeaveClubAction: false,
        showPlayerClubAction: false,
        showPlayerNoTeamAction: false,
        showPublicClaimLogin: true,
        showPublicPlayerLogin: true,
      });
    });

    // 🔒 TEMOIN 7 — le dirigeant de SON PROPRE club ne voit apparaitre aucune de
    // ces portes : `canShowAffiliationAction` exige `!showLeaveClubAction`, et il
    // les eteint donc toutes en amont. Z01 ne doit rien y changer.
    it('never opens any of these doors for a dirigeant of his OWN club', () => {
      expect(resolveClubDetailsActionMatrix({
        canContactAdmin: true,
        canEdit: true,
        canLeaveClub: true,
        clubHasTeams: false,
        isAuthenticated: true,
        isClubStaffRole: true,
        isUserAlreadyAttachedToViewedClub: true,
        ownerCount: 1,
      })).toEqual({
        showClubArrivalInterestAction: false,
        showClubInterestAction: false,
        showClubPartneringAction: false,
        showContactAdminClaimAction: false,
        showEmptyClubClaimAction: false,
        showJoinClubAction: false,
        showLeaveClubAction: true,
        showPlayerClubAction: false,
        showPlayerNoTeamAction: false,
        showPublicClaimLogin: false,
        showPublicPlayerLogin: false,
      });
    });

    // 🔒 TEMOIN 7 bis — le meme controle pour l'entraineur de son propre club.
    it('never opens any of these doors for a coach of his OWN club', () => {
      expect(resolveClubDetailsActionMatrix({
        canJoinClub: true,
        canLeaveClub: true,
        clubHasTeams: true,
        isAuthenticated: true,
        isClubStaffRole: true,
        isUserAlreadyAttachedToViewedClub: true,
        ownerCount: 1,
      })).toMatchObject({
        showClubArrivalInterestAction: false,
        showClubInterestAction: false,
        showJoinClubAction: false,
        showLeaveClubAction: true,
      });
    });
  });
});
