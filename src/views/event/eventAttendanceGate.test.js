import { resolveEventAttendanceGate } from './eventAttendanceGate';

describe('resolveEventAttendanceGate', () => {
  test('should allow attendance access and self arrival for accepted external participant', () => {
    const result = resolveEventAttendanceGate({
      canEdit: false,
      isCurrentUserParticipating: true,
      isTeamMember: false,
    });

    expect(result).toEqual({
      canAccessAttendance: true,
      canSelfMarkArrival: true,
    });
  });

  test('should deny attendance access and self arrival for non participant external user', () => {
    const result = resolveEventAttendanceGate({
      canEdit: false,
      isCurrentUserParticipating: false,
      isTeamMember: false,
    });

    expect(result).toEqual({
      canAccessAttendance: false,
      canSelfMarkArrival: false,
    });
  });

  test('should deny self arrival for coach/manager even if participating', () => {
    const result = resolveEventAttendanceGate({
      canEdit: true,
      isCurrentUserParticipating: true,
      isTeamMember: true,
    });

    expect(result).toEqual({
      canAccessAttendance: true,
      canSelfMarkArrival: false,
    });
  });

  // -------------------------------------------------------------------------
  // L5-0 (vague P, 23/08) — LE DIRIGEANT ORGANISATEUR QUI N EST PAS DE L EQUIPE.
  //
  // Il organise l evenement, donc `canEdit`. Mais il n est ni au roster
  // (`isTeamMember` faux) ni inscrit (`isCurrentUserParticipating` faux) :
  // la grille lui refusait l acces, et la carte « Faire l appel » ne
  // s affichait pas. Cote serveur il POUVAIT pourtant deja pointer les autres
  // (`api::event.is-event-trainer` accepte `canManageTeam`). Le lot admin du
  // meme jour aligne la lecture sur l ecriture ; cette grille suit.
  // -------------------------------------------------------------------------

  test('L5-0 — un dirigeant organisateur hors equipe accede a l appel', () => {
    const result = resolveEventAttendanceGate({
      canEdit: true,
      isCurrentUserParticipating: false,
      isTeamMember: false,
    });

    expect(result).toEqual({
      canAccessAttendance: true,
      canSelfMarkArrival: false,
    });
  });

  test('L5-0 — celui qui peut gerer ne se pointe JAMAIS lui-meme comme joueur', () => {
    // 🔒 `canSelfMarkArrival` ne bouge pas d un pouce : un dirigeant pointe
    // les autres, il ne se pointe pas. Les deux cas ou il est aussi inscrit
    // sont deja tenus par le temoin « coach/manager » ci-dessus ; celui-ci
    // fige le cas neuf (hors equipe, non inscrit).
    const result = resolveEventAttendanceGate({
      canEdit: true,
      isCurrentUserParticipating: false,
      isTeamMember: false,
    });

    expect(result.canSelfMarkArrival).toBe(false);
  });

  test('🔒 L5-0 — on n a ouvert a personne d autre : sans droit, rien ne change', () => {
    // Un simple spectateur reste dehors. C est le temoin qui interdit de
    // « reparer » en ouvrant la grille a tout le monde.
    expect(resolveEventAttendanceGate({
      canEdit: false,
      isCurrentUserParticipating: false,
      isTeamMember: false,
    })).toEqual({
      canAccessAttendance: false,
      canSelfMarkArrival: false,
    });
  });
});
