import {
  annulationHorsDelai,
  estDemain,
  etatDeLaVeille,
  joursDeMesReservations,
  PERIODES_DE_MES_RESERVATIONS,
} from '@/domains/complexe/reservationsDuJoueur';
import { etatAffiche } from '@/domains/complexe/reserverTerrain';

// RESA-L6B-1 (19/10/2026) — le joueur : la confirmation la veille (E-P14) et « Mes réservations »
// (E-P10). Plan `docs/PLAN_ECRANS_RESERVATION_2026-10-13.md` E-P14 (:1765-1803), E-P10
// (:1618-1655) ; planches EP14 et EP10 (toile BLG79NHv2, « planches ok » du 13/10). Serveur
// RESA-L2B (`toPlayerView` : canAnswerDayBefore, dayBeforeAskedAt, dayBeforeConfirmedAt, noShowAt).

const MAINTENANT = new Date('2026-10-15T16:30:00Z'); // mercredi 15/10, 18 h 30 à Paris

/**
 * Une réservation de demain 19 h, la question de la veille posée.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La réservation.
 */
const deDemain = (autres = {}) => ({
  canAnswerDayBefore: true,
  cancellableUntil: '2026-10-15T17:00:00.000Z',
  cancelledBy: null,
  date: '2026-10-16',
  dayBeforeAskedAt: '2026-10-15T16:00:00.000Z',
  dayBeforeConfirmedAt: null,
  endsAt: '2026-10-16T18:00:00.000Z',
  startsAt: '2026-10-16T17:00:00.000Z',
  status: 'confirmee',
  ...autres,
});

describe('E-P14 — l’état de la veille, d’après la réservation du serveur', () => {
  it('la question posée, pas encore de réponse : « Je confirme » / « J’annule »', () => {
    expect(etatDeLaVeille(deDemain(), MAINTENANT)).toBe('aRepondre');
  });

  it('déjà confirmée (« Tu as confirmé à 18 h 12. »)', () => {
    const confirmee = deDemain({ dayBeforeConfirmedAt: '2026-10-15T16:12:00.000Z' });
    expect(etatDeLaVeille(confirmee, MAINTENANT)).toBe('dejaConfirmee');
  });

  it('déjà annulée par toi, ou annulée par le complexe entre-temps', () => {
    expect(etatDeLaVeille(
      deDemain({ canAnswerDayBefore: false, cancelledBy: 'reserveur', status: 'annulee' }),
      MAINTENANT,
    )).toBe('dejaAnnulee');
    expect(etatDeLaVeille(
      deDemain({ canAnswerDayBefore: false, cancelledBy: 'complexe', status: 'annulee' }),
      MAINTENANT,
    )).toBe('annuleeParLeComplexe');
  });

  it('le créneau a commencé : « Trop tard pour confirmer. »', () => {
    const commence = new Date('2026-10-16T17:05:00Z');
    expect(etatDeLaVeille(deDemain({ canAnswerDayBefore: false }), commence)).toBe('tropTard');
  });

  it('aucune question posée (ou une demande en attente) : rien à demander ⇒ la fiche', () => {
    const sansQuestion = deDemain({ canAnswerDayBefore: false, dayBeforeAskedAt: null });
    expect(etatDeLaVeille(sansQuestion, MAINTENANT)).toBe('rienADemander');
    const demande = deDemain({ canAnswerDayBefore: false, status: 'en_attente' });
    expect(etatDeLaVeille(demande, MAINTENANT)).toBe('rienADemander');
    expect(etatDeLaVeille(null, MAINTENANT)).toBe('rienADemander');
  });

  it('AT-07 : après le délai d’annulation figé, « J’annule » sera « hors délai »', () => {
    expect(annulationHorsDelai(deDemain(), MAINTENANT)).toBe(false);
    expect(annulationHorsDelai(deDemain(), new Date('2026-10-15T17:30:00Z'))).toBe(true);
    expect(annulationHorsDelai(deDemain({ cancellableUntil: null }), MAINTENANT)).toBe(false);
  });

  it('« demain », au jour de Paris (la question part la veille à 18 h)', () => {
    expect(estDemain('2026-10-16', MAINTENANT)).toBe(true);
    expect(estDemain('2026-10-15', MAINTENANT)).toBe(false);
    // 23 h 30 à Paris le 15 = 21 h 30 UTC : demain reste le 16.
    expect(estDemain('2026-10-16', new Date('2026-10-15T21:30:00Z'))).toBe(true);
  });
});

describe('E-P10 — « Mes réservations »', () => {
  it('trois onglets dans ce lot, dans l’ordre de la planche (« En collecte » attend L3)', () => {
    expect(PERIODES_DE_MES_RESERVATIONS).toEqual(['a-venir', 'passees', 'refusees']);
  });

  it('la liste groupée par jour, dans l’ordre du serveur', () => {
    const jours = joursDeMesReservations([
      { date: '2026-10-14', documentId: 'a' },
      { date: '2026-10-18', documentId: 'b' },
      { date: '2026-10-18', documentId: 'c' },
      { date: '2026-10-19', documentId: 'd' },
    ]);
    expect(jours.map((jour) => [jour.date, jour.reservations.map((r) => r.documentId)])).toEqual([
      ['2026-10-14', ['a']],
      ['2026-10-18', ['b', 'c']],
      ['2026-10-19', ['d']],
    ]);
    expect(joursDeMesReservations(null)).toEqual([]);
  });

  it('« Non honorée » : une confirmée passée que le complexe a marquée (L2B, `noShowAt`)', () => {
    const passee = { endsAt: '2026-10-11T18:00:00.000Z', status: 'confirmee' };
    expect(etatAffiche(passee, MAINTENANT)).toBe('jouee');
    expect(etatAffiche({ ...passee, noShowAt: '2026-10-11T19:00:00.000Z' }, MAINTENANT))
      .toBe('nonHonoree');
  });
});
