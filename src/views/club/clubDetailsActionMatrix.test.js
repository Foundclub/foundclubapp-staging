import { resolveClubDetailsActionMatrix } from './clubDetailsActionMatrix';

describe('resolveClubDetailsActionMatrix', () => {
  it('shows join for an unattached coach without the interest fallback', () => {
    expect(resolveClubDetailsActionMatrix({
      canJoinClub: true,
      clubHasTeams: true,
      isAuthenticated: true,
    })).toMatchObject({
      showClubInterestAction: false,
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

  it('shows player affiliation instead of the interest fallback', () => {
    expect(resolveClubDetailsActionMatrix({
      canPlayerSignalClubTeam: true,
      clubHasTeams: true,
      isAuthenticated: true,
      isPlayerRole: true,
    })).toMatchObject({
      showClubInterestAction: false,
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

  // D95 — non-regression. Un club QUI A une equipe ne bouge pas d'un pixel.
  it('leaves a club with teams exactly as it was for a player', () => {
    expect(resolveClubDetailsActionMatrix({
      canPlayerSignalClubTeam: true,
      canPlayerSignalMissingTeam: false,
      clubHasTeams: true,
      isAuthenticated: true,
      isPlayerRole: true,
    })).toMatchObject({
      showClubInterestAction: false,
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

  // D98 — temoin 2, LE TEMOIN QUI COMPTE. Un visiteur CONNECTE ne voit rien
  // changer. `toEqual` compare l'objet ENTIER : si D98 allumait ou eteignait quoi
  // que ce soit pour un compte connecte, ces 4 profils le diraient.
  describe('D98 · temoin 2 — un visiteur connecte ne voit RIEN changer', () => {
    it('leaves a player on a club with teams untouched', () => {
      expect(resolveClubDetailsActionMatrix({
        canPlayerSignalClubTeam: true,
        clubHasTeams: true,
        isAuthenticated: true,
        isPlayerRole: true,
      })).toEqual({
        showClubInterestAction: false,
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

    it('leaves a player on a club without any team untouched', () => {
      expect(resolveClubDetailsActionMatrix({
        canPlayerSignalMissingTeam: true,
        clubHasTeams: false,
        isAuthenticated: true,
        isPlayerRole: true,
      })).toEqual({
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

    it('leaves a coach on a partner club without teams untouched', () => {
      expect(resolveClubDetailsActionMatrix({
        canUseClubPartneringFlow: true,
        clubHasTeams: false,
        isAuthenticated: true,
      })).toEqual({
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
});
