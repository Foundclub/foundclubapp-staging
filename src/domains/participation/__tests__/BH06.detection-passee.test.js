import { USER_ROLES } from '@/domains/auth/authUseCases';
import { resolveParticipationFlow } from '@/domains/participation/participationFlow';

// 🐞 BUGHUNT P1-06 (BH06) — une DÉTECTION déjà passée restait ouverte aux réponses,
// et le joueur qui avait déjà répondu voyait la porte fermée SANS motif.

const joueur = { documentId: 'player-1', role: { name: USER_ROLES.player } };
const detection = (/** @type {Record<string, any>} */ extra = {}) => ({
  date: '2020-05-01T10:00:00.000Z',
  participations: [],
  type: { name: 'Détection' },
  ...extra,
});

describe('BH06 P1-06 — détection passée', () => {
  test('date passée : on ne peut plus agir, et on dit pourquoi', () => {
    const flow = resolveParticipationFlow(detection(), { detectionSlotsCount: 3, user: joueur });
    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).not.toBe('');
  });

  test('déjà répondu : porte fermée AVEC un motif', () => {
    const flow = resolveParticipationFlow(detection({ date: '2099-05-01T10:00:00.000Z' }), {
      detectionSlotsCount: 3,
      participationState: { isParticipating: true },
      user: joueur,
    });
    expect(flow.canAct).toBe(false);
    expect(flow.blockedReason).not.toBe('');
  });

  test('détection future, joueur sans réponse : ouverte', () => {
    const flow = resolveParticipationFlow(detection({ date: '2099-05-01T10:00:00.000Z' }), {
      detectionSlotsCount: 3,
      user: joueur,
    });
    expect(flow.canAct).toBe(true);
    expect(flow.blockedReason).toBe('');
  });
});
