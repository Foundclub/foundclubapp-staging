/* eslint-disable max-len -- les témoins se lisent en entier. */
import { getWithdrawalWindow } from '../tournamentWithdrawal';

// IMPL-2-EQUIPE (18/11/2026, planches 10c et 10d ; CGV § 5, Adel « 4- A » du 18/11) — quitter
// après avoir payé : remboursement intégral jusqu'au 5 décembre inclus (J−14 du tournoi du 19/12),
// puis cession possible jusqu'au 17/12 (J−2), puis plus rien. Les bornes se lisent en heure de Paris.

const TOURNOI = '2026-12-19T18:00:00.000Z'; // 19/12 à 19 h, heure de Paris.

describe('getWithdrawalWindow — les bornes des conditions d’inscription', () => {
  test('le 05/12 à 23:59 (Paris) : encore remboursé, « 5 décembre »', () => {
    const r = getWithdrawalWindow({ eventDate: TOURNOI, now: new Date('2026-12-05T22:59:00.000Z') });
    expect(r).toMatchObject({ cessionDate: '17 décembre', phase: 'refund', refundDate: '5 décembre' });
  });

  test('le 06/12 à 00:00 (Paris) : plus remboursé, cession possible ; « Depuis le 6 décembre »', () => {
    const r = getWithdrawalWindow({ eventDate: TOURNOI, now: new Date('2026-12-05T23:00:00.000Z') });
    expect(r).toMatchObject({ noRefundDate: '6 décembre', phase: 'cession' });
  });

  test('le 17/12 à 23:59 (Paris) : cession encore possible', () => {
    expect(getWithdrawalWindow({ eventDate: TOURNOI, now: new Date('2026-12-17T22:59:00.000Z') }).phase).toBe('cession');
  });

  test('le 18/12 à 00:00 (Paris) : plus de cession', () => {
    expect(getWithdrawalWindow({ eventDate: TOURNOI, now: new Date('2026-12-17T23:00:00.000Z') }).phase).toBe('after');
  });

  test('aujourd’hui (18/11) : remboursé', () => {
    expect(getWithdrawalWindow({ eventDate: TOURNOI, now: new Date('2026-11-18T12:00:00.000Z') }).phase).toBe('refund');
  });

  test('sans date de tournoi : « unknown » (la page garde la phrase générale)', () => {
    expect(getWithdrawalWindow({ eventDate: null, now: new Date() })).toEqual({ phase: 'unknown' });
    expect(getWithdrawalWindow({ eventDate: 'pas une date', now: new Date() })).toEqual({ phase: 'unknown' });
  });
});
