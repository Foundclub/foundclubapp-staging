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

// 🏷️ FINITIONS12-COLL (03/10, décision d'Adel « férié B ») — UNE FERMETURE PEUT AVOIR UN NOM
// (« Ascension ») : il passe avant le motif partout où le motif s'affiche — la plage du planning, la
// pastille (listes, accueil), le bandeau (fiche de l'installation, séance). Sans nom : le motif, comme
// avant. Le serveur le garde désormais (admin FIN12-COLL point 12). ROUGE avant le lot.
describe('FINITIONS12-COLL point 12 — le nom d’une fermeture passe avant son motif', () => {
  // eslint-disable-next-line global-require
  const { closureBannerText, closureTagLabel } = require('./facilityClosureDisplay');
  const ASCENSION = {
    endDate: '2027-05-13', kind: 'closure', label: 'Ascension', reason: 'vacances', startDate: '2027-05-13',
  };

  it('la plage, la pastille, le bandeau : « Ascension »', () => {
    expect(closureBandLabel(t, ASCENSION)).toBe('Fermé · Ascension');
    expect(closureTagLabel(t, ASCENSION)).toBe('Fermeture · Ascension');
    expect(closureBannerText(t, ASCENSION, { withDays: true }).texte).toContain('Ascension');
  });

  it('sans nom : le motif, comme avant', () => {
    const sansNom = { ...ASCENSION, label: null };
    expect(closureBandLabel(t, sansNom)).toBe('Fermé · vacances');
    expect(closureTagLabel(t, sansNom)).toBe('Fermeture · vacances');
  });
});

// 🕑 CRFERM (13/10, décision d'Adel « heures : plage », planche P4v4-fermer état 3 bis) — UNE
// FERMETURE PEUT AVOIR DES HEURES : une heure le premier jour, une le dernier (« du vendredi 14:00 au
// lundi 12:00 »). Les mots les disent, le brouillon du planning et ses plages hachurées les suivent,
// comme le serveur (admin CRFERM-3). Un blocage et une journée entière ne changent pas. ROUGE avant.
describe('CRFERM — une fermeture en plage d’heures', () => {
  // eslint-disable-next-line global-require
  const { closureDaysLabel } = require('./facilityClosureDisplay');
  const PLAGE = {
    endDate: '2026-10-19', endTime: '12:00', kind: 'closure', reason: 'travaux', startDate: '2026-10-16', startTime: '14:00',
  };
  const ELECTION = {
    endDate: '2026-10-04', endTime: '20:00', kind: 'closure', startDate: '2026-10-04', startTime: '07:00',
  };

  it('les jours disent leurs heures ; une journée entière, comme avant', () => {
    expect(closureDaysLabel(t, PLAGE, { long: true })).toBe('du vendredi 16 octobre à 14:00 au lundi 19 octobre à 12:00');
    expect(closureDaysLabel(t, PLAGE)).toBe('du ven. 16 oct. à 14:00 au lun. 19 oct. à 12:00');
    expect(closureDaysLabel(t, ELECTION, { long: true })).toBe('dimanche 4 octobre de 07:00 à 20:00');
    expect(closureDaysLabel(t, { ...PLAGE, endTime: null, startTime: null }, { long: true })).toBe('du vendredi 16 octobre au lundi 19 octobre');
    expect(closureHoursLabel(t, PLAGE)).toBe('dès 14:00 · jusqu’à 12:00');
    expect(closureHoursLabel(t, ELECTION)).toBe('07:00 – 20:00');
  });

  it('le brouillon du planning suit les heures : premier jour après, dernier jour avant, le milieu entier', () => {
    const seance = (/** @type {string} */ jour, /** @type {string} */ heureUtc) => ({
      endTime: null, startAt: `${jour}T${heureUtc}:00.000Z`, startTime: null,
    });
    // Octobre avant le 25 : Paris = UTC+2.
    expect(closureTouchesBlock(seance('2026-10-16', '08:00'), PLAGE)).toBe(false);
    expect(closureTouchesBlock(seance('2026-10-16', '16:00'), PLAGE)).toBe(true);
    expect(closureTouchesBlock(seance('2026-10-17', '06:00'), PLAGE)).toBe(true);
    expect(closureTouchesBlock(seance('2026-10-19', '07:00'), PLAGE)).toBe(true);
    expect(closureTouchesBlock(seance('2026-10-19', '17:00'), PLAGE)).toBe(false);
  });

  it('les plages hachurées : le premier jour dès son heure, le dernier jusqu’à la sienne', () => {
    const plages = closureBandsForRange(
      [PLAGE],
      { from: '2026-10-12', to: '2026-10-19' },
      { closing: 22 * 60, opening: 8 * 60 },
      () => 'Fermé · travaux',
    );
    expect(plages.map((plage) => [new Date(plage.startAt).getHours(), new Date(plage.endAt).getHours()])).toEqual([
      [14, 22], [8, 22], [8, 22], [8, 12],
    ]);
  });
});
