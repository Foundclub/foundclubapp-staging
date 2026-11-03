import {
  annulationHorsDelai,
  creneauxDeMesReservations,
  estAuPlanning,
  estDemain,
  etatDeLaVeille,
  joursDeMesReservations,
  joursDeMesReservationsAVenir,
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

// T3-RESA-PLANNING (03/11, Adel « 9- A ») — la réservation entre au planning du joueur.
describe('créneaux de mes réservations au planning', () => {
  const PLAGE = { from: '2026-11-02', to: '2026-11-08' };
  const t = (
    /** @type {string} */ _cle,
    /** @type {string} */ repli,
    /** @type {any} */ options,
  ) => repli.replace('{{complexe}}', options?.complexe);
  const reservation = (/** @type {object} */ champs = {}) => ({
    complexe: { name: 'Complexe Test' },
    date: '2026-11-05',
    documentId: 'resa-1',
    endsAt: '2026-11-05T19:00:00.000Z',
    from: '19:00',
    role: 'reserveur',
    startsAt: '2026-11-05T18:00:00.000Z',
    status: 'confirmee',
    terrain: { name: 'Terrain 1' },
    to: '20:00',
    ...champs,
  });

  test('ROUGE-AVANT — une réservation confirmée devient un bloc du planning, à ses heures', () => {
    const [bloc] = creneauxDeMesReservations(t, [reservation()], PLAGE);
    expect(bloc).toMatchObject({
      documentId: 'resa-1',
      endTime: '20:00',
      location: 'Terrain 1',
      startAt: '2026-11-05T18:00:00.000Z',
      startTime: '19:00',
      title: 'Complexe Test',
    });
    // Un `typeLabel` passerait devant le nom, seule ligne d'un créneau d'une heure.
    expect(bloc.typeLabel).toBeUndefined();
    expect(bloc.reservationTerrain.documentId).toBe('resa-1');
    expect(bloc.participationStatus).toBeNull();
  });

  test('ROUGE-AVANT — hors de la fenêtre lue, pas de bloc ; les deux bornes sont dedans', () => {
    const jours = ['2026-11-01', '2026-11-02', '2026-11-08', '2026-11-09'];
    const blocs = creneauxDeMesReservations(
      t,
      jours.map((date) => reservation({ date, documentId: date })),
      PLAGE,
    );
    expect(blocs.map((bloc) => bloc.documentId)).toEqual(['2026-11-02', '2026-11-08']);
  });

  test('ROUGE-AVANT — demande et collecte se disent, un invité absent ne la voit pas', () => {
    const blocs = creneauxDeMesReservations(t, [
      reservation({ documentId: 'demande', status: 'en_attente' }),
      reservation({ documentId: 'collecte', status: 'en_collecte' }),
      reservation({
        documentId: 'present', myResponse: 'present', role: 'participant',
      }),
      reservation({
        documentId: 'absent', myResponse: 'absent', role: 'participant',
      }),
    ], PLAGE);
    expect(blocs.map((bloc) => [bloc.documentId, bloc.title, bloc.participationStatus]))
      .toEqual([
        ['demande', 'Demande · Complexe Test', 'pending'],
        ['collecte', 'Collecte · Complexe Test', null],
        ['present', 'Complexe Test', null],
      ]);
  });

  test('ROUGE-AVANT — une même réservation lue deux fois ne fait qu\'un bloc', () => {
    const blocs = creneauxDeMesReservations(t, [reservation(), reservation()], PLAGE);
    expect(blocs).toHaveLength(1);
  });

  test('ROUGE-AVANT — une annulée ou une refusée n\'est pas au planning', () => {
    const lues = [
      reservation({ documentId: 'annulee', status: 'annulee' }),
      reservation({ documentId: 'refusee', status: 'refusee' }),
    ];
    expect(creneauxDeMesReservations(t, lues, PLAGE)).toEqual([]);
    expect(estAuPlanning(lues[0])).toBe(false);
    expect(estAuPlanning(reservation())).toBe(true);
    expect(estAuPlanning(reservation({ myResponse: 'absent' }))).toBe(false);
  });

  test('ROUGE-AVANT — les jours à venir comptent pour la vue d\'arrivée, même hors fenêtre', () => {
    const jours = joursDeMesReservationsAVenir([
      reservation(),
      reservation({ documentId: 'absent', myResponse: 'absent' }),
      reservation({ documentId: 'annulee', status: 'annulee' }),
    ]);
    expect(jours).toHaveLength(1);
    expect(jours[0]).toBeInstanceOf(Date);
    expect(joursDeMesReservationsAVenir(undefined)).toEqual([]);
  });

  test('ROUGE-AVANT — rien de lu : aucun bloc, jamais de plantage', () => {
    expect(creneauxDeMesReservations(t, undefined, PLAGE)).toEqual([]);
    expect(creneauxDeMesReservations(t, { data: [] }, PLAGE)).toEqual([]);
  });
});
