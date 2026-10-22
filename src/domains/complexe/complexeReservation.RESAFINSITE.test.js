import { demandeExpiree } from './complexeReservation';

// RESA-FIN-SITE (21/10/2026) — RG-DELAIS : une demande expire à `expiresAt` (début du créneau moins le
// délai minimum). Passé ce moment, le gérant ne la tranche plus (E-G05, E-G06).
describe('demandeExpiree', () => {
  const maintenant = new Date('2026-10-21T18:00:00.000Z');

  it('vraie une fois l échéance passée, ou atteinte', () => {
    expect(demandeExpiree('2026-10-21T17:59:00.000Z', maintenant)).toBe(true);
    expect(demandeExpiree('2026-10-21T18:00:00.000Z', maintenant)).toBe(true);
  });

  it('fausse avant l échéance, sans échéance, ou avec une échéance illisible', () => {
    expect(demandeExpiree('2026-10-21T18:01:00.000Z', maintenant)).toBe(false);
    expect(demandeExpiree(null, maintenant)).toBe(false);
    expect(demandeExpiree('pas une date', maintenant)).toBe(false);
  });
});
