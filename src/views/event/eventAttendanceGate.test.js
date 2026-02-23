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
});
