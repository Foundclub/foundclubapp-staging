import { isExpiredDetectionRecruitmentAd } from '../recruitmentService';

// BH15 · P2-05 — une annonce de détection datée « 2026-09-10 » reste visible le 10/09 au matin.
jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));

const annonce = (/** @type {any} */ event) => ({
  event: { documentId: 'evt1', type: { name: 'Détection' }, ...event },
});

describe('isExpiredDetectionRecruitmentAd', () => {
  it("n'expire pas le jour même d'une date sans heure", () => {
    const jour = annonce({ date: '2026-09-10' });
    expect(isExpiredDetectionRecruitmentAd(jour, new Date(2026, 8, 10, 8, 0))).toBe(false);
  });

  it('expire le lendemain', () => {
    const jour = annonce({ date: '2026-09-10' });
    expect(isExpiredDetectionRecruitmentAd(jour, new Date(2026, 8, 11, 0, 1))).toBe(true);
  });

  it("tient compte de l'heure de début quand elle existe", () => {
    const soir = annonce({ date: '2026-09-10', startTime: '18:00:00.000' });
    expect(isExpiredDetectionRecruitmentAd(soir, new Date(2026, 8, 10, 17, 0))).toBe(false);
    expect(isExpiredDetectionRecruitmentAd(soir, new Date(2026, 8, 10, 19, 0))).toBe(true);
  });
});
