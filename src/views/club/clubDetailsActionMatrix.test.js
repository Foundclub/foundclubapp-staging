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
});
