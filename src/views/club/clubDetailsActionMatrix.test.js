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
});
