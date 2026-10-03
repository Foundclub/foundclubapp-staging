/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import {
  closureBandLabel,
  closureBandsForRange,
  closureCoversDay,
  closureHoursLabel,
  closureOfDay,
  closureTouchesBlock,
  touchedSessionLine,
} from './facilityClosureDisplay';

// 🧪 COLL-C4B-BIS (03/10/2026) — le domaine des fermetures n avait AUCUN temoin (E6 de CLAUDE.md) :
// celui-ci decrit d abord ce qu il fait (VERT avant le lot), puis le point 5 de la planche 25 :
//   « la carte de la fermeture n affiche pas d heure » — capture du relais de la tournee T10
//   (`_capture_corps.log`, l.119) : une seance SANS heure de fin rend `endTime: null`, et la ligne
//   perdait ALORS les deux heures (« AS Montrivage · U15 »). ROUGE avant le lot.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

const i18n = i18nextTemoin.default || i18nextTemoin;
i18n.init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});
const t = (/** @type {any[]} */ ...args) => i18n.t(...args);

describe('facilityClosureDisplay — ce qu il faisait deja (caracterisation)', () => {
  it('une seance touchee, avec ses deux heures ; le jour en plus quand on le demande', () => {
    const seance = {
      club: { name: 'Montrivage FC' }, date: '2026-10-02', endTime: '19:30', startTime: '18:00', team: { name: 'Senior B' },
    };
    expect(touchedSessionLine(seance)).toBe('Montrivage FC · Senior B, 18:00 – 19:30');
    expect(touchedSessionLine(seance, { withDay: true })).toBe('Montrivage FC · Senior B, ven. 2 oct. 18:00 – 19:30');
  });

  it('les heures, le libelle de la plage, le jour couvert', () => {
    expect(closureHoursLabel(t, { kind: 'closure' })).toBe('Toute la journée');
    expect(closureHoursLabel(t, { endTime: '13:00:00', kind: 'block', startTime: '09:00:00' })).toBe('09:00 – 13:00');
    expect(closureBandLabel(t, { kind: 'closure', reason: 'travaux' })).toBe('Fermé · travaux');
    expect(closureBandLabel(t, { kind: 'block', label: 'Forum' })).toBe('Bloqué par la Ville · Forum');
    expect(closureCoversDay({ endDate: '2026-10-25', startDate: '2026-10-17' }, '2026-10-20')).toBe(true);
    expect(closureCoversDay({ endDate: '2026-10-25', startDate: '2026-10-17' }, '2026-10-26')).toBe(false);
  });

  it('les plages d une fenetre : une par jour couvert, sans id ni documentId', () => {
    const plages = closureBandsForRange(
      [{
        endDate: '2026-10-03', kind: 'closure', reason: 'travaux', startDate: '2026-10-02',
      }],
      { from: '2026-09-28', to: '2026-10-04' },
      { closing: 22 * 60, opening: 8 * 60 },
      () => 'Fermé · travaux',
    );
    expect(plages).toHaveLength(2);
    expect(plages[0].documentId).toBeNull();
    expect(new Date(plages[0].startAt).getHours()).toBe(8);
    expect(new Date(plages[0].endAt).getHours()).toBe(22);
  });
});

describe('facilityClosureDisplay — COLL-C4B-BIS', () => {
  it('point 5 : une seance sans heure de fin garde son heure de debut', () => {
    expect(touchedSessionLine({
      club: { name: 'AS Montrivage' }, date: '2026-10-07', endTime: null, kind: 'event', startTime: '18:00', team: { name: 'U15' },
    })).toBe('AS Montrivage · U15, 18:00');
  });

  it('point 1 : la regle du serveur pour le brouillon — jour couvert ; blocage = heures qui se chevauchent', () => {
    const seance = {
      endTime: '19:30:00.000', startAt: '2026-10-02T16:00:00.000Z', startTime: '18:00:00.000',
    };
    expect(closureTouchesBlock(seance, { endDate: '2026-10-02', kind: 'closure', startDate: '2026-10-02' })).toBe(true);
    expect(closureTouchesBlock(seance, { endDate: '2026-10-03', kind: 'closure', startDate: '2026-10-03' })).toBe(false);
    expect(closureTouchesBlock(seance, {
      endDate: '2026-10-02', endTime: '19:00', kind: 'block', startDate: '2026-10-02', startTime: '17:00',
    })).toBe(true);
    expect(closureTouchesBlock(seance, {
      endDate: '2026-10-02', endTime: '18:00', kind: 'block', startDate: '2026-10-02', startTime: '09:00',
    })).toBe(false);
    expect(closureTouchesBlock({ ...seance, raw: { closureBand: {} } }, { endDate: '2026-10-02', kind: 'closure', startDate: '2026-10-02' })).toBe(false);
  });

  it('point 4 : la fermeture d un jour — toute la journee d abord, sinon le blocage', () => {
    const fermeture = { endDate: '2026-10-02', kind: 'closure', startDate: '2026-10-02' };
    const blocage = {
      endDate: '2026-10-02', endTime: '13:00', kind: 'block', startDate: '2026-10-02', startTime: '09:00',
    };
    expect(closureOfDay([blocage, fermeture], '2026-10-02')).toBe(fermeture);
    expect(closureOfDay([blocage], '2026-10-02')).toBe(blocage);
    expect(closureOfDay([blocage], '2026-10-03')).toBeNull();
  });
});
